import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import {
  MILESTONES,
  STATUS_OPTIONS,
  daysAndHoursFromMs,
  daysBetween,
  ncElapsedMs,
  STATUS_GROUPS,
  statusMeta,
  type StatusKey,
} from "@/lib/statuses";
import { resetCounter, pauseCounter, resumeCounter } from "@/server/journey.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Heart, RefreshCw, Pause, Play, ScrollText, Clock } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { insertWithOfflineQueue } from "@/lib/data-client";
import { notify } from "@/lib/notifications";
import { daysUntilNextBirthday } from "@/lib/birthday";

export const Route = createFileRoute("/today")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <TodayPage />
      </AppShell>
    </RequireAuth>
  ),
});

type Row = { id: string; user_id: string; status: string; created_at: string };
type Break = { id: string; broken_by: "him" | "her" | null; note: string | null; created_at: string; kind?: string | null };

const PING_COOLDOWN_MS = 3 * 60 * 60 * 1000; // 3 hours
const STATUS_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours

function formatRemaining(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h <= 0) return `${m}m`;
  return `${h}h ${m}m`;
}

function TodayPage() {
  const { profile, partnerProfile, journey, refresh } = useSession();
  const [mine, setMine] = useState<Row | null>(null);
  const [theirs, setTheirs] = useState<Row | null>(null);
  const [history, setHistory] = useState<Row[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [busyReset, setBusyReset] = useState(false);
  const [busyPause, setBusyPause] = useState(false);
  const [who, setWho] = useState<"him" | "her">("him");
  const [note, setNote] = useState("");
  const [pingExpiresAt, setPingExpiresAt] = useState<number>(0);
  const [pendingStatus, setPendingStatus] = useState<StatusKey | null>(null);
  const [tick, setTick] = useState(0);

  // Today Log state
  const [todayLogOpen, setTodayLogOpen] = useState(false);
  const [partnerStatusesToday, setPartnerStatusesToday] = useState<{ id: string; status: string; created_at: string }[]>([]);
  const [partnerPingsToday, setPartnerPingsToday] = useState<{ id: string; sent_at: string }[]>([]);

  const partnerBirthdayDays = daysUntilNextBirthday((partnerProfile as any)?.birthday ?? null);

  const load = async () => {
    if (!journey || !profile) return;
    const [{ data: all }, { data: allBreaks }] = await Promise.all([
      supabase.from("daily_statuses").select("*").eq("journey_id", journey.id).order("created_at", { ascending: false }),
      supabase.from("nc_breaks").select("*").eq("journey_id", journey.id).order("created_at", { ascending: false }),
    ]);
    const rows = (all ?? []) as Row[];
    setHistory(rows);
    setBreaks((allBreaks ?? []) as Break[]);
    setMine(rows.find((r) => r.user_id === profile.id) ?? null);
    if (partnerProfile) setTheirs(rows.find((r) => r.user_id === partnerProfile.id) ?? null);
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [profile?.id, journey?.id, partnerProfile?.id]);

  useEffect(() => {
    if (!profile) return;
    const key = `shared-silance:last-ping:${profile.id}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      setPingExpiresAt(0);
      return;
    }
    setPingExpiresAt(Number(raw) + PING_COOLDOWN_MS);
  }, [profile]);

  // 1-min tick to update countdown labels and the live hours
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Refresh journey state when the tab regains focus (so partner sees pause/resume)
  useEffect(() => {
    const onFocus = () => {
      refresh().catch(() => undefined);
      load().catch(() => undefined);
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
    /* eslint-disable-next-line */
  }, []);

  useEffect(() => {
    const checkPing = async () => {
      if (!profile) return;
      const { data } = await supabase
        .from("thinking_pings")
        .select("id, sent_at")
        .eq("receiver_id", profile.id)
        .order("sent_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      const key = `shared-silance:last-seen-ping:${profile.id}`;
      const seen = window.localStorage.getItem(key);
      if (seen !== data.id) {
        await notify("Our Journey", "Someone is thinking of you right now 🤍");
        window.localStorage.setItem(key, data.id);
      }
    };
    checkPing().catch(() => undefined);
  }, [profile]);

  // Today Log: load partner activity since 00:00 today and auto-popup if new since last view.
  const loadTodayLog = async (autoOpenIfNew: boolean) => {
    if (!profile?.id || !partnerProfile?.id) return;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const sinceISO = startOfDay.toISOString();
    const [{ data: ss }, { data: pp }] = await Promise.all([
      supabase
        .from("daily_statuses")
        .select("id, status, created_at")
        .eq("user_id", partnerProfile.id)
        .gte("created_at", sinceISO)
        .order("created_at", { ascending: true }),
      supabase
        .from("thinking_pings")
        .select("id, sent_at")
        .eq("sender_id", partnerProfile.id)
        .gte("sent_at", sinceISO)
        .order("sent_at", { ascending: true }),
    ]);
    setPartnerStatusesToday(ss ?? []);
    setPartnerPingsToday(pp ?? []);

    if (!autoOpenIfNew) return;
    const key = `silance_today_last_viewed:${profile.id}`;
    const stored = window.localStorage.getItem(key);
    const latestMs = Math.max(
      0,
      ...((ss ?? []).map((r) => new Date(r.created_at).getTime())),
      ...((pp ?? []).map((r) => new Date(r.sent_at).getTime())),
    );
    if (!stored) {
      // First visit — seed and don't pop.
      window.localStorage.setItem(key, String(Date.now()));
      return;
    }
    if (latestMs > Number(stored) && latestMs > 0) {
      setTodayLogOpen(true);
    }
  };

  useEffect(() => {
    loadTodayLog(true).catch(() => undefined);
    const onFocus = () => loadTodayLog(true).catch(() => undefined);
    const onVis = () => {
      if (document.visibilityState === "visible") onFocus();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
    /* eslint-disable-next-line */
  }, [profile?.id, partnerProfile?.id]);

  const closeTodayLog = () => {
    setTodayLogOpen(false);
    if (profile?.id) {
      window.localStorage.setItem(`silance_today_last_viewed:${profile.id}`, String(Date.now()));
    }
  };

  const todayLogEntries = useMemo(() => {
    const items: { ts: number; kind: "status" | "ping"; label: string; emoji: string }[] = [];
    for (const s of partnerStatusesToday) {
      const m = statusMeta(s.status);
      items.push({
        ts: new Date(s.created_at).getTime(),
        kind: "status",
        label: m.label,
        emoji: m.emoji,
      });
    }
    for (const p of partnerPingsToday) {
      items.push({
        ts: new Date(p.sent_at).getTime(),
        kind: "ping",
        label: "thinking of you",
        emoji: "🤍",
      });
    }
    return items.sort((a, b) => a.ts - b.ts);
  }, [partnerStatusesToday, partnerPingsToday]);


  const cooldownMs = mine ? new Date(mine.created_at).getTime() + STATUS_COOLDOWN_MS - Date.now() : 0;
  const cooldownRemaining = cooldownMs > 0 ? formatRemaining(cooldownMs) : null;
  void tick; // re-render trigger

  const pingMsLeft = pingExpiresAt > 0 ? pingExpiresAt - Date.now() : 0;
  const canPing = pingMsLeft <= 0;

  const submitStatus = async () => {
    if (!profile || !journey || !pendingStatus) return;
    setSubmitting(true);
    const { error, queued } = await insertWithOfflineQueue("daily_statuses", {
      user_id: profile.id,
      journey_id: journey.id,
      status: pendingStatus,
    });
    setSubmitting(false);
    if (queued) {
      toast.message("You're offline — your update will sync when you reconnect");
      setPendingStatus(null);
      return;
    }
    if (error) {
      toast.error(
        error.message.includes("6 hours")
          ? "You can only share once every 6 hours."
          : error.message,
      );
      return;
    }
    setPendingStatus(null);
    toast.success("Update shared");
    if (partnerProfile?.id && profile.username && pendingStatus) {
      try {
        const meta = statusMeta(pendingStatus);
        const { sendPushToPartner } = await import("@/server/push.functions");
        await (sendPushToPartner as any)({
          data: {
            partnerId: partnerProfile.id,
            title: `@${profile.username}`,
            body: `${meta.emoji} ${meta.label}`,
            url: "/today",
          },
        });
      } catch {
        /* push is best-effort */
      }
    }
    load();
  };

  // ---- NC counter: hours + pause aware ----
  const elapsed = journey
    ? ncElapsedMs({
        startAt: journey.nc_start_at ?? journey.nc_start_date,
        isPaused: !!journey.is_paused,
        pausedAt: journey.paused_at,
        pausedTotalSeconds: journey.paused_total_seconds ?? 0,
      })
    : 0;
  const noContact = daysAndHoursFromMs(elapsed);
  const isPaused = !!journey?.is_paused;

  const talkingDays = journey?.talking_since ? daysBetween(journey.talking_since) : 0;
  const counterLabel = profile?.counter_label?.trim() || "Days of no contact";

  const sendThinkingPing = async () => {
    if (!profile || !partnerProfile || !journey || !canPing) return;
    const { error } = await supabase.from("thinking_pings").insert({
      sender_id: profile.id,
      receiver_id: partnerProfile.id,
    });
    if (error) return toast.error(error.message);
    const now = Date.now();
    window.localStorage.setItem(`shared-silance:last-ping:${profile.id}`, String(now));
    setPingExpiresAt(now + PING_COOLDOWN_MS);
    toast.success("Sent.");
  };

  const submitReset = async () => {
    setBusyReset(true);
    try {
      await resetCounter({ data: { brokenBy: who, note: note.trim() || undefined } });
      toast.success("Counter reset. Begin again.");
      setResetOpen(false);
      setNote("");
      await refresh();
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not reset counter");
    } finally {
      setBusyReset(false);
    }
  };

  const submitPauseToggle = async () => {
    setBusyPause(true);
    try {
      if (isPaused) {
        await resumeCounter();
        toast.success("Counter resumed.");
      } else {
        await pauseCounter();
        toast.success("Counter paused.");
      }
      setPauseOpen(false);
      await refresh();
      await load();
    } catch (e: any) {
      toast.error(e.message ?? "Could not update pause state");
    } finally {
      setBusyPause(false);
    }
  };

  // Partner update freshness window (6h)
  const theirsFresh = theirs ? Date.now() - new Date(theirs.created_at).getTime() < STATUS_COOLDOWN_MS : false;

  return (
    <div className="space-y-6">
      <div className="text-center relative">
        <h2 className="font-display text-3xl tracking-widest text-primary">TODAY</h2>
        <p className="text-muted-foreground italic mt-1">Your journey at a glance.</p>
        <button
          aria-label="Open today log"
          onClick={() => setTodayLogOpen(true)}
          className="absolute top-0 right-0 size-8 rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/40 inline-flex items-center justify-center transition-colors"
        >
          <Clock className="size-4" />
        </button>
      </div>

      {/* Today Log + History sheet */}
      <Sheet open={todayLogOpen} onOpenChange={(o) => (o ? setTodayLogOpen(true) : closeTodayLog())}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display tracking-widest">JOURNAL</SheetTitle>
          </SheetHeader>
          <Tabs defaultValue="today" className="mt-5">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="today">Today</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <TabsContent value="today" className="mt-4">
              {todayLogEntries.length === 0 ? (
                <p className="text-sm italic text-muted-foreground text-center py-12">nothing yet today…</p>
              ) : (
                <ol className="relative border-l border-border/60 ml-3 space-y-3">
                  {todayLogEntries.map((e, i) => (
                    <li key={i} className="ml-4">
                      <span className="absolute -left-[7px] mt-2 size-3 rounded-full bg-primary/60 border border-background" />
                      <div className="rounded-xl border border-border/50 bg-card/60 px-3 py-2 flex items-center gap-3">
                        <span className="text-xl shrink-0">{e.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm leading-tight truncate">{e.label}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(e.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </TabsContent>
            <TabsContent value="history" className="mt-4">
              {history.length === 0 ? (
                <p className="text-sm italic text-muted-foreground text-center py-12">nothing yet…</p>
              ) : (
                <ul className="space-y-2">
                  {(() => {
                    // group by date
                    const groups: Record<string, Row[]> = {};
                    for (const r of history) {
                      const d = new Date(r.created_at).toLocaleDateString();
                      groups[d] ??= [];
                      groups[d].push(r);
                    }
                    return Object.entries(groups).map(([date, rows]) => (
                      <li key={date} className="space-y-1.5">
                        <p className="text-[10px] uppercase tracking-widest text-muted-foreground sticky top-0 bg-background/95 backdrop-blur py-1">
                          {date}
                        </p>
                        {rows.map((r) => {
                          const m = statusMeta(r.status);
                          const mine = r.user_id === profile?.id;
                          return (
                            <div
                              key={r.id}
                              className={[
                                "rounded-xl border px-3 py-2 flex items-center gap-3",
                                mine ? "border-primary/30 bg-primary/5" : "border-border/50 bg-card/40",
                              ].join(" ")}
                            >
                              <span className="text-lg shrink-0">{m.emoji}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm leading-tight truncate">{m.label}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">
                                  {mine ? "you" : `@${partnerProfile?.username ?? "partner"}`} ·{" "}
                                  {new Date(r.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </li>
                    ));
                  })()}
                </ul>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>

      {/* NC counter card */}
      <div className="parchment-card rounded-2xl p-6 text-center space-y-3 relative">
        {/* Subtle action icons (top-right) */}
        <div className="absolute top-3 right-3 flex items-center gap-1">
          <button
            aria-label="View break log"
            onClick={() => setLogOpen(true)}
            className="size-8 rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/40 inline-flex items-center justify-center transition-colors"
          >
            <ScrollText className="size-4" />
          </button>
          <button
            aria-label={isPaused ? "Resume counter" : "Pause counter"}
            onClick={() => setPauseOpen(true)}
            className="size-8 rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/40 inline-flex items-center justify-center transition-colors"
          >
            {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
          </button>
          <Dialog open={resetOpen} onOpenChange={setResetOpen}>
            <DialogTrigger asChild>
              <button
                aria-label="Reset counter"
                className="size-8 rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/40 inline-flex items-center justify-center transition-colors"
              >
                <RefreshCw className="size-4" />
              </button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle className="font-display tracking-widest">RESET COUNTER</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="font-display text-xs uppercase tracking-widest">Who broke it?</Label>
                  <RadioGroup value={who} onValueChange={(v) => setWho(v as "him" | "her")} className="mt-2 flex gap-6">
                    <label className="flex items-center gap-2"><RadioGroupItem value="him" /> Him</label>
                    <label className="flex items-center gap-2"><RadioGroupItem value="her" /> Her</label>
                  </RadioGroup>
                </div>
                <div>
                  <Label className="font-display text-xs uppercase tracking-widest">What happened (optional)</Label>
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setResetOpen(false)}>Cancel</Button>
                <Button onClick={submitReset} disabled={busyReset}>{busyReset ? "Resetting…" : "Confirm reset"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <p className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">{counterLabel}</p>
        <div className="font-display text-5xl sm:text-6xl text-primary tabular-nums">
          {noContact.days}
          {isPaused ? (
            <span className="ml-2 align-middle inline-block text-xs uppercase tracking-[0.3em] rounded-full border border-border bg-muted/40 text-muted-foreground px-3 py-1">
              paused
            </span>
          ) : (
            <span className="text-2xl sm:text-3xl text-primary/70"> days, {noContact.hours}h</span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Since {journey
            ? new Date(journey.nc_start_at ?? journey.nc_start_date + "T00:00").toLocaleDateString()
            : "—"}
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {MILESTONES.map((m) => (
            <span
              key={m}
              className={[
                "rounded-full border px-3 py-1 text-[11px] font-display tracking-widest",
                noContact.days >= m
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {m}d
            </span>
          ))}
        </div>
      </div>

      {/* Pause/Resume confirm dialog */}
      <Dialog open={pauseOpen} onOpenChange={setPauseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest">
              {isPaused ? "RESUME COUNTER" : "PAUSE COUNTER"}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {isPaused
              ? "Resume counting from where it stopped?"
              : "Are you sure you want to pause? This means you are in contact right now."}
          </p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPauseOpen(false)}>Cancel</Button>
            <Button onClick={submitPauseToggle} disabled={busyPause}>
              {busyPause ? "Saving…" : isPaused ? "Resume" : "Pause"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Break log dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display tracking-widest">BREAK LOG</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-96 pr-4">
            {breaks.length === 0 ? (
              <p className="text-sm italic text-muted-foreground text-center py-8">No entries yet.</p>
            ) : (
              <ul className="space-y-3">
                {breaks.map((b, idx) => {
                  const kind = (b.kind ?? "reset") as "reset" | "pause" | "resume";
                  // duration of pause = time between this resume and the previous (older) pause for the same journey
                  let pauseDuration: string | null = null;
                  if (kind === "resume") {
                    const earlierPause = breaks
                      .slice(idx + 1)
                      .find((x) => (x.kind ?? "reset") === "pause");
                    if (earlierPause) {
                      const ms = new Date(b.created_at).getTime() - new Date(earlierPause.created_at).getTime();
                      pauseDuration = formatRemaining(Math.max(0, ms));
                    }
                  }
                  const labelMap = { reset: "RESET", pause: "PAUSED", resume: "RESUMED" } as const;
                  return (
                    <li key={b.id} className="border-b border-border/40 pb-3 last:border-0">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="font-display text-sm tracking-widest">
                          {labelMap[kind]}
                          {kind === "reset" && b.broken_by ? ` · ${b.broken_by === "him" ? "HIM" : "HER"}` : ""}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(b.created_at).toLocaleString()}
                        </span>
                      </div>
                      {pauseDuration && (
                        <p className="text-xs text-muted-foreground mt-1">Paused for {pauseDuration}</p>
                      )}
                      {b.note && <p className="text-sm text-muted-foreground mt-1 italic">"{b.note}"</p>}
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Talking + Birthday */}
      <div className="grid grid-cols-2 gap-3">
        <div className="parchment-card rounded-2xl p-4 text-center">
          <p className="font-display text-[10px] uppercase tracking-[0.25em] text-muted-foreground">Days talking</p>
          <div className="mt-1 font-display text-3xl text-primary tabular-nums">{talkingDays}</div>
          <p className="text-[10px] text-muted-foreground mt-1">
            Since {journey?.talking_since ? new Date(`${journey.talking_since}T00:00:00`).toLocaleDateString() : "—"}
          </p>
        </div>
        <div className="parchment-card rounded-2xl p-4 text-center">
          <p className="font-display text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
            @{partnerProfile?.username ?? "partner"}'s birthday
          </p>
          <div className="mt-1 font-display text-3xl text-primary tabular-nums">
            {partnerBirthdayDays === null ? "—" : partnerBirthdayDays === 0 ? "🎂" : partnerBirthdayDays}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {partnerBirthdayDays === null
              ? "not set"
              : partnerBirthdayDays === 0
                ? "today!"
                : `day${partnerBirthdayDays === 1 ? "" : "s"} away`}
          </p>
        </div>
      </div>

      {/* Side-by-side updates with centered ping in between */}
      <div className="parchment-card rounded-2xl p-4 sm:p-5 space-y-4">
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
          <UpdateCard
            label="You"
            name={profile?.display_name ?? profile?.username ?? "You"}
            row={mine}
            fresh={!!mine && Date.now() - new Date(mine.created_at).getTime() < STATUS_COOLDOWN_MS}
            waitingText="Not yet today"
          />
          <PingRing
            canPing={canPing}
            msLeft={pingMsLeft}
            totalMs={PING_COOLDOWN_MS}
            onClick={sendThinkingPing}
          />
          <UpdateCard
            label={`@${partnerProfile?.username ?? "partner"}`}
            name={partnerProfile?.display_name ?? partnerProfile?.username ?? "Them"}
            row={theirsFresh ? theirs : null}
            fresh={theirsFresh}
            waitingText={`waiting for @${partnerProfile?.username ?? "partner"}…`}
            lastSeen={(partnerProfile as any)?.share_last_seen !== false ? (partnerProfile as any)?.last_seen_at ?? null : null}
          />
        </div>

        {/* 6h progress line */}
        <UpdateProgressLine
          lastUpdateMs={mine ? new Date(mine.created_at).getTime() : null}
          windowMs={STATUS_COOLDOWN_MS}
        />

        {/* Picker — collapsed when within cooldown, expandable bottom sheet */}
        {!cooldownRemaining ? (
          <PickerInline
            pendingStatus={pendingStatus}
            setPendingStatus={setPendingStatus}
            onConfirm={submitStatus}
            submitting={submitting}
          />
        ) : (
          <PickerCollapsed
            pendingStatus={pendingStatus}
            setPendingStatus={setPendingStatus}
            onConfirm={submitStatus}
            submitting={submitting}
          />
        )}

        <p className="text-[11px] text-muted-foreground text-center italic">
          {canPing ? " " : `Thinking-of-you available again in ${formatRemaining(pingMsLeft)}`}
        </p>
      </div>

    </div>
  );
}

function UpdateCard({
  label,
  name,
  row,
  fresh,
  waitingText,
  lastSeen,
}: {
  label: string;
  name: string;
  row: Row | null;
  fresh: boolean;
  waitingText: string;
  lastSeen?: string | null;
}) {
  const m = row ? statusMeta(row.status) : null;
  return (
    <div className="parchment-card rounded-2xl p-3 sm:p-4 text-center min-h-[140px] flex flex-col items-center justify-center">
      <p className="font-display text-[10px] uppercase tracking-[0.25em] text-muted-foreground">{label}</p>
      <p className="font-display text-xs mt-1 truncate max-w-full">{name}</p>
      {row && m ? (
        <>
          <div className="my-2 text-3xl">{m.emoji}</div>
          <p className="text-xs leading-tight">{m.label}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            {new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </p>
        </>
      ) : (
        <>
          <div className="my-2 text-3xl text-muted-foreground/50">·</div>
          <p className="text-xs leading-tight italic text-muted-foreground">{waitingText}</p>
        </>
      )}
      {!fresh && row && (
        <p className="text-[10px] text-muted-foreground/70 mt-1 italic">over 6h ago</p>
      )}
      {lastSeen !== undefined && lastSeen && (
        <p className="text-[10px] text-muted-foreground/70 mt-1.5 italic">{formatLastSeen(lastSeen)}</p>
      )}
    </div>
  );
}

function formatLastSeen(iso: string): string {
  const ts = new Date(iso).getTime();
  const now = Date.now();
  const diff = now - ts;
  const day = 86400000;
  if (diff < 0) return "";
  if (diff > day) {
    const days = Math.floor(diff / day);
    return `last seen ${days} day${days === 1 ? "" : "s"} ago`;
  }
  // Within 24h: show today / yesterday with time
  const d = new Date(ts);
  const today = new Date(); today.setHours(0,0,0,0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
  const dayLabel = d.getTime() >= today.getTime() ? "today" : d.getTime() >= yesterday.getTime() ? "yesterday" : "";
  const timeStr = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }).toLowerCase();
  return `last seen ${dayLabel ? dayLabel + " at " : ""}${timeStr}`;
}

function UpdateProgressLine({ lastUpdateMs, windowMs }: { lastUpdateMs: number | null; windowMs: number }) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const elapsed = lastUpdateMs ? Date.now() - lastUpdateMs : windowMs;
  const pct = Math.max(0, Math.min(100, (elapsed / windowMs) * 100));
  const ready = pct >= 100;
  return (
    <div className="relative h-[3px] w-full rounded-full bg-muted/50 overflow-visible">
      <div
        className={[
          "absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-primary/60 to-primary transition-[width] duration-700 ease-out",
          ready && "animate-pulse",
        ].filter(Boolean).join(" ")}
        style={{ width: `${pct}%`, boxShadow: "0 0 8px hsl(var(--primary) / 0.6)" }}
      />
    </div>
  );
}

function PingRing({
  canPing,
  msLeft,
  totalMs,
  onClick,
}: {
  canPing: boolean;
  msLeft: number;
  totalMs: number;
  onClick: () => void;
}) {
  const [, setT] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  const fraction = canPing ? 1 : Math.max(0, Math.min(1, 1 - msLeft / totalMs));
  const size = 56;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center justify-center">
      <button
        onClick={onClick}
        disabled={!canPing}
        aria-label="Send thinking of you"
        className="relative inline-flex items-center justify-center disabled:opacity-60"
        style={{ width: size, height: size }}
      >
        <svg width={size} height={size} className="absolute inset-0 -rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--muted-foreground) / 0.25)" strokeWidth={stroke} fill="none" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="hsl(var(--primary))"
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - fraction)}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s linear" }}
          />
        </svg>
        <span className="relative inline-flex items-center justify-center size-9 rounded-full bg-primary/10 border border-primary/40 text-primary">
          <Heart className={["size-4", canPing && "fill-current"].filter(Boolean).join(" ")} />
        </span>
      </button>
    </div>
  );
}

function PickerInline({
  pendingStatus,
  setPendingStatus,
  onConfirm,
  submitting,
}: {
  pendingStatus: StatusKey | null;
  setPendingStatus: (k: StatusKey | null) => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  const meta = pendingStatus ? statusMeta(pendingStatus) : null;
  return (
    <div className="space-y-3">
      <GroupedOptions pendingStatus={pendingStatus} setPendingStatus={setPendingStatus} submitting={submitting} />
      <Button className="w-full" onClick={onConfirm} disabled={!pendingStatus || submitting}>
        {submitting ? "Sending…" : meta ? `Send — ${meta.label} ${meta.emoji}` : "Confirm update"}
      </Button>
    </div>
  );
}

function GroupedOptions({
  pendingStatus,
  setPendingStatus,
  submitting,
}: {
  pendingStatus: StatusKey | null;
  setPendingStatus: (k: StatusKey | null) => void;
  submitting: boolean;
}) {
  return (
    <div className="space-y-4">
      {STATUS_GROUPS.map((g) => {
        const opts = STATUS_OPTIONS.filter((s) => s.group === g.key);
        if (opts.length === 0) return null;
        return (
          <div key={g.key}>
            <p className="font-display text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{g.label}</p>
            <div className="grid grid-cols-2 gap-2">
              {opts.map((s) => {
                const selected = pendingStatus === s.key;
                return (
                  <button
                    key={s.key}
                    disabled={submitting}
                    onClick={() => setPendingStatus(s.key)}
                    className={[
                      "flex items-center gap-2 rounded-xl border bg-card hover:bg-accent/40 disabled:opacity-50 transition-colors p-3 text-left",
                      selected ? "border-primary bg-primary/10" : "border-border",
                    ].join(" ")}
                  >
                    <span className="text-xl shrink-0">{s.emoji}</span>
                    <span className="text-xs leading-tight">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PickerCollapsed({
  pendingStatus,
  setPendingStatus,
  onConfirm,
  submitting,
}: {
  pendingStatus: StatusKey | null;
  setPendingStatus: (k: StatusKey | null) => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  const [open, setOpen] = useState(false);
  const meta = pendingStatus ? statusMeta(pendingStatus) : null;
  const close = () => { setOpen(false); setPendingStatus(null); };
  const handleConfirm = async () => {
    await onConfirm();
    setOpen(false);
  };
  return (
    <>
      <Button variant="outline" size="sm" className="w-full" onClick={() => setOpen(true)}>
        Send a new update
      </Button>
      <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="font-display tracking-widest">HOW ARE YOU, RIGHT NOW?</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            <GroupedOptions pendingStatus={pendingStatus} setPendingStatus={setPendingStatus} submitting={submitting} />
            <Button className="w-full" onClick={handleConfirm} disabled={!pendingStatus || submitting}>
              {submitting ? "Sending…" : meta ? `Send — ${meta.label} ${meta.emoji}` : "Confirm update"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
