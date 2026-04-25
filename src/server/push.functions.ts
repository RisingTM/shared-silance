import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { z } from "zod";
import webpush from "web-push";

const sendSchema = z.object({
  partnerId: z.string().uuid(),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(240),
  url: z.string().trim().max(200).optional(),
});

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const sub = process.env.VAPID_SUBJECT || "mailto:notify@app.local";
  if (!pub || !priv) throw new Error("Push not configured (missing VAPID keys)");
  webpush.setVapidDetails(sub, pub, priv);
  configured = true;
}

export const sendPushToPartner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: z.infer<typeof sendSchema>) => sendSchema.parse(d))
  .handler(async ({ data }) => {
    try {
      configure();
    } catch {
      // Silently no-op if VAPID isn't set up.
      return { ok: true, sent: 0, skipped: true };
    }
    const { data: subs } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", data.partnerId);
    if (!subs?.length) return { ok: true, sent: 0 };

    const payload = JSON.stringify({
      title: data.title,
      body: data.body,
      url: data.url ?? "/today",
    });

    let sent = 0;
    const dead: string[] = [];
    await Promise.all(
      subs.map(async (s: any) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
          );
          sent += 1;
        } catch (err: any) {
          if (err?.statusCode === 404 || err?.statusCode === 410) dead.push(s.id);
        }
      }),
    );
    if (dead.length) {
      await supabaseAdmin.from("push_subscriptions").delete().in("id", dead);
    }
    return { ok: true, sent };
  });
