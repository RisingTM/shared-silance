// In-memory + sessionStorage flag for the Us page unlock state.
// Cleared automatically when the tab closes.
const KEY = "shared-silance:us-unlocked";

export function isUsUnlocked(journeyId: string | undefined | null): boolean {
  if (!journeyId || typeof window === "undefined") return false;
  return window.sessionStorage.getItem(`${KEY}:${journeyId}`) === "1";
}

export function markUsUnlocked(journeyId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(`${KEY}:${journeyId}`, "1");
}

export function clearUsUnlocked(journeyId: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(`${KEY}:${journeyId}`);
}
