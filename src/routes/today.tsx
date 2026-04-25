import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
import { History, Heart, RefreshCw, Pause, Play, ScrollText } from "lucide-react";
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
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">TODAY</h2>
        <p className="text-muted-foreground italic mt-1">Your journey at a glance.</p>
      </div>

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

      {/* Side-by-side updates */}
      <div className="grid grid-cols-2 gap-3">
        <UpdateCard
          label="You"
          name={profile?.display_name ?? profile?.username ?? "You"}
          row={mine}
          fresh={!!mine && Date.now() - new Date(mine.created_at).getTime() < STATUS_COOLDOWN_MS}
          waitingText="Not yet today"
        />
        <UpdateCard
          label={`@${partnerProfile?.username ?? "partner"}`}
          name={partnerProfile?.display_name ?? partnerProfile?.username ?? "Them"}
          row={theirsFresh ? theirs : null}
          fresh={theirsFresh}
          waitingText={`waiting for @${partnerProfile?.username ?? "partner"}…`}
        />
      </div>

      {/* 16-option update grid */}
      <div className="parchment-card rounded-2xl p-5">
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground text-center mb-4">
          {cooldownRemaining ? `Next update in ${cooldownRemaining}` : "How are you, right now?"}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {STATUS_OPTIONS.map((s) => {
            const selected = pendingStatus === s.key;
            return (
              <button
                key={s.key}
                disabled={submitting || !!cooldownRemaining}
                onClick={() => setPendingStatus(s.key)}
                className={[
                  "flex items-center gap-2 rounded-xl border bg-card hover:bg-accent/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-3 text-left",
                  selected ? "border-primary bg-primary/10" : "border-border",
                ].join(" ")}
              >
                <span className="text-xl shrink-0">{s.emoji}</span>
                <span className="text-xs leading-tight">{s.label}</span>
              </button>
            );
          })}
        </div>
        <Button
          className="w-full mt-4"
          onClick={submitStatus}
          disabled={!pendingStatus || submitting || !!cooldownRemaining}
        >
          {submitting ? "Sending…" : "Confirm update"}
        </Button>
        <Button variant="outline" className="w-full mt-2" onClick={sendThinkingPing} disabled={!canPing}>
          <Heart className="size-4" />
          {canPing ? "Thinking of you" : `Available again in ${formatRemaining(pingMsLeft)}`}
        </Button>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full"><History className="size-4" /> View history</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display tracking-widest">FULL HISTORY</DialogTitle></DialogHeader>
          <ScrollArea className="h-96 pr-4">
            <ul className="space-y-2">
              {history.length === 0 && <li className="text-sm text-muted-foreground italic text-center py-8">Nothing yet.</li>}
              {history.map((r) => {
                const m = statusMeta(r.status);
                const who = r.user_id === profile?.id ? (profile?.display_name ?? "You") : (partnerProfile?.display_name ?? "Them");
                return (
                  <li key={r.id} className="flex items-center justify-between border-b border-border/40 py-2">
                    <span className="flex items-center gap-2"><span className="text-xl">{m.emoji}</span><span className="text-sm">{m.label}</span></span>
                    <span className="text-xs text-muted-foreground">{who} · {new Date(r.created_at).toLocaleString()}</span>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UpdateCard({
  label,
  name,
  row,
  fresh,
  waitingText,
}: {
  label: string;
  name: string;
  row: Row | null;
  fresh: boolean;
  waitingText: string;
}) {
  const m = row ? statusMeta(row.status) : null;
  return (
    <div className="parchment-card rounded-2xl p-4 text-center min-h-[140px] flex flex-col items-center justify-center">
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
    </div>
  );
}
