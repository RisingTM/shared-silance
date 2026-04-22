// Compute days until next occurrence of a birthday (month/day only).
// Returns null if date is invalid/empty, 0 if today, otherwise positive integer.
export function daysUntilNextBirthday(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = new Date(today.getFullYear(), d.getMonth(), d.getDate());
  if (next.getTime() < today.getTime()) {
    next = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
  }
  const ms = next.getTime() - today.getTime();
  return Math.round(ms / 86400000);
}

export function formatBirthdayCountdown(days: number | null, isSelf: boolean): string {
  if (days === null) return "not set yet";
  if (days === 0) {
    return isSelf ? "🎂 it's your birthday today 🤍" : "🎂 it's their birthday today 🤍";
  }
  if (days === 1) return "🎂 1 day away";
  return `🎂 ${days} days away`;
}
