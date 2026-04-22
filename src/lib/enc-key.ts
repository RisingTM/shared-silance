// Auto-derived per-user encryption passphrase.
// Stored in localStorage on first use so the same user always gets the same key
// across sessions on the same device. The key itself is derived from the user's
// stable auth id plus a fixed app secret — users never see or manage it.

const APP_SECRET = "shared-silance:v1:auto-enc";

function storageKey(userId: string) {
  return `shared-silance:auto-enc-key:${userId}`;
}

export function getUserEncKey(userId: string | null | undefined): string {
  if (!userId) return "";
  if (typeof window === "undefined") return `${APP_SECRET}:${userId}`;
  const k = storageKey(userId);
  let existing = window.localStorage.getItem(k);
  if (!existing) {
    existing = `${APP_SECRET}:${userId}`;
    window.localStorage.setItem(k, existing);
  }
  return existing;
}
