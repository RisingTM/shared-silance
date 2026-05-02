import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { duaForDate } from "@/lib/dua";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Clock, Crown, Minus, Plus, Trophy, X } from "lucide-react";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Progress } from "@/components/ui/progress";
import { WeekCircles, weekRangeLabel, weekStartSaturday } from "@/components/WeekCircles";
import { toast } from "sonner";

export const Route = createFileRoute("/deen")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <DeenPage />
      </AppShell>
    </RequireAuth>
  ),
});

const PRAYERS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;
const ATHKAR_KINDS = [
  { kind: "morning", label: "Morning athkar" },
  { kind: "evening", label: "Evening athkar" },
] as const;
const DHIKR_PRESETS = [
  { kind: "subhanallah", label: "SubhanAllah" },
  { kind: "alhamdulillah", label: "Alhamdulillah" },
  { kind: "allahuakbar", label: "Allahu Akbar" },
] as const;
const ASTAGHFIRULLAH = { kind: "astaghfirullah", label: "Astaghfirullah" } as const;

const EMPTY_WEEK: boolean[] = [false, false, false, false, false, false, false];

function DeenPage() {
  const ws = useMemo(() => weekStartSaturday(), []);
  return (
    <div className="space-y-6">
      <div className="text-center relative">
        <h2 className="font-display text-3xl tracking-widest text-primary">DEEN</h2>
        <p className="text-muted-foreground italic mt-1">{weekRangeLabel(ws)}</p>
        <DeenLogButton />
      </div>

      <PrayerTracker />
      <FastingTracker />
      <AthkarTracker />
      <QuranTracker />
      <DuaSection />
    </div>
  );
}

function DeenLogButton() {
  const { user, partnerProfile } = useSession();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<{ key: string; label: string }[]>([]);
  const lsKey = user ? `silance_deen_last_viewed:${user.id}` : "";

  const buildSummary = async (autoOpen: boolean) => {
    if (!user || !partnerProfile?.id) return;
    const stored = window.localStorage.getItem(lsKey);
    const sinceISO = stored ? new Date(Number(stored)).toISOString() : new Date(Date.now() - 7 * 86400000).toISOString();

    const [
      { data: dhikr },
      { data: quran },
      { data: prayers },
      { data: athkar },
      { data: fasting },
    ] = await Promise.all([
      supabase.from("deen_quran_log").select("pages, created_at").eq("user_id", partnerProfile.id).gte("created_at", sinceISO),
      supabase.from("deen_quran_log").select("pages, created_at").eq("user_id", partnerProfile.id).gte("created_at", sinceISO),
      supabase.from("deen_prayers").select("prayer, days, updated_at").eq("user_id", partnerProfile.id).gte("updated_at", sinceISO),
      supabase.from("deen_athkar").select("kind, days, updated_at").eq("user_id", partnerProfile.id).gte("updated_at", sinceISO),
      supabase.from("deen_fasting").select("days, updated_at").eq("user_id", partnerProfile.id).gte("updated_at", sinceISO),
    ]);

    // Dhikr deltas — compare current count vs at-last-view by reading dhikr table snapshots
    // Simpler: report current totals if updated since last view
    const { data: dhikrNow } = await supabase
      .from("deen_dhikr")
      .select("kind, count, updated_at")
      .eq("user_id", partnerProfile.id)
      .gte("updated_at", sinceISO);

    const items: { key: string; label: string }[] = [];

    if (dhikrNow && dhikrNow.length) {
      const labelMap: Record<string, string> = {
        astaghfirullah: "Astaghfirullah",
        subhanallah: "SubhanAllah",
        alhamdulillah: "Alhamdulillah",
        allahuakbar: "Allahu Akbar",
      };
      const parts = dhikrNow
        .map((r: any) => `${labelMap[r.kind] ?? r.kind} (${r.count})`)
        .join(", ");
      if (parts) items.push({ key: "dhikr", label: `Dhikr — ${parts}` });
    }

    const quranPages = (quran ?? []).reduce((s: number, r: any) => s + (r.pages ?? 0), 0);
    if (quranPages > 0) items.push({ key: "quran", label: `Quran — +${quranPages} page${quranPages === 1 ? "" : "s"}` });

    if (prayers && prayers.length) {
      const names = prayers.map((p: any) => p.prayer).join(", ");
      items.push({ key: "prayers", label: `Prayers — updated ${names}` });
    }

    if (athkar && athkar.length) {
      const names = athkar.map((a: any) => a.kind).join(", ");
      items.push({ key: "athkar", label: `Athkar — ${names}` });
    }

    if (fasting && fasting.length) {
      items.push({ key: "fasting", label: `Fasting — updated this week` });
    }

    setSummary(items);

    if (!stored) {
      window.localStorage.setItem(lsKey, String(Date.now()));
      return;
    }
    if (autoOpen && items.length > 0) setOpen(true);
  };

  useEffect(() => {
    buildSummary(true).catch(() => undefined);
    /* eslint-disable-next-line */
  }, [user?.id, partnerProfile?.id]);

  const close = () => {
    setOpen(false);
    if (lsKey) window.localStorage.setItem(lsKey, String(Date.now()));
  };

  if (!partnerProfile) return null;

  return (
    <>
      <button
        aria-label="Open deen log"
        onClick={() => setOpen(true)}
        className="absolute top-0 right-0 size-8 rounded-full text-muted-foreground/60 hover:text-muted-foreground hover:bg-accent/40 inline-flex items-center justify-center transition-colors"
      >
        <Clock className="size-4" />
      </button>
      <Sheet open={open} onOpenChange={(o) => (o ? setOpen(true) : close())}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="font-display tracking-widest">DEEN LOG</SheetTitle>
          </SheetHeader>
          <p className="text-[11px] text-muted-foreground mt-2 italic">
            What @{partnerProfile.username} has done since you last visited.
          </p>
          <div className="mt-5 space-y-2">
            {summary.length === 0 ? (
              <p className="text-sm italic text-muted-foreground text-center py-12">nothing new yet…</p>
            ) : (
              summary.map((s) => (
                <div key={s.key} className="rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-sm">
                  {s.label}
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function TrackerCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="parchment-card rounded-2xl p-5 space-y-4">
      <h3 className="font-display text-sm uppercase tracking-widest text-primary">{title}</h3>
      {children}
    </div>
  );
}

// Aligned 2-column row: fixed 80px label column + circles area.
function AlignedRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-2 items-center">
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">{label}</p>
      <div>{children}</div>
    </div>
  );
}

function PrayerTracker() {
  const { user, partnerProfile } = useSession();
  const ws = useMemo(() => weekStartSaturday(), []);
  const [mine, setMine] = useState<Record<string, boolean[]>>({});
  const [theirs, setTheirs] = useState<Record<string, boolean[]>>({});

  const load = async () => {
    if (!user) return;
    const ids = [user.id, partnerProfile?.id].filter(Boolean) as string[];
    const { data } = await supabase
      .from("deen_prayers").select("*").in("user_id", ids).eq("week_start", ws);
    const m: Record<string, boolean[]> = {};
    const t: Record<string, boolean[]> = {};
    for (const p of PRAYERS) { m[p] = [...EMPTY_WEEK]; t[p] = [...EMPTY_WEEK]; }
    (data ?? []).forEach((r: any) => {
      if (r.user_id === user.id) m[r.prayer] = (r.days as boolean[]) ?? m[r.prayer];
      else t[r.prayer] = (r.days as boolean[]) ?? t[r.prayer];
    });
    setMine(m); setTheirs(t);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, partnerProfile?.id]);

  const toggle = async (prayer: string, idx: number, next: boolean) => {
    if (!user) return;
    const current = mine[prayer] ?? [...EMPTY_WEEK];
    const updated = current.map((v, i) => (i === idx ? next : v));
    setMine({ ...mine, [prayer]: updated });
    const { error } = await supabase.from("deen_prayers").upsert(
      { user_id: user.id, week_start: ws, prayer, days: updated, updated_at: new Date().toISOString() },
      { onConflict: "user_id,week_start,prayer" },
    );
    if (error) toast.error(error.message);
  };

  const partnerLabel = `@${partnerProfile?.username ?? "partner"}`;

  return (
    <TrackerCard title="Prayers">
      <div className="space-y-5">
        {PRAYERS.map((p) => (
          <div key={p} className="space-y-2">
            <p className="text-xs font-display uppercase tracking-widest">{p}</p>
            <div className="space-y-2">
              <AlignedRow label="You">
                <WeekCircles days={mine[p] ?? EMPTY_WEEK} onToggle={(i, n) => toggle(p, i, n)} size="sm" tone="gold" />
              </AlignedRow>
              <AlignedRow label={partnerLabel}>
                <WeekCircles days={theirs[p] ?? EMPTY_WEEK} size="sm" readOnly tone="muted" />
              </AlignedRow>
            </div>
          </div>
        ))}
      </div>
    </TrackerCard>
  );
}

function AthkarTracker() {
  const { user, partnerProfile } = useSession();
  const ws = useMemo(() => weekStartSaturday(), []);
  const [mine, setMine] = useState<Record<string, boolean[]>>({});
  const [theirs, setTheirs] = useState<Record<string, boolean[]>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [partnerCounts, setPartnerCounts] = useState<Record<string, number>>({});

  const load = async () => {
    if (!user) return;
    const ids = [user.id, partnerProfile?.id].filter(Boolean) as string[];
    const [{ data: a }, { data: d }] = await Promise.all([
      supabase.from("deen_athkar").select("*").in("user_id", ids).eq("week_start", ws),
      supabase.from("deen_dhikr").select("*").in("user_id", ids),
    ]);
    const m: Record<string, boolean[]> = {};
    const t: Record<string, boolean[]> = {};
    for (const k of ATHKAR_KINDS) { m[k.kind] = [...EMPTY_WEEK]; t[k.kind] = [...EMPTY_WEEK]; }
    (a ?? []).forEach((r: any) => {
      if (r.user_id === user.id) m[r.kind] = (r.days as boolean[]) ?? m[r.kind];
      else t[r.kind] = (r.days as boolean[]) ?? t[r.kind];
    });
    setMine(m); setTheirs(t);
    const c: Record<string, number> = {};
    const pc: Record<string, number> = {};
    (d ?? []).forEach((r: any) => {
      if (r.user_id === user.id) c[r.kind] = r.count ?? 0;
      else pc[r.kind] = r.count ?? 0;
    });
    setCounts(c); setPartnerCounts(pc);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, partnerProfile?.id]);

  const toggle = async (kind: string, idx: number, next: boolean) => {
    if (!user) return;
    const current = mine[kind] ?? [...EMPTY_WEEK];
    const updated = current.map((v, i) => (i === idx ? next : v));
    setMine({ ...mine, [kind]: updated });
    await supabase.from("deen_athkar").upsert(
      { user_id: user.id, week_start: ws, kind, days: updated, updated_at: new Date().toISOString() },
      { onConflict: "user_id,week_start,kind" },
    );
  };

  const incDhikr = async (kind: string) => {
    if (!user) return;
    const next = (counts[kind] ?? 0) + 1;
    setCounts({ ...counts, [kind]: next });
    await supabase.from("deen_dhikr").upsert(
      { user_id: user.id, kind, count: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id,kind" },
    );
  };

  const partnerLabel = `@${partnerProfile?.username ?? "partner"}`;

  return (
    <TrackerCard title="Athkar">
      <div className="space-y-5">
        {ATHKAR_KINDS.map((k) => (
          <div key={k.kind} className="space-y-2">
            <p className="text-xs font-display uppercase tracking-widest">{k.label}</p>
            <div className="space-y-2">
              <AlignedRow label="You">
                <WeekCircles days={mine[k.kind] ?? EMPTY_WEEK} onToggle={(i, n) => toggle(k.kind, i, n)} size="sm" tone="gold" />
              </AlignedRow>
              <AlignedRow label={partnerLabel}>
                <WeekCircles days={theirs[k.kind] ?? EMPTY_WEEK} size="sm" readOnly tone="muted" />
              </AlignedRow>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border/50 pt-3 space-y-3">
        <p className="text-xs font-display uppercase tracking-widest text-muted-foreground">Dhikr counter</p>

        {/* Astaghfirullah — full-width prominent */}
        <DhikrCard
          kind={ASTAGHFIRULLAH.kind}
          label={ASTAGHFIRULLAH.label}
          mine={counts[ASTAGHFIRULLAH.kind] ?? 0}
          theirs={partnerCounts[ASTAGHFIRULLAH.kind] ?? 0}
          partnerLabel={partnerLabel}
          onTap={() => incDhikr(ASTAGHFIRULLAH.kind)}
          prominent
        />

        {/* The other three side-by-side */}
        <div className="grid grid-cols-3 gap-2">
          {DHIKR_PRESETS.map((d) => (
            <DhikrCard
              key={d.kind}
              kind={d.kind}
              label={d.label}
              mine={counts[d.kind] ?? 0}
              theirs={partnerCounts[d.kind] ?? 0}
              partnerLabel={partnerLabel}
              onTap={() => incDhikr(d.kind)}
            />
          ))}
        </div>
      </div>
    </TrackerCard>
  );
}

function DhikrCard({
  label,
  mine,
  theirs,
  partnerLabel,
  onTap,
  prominent,
}: {
  kind: string;
  label: string;
  mine: number;
  theirs: number;
  partnerLabel: string;
  onTap: () => void;
  prominent?: boolean;
}) {
  const youLead = mine > theirs;
  const theyLead = theirs > mine;
  const diff = Math.abs(mine - theirs);
  if (prominent) {
    return (
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-center">
        <p className="text-xs font-display tracking-wider text-primary">{label}</p>
        <button
          onClick={onTap}
          className="mt-2 w-full rounded-lg border border-primary/40 bg-card hover:bg-accent/40 py-3 transition-colors"
        >
          <p className="font-display text-4xl text-primary tabular-nums inline-flex items-center gap-2">
            {youLead && <Crown className="size-5 text-amber-500" />}
            {mine}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">tap +1</p>
          {youLead && diff > 0 && <p className="text-[10px] text-amber-600/80 dark:text-amber-400/80">+{diff} ahead</p>}
        </button>
        <p className="text-[10px] text-muted-foreground mt-2 truncate inline-flex items-center gap-1 justify-center w-full">
          {theyLead && <Crown className="size-3 text-amber-500" />}
          {partnerLabel}: <span className="text-foreground tabular-nums">{theirs}</span>
        </p>
        {theyLead && diff > 0 && <p className="text-[10px] text-muted-foreground/80 mt-0.5">{diff} behind</p>}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border bg-card/40 p-2 text-center">
      <p className="text-[11px] font-display tracking-wider">{label}</p>
      <button
        onClick={onTap}
        className="mt-1 w-full rounded-lg border border-border bg-card hover:bg-accent/40 py-2 transition-colors"
      >
        <p className="font-display text-2xl text-primary tabular-nums inline-flex items-center gap-1">
          {youLead && <Crown className="size-3.5 text-amber-500" />}
          {mine}
        </p>
        <p className="text-[10px] text-muted-foreground">tap +1</p>
        {youLead && diff > 0 && <p className="text-[9px] text-amber-600/80 dark:text-amber-400/80">+{diff} ahead</p>}
      </button>
      <p className="text-[10px] text-muted-foreground mt-1 truncate inline-flex items-center gap-1 justify-center w-full">
        {theyLead && <Crown className="size-3 text-amber-500" />}
        {partnerLabel}: <span className="text-foreground tabular-nums">{theirs}</span>
      </p>
      {theyLead && diff > 0 && <p className="text-[9px] text-muted-foreground/80">{diff} behind</p>}
    </div>
  );
}

const QURAN_TOTAL = 604;

function QuranTracker() {
  const { user, partnerProfile } = useSession();
  const [page, setPage] = useState(0);
  const [partnerPage, setPartnerPage] = useState(0);
  const [completions, setCompletions] = useState(0);
  const [partnerCompletions, setPartnerCompletions] = useState(0);

  const load = async () => {
    if (!user) return;
    const ids = [user.id, partnerProfile?.id].filter(Boolean) as string[];
    const [{ data }, { data: profs }] = await Promise.all([
      supabase.from("deen_quran").select("user_id, current_page").in("user_id", ids),
      supabase.from("profiles").select("id, quran_completions").in("id", ids),
    ]);
    let mine = 0, theirs = 0;
    (data ?? []).forEach((r: any) => {
      if (r.user_id === user.id) mine = r.current_page ?? 0;
      else theirs = r.current_page ?? 0;
    });
    setPage(mine); setPartnerPage(theirs);
    let myc = 0, thc = 0;
    (profs ?? []).forEach((p: any) => {
      if (p.id === user.id) myc = p.quran_completions ?? 0;
      else thc = p.quran_completions ?? 0;
    });
    setCompletions(myc); setPartnerCompletions(thc);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, partnerProfile?.id]);

  const writePage = async (next: number, delta: number) => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("deen_quran").upsert(
      { user_id: user.id, current_page: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    await supabase.from("deen_quran_log").insert({ user_id: user.id, log_date: today, pages: delta });
  };

  const inc = async () => {
    if (!user) return;
    let next = page + 1;
    if (next >= QURAN_TOTAL) {
      // Complete a read
      await writePage(QURAN_TOTAL, 1);
      const newCompletions = completions + 1;
      await supabase.from("profiles").update({ quran_completions: newCompletions } as any).eq("id", user.id);
      // Reset
      await writePage(0, 0);
      setPage(0);
      setCompletions(newCompletions);
      toast.success(`MashaAllah — ${newCompletions} complete read${newCompletions === 1 ? "" : "s"}!`);
      return;
    }
    setPage(next);
    await writePage(next, 1);
  };

  const dec = async () => {
    if (!user || page <= 0) return;
    const next = Math.max(0, page - 1);
    setPage(next);
    await writePage(next, -1);
  };

  const myPct = Math.min(100, (page / QURAN_TOTAL) * 100);
  const theirPct = Math.min(100, (partnerPage / QURAN_TOTAL) * 100);

  return (
    <TrackerCard title="Quran progress">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card/40 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">You</p>
            {completions > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-display tracking-wider text-amber-600 dark:text-amber-400">
                <Trophy className="size-3" /> +{completions}
              </span>
            )}
          </div>
          <p className="font-display text-3xl text-primary tabular-nums mt-1">{page}</p>
          <p className="text-[10px] text-muted-foreground">Page {page} of {QURAN_TOTAL}</p>
          <Progress value={myPct} className="mt-2 h-1.5" />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button size="sm" onClick={inc} aria-label="Read 1 page">
              <Plus className="size-3" />
              <span className="hidden sm:inline ml-1">Read 1 page</span>
            </Button>
            <Button size="sm" variant="outline" onClick={dec} disabled={page <= 0} aria-label="Remove 1 page">
              <Minus className="size-3" />
              <span className="hidden sm:inline ml-1">Remove 1</span>
            </Button>
          </div>
        </div>
        <div className="rounded-xl border border-amber-200/40 dark:border-amber-900/40 bg-amber-200/10 dark:bg-amber-900/10 p-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
              @{partnerProfile?.username ?? "partner"}
            </p>
            {partnerCompletions > 0 && (
              <span className="inline-flex items-center gap-1 text-[10px] font-display tracking-wider text-amber-600 dark:text-amber-400">
                <Trophy className="size-3" /> +{partnerCompletions}
              </span>
            )}
          </div>
          <p className="font-display text-3xl text-foreground/80 tabular-nums mt-1">{partnerPage}</p>
          <p className="text-[10px] text-muted-foreground">Page {partnerPage} of {QURAN_TOTAL}</p>
          <Progress value={theirPct} className="mt-2 h-1.5" />
          <p className="text-[10px] text-muted-foreground mt-2 italic">read-only</p>
        </div>
      </div>
    </TrackerCard>
  );
}


function FastingTracker() {
  const { user, partnerProfile } = useSession();
  const ws = useMemo(() => weekStartSaturday(), []);
  const [days, setDays] = useState<boolean[]>([...EMPTY_WEEK]);
  const [partnerDays, setPartnerDays] = useState<boolean[]>([...EMPTY_WEEK]);

  const load = async () => {
    if (!user) return;
    const ids = [user.id, partnerProfile?.id].filter(Boolean) as string[];
    const { data } = await supabase.from("deen_fasting").select("*").in("user_id", ids).eq("week_start", ws);
    let mine = [...EMPTY_WEEK], theirs = [...EMPTY_WEEK];
    (data ?? []).forEach((r: any) => {
      if (r.user_id === user.id) mine = r.days ?? mine;
      else theirs = r.days ?? theirs;
    });
    setDays(mine); setPartnerDays(theirs);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, partnerProfile?.id]);

  const toggle = async (idx: number, next: boolean) => {
    if (!user) return;
    const updated = days.map((v, i) => (i === idx ? next : v));
    setDays(updated);
    await supabase.from("deen_fasting").upsert(
      { user_id: user.id, week_start: ws, days: updated, updated_at: new Date().toISOString() },
      { onConflict: "user_id,week_start" },
    );
  };

  const partnerLabel = `@${partnerProfile?.username ?? "partner"}`;

  return (
    <TrackerCard title="Fasting">
      <div className="space-y-2">
        <AlignedRow label="You">
          <WeekCircles days={days} onToggle={toggle} size="sm" tone="gold" />
        </AlignedRow>
        <AlignedRow label={partnerLabel}>
          <WeekCircles days={partnerDays} size="sm" readOnly tone="muted" />
        </AlignedRow>
      </div>
    </TrackerCard>
  );
}

function DuaSection() {
  const { user } = useSession();
  const [offset, setOffset] = useState(0);
  const [personal, setPersonal] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [arabic, setArabic] = useState("");
  const [english, setEnglish] = useState("");

  const date = new Date();
  date.setDate(date.getDate() + offset);
  const general = duaForDate(date);
  const dayIndex = Math.abs(Math.floor(date.getTime() / 86400000));
  const pickPersonal = personal.length > 0 && dayIndex % 2 === 1 ? personal[dayIndex % personal.length] : null;
  const dua = pickPersonal
    ? { ...pickPersonal, transliteration: pickPersonal.transliteration || "", theme: `${pickPersonal.title || "Personal"} · personal` }
    : general;

  const loadPersonal = async () => {
    if (!user) return;
    const { data } = await supabase.from("personal_duas").select("*").eq("user_id", user.id).order("created_at", { ascending: true });
    setPersonal(data ?? []);
  };
  useEffect(() => { loadPersonal(); /* eslint-disable-next-line */ }, [user?.id]);

  const savePersonal = async () => {
    if (!user || !arabic.trim() || !english.trim()) return;
    await supabase.from("personal_duas").insert({
      user_id: user.id,
      text: [title.trim(), arabic.trim(), english.trim()].filter(Boolean).join("\n\n"),
    });
    setTitle(""); setArabic(""); setEnglish("");
    setOpen(false);
    loadPersonal();
  };

  return (
    <div className="space-y-4">
      <div className="parchment-card rounded-2xl p-6 sm:p-10">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground text-center">{dua.theme}</p>
        <p className="font-arabic text-2xl sm:text-4xl text-right leading-loose mt-6 text-foreground">{dua.arabic}</p>
        <p className="mt-4 italic text-muted-foreground text-base sm:text-lg leading-relaxed">{dua.transliteration}</p>
        <div className="mt-4 border-t border-border/50 pt-4">
          <p className="text-base sm:text-lg leading-relaxed">{dua.english}</p>
        </div>
        <div className="flex justify-between gap-2 mt-5">
          <Button variant="outline" size="sm" onClick={() => setOffset(offset - 1)}>
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setOffset(0)} disabled={offset === 0}>Today</Button>
          <Button variant="outline" size="sm" onClick={() => setOffset(offset + 1)}>
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="parchment-card rounded-2xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-sm uppercase tracking-widest">Your personal duas</h3>
          <Button size="icon" variant="ghost" aria-label={open ? "Close" : "Add personal dua"} onClick={() => setOpen((v) => !v)}>
            {open ? <X className="size-4" /> : <Plus className="size-4" />}
          </Button>
        </div>
        {open && (
          <div className="space-y-2">
            <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea placeholder="Arabic" value={arabic} onChange={(e) => setArabic(e.target.value)} rows={2} />
            <Textarea placeholder="English" value={english} onChange={(e) => setEnglish(e.target.value)} rows={2} />
            <Button size="sm" onClick={savePersonal}>Save personal dua</Button>
          </div>
        )}
        {personal.length > 0 && (
          <p className="text-xs text-muted-foreground">{personal.length} saved</p>
        )}
      </div>
    </div>
  );
}
