export const STATUS_OPTIONS = [
  { key: "okay", emoji: "🌿", label: "I'm okay" },
  { key: "praying", emoji: "🤲", label: "I'm praying for you" },
  { key: "miss", emoji: "🌙", label: "I miss you" },
  { key: "strong", emoji: "💪", label: "I'm staying strong" },
  { key: "hard", emoji: "🌧️", label: "It's a hard day" },
  { key: "proud", emoji: "✨", label: "I'm proud of us" },
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
