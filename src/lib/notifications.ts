import { supabase } from "@/integrations/supabase/client";

function supported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!supported()) return "unsupported";
  const current = Notification.permission;
  if (current === "granted" || current === "denied") return current;
  try {
    return await Notification.requestPermission();
  } catch {
    return "default";
  }
}

export async function notify(title: string, body: string, url?: string) {
  if (!supported()) return;
  if (Notification.permission !== "granted") return;
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        data: { url: url ?? "/today" },
      });
      return;
    }
    new Notification(title, { body });
  } catch {
    /* fail silently */
  }
}

export async function registerPushSubscription(userId: string) {
  if (typeof navigator === "undefined") return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    const json = sub.toJSON();
    await supabase.from("push_subscriptions").insert({
      user_id: userId,
      endpoint: json.endpoint ?? "",
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
    });
  } catch {
    /* ignore */
  }
}

// Schedule a one-shot reminder at the next occurrence of "HH:MM",
// then re-schedule every 24h. Returns a cleanup function.
export function scheduleDailyReminder(time: string, body = "You haven't written today yet 🤍") {
  if (!supported()) return () => undefined;
  const [hStr, mStr] = (time || "21:00").split(":");
  const h = Number(hStr) || 21;
  const m = Number(mStr) || 0;

  let timeoutId: number | undefined;
  let intervalId: number | undefined;

  const ms = (() => {
    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    return target.getTime() - now.getTime();
  })();

  timeoutId = window.setTimeout(() => {
    notify("Our Journey", body).catch(() => undefined);
    intervalId = window.setInterval(
      () => notify("Our Journey", body).catch(() => undefined),
      24 * 60 * 60 * 1000,
    );
  }, ms);

  return () => {
    if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    if (intervalId !== undefined) window.clearInterval(intervalId);
  };
}
