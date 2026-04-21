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
import { Checkbox } from "@/components/ui/checkbox";
import { Mic, Square, Trash2, Upload, Plus } from "lucide-react";
import { toast } from "sonner";
import { MOOD_EMOJIS, daysBetween } from "@/lib/statuses";

export const Route = createFileRoute("/private")({
  component: () => (<RequireAuth><AppShell><PrivatePage /></AppShell></RequireAuth>),
});

function PrivatePage() {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">PRIVATE</h2>
        <p className="text-muted-foreground italic mt-1">Only you can see this. Only you ever will.</p>
      </div>
      <Section title="Journal" defaultOpen><Journal /></Section>
      <Section title="Unsent Thoughts" defaultOpen><Unsent /></Section>
      <Section title="Goals"><Goals /></Section>
      <Section title="Mood"><Mood /></Section>
      <Section title="Worship"><Worship /></Section>
    </div>
  );
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="parchment-card rounded-2xl p-5" open={defaultOpen}>
      <summary className="cursor-pointer list-none font-display text-sm uppercase tracking-widest text-primary">{title}</summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}

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
    <div className="space-y-4">
      <div className="space-y-3">
        <h3 className="font-display tracking-widest">NEW ENTRY</h3>
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Write…" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
        <Button onClick={add}><Plus className="size-4" /> Save entry</Button>
      </div>
      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="rounded-xl border border-border/70 bg-card p-4">
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
    <div className="space-y-4">
      <div>
        <h3 className="font-display tracking-widest">TODAY'S MOOD</h3>
        <div className="flex flex-wrap gap-3 mt-4">
          {MOOD_EMOJIS.map((e) => (
            <button key={e} onClick={() => set(e)} className={["text-3xl rounded-full size-14 flex items-center justify-center border transition-all", todays?.mood === e ? "border-primary bg-primary/15 scale-110" : "border-border hover:bg-accent/40"].join(" ")}>{e}</button>
          ))}
        </div>
      </div>
      <div>
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
    <div className="space-y-4">
      <div className="flex gap-2">
        <Input placeholder="Add a goal…" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <Button onClick={add}>Add</Button>
      </div>
      <ul className="space-y-2">
        {list.map((g) => (
          <li key={g.id} className="rounded-xl border border-border/70 bg-card p-4 flex items-center gap-3">
            <Checkbox checked={g.done} onCheckedChange={() => toggle(g)} />
            <span className={["flex-1", g.done && "line-through text-muted-foreground"].filter(Boolean).join(" ")}>{g.title}</span>
            <button onClick={() => del(g.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></button>
          </li>
        ))}
      </ul>
    </div>
  );
}

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
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="NC days" value={days} />
        <Stat label="Quran pages" value={totalPages} />
        <Stat label="Adhkar" value={totalAdhkar} />
      </div>
      <div className="space-y-3">
        <h3 className="font-display tracking-widest">TODAY</h3>
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs">Quran pages</Label><Input type="number" min={0} value={pages} onChange={(e) => setPages(parseInt(e.target.value) || 0)} /></div>
          <div><Label className="text-xs">Adhkar count</Label><Input type="number" min={0} value={adhkar} onChange={(e) => setAdhkar(parseInt(e.target.value) || 0)} /></div>
        </div>
        <Button onClick={save}>Save</Button>
      </div>
      <ul className="space-y-1">
        {list.map((r) => (
          <li key={r.id} className="rounded-lg border border-border/70 bg-card px-4 py-2 flex justify-between text-sm">
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
    <div className="space-y-4">
      <div className="space-y-3">
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
          <li key={r.id} className="rounded-xl border border-border/70 bg-card p-4">
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
