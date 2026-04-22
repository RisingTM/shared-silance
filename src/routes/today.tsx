import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { MILESTONES, STATUS_OPTIONS, daysBetween, statusMeta, type StatusKey } from "@/lib/statuses";
import { resetCounter } from "@/server/journey.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { History, Heart } from "lucide-react";
import { insertWithOfflineQueue } from "@/lib/data-client";
import { notify, requestNotificationPermission } from "@/lib/notifications";

export const Route = createFileRoute("/today")({
  component: () => (<RequireAuth><AppShell><TodayPage /></AppShell></RequireAuth>),
});

type Row = { id: string; user_id: string; status: string; created_at: string };
type Break = { id: string; broken_by: "him" | "her"; note: string | null; created_at: string };

function TodayPage() {
  const { profile, partnerProfile, journey, refresh } = useSession();
  const [mine, setMine] = useState<Row | null>(null);
  const [theirs, setTheirs] = useState<Row | null>(null);
  const [history, setHistory] = useState<Row[]>([]);
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [busyReset, setBusyReset] = useState(false);
  const [who, setWho] = useState<"him" | "her">("him");
  const [note, setNote] = useState("");
  const [canPing, setCanPing] = useState(true);
  const [showDigest, setShowDigest] = useState(false);
  const [digestLine, setDigestLine] = useState<string>("");

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

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.id, journey?.id, partnerProfile?.id]);
  useEffect(() => {
    requestNotificationPermission().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const key = `shared-silance:last-ping:${profile.id}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    const elapsed = Date.now() - Number(raw);
    setCanPing(elapsed > 3 * 60 * 60 * 1000);
  }, [profile]);

  useEffect(() => {
    const now = new Date();
    setShowDigest(now.getDay() === 0);
  }, []);
  useEffect(() => {
    const loadDigestLine = async () => {
      if (!profile || !showDigest) return;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const { data } = await supabase
        .from("journal_entries")
        .select("body, body_encrypted")
        .eq("user_id", profile.id)
        .lt("created_at", monthStart)
        .order("created_at", { ascending: false })
        .limit(20);
      const lines = (data ?? [])
        .map((r: any) => (r.body || "").trim())
        .filter((v: string) => v.length > 0);
      if (lines.length > 0) setDigestLine(lines[Math.floor(Math.random() * lines.length)]);
    };
    loadDigestLine().catch(() => undefined);
  }, [profile, showDigest]);
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
        await notify("Shared Silance", "Someone is thinking of you right now 🤍");
        window.localStorage.setItem(key, data.id);
      }
    };
    checkPing().catch(() => undefined);
  }, [profile]);

  const setStatus = async (key: StatusKey) => {
    if (!profile || !journey) return;
    setSubmitting(true);
    const { error, queued } = await insertWithOfflineQueue("daily_statuses", {
      user_id: profile.id, journey_id: journey.id, status: key,
    });
    setSubmitting(false);
    if (queued) {
      toast.message("You're offline — your entry will sync when you reconnect");
      return;
    }
    if (error) {
      toast.error(error.message.includes("12 hours") ? "You've already shared today. Try again in 12 hours." : error.message);
      return;
    }
    toast.success("Status shared");
    load();
  };

  const cooldownRemaining = (() => {
    if (!mine) return null;
    const next = new Date(mine.created_at).getTime() + 12 * 3600 * 1000;
    const ms = next - Date.now();
    if (ms <= 0) return null;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  })();
  const noContactDays = journey ? daysBetween(journey.nc_start_date) : 0;
  const talkingDays = journey?.talking_since ? daysBetween(journey.talking_since) : 0;
  const counterLabel = profile?.counter_label?.trim() || "Days of no contact";
  const lastCheckInAt = mine ? new Date(mine.created_at).getTime() : 0;
  const missedWindow = lastCheckInAt > 0 && Date.now() - lastCheckInAt > 24 * 3600 * 1000;
  const weekCount = history.filter((r) => {
    const d = new Date(r.created_at);
    const now = new Date();
    return d >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
  }).length;
  const avgMood = "—";

  const sendThinkingPing = async () => {
    if (!profile || !partnerProfile || !journey || !canPing) return;
    const { error } = await supabase.from("thinking_pings").insert({
      sender_id: profile.id,
      receiver_id: partnerProfile.id,
    });
    if (error) return toast.error(error.message);
    window.localStorage.setItem(`shared-silance:last-ping:${profile.id}`, String(Date.now()));
    setCanPing(false);
    toast.success("Sent.");
  };

  useEffect(() => {
    const logMiss = async () => {
      if (!profile || !mine || !missedWindow) return;
      const key = `shared-silance:miss-log:${profile.id}:${new Date().toISOString().slice(0, 10)}`;
      if (window.localStorage.getItem(key)) return;
      await supabase.from("checkin_miss_log").insert({
        user_id: profile.id,
        missed_date: new Date().toISOString().slice(0, 10),
      });
      window.localStorage.setItem(key, "1");
    };
    logMiss().catch(() => undefined);
  }, [profile, mine, missedWindow]);

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

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">TODAY</h2>
        <p className="text-muted-foreground italic mt-1">Your journey at a glance.</p>
      </div>

      <PartnerActivity partnerId={partnerProfile?.id} partnerUsername={partnerProfile?.username} />

      {showDigest && (
        <div className="parchment-card rounded-2xl p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm">
              <p className="font-display tracking-wider">Weekly summary</p>
              <p className="text-muted-foreground">Check-ins this week: {weekCount} · No-contact: {noContactDays} · Avg mood: {avgMood}</p>
              {digestLine && <p className="text-muted-foreground mt-1 italic">From a previous month: "{digestLine.slice(0, 140)}"</p>}
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowDigest(false)}>Dismiss</Button>
          </div>
        </div>
      )}
      <div className="parchment-card rounded-2xl p-6 text-center space-y-4">
        <p className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">{counterLabel}</p>
        <div className="font-display text-6xl text-primary tabular-nums">{noContactDays}</div>
        <p className="text-xs text-muted-foreground">Since {journey ? new Date(journey.nc_start_date + "T00:00").toLocaleDateString() : "—"}</p>
        <div className="flex flex-wrap justify-center gap-2">
          {MILESTONES.map((m) => (
            <span
              key={m}
              className={[
                "rounded-full border px-3 py-1 text-xs font-display tracking-widest",
                noContactDays >= m ? "border-primary/40 bg-primary/15 text-primary" : "border-border bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {m}d
            </span>
          ))}
        </div>
        <Dialog open={resetOpen} onOpenChange={setResetOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full h-11">Reset counter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display tracking-widest">RESET COUNTER</DialogTitle></DialogHeader>
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

      <div className="parchment-card rounded-2xl p-6 text-center">
        <p className="font-display text-xs uppercase tracking-[0.35em] text-muted-foreground">Days since we started talking</p>
        <div className="mt-2 font-display text-5xl text-primary tabular-nums">{talkingDays}</div>
        <p className="text-xs text-muted-foreground mt-2">Since {journey?.talking_since ? new Date(`${journey.talking_since}T00:00:00`).toLocaleDateString() : "—"}</p>
      </div>

      {missedWindow && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-muted-foreground">
          Gentle nudge: you have not checked in yet in your rolling 24-hour window.
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        <StatusCard label="You" name={profile?.display_name ?? "You"} row={mine} />
        <StatusCard label="Them" name={partnerProfile?.display_name ?? "—"} row={theirs} />
      </div>

      <div className="parchment-card rounded-2xl p-6">
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground text-center mb-4">
          {cooldownRemaining ? `Next update in ${cooldownRemaining}` : "How are you, right now?"}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.key}
              disabled={submitting || !!cooldownRemaining}
              onClick={() => setStatus(s.key)}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card hover:bg-accent/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-4"
            >
              <span className="text-3xl">{s.emoji}</span>
              <span className="text-sm">{s.label}</span>
            </button>
          ))}
        </div>
        <Button variant="outline" className="w-full mt-4" onClick={sendThinkingPing} disabled={!canPing}>
          <Heart className="size-4" />
          {canPing ? "Thinking of you" : "Thinking ping sent recently"}
        </Button>
      </div>

      {(journey?.has_been_reset || breaks.length > 0) && (
        <div className="parchment-card rounded-2xl p-6">
          <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground mb-4">Break log</h3>
          {breaks.length === 0 && <p className="text-sm italic text-muted-foreground">No breaks recorded.</p>}
          <ul className="space-y-3">
            {breaks.map((b) => (
              <li key={b.id} className="border-b border-border/40 pb-3 last:border-0">
                <div className="flex justify-between items-baseline">
                  <span className="font-display text-sm tracking-widest">{b.broken_by === "him" ? "HIM" : "HER"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</span>
                </div>
                {b.note && <p className="text-sm text-muted-foreground mt-1 italic">"{b.note}"</p>}
              </li>
            ))}
          </ul>
        </div>
      )}

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

function StatusCard({ label, name, row }: { label: string; name: string; row: Row | null }) {
  const m = row ? statusMeta(row.status) : null;
  return (
    <div className="parchment-card rounded-2xl p-6 text-center">
      <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
      <p className="font-display text-lg mt-1">{name}</p>
      <div className="my-6 text-6xl">{m?.emoji ?? "·"}</div>
      <p className="text-base">{m?.label ?? "Not yet today"}</p>
      {row && <p className="text-xs text-muted-foreground mt-2">{new Date(row.created_at).toLocaleString()}</p>}
    </div>
  );
}
