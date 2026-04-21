import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// ----- Owner: complete journey setup after signing up -----
// Creates the journey, owner profile, and the partner's auth user (no password) + profile.
const setupSchema = z.object({
  ownerDisplayName: z.string().trim().min(1).max(60),
  partnerUsername: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, . _ - only"),
  partnerDisplayName: z.string().trim().min(1).max(60),
  ncStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const setupJourney = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof setupSchema>) => setupSchema.parse(d))
  .handler(async ({ data, context }) => {
    const ownerId = context.userId;

    // Already set up?
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("id", ownerId)
      .maybeSingle();
    if (existing) throw new Error("Journey already set up");

    // Username taken?
    const { data: taken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", data.partnerUsername.toLowerCase())
      .maybeSingle();
    if (taken) throw new Error("That username is already taken");

    // Create journey
    const { data: journey, error: jErr } = await supabaseAdmin
      .from("journeys")
      .insert({ nc_start_date: data.ncStartDate })
      .select()
      .single();
    if (jErr || !journey) throw new Error(jErr?.message ?? "Failed to create journey");

    // Owner profile (owner has email already)
    const { data: ownerUser } = await supabaseAdmin.auth.admin.getUserById(ownerId);
    const ownerEmailLocal = (ownerUser?.user?.email ?? "owner").split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    const ownerUsername = ownerEmailLocal || `owner_${ownerId.slice(0, 6)}`;

    const { error: opErr } = await supabaseAdmin.from("profiles").insert({
      id: ownerId,
      journey_id: journey.id,
      username: ownerUsername,
      display_name: data.ownerDisplayName,
      role: "owner",
      must_set_password: false,
    });
    if (opErr) throw new Error(opErr.message);

    // Create partner auth user with synthetic email + temp password
    const partnerEmail = `${data.partnerUsername.toLowerCase()}@journey.local`;
    const tempPassword = crypto.randomUUID() + "Aa1!";
    const { data: partnerCreated, error: pErr } = await supabaseAdmin.auth.admin.createUser({
      email: partnerEmail,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { username: data.partnerUsername.toLowerCase(), partner: true },
    });
    if (pErr || !partnerCreated.user) throw new Error(pErr?.message ?? "Failed to create partner");

    const { error: ppErr } = await supabaseAdmin.from("profiles").insert({
      id: partnerCreated.user.id,
      journey_id: journey.id,
      username: data.partnerUsername.toLowerCase(),
      display_name: data.partnerDisplayName,
      role: "partner",
      must_set_password: true,
    });
    if (ppErr) throw new Error(ppErr.message);

    return { ok: true, partnerUsername: data.partnerUsername.toLowerCase(), tempPassword };
  });

// ----- Partner: log in by username (server resolves to email) -----
const loginSchema = z.object({
  username: z.string().trim().min(2).max(40),
});

export const partnerEmailForUsername = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof loginSchema>) => loginSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, role")
      .eq("username", data.username.toLowerCase())
      .maybeSingle();
    if (error || !profile) throw new Error("Username not found");
    if (profile.role !== "partner") throw new Error("This account uses email login");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (!u.user?.email) throw new Error("Account not configured");
    return { email: u.user.email };
  });

// ----- Partner first-login: get their bootstrap temp password -----
// Owner sees this once after setup; partner uses it once to log in, then sets her own.
// We store a hint by re-deriving via admin reset; simpler: owner shares the temp password.
// Here we provide an endpoint to update the partner's password after authentication.
const setPwdSchema = z.object({ newPassword: z.string().min(8).max(120) });

export const setOwnPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof setPwdSchema>) => setPwdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.newPassword,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ must_set_password: false })
      .eq("id", userId);
    return { ok: true };
  });

// ----- Owner: regenerate partner's temp password (in case it was lost) -----
export const regeneratePartnerTempPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const ownerId = context.userId;
    const { data: ownerProfile } = await supabaseAdmin
      .from("profiles")
      .select("journey_id, role")
      .eq("id", ownerId)
      .single();
    if (!ownerProfile || ownerProfile.role !== "owner") throw new Error("Only the owner can do this");

    const { data: partner } = await supabaseAdmin
      .from("profiles")
      .select("id, username")
      .eq("journey_id", ownerProfile.journey_id)
      .eq("role", "partner")
      .single();
    if (!partner) throw new Error("Partner not found");

    const tempPassword = crypto.randomUUID() + "Aa1!";
    const { error } = await supabaseAdmin.auth.admin.updateUserById(partner.id, {
      password: tempPassword,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ must_set_password: true })
      .eq("id", partner.id);

    return { username: partner.username, tempPassword };
  });

// ----- Reset NC counter (either user can do this) -----
const resetSchema = z.object({
  brokenBy: z.enum(["him", "her"]),
  note: z.string().trim().max(500).optional(),
});

export const resetCounter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof resetSchema>) => resetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile } = await supabase.from("profiles").select("journey_id").eq("id", context.userId).single();
    if (!profile) throw new Error("No journey");
    const today = new Date().toISOString().slice(0, 10);
    const { error: brkErr } = await supabaseAdmin
      .from("nc_breaks")
      .insert({ journey_id: profile.journey_id, broken_by: data.brokenBy, note: data.note ?? null });
    if (brkErr) throw new Error(brkErr.message);
    const { error: jErr } = await supabaseAdmin
      .from("journeys")
      .update({ nc_start_date: today, has_been_reset: true })
      .eq("id", profile.journey_id);
    if (jErr) throw new Error(jErr.message);
    return { ok: true };
  });
