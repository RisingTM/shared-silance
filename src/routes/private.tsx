import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BookOpen,
  Camera,
  Image as ImageIcon,
  Mic,
  MessageSquareOff,
  Plus,
  Square,
  Target,
  Trash2,
  Upload,
  ChevronLeft,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { decryptAuto, encryptAuto } from "@/lib/crypto";
import { getUserEncKey } from "@/lib/enc-key";
import { MediaOverlay } from "@/components/MediaOverlay";

export const Route = createFileRoute("/private")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <PrivatePage />
      </AppShell>
    </RequireAuth>
  ),
});

type SectionKey = "journal" | "unsent" | "goals";

const CARDS: { k: SectionKey; label: string; Icon: typeof BookOpen }[] = [
  { k: "journal", label: "Journal", Icon: BookOpen },
  { k: "unsent", label: "Unsent Thoughts", Icon: MessageSquareOff },
  { k: "goals", label: "Goals", Icon: Target },
];

function PrivatePage() {
  const { journey } = useSession();
  const canDelete = !!journey?.allow_private_deletes;
  const [open, setOpen] = useState<SectionKey | null>(null);

  if (open) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setOpen(null)}>
          <ChevronLeft className="size-4" /> Back
        </Button>
        {open === "journal" && <Journal canDelete={canDelete} />}
        {open === "unsent" && <Unsent canDelete={canDelete} />}
        {open === "goals" && <Goals canDelete={canDelete} />}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">PRIVATE</h2>
        <p className="text-muted-foreground italic mt-1">Only you can see this. Only you ever will.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {CARDS.map(({ k, label, Icon }) => (
          <button
            key={k}
            onClick={() => setOpen(k)}
            className="parchment-card rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-accent/30 transition-colors min-h-[110px]"
          >
            <Icon className="size-6 text-primary" />
            <span className="font-display text-[11px] uppercase tracking-widest text-center leading-tight">{label}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        <Lock className="inline size-3" /> Entries are encrypted on your device.
      </p>
    </div>
  );
}

function Journal({ canDelete }: { canDelete: boolean }) {
  const { user } = useSession();
  const [entries, setEntries] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const load = async () => {
    if (!user) return;
    const key = getUserEncKey(user.id);
    const { data } = await supabase
      .from("journal_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const mapped = await Promise.all(
      (data ?? []).map(async (item: any) => {
        if (item.encrypted_body && item.iv && key) {
          try {
            const plain = await decryptAuto(item.encrypted_body, key, item.iv);
            return { ...item, body: plain };
          } catch {
            return { ...item, body: "[Could not decrypt this entry on this device.]" };
          }
        }
        return item;
      }),
    );
    setEntries(mapped);
  };
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [user?.id]);

  const add = async () => {
    if (!user || !title.trim() || !body.trim()) return;
    const key = getUserEncKey(user.id);
    const encrypted = await encryptAuto(body.trim(), key);
    const { error } = await supabase.from("journal_entries").insert({
      user_id: user.id,
      title: title.trim(),
      body: "",
      encrypted_body: encrypted.ciphertext,
      iv: encrypted.iv,
    });
    if (error) return toast.error(error.message);
    setTitle("");
    setBody("");
    toast.success("Entry saved");
    load();
  };

  const del = async (id: string) => {
    await supabase.from("journal_entries").delete().eq("id", id);
    load();
  };

  return (
    <div className="parchment-card rounded-2xl p-5 space-y-4">
      <h3 className="font-display text-sm uppercase tracking-widest text-primary">Journal</h3>
      <div className="space-y-3">
        <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Write…" value={body} onChange={(e) => setBody(e.target.value)} rows={6} />
        <Button onClick={add}>
          <Lock className="size-4" /> Save entry
        </Button>
      </div>
      <div className="space-y-3">
        {entries.map((e) => (
          <div key={e.id} className="rounded-xl border border-border/70 bg-card p-4">
            <div className="flex justify-between items-baseline">
              <h4 className="font-display tracking-wide">{e.title}</h4>
              {canDelete && (
                <button onClick={() => del(e.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              )}
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

function Goals({ canDelete }: { canDelete: boolean }) {
  const { user } = useSession();
  const [list, setList] = useState<any[]>([]);
  const [title, setTitle] = useState("");

  const load = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setList(data ?? []);
  };
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [user?.id]);

  const add = async () => {
    if (!user || !title.trim()) return;
    await supabase.from("goals").insert({ user_id: user.id, title: title.trim() });
    setTitle("");
    load();
  };
  const toggle = async (g: any) => {
    await supabase.from("goals").update({ done: !g.done, done_at: !g.done ? new Date().toISOString() : null }).eq("id", g.id);
    load();
  };
  const del = async (id: string) => {
    await supabase.from("goals").delete().eq("id", id);
    load();
  };

  return (
    <div className="parchment-card rounded-2xl p-5 space-y-4">
      <h3 className="font-display text-sm uppercase tracking-widest text-primary">Goals</h3>
      <div className="flex gap-2">
        <Input
          placeholder="Add a goal…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add}>Add</Button>
      </div>
      <ul className="space-y-2">
        {list.map((g) => (
          <li key={g.id} className="rounded-xl border border-border/70 bg-card p-4 flex items-center gap-3">
            <Checkbox checked={g.done} onCheckedChange={() => toggle(g)} />
            <span className={["flex-1", g.done && "line-through text-muted-foreground"].filter(Boolean).join(" ")}>{g.title}</span>
            {canDelete && (
              <button onClick={() => del(g.id)} className="text-muted-foreground hover:text-destructive">
                <Trash2 className="size-4" />
              </button>
            )}
          </li>
        ))}
        {list.length === 0 && <p className="text-center text-sm italic text-muted-foreground py-4">No goals yet.</p>}
      </ul>
    </div>
  );
}

function Unsent({ canDelete }: { canDelete: boolean }) {
  const { user } = useSession();
  const [list, setList] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioFileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const imageFileRef = useRef<HTMLInputElement>(null);
  const [overlay, setOverlay] = useState<{ kind: "audio" | "image"; bucket: "unsent-audio" | "unsent-images"; path: string } | null>(null);

  const load = async () => {
    if (!user) return;
    const key = getUserEncKey(user.id);
    const { data } = await supabase
      .from("unsent_thoughts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const mapped = await Promise.all(
      (data ?? []).map(async (item: any) => {
        if (item.kind === "text" && item.encrypted_body && item.iv && key) {
          try {
            const plain = await decryptAuto(item.encrypted_body, key, item.iv);
            return { ...item, text_content: plain };
          } catch {
            return { ...item, text_content: "[Could not decrypt this entry on this device.]" };
          }
        }
        return item;
      }),
    );
    setList(mapped);
  };
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [user?.id]);

  // Paste-screenshot listener
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of Array.from(items)) {
        if (it.type.startsWith("image/")) {
          const file = it.getAsFile();
          if (file) {
            uploadImage(file, file.type.split("/")[1] || "png");
            e.preventDefault();
            break;
          }
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    /* eslint-disable-next-line */
  }, [user?.id]);

  const addText = async () => {
    if (!user || !text.trim()) return;
    const key = getUserEncKey(user.id);
    const encrypted = await encryptAuto(text.trim(), key);
    await supabase.from("unsent_thoughts").insert({
      user_id: user.id,
      kind: "text",
      text_content: null,
      encrypted_body: encrypted.ciphertext,
      iv: encrypted.iv,
    });
    setText("");
    toast.success("Saved");
    load();
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
    } catch {
      toast.error("Microphone unavailable");
    }
  };
  const stopRec = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const uploadAudio = async (blob: Blob, ext: string) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("unsent-audio").upload(path, blob);
    if (error) return toast.error(error.message);
    await supabase.from("unsent_thoughts").insert({ user_id: user.id, kind: "audio", audio_path: path });
    toast.success("Uploaded");
    load();
  };

  const uploadImage = async (blob: Blob, ext: string) => {
    if (!user) return;
    const path = `${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("unsent-images").upload(path, blob);
    if (error) return toast.error(error.message);
    await supabase.from("unsent_thoughts").insert({ user_id: user.id, kind: "image", image_path: path } as any);
    toast.success("Uploaded");
    load();
  };

  const onAudioFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await uploadAudio(f, f.name.split(".").pop() ?? "mp3");
    if (audioFileRef.current) audioFileRef.current.value = "";
  };
  const onImageFile = async (e: React.ChangeEvent<HTMLInputElement>, ref: React.RefObject<HTMLInputElement | null>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    await uploadImage(f, f.name.split(".").pop() ?? "png");
    if (ref.current) ref.current.value = "";
  };

  const del = async (r: any) => {
    if (r.audio_path) await supabase.storage.from("unsent-audio").remove([r.audio_path]);
    if (r.image_path) await supabase.storage.from("unsent-images").remove([r.image_path]);
    await supabase.from("unsent_thoughts").delete().eq("id", r.id);
    load();
  };

  return (
    <div className="parchment-card rounded-2xl p-5 space-y-4">
      <h3 className="font-display text-sm uppercase tracking-widest text-primary">Unsent Thoughts</h3>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Write it… (or paste a screenshot anywhere)" />
      <div className="flex flex-wrap gap-2">
        <Button onClick={addText}>
          <Plus className="size-4" /> Save text
        </Button>
        {!recording ? (
          <Button variant="outline" onClick={startRec}>
            <Mic className="size-4" /> Record
          </Button>
        ) : (
          <Button variant="destructive" onClick={stopRec}>
            <Square className="size-4" /> Stop
          </Button>
        )}
        <Button variant="outline" onClick={() => audioFileRef.current?.click()}>
          <Upload className="size-4" /> Upload audio
        </Button>
        <Button variant="outline" onClick={() => cameraRef.current?.click()}>
          <Camera className="size-4" /> Take picture
        </Button>
        <Button variant="outline" onClick={() => imageFileRef.current?.click()}>
          <ImageIcon className="size-4" /> Upload picture
        </Button>
        <input ref={audioFileRef} type="file" accept="audio/*" hidden onChange={onAudioFile} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onImageFile(e, cameraRef)} />
        <input ref={imageFileRef} type="file" accept="image/*" hidden onChange={(e) => onImageFile(e, imageFileRef)} />
      </div>

      <ul className="space-y-2">
        {list.map((r) => (
          <li key={r.id} className="rounded-xl border border-border/70 bg-card p-3">
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{new Date(r.created_at).toLocaleString()}</span>
              {canDelete && (
                <button onClick={() => del(r)} className="hover:text-destructive">
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            {r.kind === "text" ? (
              <p className="mt-2 whitespace-pre-wrap leading-relaxed text-sm">{r.text_content ?? "[Encrypted text]"}</p>
            ) : r.kind === "audio" && r.audio_path ? (
              <button
                onClick={() => setOverlay({ kind: "audio", bucket: "unsent-audio", path: r.audio_path })}
                className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Mic className="size-4" /> audio
              </button>
            ) : r.kind === "image" && r.image_path ? (
              <button
                onClick={() => setOverlay({ kind: "image", bucket: "unsent-images", path: r.image_path })}
                className="mt-2 inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <ImageIcon className="size-4" /> photo
              </button>
            ) : null}
          </li>
        ))}
        {list.length === 0 && <p className="text-center text-sm italic text-muted-foreground py-4">Nothing yet.</p>}
      </ul>

      {overlay && (
        <MediaOverlay
          open={!!overlay}
          onClose={() => setOverlay(null)}
          bucket={overlay.bucket}
          path={overlay.path}
          kind={overlay.kind}
        />
      )}
    </div>
  );
}
