import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { duaForDate } from "@/lib/dua";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus, X } from "lucide-react";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

const EMPTY_WEEK: boolean[] = [false, false, false, false, false, false, false];

function DeenPage() {
  const ws = useMemo(() => weekStartSaturday(), []);
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">DEEN</h2>
        <p className="text-muted-foreground italic mt-1">{weekRangeLabel(ws)}</p>
      </div>

      <PrayerTracker />
      <AthkarTracker />
      <QuranTracker />
      <FastingTracker />
      <DuaSection />
    </div>
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

function YouRow({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">You</p>
      {children}
    </div>
  );
}

function PartnerRow({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1 truncate">@{name}</p>
      {children}
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

  return (
    <TrackerCard title="Prayers">
      <div className="space-y-4">
        {PRAYERS.map((p) => (
          <div key={p} className="space-y-1">
            <p className="text-xs font-display uppercase tracking-widest">{p}</p>
            <div className="grid grid-cols-2 gap-3">
              <YouRow>
                <WeekCircles days={mine[p] ?? EMPTY_WEEK} onToggle={(i, n) => toggle(p, i, n)} size="sm" tone="gold" />
              </YouRow>
              <PartnerRow name={partnerProfile?.username ?? "partner"}>
                <WeekCircles days={theirs[p] ?? EMPTY_WEEK} size="sm" readOnly tone="muted" />
              </PartnerRow>
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

  return (
    <TrackerCard title="Athkar">
      <div className="space-y-4">
        {ATHKAR_KINDS.map((k) => (
          <div key={k.kind} className="space-y-1">
            <p className="text-xs font-display uppercase tracking-widest">{k.label}</p>
            <div className="grid grid-cols-2 gap-3">
              <YouRow>
                <WeekCircles days={mine[k.kind] ?? EMPTY_WEEK} onToggle={(i, n) => toggle(k.kind, i, n)} size="sm" tone="gold" />
              </YouRow>
              <PartnerRow name={partnerProfile?.username ?? "partner"}>
                <WeekCircles days={theirs[k.kind] ?? EMPTY_WEEK} size="sm" readOnly tone="muted" />
              </PartnerRow>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-border/50 pt-3">
        <p className="text-xs font-display uppercase tracking-widest mb-2 text-muted-foreground">Dhikr counter</p>
        <div className="grid grid-cols-3 gap-2">
          {DHIKR_PRESETS.map((d) => (
            <div key={d.kind} className="rounded-xl border border-border bg-card/40 p-2 text-center">
              <p className="text-[11px] font-display tracking-wider">{d.label}</p>
              <button
                onClick={() => incDhikr(d.kind)}
                className="mt-1 w-full rounded-lg border border-border bg-card hover:bg-accent/40 py-2 transition-colors"
              >
                <p className="font-display text-2xl text-primary tabular-nums">{counts[d.kind] ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">tap +1</p>
              </button>
              <p className="text-[10px] text-muted-foreground mt-1 truncate">
                @{partnerProfile?.username ?? "partner"}:{" "}
                <span className="text-foreground tabular-nums">{partnerCounts[d.kind] ?? 0}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </TrackerCard>
  );
}

function QuranTracker() {
  const { user, partnerProfile } = useSession();
  const [page, setPage] = useState(0);
  const [partnerPage, setPartnerPage] = useState(0);

  const load = async () => {
    if (!user) return;
    const ids = [user.id, partnerProfile?.id].filter(Boolean) as string[];
    const { data } = await supabase.from("deen_quran").select("user_id, current_page").in("user_id", ids);
    let mine = 0, theirs = 0;
    (data ?? []).forEach((r: any) => {
      if (r.user_id === user.id) mine = r.current_page ?? 0;
      else theirs = r.current_page ?? 0;
    });
    setPage(mine); setPartnerPage(theirs);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, partnerProfile?.id]);

  const inc = async () => {
    if (!user) return;
    const next = page + 1;
    setPage(next);
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from("deen_quran").upsert(
      { user_id: user.id, current_page: next, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
    await supabase.from("deen_quran_log").insert({ user_id: user.id, log_date: today, pages: 1 });
  };

  return (
    <TrackerCard title="Quran progress">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-card/40 p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground">You</p>
          <p className="font-display text-3xl text-primary tabular-nums mt-1">{page}</p>
          <Button size="sm" className="mt-2 w-full" onClick={inc}>
            <Plus className="size-3" /> Read 1 page
          </Button>
        </div>
        <div className="rounded-xl border border-amber-200/40 dark:border-amber-900/40 bg-amber-200/10 dark:bg-amber-900/10 p-3">
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
            @{partnerProfile?.username ?? "partner"}
          </p>
          <p className="font-display text-3xl text-foreground/80 tabular-nums mt-1">{partnerPage}</p>
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

  return (
    <TrackerCard title="Fasting">
      <div className="grid grid-cols-2 gap-3">
        <YouRow><WeekCircles days={days} onToggle={toggle} size="sm" tone="gold" /></YouRow>
        <PartnerRow name={partnerProfile?.username ?? "partner"}>
          <WeekCircles days={partnerDays} size="sm" readOnly tone="muted" />
        </PartnerRow>
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
