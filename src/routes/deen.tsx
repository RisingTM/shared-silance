import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { duaForDate } from "@/lib/dua";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
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

function DeenPage() {
  const { user } = useSession();
  const [offset, setOffset] = useState(0);
  const [personal, setPersonal] = useState<any[]>([]);
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
  useEffect(() => {
    loadPersonal();
    /* eslint-disable-next-line */
  }, [user?.id]);

  const savePersonal = async () => {
    if (!user || !arabic.trim() || !english.trim()) return;
    await supabase.from("personal_duas").insert({
      user_id: user.id,
      text: [title.trim(), arabic.trim(), english.trim()].filter(Boolean).join("\n\n"),
    });
    setTitle("");
    setArabic("");
    setEnglish("");
    loadPersonal();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">DEEN</h2>
        <p className="text-muted-foreground italic mt-1">
          {date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
        </p>
      </div>

      <div className="parchment-card rounded-2xl p-6 sm:p-10">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground text-center">{dua.theme}</p>
        <p className="font-arabic text-2xl sm:text-4xl text-right leading-loose mt-6 text-foreground">{dua.arabic}</p>
        <p className="mt-4 italic text-muted-foreground text-base sm:text-lg leading-relaxed">{dua.transliteration}</p>
        <div className="mt-4 border-t border-border/50 pt-4">
          <p className="text-base sm:text-lg leading-relaxed">{dua.english}</p>
        </div>
      </div>

      <div className="flex justify-between gap-2">
        <Button variant="outline" size="sm" onClick={() => setOffset(offset - 1)}>
          <ChevronLeft className="size-4" /> Prev
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOffset(0)} disabled={offset === 0}>
          Today
        </Button>
        <Button variant="outline" size="sm" onClick={() => setOffset(offset + 1)}>
          Next <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="parchment-card rounded-2xl p-5 space-y-3">
        <h3 className="font-display text-sm uppercase tracking-widest">Your personal duas</h3>
        <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Arabic" value={arabic} onChange={(e) => setArabic(e.target.value)} rows={2} />
        <Textarea placeholder="English" value={english} onChange={(e) => setEnglish(e.target.value)} rows={2} />
        <Button onClick={savePersonal}>Save personal dua</Button>
      </div>

      <PrayerTracker />
      <QuranTracker />
      <AthkarTracker />
      <FastingTracker />
    </div>
  );
}

function TrackerCard({ title, children }: { title: string; children: React.ReactNode }) {
  const ws = useMemo(() => weekStartSaturday(), []);
  return (
    <div className="parchment-card rounded-2xl p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h3 className="font-display text-sm uppercase tracking-widest text-primary">{title}</h3>
        <span className="text-xs text-muted-foreground">{weekRangeLabel(ws)}</span>
      </div>
      {children}
    </div>
  );
}

function PrayerTracker() {
  const { user } = useSession();
  const ws = useMemo(() => weekStartSaturday(), []);
  const [rows, setRows] = useState<Record<string, boolean[]>>({});

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("deen_prayers")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", ws);
    const next: Record<string, boolean[]> = {};
    for (const p of PRAYERS) next[p] = [false, false, false, false, false, false, false];
    (data ?? []).forEach((r: any) => {
      next[r.prayer] = (r.days as boolean[]) ?? next[r.prayer];
    });
    setRows(next);
  };
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [user?.id]);

  const toggle = async (prayer: string, idx: number, next: boolean) => {
    if (!user) return;
    const current = rows[prayer] ?? [false, false, false, false, false, false, false];
    const updated = current.map((v, i) => (i === idx ? next : v));
    setRows({ ...rows, [prayer]: updated });
    const { error } = await supabase
      .from("deen_prayers")
      .upsert(
        { user_id: user.id, week_start: ws, prayer, days: updated, updated_at: new Date().toISOString() },
        { onConflict: "user_id,week_start,prayer" },
      );
    if (error) toast.error(error.message);
  };

  return (
    <TrackerCard title="Prayers">
      <div className="space-y-3">
        {PRAYERS.map((p) => (
          <div key={p}>
            <p className="text-xs font-display uppercase tracking-widest mb-1">{p}</p>
            <WeekCircles days={rows[p] ?? []} onToggle={(i, n) => toggle(p, i, n)} size="sm" />
          </div>
        ))}
      </div>
    </TrackerCard>
  );
}

function QuranTracker() {
  const { user } = useSession();
  const [page, setPage] = useState<number>(0);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("deen_quran").select("current_page").eq("user_id", user.id).maybeSingle();
    setPage((data as any)?.current_page ?? 0);
  };
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [user?.id]);

  const inc = async () => {
    if (!user) return;
    const next = page + 1;
    setPage(next);
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from("deen_quran")
      .upsert({ user_id: user.id, current_page: next, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    await supabase.from("deen_quran_log").insert({ user_id: user.id, log_date: today, pages: 1 });
  };

  return (
    <TrackerCard title="Quran progress">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Current page</p>
          <p className="font-display text-4xl text-primary tabular-nums">{page}</p>
        </div>
        <Button onClick={inc}>
          <Plus className="size-4" /> Read 1 page
        </Button>
      </div>
    </TrackerCard>
  );
}

function AthkarTracker() {
  const { user } = useSession();
  const ws = useMemo(() => weekStartSaturday(), []);
  const [rows, setRows] = useState<Record<string, boolean[]>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});

  const load = async () => {
    if (!user) return;
    const [{ data: a }, { data: d }] = await Promise.all([
      supabase.from("deen_athkar").select("*").eq("user_id", user.id).eq("week_start", ws),
      supabase.from("deen_dhikr").select("*").eq("user_id", user.id),
    ]);
    const next: Record<string, boolean[]> = {};
    for (const k of ATHKAR_KINDS) next[k.kind] = [false, false, false, false, false, false, false];
    (a ?? []).forEach((r: any) => {
      next[r.kind] = (r.days as boolean[]) ?? next[r.kind];
    });
    setRows(next);
    const c: Record<string, number> = {};
    (d ?? []).forEach((r: any) => {
      c[r.kind] = r.count ?? 0;
    });
    setCounts(c);
  };
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [user?.id]);

  const toggle = async (kind: string, idx: number, next: boolean) => {
    if (!user) return;
    const current = rows[kind] ?? [false, false, false, false, false, false, false];
    const updated = current.map((v, i) => (i === idx ? next : v));
    setRows({ ...rows, [kind]: updated });
    await supabase
      .from("deen_athkar")
      .upsert(
        { user_id: user.id, week_start: ws, kind, days: updated, updated_at: new Date().toISOString() },
        { onConflict: "user_id,week_start,kind" },
      );
  };

  const incDhikr = async (kind: string) => {
    if (!user) return;
    const next = (counts[kind] ?? 0) + 1;
    setCounts({ ...counts, [kind]: next });
    await supabase
      .from("deen_dhikr")
      .upsert(
        { user_id: user.id, kind, count: next, updated_at: new Date().toISOString() },
        { onConflict: "user_id,kind" },
      );
  };

  return (
    <TrackerCard title="Athkar">
      <div className="space-y-3">
        {ATHKAR_KINDS.map((k) => (
          <div key={k.kind}>
            <p className="text-xs font-display uppercase tracking-widest mb-1">{k.label}</p>
            <WeekCircles days={rows[k.kind] ?? []} onToggle={(i, n) => toggle(k.kind, i, n)} size="sm" />
          </div>
        ))}
      </div>
      <div className="border-t border-border/50 pt-3">
        <p className="text-xs font-display uppercase tracking-widest mb-2 text-muted-foreground">Dhikr counter</p>
        <div className="grid grid-cols-3 gap-2">
          {DHIKR_PRESETS.map((d) => (
            <button
              key={d.kind}
              onClick={() => incDhikr(d.kind)}
              className="rounded-xl border border-border bg-card hover:bg-accent/40 p-3 text-center transition-colors"
            >
              <p className="text-xs font-display tracking-wider">{d.label}</p>
              <p className="font-display text-2xl text-primary tabular-nums mt-1">{counts[d.kind] ?? 0}</p>
              <p className="text-[10px] text-muted-foreground mt-1">tap +1</p>
            </button>
          ))}
        </div>
      </div>
    </TrackerCard>
  );
}

function FastingTracker() {
  const { user } = useSession();
  const ws = useMemo(() => weekStartSaturday(), []);
  const [days, setDays] = useState<boolean[]>([false, false, false, false, false, false, false]);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("deen_fasting")
      .select("*")
      .eq("user_id", user.id)
      .eq("week_start", ws)
      .maybeSingle();
    if (data) setDays((data as any).days ?? days);
  };
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [user?.id]);

  const toggle = async (idx: number, next: boolean) => {
    if (!user) return;
    const updated = days.map((v, i) => (i === idx ? next : v));
    setDays(updated);
    await supabase
      .from("deen_fasting")
      .upsert(
        { user_id: user.id, week_start: ws, days: updated, updated_at: new Date().toISOString() },
        { onConflict: "user_id,week_start" },
      );
  };

  return (
    <TrackerCard title="Fasting">
      <WeekCircles days={days} onToggle={toggle} size="sm" />
    </TrackerCard>
  );
}
