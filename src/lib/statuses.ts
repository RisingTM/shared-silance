export const STATUS_OPTIONS = [
  { key: "okay", emoji: "🌿", label: "I'm ok" },
  { key: "praying", emoji: "🤲", label: "I'm praying for you" },
  { key: "miss", emoji: "🌙", label: "I miss you" },
  { key: "strong", emoji: "💪", label: "I'm staying strong" },
  { key: "hard", emoji: "🌧️", label: "It's a hard day" },
  { key: "proud", emoji: "✨", label: "I'm proud of us" },
  { key: "peace", emoji: "🕊️", label: "I'm at peace today" },
  { key: "gentle", emoji: "🌸", label: "Today was gentle" },
  { key: "healing", emoji: "🌱", label: "I'm healing" },
  { key: "trying", emoji: "🌤️", label: "I'm trying my best" },
  { key: "heavy", emoji: "🪨", label: "Today was heavy" },
  { key: "here", emoji: "🫂", label: "I'm not okay but I'm here" },
  { key: "trusting", emoji: "🌊", label: "I'm trusting the process" },
  { key: "felt_strong", emoji: "🔥", label: "I felt strong today" },
  { key: "quiet", emoji: "🤍", label: "Today was quiet" },
  { key: "proud_you", emoji: "💛", label: "I am proud of you" },
] as const;

export type StatusKey = (typeof STATUS_OPTIONS)[number]["key"];

export const MILESTONES = [7, 14, 21, 30, 60, 90, 180, 365];

export const MOOD_EMOJIS = ["😊", "🙂", "😐", "😔", "😢", "😤", "🤲", "✨"];

export function statusMeta(key: string) {
  return STATUS_OPTIONS.find((s) => s.key === key) ?? STATUS_OPTIONS[0];
}

export function daysBetween(startISO: string): number {
  const start = new Date(startISO + "T00:00:00Z");
  const today = new Date();
  const todayUTC = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.max(0, Math.floor((todayUTC - start.getTime()) / 86400000));
}

// Days + hours since the given date (treated as local midnight).
export function daysAndHoursBetween(startISO: string): { days: number; hours: number } {
  const start = new Date(startISO + "T00:00:00").getTime();
  const ms = Math.max(0, Date.now() - start);
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  return { days, hours };
}
