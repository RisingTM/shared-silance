import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import bcrypt from "bcryptjs";

const setPwdSchema = z.object({ password: z.string().min(6).max(120) });

async function getJourneyForUser(userId: string) {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("journey_id, role")
    .eq("id", userId)
    .single();
  if (!profile) throw new Error("No journey");
  return profile;
}

export const setUsPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof setPwdSchema>) => setPwdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const profile = await getJourneyForUser(context.userId);
    const { data: j } = await supabaseAdmin
      .from("journeys")
      .select("us_password_hash")
      .eq("id", profile.journey_id)
      .single();
    if (j?.us_password_hash) throw new Error("Us password is already set");
    const hash = await bcrypt.hash(data.password, 10);
    const { error } = await supabaseAdmin
      .from("journeys")
      .update({ us_password_hash: hash })
      .eq("id", profile.journey_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const verifyUsPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof setPwdSchema>) => setPwdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const profile = await getJourneyForUser(context.userId);
    const { data: j } = await supabaseAdmin
      .from("journeys")
      .select("us_password_hash")
      .eq("id", profile.journey_id)
      .single();
    if (!j?.us_password_hash) throw new Error("No Us password set yet");
    const ok = await bcrypt.compare(data.password, j.us_password_hash);
    if (!ok) throw new Error("Wrong password");
    return { ok: true };
  });

export const resetUsPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getJourneyForUser(context.userId);
    if (profile.role !== "owner") throw new Error("Only the owner can reset the Us password");
    const { error } = await supabaseAdmin
      .from("journeys")
      .update({ us_password_hash: null })
      .eq("id", profile.journey_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const usPasswordStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const profile = await getJourneyForUser(context.userId);
    const { data: j } = await supabaseAdmin
      .from("journeys")
      .select("us_password_hash")
      .eq("id", profile.journey_id)
      .single();
    return { isSet: !!j?.us_password_hash };
  });

// ----- Studying syllabus -----
const syllabusSchema = z.object({
  modules: z.array(
    z.object({
      name: z.string().min(1),
      branches: z.array(
        z.object({ name: z.string().min(1), items: z.array(z.string().min(1)) }),
      ),
    }),
  ),
});

export const replaceSyllabus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof syllabusSchema>) => syllabusSchema.parse(d))
  .handler(async ({ data, context }) => {
    const profile = await getJourneyForUser(context.userId);
    if (profile.role !== "owner") throw new Error("Only the owner can edit the syllabus");
    const { error } = await supabaseAdmin
      .from("us_syllabus")
      .upsert(
        [
          {
            journey_id: profile.journey_id,
            content: data.modules as unknown as object,
            imported_by: context.userId,
            imported_at: new Date().toISOString(),
          },
        ],
        { onConflict: "journey_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });
