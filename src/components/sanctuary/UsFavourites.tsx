import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, Shuffle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Fav = { id: string; user_id: string; content: string; created_at: string };

export function UsFavourites() {
  const { user, journey, profile, partnerProfile } = useSession();
  const [list, setList] = useState<Fav[]>([]);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState("");
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const myId = user?.id;
  const partnerId = partnerProfile?.id;

  const load = async () => {
    if (!journey) return;
    const { data } = await supabase
      .from("us_favourites")
      .select("*")
      .eq("journey_id", journey.id)
      .order("created_at", { ascending: false });
    setList((data ?? []) as any);
  };
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [journey?.id]);

  const add = async () => {
    if (!myId || !journey || !text.trim()) return;
    await supabase.from("us_favourites").insert({ user_id: myId, journey_id: journey.id, content: text.trim() });
    setText("");
    setAdding(false);
    load();
  };

  const del = async (id: string) => {
    await supabase.from("us_favourites").delete().eq("id", id);
    load();
  };

  const mine = list.filter((f) => f.user_id === myId);
  const theirs = list.filter((f) => f.user_id === partnerId);

  const shuffle = () => {
    if (mine.length === 0) return;
    const pick = mine[Math.floor(Math.random() * mine.length)];
    setHighlightId(pick.id);
    setTimeout(() => setHighlightId(null), 2500);
    document.getElementById(`fav-${pick.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-display text-2xl tracking-widest text-primary">FAVOURITE THINGS</h2>
        <p className="text-xs text-muted-foreground italic">Things we love about each other</p>
      </div>

      <Tabs defaultValue="mine">
        <TabsList className="w-full">
          <TabsTrigger value="mine" className="flex-1">Mine ({mine.length})</TabsTrigger>
          <TabsTrigger value="theirs" className="flex-1">Theirs ({theirs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="mine" className="space-y-3">
          <div className="flex gap-2">
            {!adding ? (
              <Button onClick={() => setAdding(true)} className="flex-1">
                <Plus className="size-4" /> Add
              </Button>
            ) : (
              <>
                <Input
                  autoFocus
                  placeholder="I love how…"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && add()}
                />
                <Button onClick={add}>Save</Button>
                <Button variant="ghost" onClick={() => { setAdding(false); setText(""); }}>×</Button>
              </>
            )}
            <Button variant="outline" onClick={shuffle}>
              <Shuffle className="size-4" />
            </Button>
          </div>
          <ul className="space-y-2">
            {mine.map((f) => (
              <li
                key={f.id}
                id={`fav-${f.id}`}
                className={cn(
                  "rounded-xl border border-border/70 bg-card p-3 transition-all",
                  highlightId === f.id && "ring-2 ring-primary shadow-lg scale-[1.02]",
                )}
              >
                <div className="flex items-start gap-2">
                  <p className="flex-1 text-sm whitespace-pre-wrap">{f.content}</p>
                  <button onClick={() => del(f.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(f.created_at).toLocaleDateString()}</p>
              </li>
            ))}
            {mine.length === 0 && (
              <p className="text-center italic text-sm text-muted-foreground py-8">Nothing yet.</p>
            )}
          </ul>
        </TabsContent>

        <TabsContent value="theirs" className="space-y-2">
          <p className="text-center text-xs text-muted-foreground italic">
            What {partnerProfile?.username ?? "your partner"} loves about you
          </p>
          <ul className="space-y-2">
            {theirs.map((f) => (
              <li key={f.id} className="rounded-xl border border-border/70 bg-card p-3">
                <p className="text-sm whitespace-pre-wrap">{f.content}</p>
                <p className="text-[10px] text-muted-foreground mt-1">{new Date(f.created_at).toLocaleDateString()}</p>
              </li>
            ))}
            {theirs.length === 0 && (
              <p className="text-center italic text-sm text-muted-foreground py-8">Nothing yet.</p>
            )}
          </ul>
        </TabsContent>
      </Tabs>
    </div>
  );
}
