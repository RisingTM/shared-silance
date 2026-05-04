import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Play, Pause, Square, ChevronDown, Lock, Trophy } from "lucide-react";
import { toast } from "sonner";
import { notify } from "@/lib/notifications";
import { parseSyllabus, itemKey, type Module } from "@/lib/syllabus";
import * as Timer from "@/lib/study-timer";
import { STUDY_ACHIEVEMENTS, evaluateAchievements } from "@/lib/study-achievements";
import { useIsMobile } from "@/hooks/use-mobile";

export const Route = createFileRoute("/study")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <StudyPage />
      </AppShell>
    </RequireAuth>
  ),
});

type Session = {
  id: string;
  user_id: string;
  subject_key: string | null;
  subject_name: string | null;
  duration_seconds: number;
  started_at: string;
  ended_at: string;
};
type Rating = { user_id: string; item_key: string; rating: "not_started" | "in_progress" | "confident" };
type Achievement = { user_id: string; achievement_key: string; earned_at: string };

function StudyPage() {
  const { user, profile, partnerProfile, journey } = useSession();
  const [tab, setTab] = useState("dashboard");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [syllabus, setSyllabus] = useState<Module[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [sessionDefault, setSessionDefault] = useState(90);
  const [breakDefault, setBreakDefault] = useState(20);

  const myId = user?.id ?? "";
  const partnerId = partnerProfile?.id ?? null;
  const journeyId = journey?.id ?? "";

  const loadAll = async () => {
    if (!journeyId) return;
    const since = new Date();
    since.setDate(since.getDate() - 90);
    const [{ data: ss }, { data: sy }, { data: rt }, { data: ach }] = await Promise.all([
      supabase.from("study_sessions").select("*").eq("journey_id", journeyId).gte("started_at", since.toISOString()).order("started_at", { ascending: false }),
      supabase.from("study_syllabus").select("content").eq("journey_id", journeyId).maybeSingle(),
      supabase.from("study_ratings").select("user_id, item_key, rating").eq("journey_id", journeyId),
      supabase.from("study_achievements").select("user_id, achievement_key, earned_at").eq("journey_id", journeyId),
    ]);
    setSessions((ss ?? []) as any);
    setSyllabus(((sy as any)?.content as Module[]) ?? []);
    setRatings((rt ?? []) as any);
    setAchievements((ach ?? []) as any);
  };

  useEffect(() => {
    loadAll();
    /* eslint-disable-next-line */
  }, [journeyId]);

  useEffect(() => {
    if (!profile) return;
    setSessionDefault((profile as any).study_session_duration_default ?? 90);
    setBreakDefault((profile as any).study_break_duration_default ?? 20);
  }, [profile]);

  const onAchievementsChanged = async () => {
    if (!user || !journeyId) return;
    const earned = await evaluateAchievements({
      journeyId,
      userId: user.id,
      partnerId,
      syllabus,
      ratings,
    });
    for (const k of earned) {
      const def = STUDY_ACHIEVEMENTS.find((a) => a.key === k);
      if (def) toast.success(`you earned ${def.name} ${def.emoji}`);
    }
    if (earned.length > 0) loadAll();
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">STUDY</h2>
        <p className="text-muted-foreground italic mt-1 text-sm">Sessions, subjects, and shared milestones.</p>
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="session">Session</TabsTrigger>
          <TabsTrigger value="subjects">Subjects</TabsTrigger>
          <TabsTrigger value="achievements">Badges</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="space-y-4">
          <DashboardTab
            sessions={sessions}
            myId={myId}
            partnerId={partnerId}
            partnerName={partnerProfile?.username ?? "partner"}
            syllabus={syllabus}
            achievements={achievements}
          />
        </TabsContent>
        <TabsContent value="session" className="space-y-4">
          <SessionTab
            myId={myId}
            partnerName={partnerProfile?.username ?? "partner"}
            journeyId={journeyId}
            syllabus={syllabus}
            sessions={sessions}
            sessionDefault={sessionDefault}
            breakDefault={breakDefault}
            setSessionDefault={setSessionDefault}
            setBreakDefault={setBreakDefault}
            onSessionLogged={async () => {
              await loadAll();
              await onAchievementsChanged();
            }}
          />
        </TabsContent>
        <TabsContent value="subjects" className="space-y-4">
          <SubjectsTab
            myId={myId}
            partnerName={partnerProfile?.username ?? "partner"}
            journeyId={journeyId}
            isOwner={profile?.role === "owner"}
            syllabus={syllabus}
            ratings={ratings}
            sessions={sessions}
            partnerId={partnerId}
            onChange={async () => {
              await loadAll();
              await onAchievementsChanged();
            }}
          />
        </TabsContent>
        <TabsContent value="achievements" className="space-y-4">
          <AchievementsTab achievements={achievements} myId={myId} partnerId={partnerId} partnerName={partnerProfile?.username ?? "partner"} youName={profile?.username ?? "you"} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ----- Dashboard -----

function DashboardTab({
  sessions,
  myId,
  partnerId,
  partnerName,
  achievements,
}: {
  sessions: Session[];
  myId: string;
  partnerId: string | null;
  partnerName: string;
  syllabus: Module[];
  achievements: Achievement[];
}) {
  const isMobile = useIsMobile();
  const weeks = isMobile ? 8 : 12;
  const [view, setView] = useState<"together" | "separate">("together");

  const stat = (uid: string) => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);
    const monthStart = new Date(today); monthStart.setDate(monthStart.getDate() - 29);
    let todayS = 0, weekS = 0, monthS = 0;
    const dates = new Set<string>();
    for (const s of sessions) {
      if (s.user_id !== uid) continue;
      const dt = new Date(s.started_at);
      if (dt >= today) todayS += s.duration_seconds;
      if (dt >= weekStart) weekS += s.duration_seconds;
      if (dt >= monthStart) monthS += s.duration_seconds;
      dates.add(dt.toISOString().slice(0, 10));
    }
    let streak = 0;
    for (let i = 0; i < 365; i++) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      if (dates.has(d.toISOString().slice(0, 10))) streak++;
      else break;
    }
    return { today: todayS / 3600, week: weekS / 3600, month: monthS / 3600, streak };
  };

  const me = stat(myId);
  const them = partnerId ? stat(partnerId) : null;

  // Same-day shared achievement banner
  const sharedBanner = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const byKey: Record<string, Set<string>> = {};
    for (const a of achievements) {
      const d = a.earned_at.slice(0, 10);
      if (d !== today) continue;
      byKey[a.achievement_key] ??= new Set();
      byKey[a.achievement_key].add(a.user_id);
    }
    for (const [key, users] of Object.entries(byKey)) {
      if (partnerId && users.has(myId) && users.has(partnerId)) {
        const def = STUDY_ACHIEVEMENTS.find((a) => a.key === key);
        if (def) return def;
      }
    }
    return null;
  }, [achievements, myId, partnerId]);

  return (
    <div className="space-y-4">
      {sharedBanner && (
        <div className="parchment-card rounded-2xl p-4 text-center border border-primary/40 bg-primary/5">
          <p className="text-2xl">{sharedBanner.emoji}</p>
          <p className="font-display text-sm tracking-widest text-primary mt-1">SHARED — {sharedBanner.name}</p>
          <p className="text-xs text-muted-foreground mt-1">You both earned this today</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <StatBlock label="You" s={me} tone="gold" />
        <StatBlock label={`@${partnerName}`} s={them} tone="muted" />
      </div>

      <div className="parchment-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm uppercase tracking-widest text-primary">Activity</h3>
          <div className="flex items-center gap-2 text-[11px]">
            <span className={view === "together" ? "text-primary" : "text-muted-foreground"}>Together</span>
            <Switch checked={view === "separate"} onCheckedChange={(c) => setView(c ? "separate" : "together")} />
            <span className={view === "separate" ? "text-primary" : "text-muted-foreground"}>Separate</span>
          </div>
        </div>
        {view === "together" ? (
          <Heatmap sessions={sessions} weeks={weeks} myId={myId} partnerId={partnerId} mode="together" />
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">You</p>
              <Heatmap sessions={sessions} weeks={weeks} myId={myId} partnerId={partnerId} mode="me" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">@{partnerName}</p>
              <Heatmap sessions={sessions} weeks={weeks} myId={myId} partnerId={partnerId} mode="partner" />
            </div>
          </div>
        )}
      </div>

      <SubjectBreakdown sessions={sessions} myId={myId} partnerId={partnerId} partnerName={partnerName} />
    </div>
  );
}

function StatBlock({ label, s, tone }: { label: string; s: { today: number; week: number; month: number; streak: number } | null; tone: "gold" | "muted" }) {
  return (
    <div className={["parchment-card rounded-2xl p-4 space-y-2", tone === "gold" ? "" : "opacity-90"].join(" ")}>
      <p className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">{label}</p>
      {s ? (
        <>
          <p className="font-display text-2xl text-primary tabular-nums">{s.today.toFixed(1)}<span className="text-xs text-muted-foreground"> h today</span></p>
          <p className="text-[11px] text-muted-foreground tabular-nums">{s.week.toFixed(1)}h week · {s.month.toFixed(1)}h month</p>
          <p className="text-[11px] text-amber-600 dark:text-amber-400">🔥 {s.streak} day{s.streak === 1 ? "" : "s"}</p>
        </>
      ) : (
        <p className="text-xs italic text-muted-foreground">no data</p>
      )}
    </div>
  );
}

function Heatmap({ sessions, weeks, myId, partnerId, mode }: { sessions: Session[]; weeks: number; myId: string; partnerId: string | null; mode: "together" | "me" | "partner" }) {
  // Build grid: cols = weeks, rows = Mon..Sun
  // Anchor: today is in the rightmost column. Compute from "this week's Monday".
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const dayMs = 86400000;
  const dow = (today.getDay() + 6) % 7; // Mon=0..Sun=6
  const lastMonday = new Date(today.getTime() - dow * dayMs);

  // Aggregate minutes per (uid, dateKey)
  const minutesByDay: Record<string, { me: number; them: number }> = {};
  for (const s of sessions) {
    const k = new Date(s.started_at); k.setHours(0, 0, 0, 0);
    const key = k.toISOString().slice(0, 10);
    minutesByDay[key] ??= { me: 0, them: 0 };
    const minutes = s.duration_seconds / 60;
    if (s.user_id === myId) minutesByDay[key].me += minutes;
    else if (partnerId && s.user_id === partnerId) minutesByDay[key].them += minutes;
  }

  const colorFor = (m: number, isMe: boolean): string => {
    if (m <= 0) return "bg-muted/40";
    const intensity = m < 30 ? 0.25 : m < 90 ? 0.5 : m < 180 ? 0.75 : 1;
    if (isMe) {
      return ["bg-primary/30", "bg-primary/50", "bg-primary/70", "bg-primary"][Math.floor(intensity * 4) - 1] ?? "bg-primary";
    }
    return ["bg-teal-500/30", "bg-teal-500/50", "bg-teal-500/70", "bg-teal-500"][Math.floor(intensity * 4) - 1] ?? "bg-teal-500";
  };

  // Build columns
  const cols: { date: Date; minutesMe: number; minutesThem: number }[][] = [];
  for (let w = weeks - 1; w >= 0; w--) {
    const colMonday = new Date(lastMonday.getTime() - w * 7 * dayMs);
    const col: typeof cols[number] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(colMonday.getTime() + d * dayMs);
      const key = date.toISOString().slice(0, 10);
      const v = minutesByDay[key] ?? { me: 0, them: 0 };
      col.push({ date, minutesMe: v.me, minutesThem: v.them });
    }
    cols.push(col);
  }

  const monthLabel = (col: typeof cols[number]) => {
    const first = col[0];
    if (first.date.getDate() <= 7) return first.date.toLocaleString("en-US", { month: "short" });
    return "";
  };

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(14px, 1fr))` }}>
        {cols.map((col, i) => (
          <div key={i} className="text-[8px] text-muted-foreground/70 text-center h-3">{monthLabel(col)}</div>
        ))}
        {cols.map((col, i) => (
          <div key={i} className="grid grid-rows-7 gap-[2px]">
            {col.map((cell, d) => {
              const isToday = cell.date.toDateString() === today.toDateString();
              const showMe = mode === "together" || mode === "me";
              const showThem = mode === "together" || mode === "partner";
              const meHas = showMe && cell.minutesMe > 0;
              const themHas = showThem && cell.minutesThem > 0;
              if (mode !== "together") {
                const m = mode === "me" ? cell.minutesMe : cell.minutesThem;
                return (
                  <div
                    key={d}
                    title={`${cell.date.toLocaleDateString()} — ${(m / 60).toFixed(1)}h`}
                    className={["aspect-square rounded-sm", colorFor(m, mode === "me"), isToday && "ring-1 ring-primary/60"].filter(Boolean).join(" ")}
                  />
                );
              }
              if (meHas && themHas) {
                return (
                  <div key={d} title={`${cell.date.toLocaleDateString()}`} className={["aspect-square rounded-sm overflow-hidden flex", isToday && "ring-1 ring-primary/60"].filter(Boolean).join(" ")}>
                    <div className={["w-1/2 h-full", colorFor(cell.minutesMe, true)].join(" ")} />
                    <div className={["w-1/2 h-full", colorFor(cell.minutesThem, false)].join(" ")} />
                  </div>
                );
              }
              if (meHas) return <div key={d} title={`${cell.date.toLocaleDateString()} — ${(cell.minutesMe / 60).toFixed(1)}h`} className={["aspect-square rounded-sm", colorFor(cell.minutesMe, true), isToday && "ring-1 ring-primary/60"].filter(Boolean).join(" ")} />;
              if (themHas) return <div key={d} title={`${cell.date.toLocaleDateString()} — ${(cell.minutesThem / 60).toFixed(1)}h`} className={["aspect-square rounded-sm", colorFor(cell.minutesThem, false), isToday && "ring-1 ring-primary/60"].filter(Boolean).join(" ")} />;
              return <div key={d} className={["aspect-square rounded-sm bg-muted/40", isToday && "ring-1 ring-primary/60"].filter(Boolean).join(" ")} />;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function SubjectBreakdown({ sessions, myId, partnerId, partnerName }: { sessions: Session[]; myId: string; partnerId: string | null; partnerName: string }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);
  const map: Record<string, { me: number; them: number }> = {};
  for (const s of sessions) {
    if (new Date(s.started_at) < weekStart) continue;
    const name = s.subject_name ?? "General study";
    map[name] ??= { me: 0, them: 0 };
    const h = s.duration_seconds / 3600;
    if (s.user_id === myId) map[name].me += h;
    else if (partnerId && s.user_id === partnerId) map[name].them += h;
  }
  const entries = Object.entries(map).sort((a, b) => (b[1].me + b[1].them) - (a[1].me + a[1].them));
  const max = Math.max(0.1, ...entries.map(([, v]) => v.me + v.them));

  if (entries.length === 0) {
    return (
      <div className="parchment-card rounded-2xl p-4">
        <p className="font-display text-sm uppercase tracking-widest text-primary">This week by subject</p>
        <p className="text-xs italic text-muted-foreground mt-3 text-center py-4">no sessions this week</p>
      </div>
    );
  }

  return (
    <div className="parchment-card rounded-2xl p-4 space-y-3">
      <p className="font-display text-sm uppercase tracking-widest text-primary">This week by subject</p>
      <div className="space-y-2">
        {entries.map(([name, v]) => (
          <div key={name}>
            <div className="flex items-center justify-between text-[11px]">
              <span className="truncate">{name}</span>
              <span className="text-muted-foreground tabular-nums">{(v.me + v.them).toFixed(1)}h</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden bg-muted/40 mt-1">
              <div className="bg-primary" style={{ width: `${(v.me / max) * 100}%` }} />
              <div className="bg-teal-500" style={{ width: `${(v.them / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-3 text-[10px] text-muted-foreground">
        <span><span className="inline-block size-2 rounded-sm bg-primary mr-1" />you</span>
        <span><span className="inline-block size-2 rounded-sm bg-teal-500 mr-1" />@{partnerName}</span>
      </div>
    </div>
  );
}

// ----- Session -----

function SessionTab({
  myId,
  journeyId,
  syllabus,
  sessions,
  sessionDefault,
  breakDefault,
  setSessionDefault,
  setBreakDefault,
  onSessionLogged,
  partnerName,
}: {
  myId: string;
  partnerName: string;
  journeyId: string;
  syllabus: Module[];
  sessions: Session[];
  sessionDefault: number;
  breakDefault: number;
  setSessionDefault: (v: number) => void;
  setBreakDefault: (v: number) => void;
  onSessionLogged: () => Promise<void> | void;
}) {
  const [state, setState] = useState<Timer.TimerState | null>(null);
  const [subject, setSubject] = useState<{ key: string | null; name: string | null }>({ key: null, name: null });
  const [, setTick] = useState(0);
  const [stopOpen, setStopOpen] = useState(false);

  // Load persisted state on mount
  useEffect(() => {
    if (!myId) return;
    const s = Timer.load(myId);
    if (s) setState(s);
    /* eslint-disable-next-line */
  }, [myId]);

  // Tick every second when running
  useEffect(() => {
    if (!state || Timer.isPaused(state)) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  // Persist on every state change
  useEffect(() => {
    if (myId) Timer.save(myId, state);
  }, [state, myId]);

  // Watch for phase end
  useEffect(() => {
    if (!state || Timer.isPaused(state)) return;
    const remaining = Timer.remainingSec(state);
    if (remaining > 0) return;
    // phase ended
    if (state.phase === "session") {
      // log session
      const actual = Math.min(state.durationSec, Timer.elapsedSec(state));
      logSession(actual, state.subjectKey, state.subjectName, state.startedAt - state.elapsedBeforePauseSec * 1000);
      notify("Study", "Session done — break starting 🌿").catch(() => undefined);
      setState({
        ...state,
        phase: "break",
        startedAt: Date.now(),
        elapsedBeforePauseSec: 0,
        durationSec: state.breakDurationSec,
        pausedAt: null,
      });
    } else {
      notify("Study", "Break over — ready for next session ✨").catch(() => undefined);
      setState(null);
    }
    /* eslint-disable-next-line */
  }, [state ? Timer.remainingSec(state) : 0]);

  const persistDefaults = async (sd: number, bd: number) => {
    if (!myId) return;
    await supabase.from("profiles").update({ study_session_duration_default: sd, study_break_duration_default: bd } as any).eq("id", myId);
  };

  const logSession = async (durSec: number, sk: string | null, sn: string | null, startMs: number) => {
    if (!journeyId || !myId || durSec < 5) return;
    const startedAt = new Date(startMs).toISOString();
    const endedAt = new Date(startMs + durSec * 1000).toISOString();
    await supabase.from("study_sessions").insert({
      journey_id: journeyId,
      user_id: myId,
      subject_key: sk,
      subject_name: sn,
      duration_seconds: durSec,
      started_at: startedAt,
      ended_at: endedAt,
    });
    await onSessionLogged();
  };

  const start = () => {
    setState({
      phase: "session",
      startedAt: Date.now(),
      durationSec: sessionDefault * 60,
      subjectKey: subject.key,
      subjectName: subject.name,
      pausedAt: null,
      elapsedBeforePauseSec: 0,
      sessionDurationSec: sessionDefault * 60,
      breakDurationSec: breakDefault * 60,
    });
  };

  const togglePause = () => {
    if (!state) return;
    setState(Timer.isPaused(state) ? Timer.resume(state) : Timer.pause(state));
  };

  const confirmStop = async () => {
    if (!state) {
      setStopOpen(false);
      return;
    }
    if (state.phase === "session") {
      const actual = Timer.elapsedSec(state);
      const startMs = state.startedAt - state.elapsedBeforePauseSec * 1000;
      await logSession(actual, state.subjectKey, state.subjectName, startMs);
    }
    setState(null);
    setStopOpen(false);
  };

  const subjectOptions = useMemo(() => {
    const opts: { key: string; name: string }[] = [];
    for (const m of syllabus) {
      opts.push({ key: `mod:${m.name}`, name: m.name });
      for (const b of m.branches) opts.push({ key: `br:${m.name}/${b.name}`, name: `${m.name} — ${b.name}` });
    }
    return opts;
  }, [syllabus]);

  const remainingSec = state ? Timer.remainingSec(state) : 0;
  const recent = sessions.slice(0, 50);

  return (
    <div className="space-y-4">
      <div className="parchment-card rounded-2xl p-5 space-y-4">
        <div>
          <label className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">Subject</label>
          <Select
            value={subject.key ?? "general"}
            onValueChange={(v) => {
              if (v === "general") setSubject({ key: null, name: null });
              else {
                const opt = subjectOptions.find((o) => o.key === v);
                setSubject({ key: v, name: opt?.name ?? v });
              }
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="General study" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General study</SelectItem>
              {subjectOptions.map((o) => (
                <SelectItem key={o.key} value={o.key}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">Session (min)</label>
            <Input
              type="number"
              min={1}
              max={240}
              value={sessionDefault}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value) || 1);
                setSessionDefault(v);
                persistDefaults(v, breakDefault);
              }}
              disabled={!!state}
            />
          </div>
          <div>
            <label className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">Break (min)</label>
            <Input
              type="number"
              min={1}
              max={120}
              value={breakDefault}
              onChange={(e) => {
                const v = Math.max(1, Number(e.target.value) || 1);
                setBreakDefault(v);
                persistDefaults(sessionDefault, v);
              }}
              disabled={!!state}
            />
          </div>
        </div>

        <div className="text-center py-4">
          <p className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">
            {state ? (state.phase === "session" ? "Session" : "Break") : "Ready"}
          </p>
          <p className="font-display text-6xl text-primary tabular-nums mt-2">{Timer.fmtMMSS(remainingSec)}</p>
          {state?.subjectName && <p className="text-xs text-muted-foreground mt-1">{state.subjectName}</p>}
        </div>

        <div className="flex justify-center gap-2">
          {!state ? (
            <Button onClick={start}><Play className="size-4" /> Start</Button>
          ) : (
            <>
              <Button variant="outline" onClick={togglePause}>
                {Timer.isPaused(state) ? <><Play className="size-4" /> Resume</> : <><Pause className="size-4" /> Pause</>}
              </Button>
              <Button variant="destructive" onClick={() => setStopOpen(true)}>
                <Square className="size-4" /> Stop
              </Button>
            </>
          )}
        </div>
      </div>

      <AlertDialog open={stopOpen} onOpenChange={setStopOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End session?</AlertDialogTitle>
            <AlertDialogDescription>Your time will be logged.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStop}>End</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="parchment-card rounded-2xl p-4 space-y-2">
        <h3 className="font-display text-sm uppercase tracking-widest text-primary">Recent sessions</h3>
        {recent.length === 0 ? (
          <p className="text-xs italic text-muted-foreground text-center py-6">no sessions logged yet</p>
        ) : (
          <ul className="space-y-1">
            {recent.map((s) => {
              const isMine = s.user_id === myId;
              const mins = Math.round(s.duration_seconds / 60);
              return (
                <li key={s.id} className={["flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0", !isMine && "opacity-70"].filter(Boolean).join(" ")}>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{s.subject_name ?? "General study"}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(s.started_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} · {isMine ? "you" : `@${partnerName}`}
                    </p>
                  </div>
                  <span className="tabular-nums text-muted-foreground ml-2">{mins}m</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ----- Subjects -----

function SubjectsTab({
  myId,
  partnerId,
  partnerName,
  journeyId,
  isOwner,
  syllabus,
  ratings,
  sessions,
  onChange,
}: {
  myId: string;
  partnerId: string | null;
  partnerName: string;
  journeyId: string;
  isOwner: boolean;
  syllabus: Module[];
  ratings: Rating[];
  sessions: Session[];
  onChange: () => Promise<void> | void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [confirmReplaceOpen, setConfirmReplaceOpen] = useState(false);
  const [pendingModules, setPendingModules] = useState<Module[] | null>(null);

  const ratingByItemUser = useMemo(() => {
    const m: Record<string, Record<string, string>> = {};
    for (const r of ratings) {
      m[r.item_key] ??= {};
      m[r.item_key][r.user_id] = r.rating;
    }
    return m;
  }, [ratings]);

  const cycle = (cur: string | undefined): "not_started" | "in_progress" | "confident" => {
    if (cur === "confident") return "not_started";
    if (cur === "in_progress") return "confident";
    return "in_progress";
  };

  const setRating = async (item_key: string, rating: "not_started" | "in_progress" | "confident") => {
    if (!myId || !journeyId) return;
    if (rating === "not_started") {
      await supabase.from("study_ratings").delete().eq("user_id", myId).eq("journey_id", journeyId).eq("item_key", item_key);
    } else {
      await supabase.from("study_ratings").upsert(
        { user_id: myId, journey_id: journeyId, item_key, rating, updated_at: new Date().toISOString() },
        { onConflict: "journey_id,user_id,item_key" },
      );
    }
    await onChange();
  };

  const handleParse = () => {
    const res = parseSyllabus(pasteText);
    if (!res.ok) {
      setPasteError(`Line ${res.line}: ${res.error}`);
      return;
    }
    setPasteError(null);
    setPendingModules(res.modules);
    if (syllabus.length > 0) setConfirmReplaceOpen(true);
    else commitSyllabus(res.modules);
  };

  const commitSyllabus = async (modules: Module[]) => {
    if (!journeyId) return;
    await supabase.from("study_syllabus").upsert(
      { journey_id: journeyId, content: modules as any, imported_by: myId, imported_at: new Date().toISOString() },
      { onConflict: "journey_id" },
    );
    setEditorOpen(false);
    setPasteText("");
    setPendingModules(null);
    setConfirmReplaceOpen(false);
    await onChange();
    toast.success("Syllabus saved");
  };

  // Hours per module this week
  const hoursThisWeek = (uid: string, moduleName: string): number => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);
    let h = 0;
    for (const s of sessions) {
      if (s.user_id !== uid) continue;
      if (new Date(s.started_at) < weekStart) continue;
      if (s.subject_key?.startsWith("mod:") && s.subject_key.slice(4) === moduleName) h += s.duration_seconds / 3600;
      else if (s.subject_key?.startsWith("br:") && s.subject_key.slice(3).startsWith(moduleName + "/")) h += s.duration_seconds / 3600;
    }
    return h;
  };

  return (
    <div className="space-y-4">
      {isOwner && (
        <div className="parchment-card rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm uppercase tracking-widest text-primary">Syllabus</h3>
            <Button size="sm" variant="outline" onClick={() => setEditorOpen((v) => !v)}>
              {editorOpen ? "Close" : syllabus.length > 0 ? "Edit" : "Import"}
            </Button>
          </div>
          {editorOpen && (
            <div className="space-y-2">
              <p className="text-[11px] text-muted-foreground">
                # Module · - Branch · plain line for topic
              </p>
              <Textarea rows={10} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="# Module 1&#10;- Branch A&#10;Topic one&#10;Topic two" />
              {pasteError && <p className="text-xs text-destructive">{pasteError}</p>}
              <Button size="sm" onClick={handleParse}>Save syllabus</Button>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmReplaceOpen} onOpenChange={setConfirmReplaceOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace existing syllabus?</AlertDialogTitle>
            <AlertDialogDescription>This will replace the current syllabus. Ratings tied to old item names won't carry over.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => pendingModules && commitSyllabus(pendingModules)}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {syllabus.length === 0 && !isOwner && (
        <p className="text-center text-sm italic text-muted-foreground py-8">No syllabus yet — owner can import one.</p>
      )}

      {syllabus.map((m) => {
        const myH = hoursThisWeek(myId, m.name);
        const partnerH = partnerId ? hoursThisWeek(partnerId, m.name) : 0;
        return (
          <Collapsible key={m.name} className="parchment-card rounded-2xl p-3">
            <CollapsibleTrigger className="w-full flex items-center justify-between gap-2">
              <div className="flex-1 text-left">
                <p className="font-display text-sm tracking-wide">{m.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  you {myH.toFixed(1)}h · @{partnerName} {partnerH.toFixed(1)}h
                </p>
              </div>
              <ChevronDown className="size-4 text-muted-foreground" />
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3 space-y-2">
              {m.branches.map((b) => (
                <Collapsible key={b.name} className="rounded-lg border border-border/40 bg-card/40 p-2">
                  <CollapsibleTrigger className="w-full flex items-center justify-between text-xs">
                    <span>{b.name}</span>
                    <ChevronDown className="size-3 text-muted-foreground" />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1">
                    {b.items.map((it) => {
                      const key = itemKey(m.name, b.name, it);
                      const myR = ratingByItemUser[key]?.[myId];
                      const themR = partnerId ? ratingByItemUser[key]?.[partnerId] : undefined;
                      return (
                        <div key={it} className="flex items-center gap-2 text-xs py-1">
                          <span className="flex-1 truncate">{it}</span>
                          <RatingChip rating={myR} onClick={() => setRating(key, cycle(myR))} editable />
                          <RatingChip rating={themR} editable={false} />
                        </div>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              ))}
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}

function RatingChip({ rating, onClick, editable }: { rating: string | undefined; onClick?: () => void; editable: boolean }) {
  const cls =
    rating === "confident" ? "bg-teal-500/30 text-teal-700 dark:text-teal-300 border-teal-500/40" :
    rating === "in_progress" ? "bg-amber-500/30 text-amber-700 dark:text-amber-300 border-amber-500/40" :
    "bg-muted/40 text-muted-foreground border-border/40";
  const label = rating === "confident" ? "✓" : rating === "in_progress" ? "~" : "·";
  return (
    <button
      onClick={editable ? onClick : undefined}
      disabled={!editable}
      className={["size-6 rounded-full border text-[10px] inline-flex items-center justify-center", cls, !editable && "opacity-70 cursor-default"].filter(Boolean).join(" ")}
      title={rating ?? "not started"}
    >
      {label}
    </button>
  );
}

// ----- Achievements -----

function AchievementsTab({ achievements, myId, partnerId, partnerName, youName }: { achievements: Achievement[]; myId: string; partnerId: string | null; partnerName: string; youName: string }) {
  const earnedByKey: Record<string, Achievement[]> = {};
  for (const a of achievements) {
    earnedByKey[a.achievement_key] ??= [];
    earnedByKey[a.achievement_key].push(a);
  }
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {STUDY_ACHIEVEMENTS.map((def) => {
        const earned = earnedByKey[def.key] ?? [];
        const earnedAny = earned.length > 0;
        return (
          <div
            key={def.key}
            className={["rounded-2xl border p-3 text-center space-y-1", earnedAny ? "border-primary/40 bg-primary/5" : "border-border/40 bg-muted/20 opacity-70"].join(" ")}
          >
            <div className="text-2xl">{earnedAny ? def.emoji : <Lock className="size-5 inline text-muted-foreground" />}</div>
            <p className={["font-display text-xs tracking-wide", earnedAny ? "text-primary" : "text-muted-foreground"].join(" ")}>{def.name}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{def.description}</p>
            {earnedAny && (
              <div className="text-[9px] text-muted-foreground space-y-0.5 pt-1">
                {earned.map((e) => (
                  <p key={e.user_id}>
                    {e.user_id === myId ? youName : `@${partnerName}`} · {new Date(e.earned_at).toLocaleDateString()}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
