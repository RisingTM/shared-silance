import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { duaForDate } from "@/lib/dua";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/dua")({
  component: () => (<RequireAuth><AppShell><DuaPage /></AppShell></RequireAuth>),
});

function DuaPage() {
  const { user } = useSession();
  const [offset, setOffset] = useState(0);
  const [personal, setPersonal] = useState<any[]>([]);
  const [title, setTitle] = useState("");
  const [arabic, setArabic] = useState("");
  const [english, setEnglish] = useState("");
  const date = new Date(); date.setDate(date.getDate() + offset);
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
    setTitle("");
    setArabic("");
    setEnglish("");
    loadPersonal();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">DAILY DUA</h2>
        <p className="text-muted-foreground italic mt-1">{date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>

      <div className="parchment-card rounded-2xl p-8 sm:p-10">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground text-center">{dua.theme}</p>
        <p className="font-arabic text-3xl sm:text-4xl text-right leading-loose mt-6 text-foreground">{dua.arabic}</p>
        <p className="mt-6 italic text-muted-foreground text-lg leading-relaxed">{dua.transliteration}</p>
        <div className="mt-6 border-t border-border/50 pt-6">
          <p className="text-lg leading-relaxed">{dua.english}</p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setOffset(offset - 1)}><ChevronLeft className="size-4" /> Previous</Button>
        <Button variant="ghost" onClick={() => setOffset(0)} disabled={offset === 0}>Today</Button>
        <Button variant="outline" onClick={() => setOffset(offset + 1)}>Next <ChevronRight className="size-4" /></Button>
      </div>

      <div className="parchment-card rounded-2xl p-6 space-y-3">
        <h3 className="font-display text-sm uppercase tracking-widest">Your personal duas</h3>
        <Input placeholder="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea placeholder="Arabic" value={arabic} onChange={(e) => setArabic(e.target.value)} rows={2} />
        <Textarea placeholder="English" value={english} onChange={(e) => setEnglish(e.target.value)} rows={2} />
        <Button onClick={savePersonal}>Save personal dua</Button>
      </div>
    </div>
  );
}
