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
  talkingSince: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
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
      .insert({ nc_start_date: data.ncStartDate, talking_since: data.talkingSince })
      .select()
      .single();
    if (jErr || !journey) throw new Error(jErr?.message ?? "Failed to create journey");

    // Owner profile (owner auth account is created with an internal email)
    const { data: ownerUser } = await supabaseAdmin.auth.admin.getUserById(ownerId);
    const metadataUsername = (ownerUser?.user?.user_metadata?.username as string | undefined)?.toLowerCase().trim();
    const ownerEmailLocal = (ownerUser?.user?.email ?? "owner").split("@")[0].toLowerCase().replace(/[^a-z0-9_.-]/g, "");
    const ownerUsername = (metadataUsername || ownerEmailLocal || `owner_${ownerId.slice(0, 6)}`).replace(/[^a-z0-9_.-]/g, "");

    const { data: ownerTaken } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", ownerUsername)
      .maybeSingle();
    if (ownerTaken) throw new Error("Your username is already taken");

    const { error: opErr } = await supabaseAdmin.from("profiles").insert({
      id: ownerId,
      journey_id: journey.id,
      username: ownerUsername,
      display_name: data.ownerDisplayName,
      role: "owner",
      must_set_password: false,
      is_claimed: true,
    });
    if (opErr) throw new Error(opErr.message);

    // Create partner auth user with temporary random password.
    // Partner will claim their account by setting their own password later.
    const partnerEmail = `${data.partnerUsername.toLowerCase()}@internal.app`;
    const { data: partnerCreated, error: pErr } = await supabaseAdmin.auth.admin.createUser({
      email: partnerEmail,
      password: `${crypto.randomUUID()}Aa1!`,
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
      is_claimed: false,
    });
    if (ppErr) throw new Error(ppErr.message);

    return { ok: true, partnerUsername: data.partnerUsername.toLowerCase() };
  });

// ----- Username login helper: resolves username -> internal email -----
const loginSchema = z.object({
  username: z.string().trim().min(2).max(40),
});

export const partnerEmailForUsername = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof loginSchema>) => loginSchema.parse(d))
  .handler(async ({ data }) => {
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, must_set_password, is_claimed")
      .eq("username", data.username.toLowerCase())
      .maybeSingle();
    if (error || !profile) throw new Error("Username not found");
    const { data: u } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (!u.user?.email) throw new Error("Account not configured");
    return {
      email: u.user.email,
      mustSetPassword: !!profile.must_set_password,
      isClaimed: profile.is_claimed ?? true,
    };
  });

const claimSchema = z.object({
  username: z.string().trim().min(2).max(40),
  newPassword: z.string().min(8).max(120),
});

export const claimPartnerPassword = createServerFn({ method: "POST" })
  .inputValidator((d: z.infer<typeof claimSchema>) => claimSchema.parse(d))
  .handler(async ({ data }) => {
    const username = data.username.toLowerCase();
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("id, is_claimed")
      .eq("username", username)
      .eq("role", "partner")
      .maybeSingle();
    if (error || !profile) throw new Error("Partner account not found");
    if (profile.is_claimed) throw new Error("This account is already claimed. Please sign in.");

    const { error: pwdErr } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: data.newPassword,
    });
    if (pwdErr) throw new Error(pwdErr.message);

    const { error: profileErr } = await supabaseAdmin
      .from("profiles")
      .update({ must_set_password: false, is_claimed: true })
      .eq("id", profile.id);
    if (profileErr) throw new Error(profileErr.message);

    return { ok: true };
  });

// ----- Update your own password -----
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

// ----- Reset NC counter (either user can do this) -----
const resetSchema = z.object({
  brokenBy: z.enum(["him", "her"]),
  note: z.string().trim().max(500).optional(),
});

const allowPrivateDeletesSchema = z.object({
  allow: z.boolean(),
});

export const setAllowPrivateDeletes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof allowPrivateDeletesSchema>) => allowPrivateDeletesSchema.parse(d))
  .handler(async ({ context, data }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("journey_id, role")
      .eq("id", context.userId)
      .maybeSingle();
    if (!profile || profile.role !== "owner") throw new Error("Only the owner can update this setting.");
    const { error } = await supabaseAdmin.from("journeys").update({ allow_private_deletes: data.allow }).eq("id", profile.journey_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ----- Notify partner of a new today-update (best-effort web push) -----
const notifySchema = z.object({
  partnerId: z.string().uuid(),
  message: z.string().trim().min(1).max(200),
});

export const notifyPartnerUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof notifySchema>) => notifySchema.parse(d))
  .handler(async ({ data }) => {
    // We don't have web-push configured (no VAPID keys), so this is a no-op
    // server-side stub. Subscriptions are still recorded so this can be
    // wired to a sender later. Return ok so the client doesn't error.
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("id")
      .eq("user_id", data.partnerId);
    return { ok: true, subscribers: subs?.length ?? 0 };
  });

export const resetCounter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof resetSchema>) => resetSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: profile } = await supabase.from("profiles").select("journey_id").eq("id", context.userId).single();
    if (!profile) throw new Error("No journey");
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const { error: brkErr } = await supabaseAdmin
      .from("nc_breaks")
      .insert({ journey_id: profile.journey_id, broken_by: data.brokenBy, note: data.note ?? null, kind: "reset" });
    if (brkErr) throw new Error(brkErr.message);
    const { error: jErr } = await supabaseAdmin
      .from("journeys")
      .update({
        nc_start_date: today,
        nc_start_at: nowIso,
        has_been_reset: true,
        is_paused: false,
        paused_at: null,
        paused_total_seconds: 0,
      })
      .eq("id", profile.journey_id);
    if (jErr) throw new Error(jErr.message);
    return { ok: true };
  });

// ----- Pause / resume the NC counter (either user) -----
export const pauseCounter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("journey_id, role")
      .eq("id", context.userId)
      .single();
    if (!profile) throw new Error("No journey");
    const { data: j } = await supabaseAdmin
      .from("journeys")
      .select("is_paused")
      .eq("id", profile.journey_id)
      .single();
    if (j?.is_paused) throw new Error("Counter is already paused");
    const nowIso = new Date().toISOString();
    const { error: jErr } = await supabaseAdmin
      .from("journeys")
      .update({ is_paused: true, paused_at: nowIso })
      .eq("id", profile.journey_id);
    if (jErr) throw new Error(jErr.message);
    await supabaseAdmin
      .from("nc_breaks")
      .insert({ journey_id: profile.journey_id, broken_by: profile.role === "owner" ? "him" : "her", kind: "pause", note: null });
    return { ok: true };
  });

export const resumeCounter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("journey_id, role")
      .eq("id", context.userId)
      .single();
    if (!profile) throw new Error("No journey");
    const { data: j } = await supabaseAdmin
      .from("journeys")
      .select("is_paused, paused_at, paused_total_seconds")
      .eq("id", profile.journey_id)
      .single();
    if (!j?.is_paused || !j.paused_at) throw new Error("Counter is not paused");
    const deltaSec = Math.max(0, Math.floor((Date.now() - new Date(j.paused_at).getTime()) / 1000));
    const newTotal = (j.paused_total_seconds ?? 0) + deltaSec;
    const { error: jErr } = await supabaseAdmin
      .from("journeys")
      .update({ is_paused: false, paused_at: null, paused_total_seconds: newTotal })
      .eq("id", profile.journey_id);
    if (jErr) throw new Error(jErr.message);
    await supabaseAdmin
      .from("nc_breaks")
      .insert({ journey_id: profile.journey_id, broken_by: profile.role === "owner" ? "him" : "her", kind: "resume", note: null });
    return { ok: true };
  });
