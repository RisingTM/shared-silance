import { supabase } from "@/integrations/supabase/client";

export type AchievementDef = {
  key: string;
  name: string;
  description: string;
  emoji: string;
};

export const STUDY_ACHIEVEMENTS: AchievementDef[] = [
  { key: "first_session", name: "First session", description: "Log your first study session", emoji: "🌱" },
  { key: "first_hour", name: "First hour", description: "Reach 1 hour total study time", emoji: "⏰" },
  { key: "early_bird", name: "Early bird", description: "Start a session before 8am", emoji: "🌅" },
  { key: "night_owl", name: "Night owl", description: "Start a session after 10pm", emoji: "🌙" },
  { key: "streak_7", name: "7-day streak", description: "Study 7 days in a row", emoji: "🔥" },
  { key: "streak_30", name: "30-day streak", description: "Study 30 days in a row", emoji: "🏔️" },
  { key: "century", name: "Century", description: "Reach 100 total hours", emoji: "💯" },
  { key: "subject_master", name: "Subject master", description: "Rate all topics in one module as confident", emoji: "🎓" },
  { key: "sync", name: "Sync", description: "Both study on the same day", emoji: "🤝" },
  { key: "in_sync", name: "In sync", description: "Both study the same subject same day", emoji: "💞" },
  { key: "marathon", name: "Marathon", description: "Single session of 2+ hours", emoji: "🏃" },
  { key: "consistent", name: "Consistent", description: "Study 5+ days/week for 4 weeks", emoji: "📅" },
  { key: "halfway", name: "Halfway", description: "Mark 50% of topics confident", emoji: "🌓" },
  { key: "full_read", name: "Full read", description: "Mark 100% of topics confident", emoji: "🌕" },
];

type Session = { user_id: string; subject_key: string | null; subject_name: string | null; duration_seconds: number; started_at: string };

function dateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function consecutiveStreak(dates: Set<string>): number {
  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    if (dates.has(k)) streak++;
    else break;
  }
  return streak;
}

export async function evaluateAchievements(opts: {
  journeyId: string;
  userId: string;
  partnerId: string | null;
  syllabus: any[]; // modules
  ratings: { user_id: string; item_key: string; rating: string }[];
}) {
  const { journeyId, userId, partnerId, syllabus, ratings } = opts;

  // Load all sessions for the journey & current achievements (mine)
  const [{ data: sessionsData }, { data: minePrev }] = await Promise.all([
    supabase.from("study_sessions").select("user_id, subject_key, subject_name, duration_seconds, started_at").eq("journey_id", journeyId),
    supabase.from("study_achievements").select("achievement_key").eq("journey_id", journeyId).eq("user_id", userId),
  ]);
  const sessions = (sessionsData ?? []) as Session[];
  const owned = new Set((minePrev ?? []).map((r: any) => r.achievement_key));
  const mySessions = sessions.filter((s) => s.user_id === userId);
  const partnerSessions = partnerId ? sessions.filter((s) => s.user_id === partnerId) : [];

  const newlyEarned: string[] = [];
  const tryEarn = (key: string) => {
    if (!owned.has(key)) newlyEarned.push(key);
  };

  // first_session
  if (mySessions.length >= 1) tryEarn("first_session");

  // first_hour
  const totalSec = mySessions.reduce((s, x) => s + x.duration_seconds, 0);
  if (totalSec >= 3600) tryEarn("first_hour");
  if (totalSec >= 360000) tryEarn("century");

  // early_bird / night_owl
  for (const s of mySessions) {
    const h = new Date(s.started_at).getHours();
    if (h < 8) tryEarn("early_bird");
    if (h >= 22) tryEarn("night_owl");
  }

  // marathon
  if (mySessions.some((s) => s.duration_seconds >= 7200)) tryEarn("marathon");

  // streaks
  const myDates = new Set(mySessions.map((s) => dateKey(s.started_at)));
  const streak = consecutiveStreak(myDates);
  if (streak >= 7) tryEarn("streak_7");
  if (streak >= 30) tryEarn("streak_30");

  // consistent — 5+ days/week for 4 consecutive weeks (last 28 days)
  let consistentOk = true;
  const today = new Date(); today.setHours(0,0,0,0);
  for (let w = 0; w < 4; w++) {
    let count = 0;
    for (let d = 0; d < 7; d++) {
      const dt = new Date(today); dt.setDate(dt.getDate() - (w * 7 + d));
      if (myDates.has(dt.toISOString().slice(0, 10))) count++;
    }
    if (count < 5) { consistentOk = false; break; }
  }
  if (consistentOk && mySessions.length > 0) tryEarn("consistent");

  // sync — both studied the same day at any point
  if (partnerSessions.length > 0) {
    const partnerDates = new Set(partnerSessions.map((s) => dateKey(s.started_at)));
    let sync = false;
    let inSync = false;
    for (const md of myDates) {
      if (partnerDates.has(md)) {
        sync = true;
        const mySubs = new Set(mySessions.filter((s) => dateKey(s.started_at) === md).map((s) => s.subject_key ?? "general"));
        const partnerSubs = partnerSessions.filter((s) => dateKey(s.started_at) === md).map((s) => s.subject_key ?? "general");
        if (partnerSubs.some((sub) => mySubs.has(sub))) inSync = true;
      }
    }
    if (sync) tryEarn("sync");
    if (inSync) tryEarn("in_sync");
  }

  // syllabus rating achievements
  const myRatings = ratings.filter((r) => r.user_id === userId);
  const allItemKeys: string[] = [];
  for (const m of syllabus) for (const b of (m.branches ?? [])) for (const it of (b.items ?? [])) {
    allItemKeys.push(`${m.name}\u200b/${b.name}\u200b/${it}`);
  }
  if (allItemKeys.length > 0) {
    const confidentSet = new Set(myRatings.filter((r) => r.rating === "confident").map((r) => r.item_key));
    const confidentInSyllabus = allItemKeys.filter((k) => confidentSet.has(k)).length;
    const pct = confidentInSyllabus / allItemKeys.length;
    if (pct >= 0.5) tryEarn("halfway");
    if (pct >= 1) tryEarn("full_read");
    // subject_master — any module fully confident
    for (const m of syllabus) {
      const moduleKeys: string[] = [];
      for (const b of (m.branches ?? [])) for (const it of (b.items ?? [])) {
        moduleKeys.push(`${m.name}\u200b/${b.name}\u200b/${it}`);
      }
      if (moduleKeys.length > 0 && moduleKeys.every((k) => confidentSet.has(k))) {
        tryEarn("subject_master");
        break;
      }
    }
  }

  // Insert
  if (newlyEarned.length === 0) return [];
  const rows = newlyEarned.map((key) => ({
    journey_id: journeyId,
    user_id: userId,
    achievement_key: key,
  }));
  await supabase.from("study_achievements").insert(rows);
  return newlyEarned;
}
