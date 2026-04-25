// Public VAPID key — safe to ship to the client. The matching private key
// is stored as a server-only secret and used by the push sender.
export const VAPID_PUBLIC_KEY =
  "BKHM0zoCggbNfs0FCkDU3ls20rgfupOhNyWMVClh4UlLlkU0rRCYR-CrmpEf0oPyecNfMn6puO2hzVqFKT1o4xI";

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}
