import { supabase } from "@/integrations/supabase/client";

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  return Notification.requestPermission();
}

export async function notify(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  if ("serviceWorker" in navigator) {
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(title, { body, icon: "/pwa-192x192.png", badge: "/pwa-192x192.png" });
    return;
  }
  new Notification(title, { body });
}

export async function registerPushSubscription(userId: string) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
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
}

