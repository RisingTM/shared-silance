export type StatusGroup = "faith" | "strength" | "hard" | "gentle" | "love";

export const STATUS_GROUPS: { key: StatusGroup; label: string }[] = [
  { key: "faith", label: "Faith" },
  { key: "strength", label: "Strength" },
  { key: "hard", label: "Hard days" },
  { key: "gentle", label: "Gentle days" },
  { key: "love", label: "Love" },
];

export const STATUS_OPTIONS = [
  // Faith
  { key: "dua_for_you", emoji: "🤲", label: "I made dua for you today", group: "faith" },
  { key: "peace_plan", emoji: "🌿", label: "I'm at peace with Allah's plan", group: "faith" },
  { key: "close_allah", emoji: "🌙", label: "today I felt close to Allah", group: "faith" },
  { key: "his_timing", emoji: "⏳", label: "I'm trusting His timing", group: "faith" },
  { key: "mercy", emoji: "✨", label: "I felt Allah's mercy today", group: "faith" },
  { key: "name_in_dua", emoji: "📿", label: "today I wrote your name in my dua", group: "faith" },
  { key: "trusting", emoji: "🌊", label: "I'm trusting the process", group: "faith" },

  // Strength
  { key: "strong", emoji: "💪", label: "I'm staying strong", group: "strength" },
  { key: "not_giving_up", emoji: "🪷", label: "I'm not giving up on us", group: "strength" },
  { key: "for_us", emoji: "💛", label: "I'm doing this for us", group: "strength" },
  { key: "stronger_today", emoji: "🔥", label: "I'm stronger than yesterday", group: "strength" },
  { key: "patience", emoji: "🕊️", label: "today I chose patience", group: "strength" },
  { key: "holding_tighter", emoji: "🤍", label: "I'm holding on tighter today", group: "strength" },
  { key: "becoming_who", emoji: "🌱", label: "I'm becoming who you deserve", group: "strength" },
  { key: "felt_strong", emoji: "⚡", label: "I felt strong today", group: "strength" },
  { key: "still_choosing", emoji: "💎", label: "I'm still choosing this every day", group: "strength" },
  { key: "proud", emoji: "✨", label: "I'm proud of us", group: "strength" },

  // Hard days
  { key: "hard", emoji: "🌧️", label: "it's a hard day", group: "hard" },
  { key: "heavy", emoji: "🪨", label: "today was heavy", group: "hard" },
  { key: "here", emoji: "🫂", label: "I'm not okay but I'm here", group: "hard" },
  { key: "absence", emoji: "🌫️", label: "today I felt your absence", group: "hard" },
  { key: "hurt_still_here", emoji: "🥀", label: "today hurt but I'm still here", group: "hard" },

  // Gentle days
  { key: "okay", emoji: "🌿", label: "I'm ok", group: "gentle" },
  { key: "gentle", emoji: "🌸", label: "today was gentle", group: "gentle" },
  { key: "quiet", emoji: "🤍", label: "today was quiet", group: "gentle" },
  { key: "healing", emoji: "🌱", label: "I'm healing", group: "gentle" },
  { key: "peace", emoji: "🕊️", label: "I'm at peace today", group: "gentle" },
  { key: "soft_still", emoji: "🪶", label: "today was soft and still", group: "gentle" },
  { key: "better_bcs_you", emoji: "💫", label: "today was better because of you", group: "gentle" },
  { key: "step_forward", emoji: "🌤️", label: "today was a step forward", group: "gentle" },
  { key: "worth_it", emoji: "🌷", label: "today was worth it", group: "gentle" },
  { key: "reminder_why", emoji: "💭", label: "today was a reminder why", group: "gentle" },
  { key: "learning", emoji: "📖", label: "I'm learning through this", group: "gentle" },

  // Love
  { key: "miss", emoji: "🌙", label: "I miss you", group: "love" },
  { key: "praying", emoji: "🤲", label: "I'm praying for you", group: "love" },
  { key: "thinking", emoji: "💭", label: "I'm thinking of you", group: "love" },
  { key: "proud_of_you", emoji: "🌟", label: "I'm proud of you", group: "love" },
  { key: "proud_you", emoji: "💛", label: "I am proud of you", group: "love" },
  { key: "smiled", emoji: "😊", label: "I smiled thinking of you today", group: "love" },
  { key: "reminded_me", emoji: "🌅", label: "today reminded me of you", group: "love" },
  { key: "holding_us", emoji: "🤍", label: "I'm holding us close today", group: "love" },
  { key: "carrying_you", emoji: "💗", label: "I'm carrying you in my heart", group: "love" },
  { key: "grateful", emoji: "🌹", label: "I'm grateful we found each other", group: "love" },
  { key: "promise", emoji: "🔗", label: "I'm keeping my promise today", group: "love" },
  { key: "patient_us", emoji: "⏳", label: "I'm being patient for us", group: "love" },
  { key: "full_of_hope", emoji: "🌈", label: "today was full of hope", group: "love" },

  // Legacy keys kept for backwards compatibility (existing rows in DB)
  { key: "trying", emoji: "🌤️", label: "I'm trying my best", group: "gentle" },
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

export function daysAndHoursFromMs(ms: number): { days: number; hours: number } {
  const safe = Math.max(0, ms);
  const days = Math.floor(safe / 86400000);
  const hours = Math.floor((safe % 86400000) / 3600000);
  return { days, hours };
}

export function daysAndHoursBetween(startISO: string): { days: number; hours: number } {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(startISO) ? startISO + "T00:00:00" : startISO;
  const start = new Date(iso).getTime();
  return daysAndHoursFromMs(Date.now() - start);
}

export function ncElapsedMs(opts: {
  startAt: string;
  isPaused?: boolean;
  pausedAt?: string | null;
  pausedTotalSeconds?: number | null;
}): number {
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(opts.startAt) ? opts.startAt + "T00:00:00" : opts.startAt;
  const base = new Date(iso).getTime();
  const endpoint = opts.isPaused && opts.pausedAt ? new Date(opts.pausedAt).getTime() : Date.now();
  const pausedMs = (opts.pausedTotalSeconds ?? 0) * 1000;
  return Math.max(0, endpoint - base - pausedMs);
}
