import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock, Mic, Square, Trash2, Upload, Plus } from "lucide-react";
import { toast } from "sonner";
import { MOOD_EMOJIS, daysBetween } from "@/lib/statuses";
import { isoYearWeek } from "@/lib/dua";

export const Route = createFileRoute("/private")({
  component: () => (<RequireAuth><AppShell><PrivatePage /></AppShell></RequireAuth>),
});

const TABS = [
  { v: "why", l: "Why" },
  { v: "journal", l: "Journal" },
  { v: "strong", l: "Strong" },
  { v: "triggers", l: "Triggers" },
  { v: "mood", l: "Mood" },
  { v: "goals", l: "Goals" },
  { v: "letter", l: "Letter" },
  { v: "vault", l: "Vault" },
  { v: "building", l: "Building" },
  { v: "reflect", l: "Reflect" },
  { v: "worship", l: "Worship" },
  { v: "summary", l: "Summary" },
  { v: "unsent", l: "Unsent" },
];

function PrivatePage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">PRIVATE</h2>
        <p className="text-muted-foreground italic mt-1">Only you can see this. Only you ever will.</p>
      </div>
      <Tabs defaultValue="why">
        <ScrollArea className="w-full">
          <TabsList className="bg-secondary/50 flex w-max">
            {TABS.map((t) => <TabsTrigger key={t.v} value={t.v} className="font-display text-xs tracking-widest uppercase">{t.l}</TabsTrigger>)}
          </TabsList>
        </ScrollArea>
        <TabsContent value="why"><SingleNote table="why_notes" title="Why I'm Here" placeholder="Write your reason. Come back to it." /></TabsContent>
        <TabsContent value="journal"><Journal /></TabsContent>
        <TabsContent value="strong"><SimpleLog table="strong_moments" field="note" title="Stayed Strong" placeholder="What did you choose right today?" /></TabsContent>
        <TabsContent value="triggers"><Triggers /></TabsContent>
        <TabsContent value="mood"><Mood /></TabsContent>
        <TabsContent value="goals"><Goals /></TabsContent>
        <TabsContent value="letter"><SealedLetter /></TabsContent>
        <TabsContent value="vault"><Vault /></TabsContent>
        <TabsContent value="building"><SingleNote table="building_notes" title="Building Toward" placeholder="Who are you becoming?" /></TabsContent>
        <TabsContent value="reflect"><Reflection /></TabsContent>
        <TabsContent value="worship"><Worship /></TabsContent>
        <TabsContent value="summary"><MonthlySummary /></TabsContent>
        <TabsContent value="unsent"><Unsent /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Single editable note ----------
function SingleNote({ table, title, placeholder }: { table: "why_notes" | "building_notes"; title: string; placeholder: string }) {
  const { user } = useSession();
  const [content, setContent] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from(table).select("content").eq("user_id", user.id).maybeSingle().then(({ data }) => {
      setContent((data?.content as string) ?? ""); setLoaded(true);
    });
  }, [user, table]);

  const save = async () => {
    if (!user) return;
    const { error } = await supabase.from(table).upsert({ user_id: user.id, content, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  return (
    <div className="parchment-card rounded-2xl p-6 mt-4 space-y-3">
      <h3 className="font-display tracking-widest">{title.toUpperCase()}</h3>
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={placeholder} rows={10} disabled={!loaded} />
      <Button onClick={save} disabled={!loaded}>Save</Button>
    </div>
  );
}

// ---------- Journal ----------
function Journal() {
  const { user } = useSession();
  const [entries, setEntries] = useState<any[]>([]);
  const [title, setTitle] = useState(""); const [body, setBody] = useState("");
  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("journal_entries").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setEntries(data ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);
  const add = async () => {
    if (!user || !title.trim() || !body.trim()) return;
    const { error } = await supabase.from("journal_entries").insert({ user_id: user.id, title: title.trim(), body: body.trim() });
    if (error) return toast.error(error.message);
    setTitle(""); setBody(""); toast.success("Entry saved"); load();
  };
  const del = async (id: string) => {
    await supabase.from("journal_entries").delete().eq("id", id); load();
  };
  return (
    <div className="space-y-4 mt-4">
      <div className="parchment-card rounded-2xl p-6 space-y-3">
        <h3 className="font-display tracking-widest">NEW ENTRY</h3>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Write…" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
        <Button onClick={add}><Plus className="size-4" /> Save entry</Button>
      </div>
      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="parchment-card rounded-2xl p-5">
            <div className="flex justify-between items-baseline">
              <h4 className="font-display tracking-wide">{e.title}</h4>
              <button onClick={() => del(e.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
            </div>
            <p className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</p>
            <p className="mt-3 whitespace-pre-wrap leading-relaxed">{e.body}</p>
          </div>
        ))}
        {entries.length === 0 && <p className="text-center text-sm italic text-muted-foreground py-8">Nothing yet.</p>}
      </div>
    </div>
  );
}

// ---------- SimpleLog (strong) ----------
function SimpleLog({ table, field, title, placeholder }: { table: "strong_moments"; field: "note"; title: string; placeholder: string }) {
  const { user } = useSession();
  const [list, setList] = useState<any[]>([]);
  const [val, setVal] = useState("");
  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from(table).select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);
  const add = async () => {
    if (!user || !val.trim()) return;
    const { error } = await supabase.from(table).insert({ user_id: user.id, [field]: val.trim() } as any);
    if (error) return toast.error(error.message);
    setVal(""); toast.success("Logged"); load();
  };
  const del = async (id: string) => { await supabase.from(table).delete().eq("id", id); load(); };
  return (
    <div className="space-y-4 mt-4">
      <div className="parchment-card rounded-2xl p-6 space-y-3">
        <h3 className="font-display tracking-widest">{title.toUpperCase()}</h3>
        <Textarea value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder} rows={3} />
        <Button onClick={add}><Plus className="size-4" /> Add</Button>
      </div>
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id} className="parchment-card rounded-xl p-4 flex justify-between gap-3">
            <div>
              <p className="leading-relaxed">{r.note}</p>
              <p className="text-xs text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString()}</p>
            </div>
            <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-destructive shrink-0"><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Triggers ----------
function Triggers() {
  const { user } = useSession();
  const [list, setList] = useState<any[]>([]);
  const [what, setWhat] = useState(""); const [urge, setUrge] = useState("");
  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("trigger_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);
  const add = async () => {
    if (!user || !what.trim()) return;
    const { error } = await supabase.from("trigger_logs").insert({ user_id: user.id, what_happened: what.trim(), the_urge: urge.trim() || null });
    if (error) return toast.error(error.message);
    setWhat(""); setUrge(""); toast.success("Logged"); load();
  };
  const del = async (id: string) => { await supabase.from("trigger_logs").delete().eq("id", id); load(); };
  return (
    <div className="space-y-4 mt-4">
      <div className="parchment-card rounded-2xl p-6 space-y-3">
        <h3 className="font-display tracking-widest">WHAT ALMOST BROKE IT</h3>
        <div>
          <Label className="text-xs">What happened</Label>
          <Textarea value={what} onChange={(e) => setWhat(e.target.value)} rows={2} />
        </div>
        <div>
          <Label className="text-xs">What was the urge?</Label>
          <Textarea value={urge} onChange={(e) => setUrge(e.target.value)} rows={2} />
        </div>
        <Button onClick={add}><Plus className="size-4" /> Log it</Button>
      </div>
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id} className="parchment-card rounded-xl p-4">
            <div className="flex justify-between">
              <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
              <button onClick={() => del(r.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
            </div>
            <p className="mt-2"><span className="text-muted-foreground">What: </span>{r.what_happened}</p>
            {r.the_urge && <p className="mt-1"><span className="text-muted-foreground">Urge: </span>{r.the_urge}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Mood ----------
function Mood() {
  const { user } = useSession();
  const [list, setList] = useState<any[]>([]);
  const today = new Date().toISOString().slice(0, 10);
  const todays = list.find((m) => m.entry_date === today);
  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("mood_entries").select("*").eq("user_id", user.id).order("entry_date", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);
  const set = async (mood: string) => {
    if (!user) return;
    const { error } = await supabase.from("mood_entries").upsert({ user_id: user.id, entry_date: today, mood }, { onConflict: "user_id,entry_date" });
    if (error) return toast.error(error.message);
    toast.success("Mood saved"); load();
  };
  return (
    <div className="space-y-4 mt-4">
      <div className="parchment-card rounded-2xl p-6">
        <h3 className="font-display tracking-widest">TODAY'S MOOD</h3>
        <div className="flex flex-wrap gap-3 mt-4">
          {MOOD_EMOJIS.map((e) => (
            <button key={e} onClick={() => set(e)} className={["text-3xl rounded-full size-14 flex items-center justify-center border transition-all", todays?.mood === e ? "border-primary bg-primary/15 scale-110" : "border-border hover:bg-accent/40"].join(" ")}>{e}</button>
          ))}
        </div>
      </div>
      <div className="parchment-card rounded-2xl p-6">
        <h3 className="font-display tracking-widest mb-3">HISTORY</h3>
        <div className="grid grid-cols-7 sm:grid-cols-10 gap-2">
          {list.map((m) => (
            <div key={m.id} className="text-center">
              <div className="text-2xl">{m.mood}</div>
              <div className="text-[10px] text-muted-foreground">{m.entry_date.slice(5)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Goals ----------
function Goals() {
  const { user } = useSession();
  const [list, setList] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("goals").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);
  const add = async () => {
    if (!user || !title.trim()) return;
    await supabase.from("goals").insert({ user_id: user.id, title: title.trim() });
    setTitle(""); load();
  };
  const toggle = async (g: any) => {
    await supabase.from("goals").update({ done: !g.done, done_at: !g.done ? new Date().toISOString() : null }).eq("id", g.id);
    load();
  };
  const del = async (id: string) => { await supabase.from("goals").delete().eq("id", id); load(); };
  return (
    <div className="space-y-4 mt-4">
      <div className="parchment-card rounded-2xl p-6 flex gap-2">
        <Input placeholder="Add a goal…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add}>Add</Button>
      </div>
      <ul className="space-y-2">
        {list.map((g) => (
          <li key={g.id} className="parchment-card rounded-xl p-4 flex items-center gap-3">
            <Checkbox checked={g.done} onCheckedChange={() => toggle(g)} />
            <span className={["flex-1", g.done && "line-through text-muted-foreground"].filter(Boolean).join(" ")}>{g.title}</span>
            <button onClick={() => del(g.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------- Sealed Letter ----------
function SealedLetter() {
  const { user } = useSession();
  const [content, setContent] = useState(""); const [sealed, setSealed] = useState<any>(null);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!user) return;
    supabase.from("sealed_letters").select("*").eq("user_id", user.id).maybeSingle().then(({ data }) => setSealed(data));
  }, [user]);
  const seal = async () => {
    if (!user || !content.trim()) return;
    const { error } = await supabase.from("sealed_letters").insert({ user_id: user.id, content: content.trim() });
    if (error) return toast.error(error.message);
    toast.success("Sealed forever");
    const { data } = await supabase.from("sealed_letters").select("*").eq("user_id", user.id).maybeSingle();
    setSealed(data); setConfirming(false);
  };
  if (sealed) {
    return (
      <div className="parchment-card rounded-2xl p-8 mt-4 text-center">
        <Lock className="size-8 mx-auto text-primary" />
        <p className="font-display text-xs uppercase tracking-widest text-muted-foreground mt-2">SEALED · {new Date(sealed.sealed_at).toLocaleDateString()}</p>
        <div className="mt-6 text-left whitespace-pre-wrap leading-relaxed italic">{sealed.content}</div>
      </div>
    );
  }
  return (
    <div className="parchment-card rounded-2xl p-6 mt-4 space-y-3">
      <h3 className="font-display tracking-widest">SEALED LETTER</h3>
      <p className="text-sm text-muted-foreground italic">Write once. Once sealed, it cannot ever be edited or deleted.</p>
      <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={12} placeholder="Write the letter…" />
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogTrigger asChild><Button disabled={!content.trim()}><Lock className="size-4" /> Seal it</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Seal forever?</DialogTitle></DialogHeader>
          <p className="text-muted-foreground italic">This cannot be undone. The letter cannot be edited or deleted, ever.</p>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)}>Wait</Button>
            <Button onClick={seal}>Yes, seal it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------- Memory Vault ----------
function Vault() {
  const { user, journey } = useSession();
  const [list, setList] = useState<any[]>([]);
  const [title, setTitle] = useState(""); const [content, setContent] = useState(""); const [day, setDay] = useState(30);
  const days = journey ? daysBetween(journey.nc_start_date) : 0;
  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("memory_vault").select("*").eq("user_id", user.id).order("unlock_day", { ascending: true });
    setList(data ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);
  const add = async () => {
    if (!user || !title.trim() || !content.trim()) return;
    const { error } = await supabase.from("memory_vault").insert({ user_id: user.id, title: title.trim(), content: content.trim(), unlock_day: day });
    if (error) return toast.error(error.message);
    setTitle(""); setContent(""); setDay(30); toast.success("Locked away"); load();
  };
  const del = async (id: string) => { await supabase.from("memory_vault").delete().eq("id", id); load(); };
  return (
    <div className="space-y-4 mt-4">
      <div className="parchment-card rounded-2xl p-6 space-y-3">
        <h3 className="font-display tracking-widest">LOCK A MEMORY</h3>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="The memory…" value={content} onChange={(e) => setContent(e.target.value)} rows={4} />
        <div>
          <Label className="text-xs">Unlock at day</Label>
          <Input type="number" min={1} value={day} onChange={(e) => setDay(parseInt(e.target.value) || 1)} />
        </div>
        <Button onClick={add}>Lock it</Button>
      </div>
      <ul className="space-y-2">
        {list.map((v) => {
          const unlocked = days >= v.unlock_day;
          return (
            <li key={v.id} className="parchment-card rounded-xl p-4">
              <div className="flex justify-between">
                <h4 className="font-display tracking-wide">{unlocked ? v.title : "🔒 Locked"}</h4>
                <button onClick={() => del(v.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
              </div>
              {unlocked ? (
                <p className="mt-2 whitespace-pre-wrap">{v.content}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic mt-1">Unlocks at day {v.unlock_day} ({v.unlock_day - days} more days)</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ---------- Weekly Reflection ----------
function Reflection() {
  const { user } = useSession();
  const wk = isoYearWeek(new Date());
  const [answer, setAnswer] = useState("");
  const [past, setPast] = useState<any[]>([]);
  const [thisWeek, setThisWeek] = useState<any>(null);
  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("weekly_reflections").select("*").eq("user_id", user.id).order("year_week", { ascending: false });
    setPast(data ?? []);
    setThisWeek(data?.find((r) => r.year_week === wk.key) ?? null);
    setAnswer(data?.find((r) => r.year_week === wk.key)?.answer ?? "");
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);
  const save = async () => {
    if (!user || !answer.trim()) return;
    if (thisWeek) {
      await supabase.from("weekly_reflections").update({ answer: answer.trim() }).eq("id", thisWeek.id);
    } else {
      await supabase.from("weekly_reflections").insert({ user_id: user.id, year_week: wk.key, question: wk.question, answer: answer.trim() });
    }
    toast.success("Reflection saved"); load();
  };
  return (
    <div className="space-y-4 mt-4">
      <div className="parchment-card rounded-2xl p-6 space-y-3">
        <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">{wk.key}</p>
        <h3 className="font-display text-xl">{wk.question}</h3>
        <Textarea rows={6} value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Take your time…" />
        <Button onClick={save}>Save</Button>
      </div>
      {past.filter((p) => p.year_week !== wk.key).map((p) => (
        <div key={p.id} className="parchment-card rounded-xl p-5">
          <p className="font-display text-xs uppercase tracking-widest text-muted-foreground">{p.year_week}</p>
          <h4 className="font-display mt-1">{p.question}</h4>
          <p className="mt-2 whitespace-pre-wrap">{p.answer}</p>
        </div>
      ))}
    </div>
  );
}

// ---------- Worship ----------
function Worship() {
  const { user, journey } = useSession();
  const today = new Date().toISOString().slice(0, 10);
  const [pages, setPages] = useState(0); const [adhkar, setAdhkar] = useState(0);
  const [list, setList] = useState<any[]>([]);
  const days = journey ? daysBetween(journey.nc_start_date) : 0;
  const totalPages = list.reduce((s, r) => s + (r.pages ?? 0), 0);
  const totalAdhkar = list.reduce((s, r) => s + (r.adhkar ?? 0), 0);
  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("worship_logs").select("*").eq("user_id", user.id).order("entry_date", { ascending: false });
    setList(data ?? []);
    const t = data?.find((r) => r.entry_date === today);
    if (t) { setPages(t.pages); setAdhkar(t.adhkar); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);
  const save = async () => {
    if (!user) return;
    await supabase.from("worship_logs").upsert({ user_id: user.id, entry_date: today, pages, adhkar }, { onConflict: "user_id,entry_date" });
    toast.success("Saved"); load();
  };
  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="NC days" value={days} />
        <Stat label="Quran pages" value={totalPages} />
        <Stat label="Adhkar" value={totalAdhkar} />
      </div>
      <div className="parchment-card rounded-2xl p-6 space-y-3">
        <h3 className="font-display tracking-widest">TODAY</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Quran pages</Label><Input type="number" min={0} value={pages} onChange={(e) => setPages(parseInt(e.target.value) || 0)} /></div>
          <div><Label className="text-xs">Adhkar count</Label><Input type="number" min={0} value={adhkar} onChange={(e) => setAdhkar(parseInt(e.target.value) || 0)} /></div>
        </div>
        <Button onClick={save}>Save</Button>
      </div>
      <ul className="space-y-1">
        {list.map((r) => (
          <li key={r.id} className="parchment-card rounded-lg px-4 py-2 flex justify-between text-sm">
            <span className="text-muted-foreground">{r.entry_date}</span>
            <span>📖 {r.pages} · 📿 {r.adhkar}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="parchment-card rounded-xl p-4 text-center">
      <div className="font-display text-2xl text-primary tabular-nums">{value}</div>
      <div className="font-display text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

// ---------- Monthly Summary (computed client-side) ----------
function MonthlySummary() {
  const { user, journey } = useSession();
  const [data, setData] = useState<any>(null);
  const monthKey = new Date().toISOString().slice(0, 7);
  useEffect(() => {
    if (!user) return;
    const start = monthKey + "-01";
    const next = new Date(monthKey + "-01"); next.setMonth(next.getMonth() + 1);
    const end = next.toISOString().slice(0, 10);
    Promise.all([
      supabase.from("mood_entries").select("id").eq("user_id", user.id).gte("entry_date", start).lt("entry_date", end),
      supabase.from("journal_entries").select("id").eq("user_id", user.id).gte("created_at", start).lt("created_at", end),
      supabase.from("goals").select("id").eq("user_id", user.id).eq("done", true).gte("done_at", start).lt("done_at", end),
      supabase.from("strong_moments").select("id").eq("user_id", user.id).gte("created_at", start).lt("created_at", end),
    ]).then(([m, j, g, s]) => setData({ moods: m.data?.length ?? 0, journals: j.data?.length ?? 0, goals: g.data?.length ?? 0, strong: s.data?.length ?? 0 }));
  }, [user, monthKey]);
  return (
    <div className="parchment-card rounded-2xl p-6 mt-4">
      <h3 className="font-display tracking-widest">{new Date().toLocaleString(undefined, { month: "long", year: "numeric" }).toUpperCase()}</h3>
      {!data ? <p className="text-muted-foreground italic mt-2">Loading…</p> : (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mt-4">
          <Stat label="NC days" value={journey ? daysBetween(journey.nc_start_date) : 0} />
          <Stat label="Moods" value={data.moods} />
          <Stat label="Journals" value={data.journals} />
          <Stat label="Goals done" value={data.goals} />
          <Stat label="Strong moments" value={data.strong} />
        </div>
      )}
      <p className="text-xs text-muted-foreground italic mt-4">Updates automatically. Browse months by visiting later.</p>
    </div>
  );
}

// ---------- Unsent Thoughts (text + audio) ----------
function Unsent() {
  const { user } = useSession();
  const [list, setList] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("unsent_thoughts").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id]);

  const addText = async () => {
    if (!user || !text.trim()) return;
    await supabase.from("unsent_thoughts").insert({ user_id: user.id, kind: "text", text_content: text.trim() });
    setText(""); toast.success("Saved"); load();
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadAudio(blob, "webm");
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch { toast.error("Microphone unavailable"); }
  };
  const stopRec = () => { recorderRef.current?.stop(); setRecording(false); };

  const uploadAudio = async (blob: Blob, ext: string) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("unsent-audio").upload(path, blob);
    if (error) return toast.error(error.message);
    await supabase.from("unsent_thoughts").insert({ user_id: user.id, kind: "audio", audio_path: path });
    toast.success("Uploaded"); load();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    await uploadAudio(f, f.name.split(".").pop() ?? "mp3");
    if (fileRef.current) fileRef.current.value = "";
  };

  const del = async (r: any) => {
    if (r.audio_path) await supabase.storage.from("unsent-audio").remove([r.audio_path]);
    await supabase.from("unsent_thoughts").delete().eq("id", r.id);
    load();
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="parchment-card rounded-2xl p-6 space-y-3">
        <h3 className="font-display tracking-widest">THINGS I WISH I COULD TELL YOU</h3>
        <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Write it…" />
        <div className="flex flex-wrap gap-2">
          <Button onClick={addText}><Plus className="size-4" /> Save text</Button>
          {!recording ? (
            <Button variant="outline" onClick={startRec}><Mic className="size-4" /> Record</Button>
          ) : (
            <Button variant="destructive" onClick={stopRec}><Square className="size-4" /> Stop</Button>
          )}
          <Button variant="outline" onClick={() => fileRef.current?.click()}><Upload className="size-4" /> Upload audio</Button>
          <input ref={fileRef} type="file" accept="audio/*" hidden onChange={onFile} />
        </div>
      </div>
      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id} className="parchment-card rounded-xl p-4">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{new Date(r.created_at).toLocaleString()}</span>
              <button onClick={() => del(r)} className="hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </div>
            {r.kind === "text" ? (
              <p className="mt-2 whitespace-pre-wrap leading-relaxed">{r.text_content}</p>
            ) : (
              <AudioRow path={r.audio_path} />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AudioRow({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("unsent-audio").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  if (!url) return <p className="text-sm text-muted-foreground mt-2">Loading audio…</p>;
  return <audio src={url} controls className="mt-2 w-full" />;
}
