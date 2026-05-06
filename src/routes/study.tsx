import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Play, Pause, Square, ChevronDown, ChevronLeft, ChevronRight, Lock, Flame, Clock, CalendarDays, BookOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { notify } from "@/lib/notifications";
import { parseSyllabus, itemKey, type Module } from "@/lib/syllabus";
import * as Timer from "@/lib/study-timer";
import { STUDY_ACHIEVEMENTS, evaluateAchievements } from "@/lib/study-achievements";

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
    since.setMonth(since.getMonth() - 12);
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
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
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
            journeyId={journeyId}
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

// ============================================================
// Dashboard (now also contains the Session timer)
// ============================================================

function DashboardTab({
  sessions,
  myId,
  partnerId,
  partnerName,
  achievements,
  syllabus,
  journeyId,
  sessionDefault,
  breakDefault,
  setSessionDefault,
  setBreakDefault,
  onSessionLogged,
}: {
  sessions: Session[];
  myId: string;
  partnerId: string | null;
  partnerName: string;
  syllabus: Module[];
  achievements: Achievement[];
  journeyId: string;
  sessionDefault: number;
  breakDefault: number;
  setSessionDefault: (v: number) => void;
  setBreakDefault: (v: number) => void;
  onSessionLogged: () => Promise<void> | void;
}) {
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
    return { todaySec: todayS, weekSec: weekS, monthSec: monthS, streak };
  };

  const me = stat(myId);
  const them = partnerId ? stat(partnerId) : null;

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

      {/* Live session timer (top of dashboard) */}
      <SessionPanel
        myId={myId}
        partnerName={partnerName}
        journeyId={journeyId}
        syllabus={syllabus}
        sessionDefault={sessionDefault}
        breakDefault={breakDefault}
        setSessionDefault={setSessionDefault}
        setBreakDefault={setBreakDefault}
        onSessionLogged={onSessionLogged}
      />

      {/* Modern stat cards */}
      <ModernStats me={me} them={them} partnerName={partnerName} />

      {/* Monthly activity */}
      <div className="parchment-card rounded-2xl p-4 space-y-3">
        <MonthCalendar sessions={sessions} myId={myId} partnerId={partnerId} partnerName={partnerName} />
      </div>

      <SubjectBreakdown sessions={sessions} myId={myId} partnerId={partnerId} partnerName={partnerName} />

      <RecentSessions sessions={sessions} myId={myId} partnerName={partnerName} onDeleted={onSessionLogged} />
    </div>
  );
}

// ----- Modern stats -----

function ModernStats({
  me,
  them,
  partnerName,
}: {
  me: { todaySec: number; weekSec: number; monthSec: number; streak: number };
  them: { todaySec: number; weekSec: number; monthSec: number; streak: number } | null;
  partnerName: string;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCardModern label="You" data={me} primary />
      <StatCardModern label={`@${partnerName}`} data={them} />
    </div>
  );
}

function StatCardModern({
  label,
  data,
  primary,
}: {
  label: string;
  data: { todaySec: number; weekSec: number; monthSec: number; streak: number } | null;
  primary?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl p-4 border space-y-3",
        primary
          ? "border-primary/30 bg-gradient-to-br from-primary/10 via-card to-card shadow-sm"
          : "border-border/60 bg-card/60",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</p>
        {data && data.streak > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400">
            <Flame className="size-3" /> {data.streak}d
          </span>
        )}
      </div>
      {data ? (
        <>
          <div>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Today</p>
            <p className="font-display text-2xl text-primary tabular-nums leading-tight">
              {Timer.fmtHourMin(data.todaySec)}
            </p>
          </div>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/40 pt-2">
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="size-3" /> {Timer.fmtHourMin(data.weekSec)}
            </span>
            <span className="tabular-nums">{Timer.fmtHourMin(data.monthSec)}</span>
          </div>
          <div className="flex justify-between text-[9px] uppercase tracking-widest text-muted-foreground/70">
            <span>week</span>
            <span>month</span>
          </div>
        </>
      ) : (
        <p className="text-xs italic text-muted-foreground">no data</p>
      )}
    </div>
  );
}

// ----- Monthly calendar heatmap -----

function MonthCalendar({
  sessions,
  myId,
  partnerId,
  partnerName,
}: {
  sessions: Session[];
  myId: string;
  partnerId: string | null;
  partnerName: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [cursor, setCursor] = useState<{ y: number; m: number }>({
    y: today.getFullYear(),
    m: today.getMonth(),
  });

  const minutesByDay: Record<string, { me: number; them: number }> = useMemo(() => {
    const map: Record<string, { me: number; them: number }> = {};
    for (const s of sessions) {
      const k = new Date(s.started_at);
      k.setHours(0, 0, 0, 0);
      const key = `${k.getFullYear()}-${k.getMonth()}-${k.getDate()}`;
      map[key] ??= { me: 0, them: 0 };
      const minutes = s.duration_seconds / 60;
      if (s.user_id === myId) map[key].me += minutes;
      else if (partnerId && s.user_id === partnerId) map[key].them += minutes;
    }
    return map;
  }, [sessions, myId, partnerId]);

  const firstDow = (new Date(cursor.y, cursor.m, 1).getDay() + 6) % 7; // Mon=0..Sun=6
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.y, cursor.m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = new Date(cursor.y, cursor.m, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  const goPrev = () =>
    setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }));
  const goNext = () =>
    setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }));
  const isFuture =
    cursor.y > today.getFullYear() ||
    (cursor.y === today.getFullYear() && cursor.m >= today.getMonth());

  // Per-day intensity color
  const colorFor = (m: number, isMe: boolean) => {
    if (m <= 0) return "bg-muted/40";
    const tier = m < 30 ? 1 : m < 90 ? 2 : m < 180 ? 3 : 4;
    if (isMe) return ["bg-primary/25", "bg-primary/45", "bg-primary/70", "bg-primary"][tier - 1];
    return ["bg-teal-500/25", "bg-teal-500/45", "bg-teal-500/70", "bg-teal-500"][tier - 1];
  };

  // Month totals
  const totals = useMemo(() => {
    let me = 0, them = 0;
    for (const c of cells) {
      if (!c) continue;
      const key = `${c.getFullYear()}-${c.getMonth()}-${c.getDate()}`;
      const v = minutesByDay[key];
      if (v) {
        me += v.me;
        them += v.them;
      }
    }
    return { me: me * 60, them: them * 60 };
  }, [cells, minutesByDay]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={goPrev}
          className="size-8 rounded-full hover:bg-accent/40 inline-flex items-center justify-center text-muted-foreground"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="text-center">
          <p className="font-display text-sm uppercase tracking-widest text-primary">{monthLabel}</p>
          <p className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
            you {Timer.fmtHourMin(totals.me)} · @{partnerName} {Timer.fmtHourMin(totals.them)}
          </p>
        </div>
        <button
          onClick={goNext}
          disabled={isFuture}
          className="size-8 rounded-full hover:bg-accent/40 inline-flex items-center justify-center text-muted-foreground disabled:opacity-30"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-[9px] text-muted-foreground/70 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="aspect-square" />;
          const key = `${c.getFullYear()}-${c.getMonth()}-${c.getDate()}`;
          const v = minutesByDay[key] ?? { me: 0, them: 0 };
          const isToday = c.getTime() === today.getTime();
          const meHas = v.me > 0;
          const themHas = v.them > 0;
          const totalH = (v.me + v.them) / 60;
          return (
            <div
              key={i}
              title={`${c.toLocaleDateString()} — ${totalH.toFixed(1)}h`}
              className={[
                "aspect-square rounded-md relative overflow-hidden flex items-center justify-center text-[9px] font-display",
                isToday && "ring-1 ring-primary/60",
              ].filter(Boolean).join(" ")}
            >
              {meHas && themHas ? (
                <div className="absolute inset-0 flex">
                  <div className={["w-1/2 h-full", colorFor(v.me, true)].join(" ")} />
                  <div className={["w-1/2 h-full", colorFor(v.them, false)].join(" ")} />
                </div>
              ) : meHas ? (
                <div className={["absolute inset-0", colorFor(v.me, true)].join(" ")} />
              ) : themHas ? (
                <div className={["absolute inset-0", colorFor(v.them, false)].join(" ")} />
              ) : (
                <div className="absolute inset-0 bg-muted/30" />
              )}
              <span className="relative text-foreground/70 mix-blend-luminosity">{c.getDate()}</span>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-3 text-[10px] text-muted-foreground">
        <span><span className="inline-block size-2 rounded-sm bg-primary mr-1" />you</span>
        <span><span className="inline-block size-2 rounded-sm bg-teal-500 mr-1" />@{partnerName}</span>
      </div>
    </div>
  );
}

function SubjectBreakdown({
  sessions,
  myId,
  partnerId,
  partnerName,
}: {
  sessions: Session[];
  myId: string;
  partnerId: string | null;
  partnerName: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekStart = new Date(today);
  weekStart.setDate(weekStart.getDate() - 6);
  const map: Record<string, { me: number; them: number }> = {};
  for (const s of sessions) {
    if (new Date(s.started_at) < weekStart) continue;
    const name = s.subject_name ?? "General study";
    map[name] ??= { me: 0, them: 0 };
    if (s.user_id === myId) map[name].me += s.duration_seconds;
    else if (partnerId && s.user_id === partnerId) map[name].them += s.duration_seconds;
  }
  const entries = Object.entries(map).sort((a, b) => b[1].me + b[1].them - (a[1].me + a[1].them));
  const max = Math.max(60, ...entries.map(([, v]) => v.me + v.them));

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
              <span className="text-muted-foreground tabular-nums">{Timer.fmtHourMin(v.me + v.them)}</span>
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

function RecentSessions({ sessions, myId, partnerName, onDeleted }: { sessions: Session[]; myId: string; partnerName: string; onDeleted: () => void | Promise<void> }) {
  const recent = sessions.slice(0, 12);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  if (recent.length === 0) return null;

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("study_sessions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else {
      toast.success("Session deleted");
      await onDeleted();
    }
    setConfirmId(null);
  };

  return (
    <div className="parchment-card rounded-2xl p-4 space-y-2">
      <h3 className="font-display text-sm uppercase tracking-widest text-primary inline-flex items-center gap-2">
        <Clock className="size-3.5" /> Recent
      </h3>
      <ul className="divide-y divide-border/40">
        {recent.map((s) => {
          const isMine = s.user_id === myId;
          return (
            <li key={s.id} className={["flex items-center justify-between text-xs py-2", !isMine && "opacity-70"].filter(Boolean).join(" ")}>
              <div className="flex-1 min-w-0">
                <p className="truncate inline-flex items-center gap-1.5">
                  <BookOpen className="size-3 text-muted-foreground shrink-0" />
                  {s.subject_name ?? "General study"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {new Date(s.started_at).toLocaleString([], { dateStyle: "short", timeStyle: "short" })} · {isMine ? "you" : `@${partnerName}`}
                </p>
              </div>
              <div className="flex items-center gap-2 ml-2">
                <span className="tabular-nums text-muted-foreground">{Timer.fmtHourMin(s.duration_seconds)}</span>
                {isMine && (
                  <button
                    onClick={() => setConfirmId(s.id)}
                    className="text-muted-foreground/60 hover:text-destructive p-1 -m-1"
                    aria-label="Delete session"
                  >
                    <Square className="size-3" />
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <AlertDialog open={confirmId !== null} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this session?</AlertDialogTitle>
            <AlertDialogDescription>The logged time will be permanently removed from your stats.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmId && handleDelete(confirmId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Session panel — synced timer
// ============================================================

function SessionPanel({
  myId,
  journeyId,
  syllabus,
  sessionDefault,
  breakDefault,
  setSessionDefault,
  setBreakDefault,
  onSessionLogged,
}: {
  myId: string;
  partnerName: string;
  journeyId: string;
  syllabus: Module[];
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
  const [loaded, setLoaded] = useState(false);

  // Initial load: prefer remote (cross-device), fall back to local
  useEffect(() => {
    if (!myId) return;
    let cancelled = false;
    (async () => {
      const remote = await Timer.loadRemote(myId).catch(() => null);
      if (cancelled) return;
      if (remote) {
        setState(remote);
        Timer.saveLocal(myId, remote);
      } else {
        setState(Timer.loadLocal(myId));
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [myId]);

  // Re-sync when tab regains focus (so phone picks up laptop)
  useEffect(() => {
    if (!myId) return;
    const onFocus = async () => {
      const remote = await Timer.loadRemote(myId).catch(() => null);
      if (remote) {
        setState(remote);
        Timer.saveLocal(myId, remote);
      } else {
        setState(null);
      }
    };
    const onVis = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [myId]);

  // 1-second tick while running
  useEffect(() => {
    if (!state || Timer.isPaused(state)) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, [state]);

  // Persist locally on every change; remote only on lifecycle moments (handled in handlers)
  useEffect(() => {
    if (!loaded || !myId) return;
    Timer.saveLocal(myId, state);
  }, [state, loaded, myId]);

  // Phase-end handler
  useEffect(() => {
    if (!state || Timer.isPaused(state)) return;
    if (Timer.remainingSec(state) > 0) return;
    (async () => {
      if (state.phase === "session") {
        const actual = Math.min(state.durationSec, Timer.elapsedSec(state));
        await logSession(actual, state.subjectKey, state.subjectName, state.originalStartedAt);
        notify("Study", "Session done — break starting 🌿").catch(() => undefined);
        const next: Timer.TimerState = {
          ...state,
          phase: "break",
          startedAt: Date.now(),
          originalStartedAt: Date.now(),
          elapsedBeforePauseSec: 0,
          durationSec: state.breakDurationSec,
          pausedAt: null,
        };
        setState(next);
        await Timer.persist(myId, next);
      } else {
        notify("Study", "Break over — ready for next session ✨").catch(() => undefined);
        setState(null);
        await Timer.persist(myId, null);
      }
    })();
    /* eslint-disable-next-line */
  }, [state ? Timer.remainingSec(state) : 0]);

  const persistDefaults = async (sd: number, bd: number) => {
    if (!myId) return;
    await supabase.from("profiles").update({ study_session_duration_default: sd, study_break_duration_default: bd } as any).eq("id", myId);
  };

  const logSession = async (durSec: number, sk: string | null, sn: string | null, startMs: number) => {
    if (!journeyId || !myId || durSec < 300) return;
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

  const start = async () => {
    const now = Date.now();
    const next: Timer.TimerState = {
      phase: "session",
      startedAt: now,
      originalStartedAt: now,
      durationSec: sessionDefault * 60,
      subjectKey: subject.key,
      subjectName: subject.name,
      pausedAt: null,
      elapsedBeforePauseSec: 0,
      sessionDurationSec: sessionDefault * 60,
      breakDurationSec: breakDefault * 60,
    };
    setState(next);
    await Timer.persist(myId, next);
  };

  const togglePause = async () => {
    if (!state) return;
    const next = Timer.isPaused(state) ? Timer.resume(state) : Timer.pause(state);
    setState(next);
    await Timer.persist(myId, next);
  };

  const confirmStop = async () => {
    if (!state) {
      setStopOpen(false);
      return;
    }
    if (state.phase === "session") {
      const actual = Timer.elapsedSec(state);
      await logSession(actual, state.subjectKey, state.subjectName, state.originalStartedAt);
    }
    setState(null);
    await Timer.persist(myId, null);
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
  const total = state?.durationSec ?? 1;
  const pct = state ? ((total - remainingSec) / total) * 100 : 0;

  return (
    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-5 space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <p className="font-display text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
          {state ? (state.phase === "session" ? "Session in progress" : "On break") : "Ready to study"}
        </p>
        {state && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {Timer.fmtHourMin(Timer.elapsedSec(state))} elapsed
          </span>
        )}
      </div>

      {/* Big timer */}
      <div className="text-center py-2">
        <p className="font-display text-6xl text-primary tabular-nums tracking-tight">
          {Timer.fmtMMSS(remainingSec || (state ? 0 : sessionDefault * 60))}
        </p>
        {state?.subjectName && <p className="text-xs text-muted-foreground mt-1">{state.subjectName}</p>}
        {state && (
          <div className="mt-3 h-1.5 rounded-full bg-muted/50 overflow-hidden mx-auto max-w-xs">
            <div
              className="h-full bg-gradient-to-r from-primary/60 to-primary transition-all duration-700"
              style={{ width: `${pct}%`, boxShadow: "0 0 8px hsl(var(--primary) / 0.5)" }}
            />
          </div>
        )}
      </div>

      {/* Controls */}
      {!state ? (
        <div className="space-y-3">
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
            <SelectTrigger><SelectValue placeholder="General study" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="general">General study</SelectItem>
              {subjectOptions.map((o) => (
                <SelectItem key={o.key} value={o.key}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-display text-[9px] uppercase tracking-widest text-muted-foreground">Session min</label>
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
              />
            </div>
            <div>
              <label className="font-display text-[9px] uppercase tracking-widest text-muted-foreground">Break min</label>
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
              />
            </div>
          </div>
          <Button onClick={start} className="w-full"><Play className="size-4" /> Start session</Button>
        </div>
      ) : (
        <div className="flex justify-center gap-2">
          <Button variant="outline" onClick={togglePause}>
            {Timer.isPaused(state) ? <><Play className="size-4" /> Resume</> : <><Pause className="size-4" /> Pause</>}
          </Button>
          <Button variant="destructive" onClick={() => setStopOpen(true)}>
            <Square className="size-4" /> Stop
          </Button>
        </div>
      )}

      <AlertDialog open={stopOpen} onOpenChange={setStopOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End {state?.phase === "break" ? "break" : "session"}?</AlertDialogTitle>
            <AlertDialogDescription>
              {state?.phase === "session" ? "Your time will be logged." : "Your break will be cleared."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmStop}>End</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// Subjects (unchanged)
// ============================================================

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
              <p className="text-[11px] text-muted-foreground"># Module · - Branch · plain line for topic</p>
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
                  you {Timer.fmtHourMin(myH * 3600)} · @{partnerName} {Timer.fmtHourMin(partnerH * 3600)}
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

// ============================================================
// Achievements
// ============================================================

function AchievementsTab({ achievements, myId, partnerName, youName }: { achievements: Achievement[]; myId: string; partnerId: string | null; partnerName: string; youName: string }) {
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
