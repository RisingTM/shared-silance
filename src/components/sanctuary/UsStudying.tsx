import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { RatingPill, ratingColorClass } from "@/components/RatingPill";
import { parseSyllabus, itemKey, type Module } from "@/lib/syllabus";
import { ChevronDown, ChevronRight, Filter, Upload } from "lucide-react";
import { toast } from "sonner";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";

type Rating = { item_key: string; user_id: string; rating: number };

const COLORS = ["#ef4444", "#dc2626", "#f97316", "#facc15", "#a3e635", "#10b981"];

export function UsStudying() {
  const { user, journey, profile, partnerProfile } = useSession();
  const isOwner = profile?.role === "owner";
  const [modules, setModules] = useState<Module[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [confirmReplace, setConfirmReplace] = useState<Module[] | null>(null);
  const [search, setSearch] = useState("");
  const [needsWorkOnly, setNeedsWorkOnly] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const myId = user?.id;
  const partnerId = partnerProfile?.id;

  const load = async () => {
    if (!journey) return;
    const [{ data: syl }, { data: rts }] = await Promise.all([
      supabase.from("us_syllabus").select("*").eq("journey_id", journey.id).maybeSingle(),
      supabase.from("us_syllabus_ratings").select("item_key, user_id, rating").eq("journey_id", journey.id),
    ]);
    setModules(((syl?.content as any) ?? []) as Module[]);
    setRatings((rts ?? []) as any);
  };
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [journey?.id]);

  const ratingFor = (key: string, uid: string): number =>
    ratings.find((r) => r.item_key === key && r.user_id === uid)?.rating ?? 0;

  const setMyRating = async (key: string, val: number) => {
    if (!myId || !journey) return;
    const existing = ratings.find((r) => r.item_key === key && r.user_id === myId);
    setRatings((prev) => {
      const others = prev.filter((r) => !(r.item_key === key && r.user_id === myId));
      return [...others, { item_key: key, user_id: myId, rating: val }];
    });
    if (existing) {
      await supabase
        .from("us_syllabus_ratings")
        .update({ rating: val, updated_at: new Date().toISOString() })
        .eq("user_id", myId)
        .eq("item_key", key)
        .eq("journey_id", journey.id);
    } else {
      await supabase
        .from("us_syllabus_ratings")
        .insert({ user_id: myId, journey_id: journey.id, item_key: key, rating: val });
    }
  };

  const handleParse = () => {
    const res = parseSyllabus(pasteText);
    if (!res.ok) {
      setPasteError(`Line ${res.line}: ${res.error}`);
      return;
    }
    setPasteError(null);
    if (modules.length > 0) {
      setConfirmReplace(res.modules);
    } else {
      saveSyllabus(res.modules);
    }
  };

  const saveSyllabus = async (mods: Module[]) => {
    if (!journey || !myId) return;
    const existing = await supabase.from("us_syllabus").select("journey_id").eq("journey_id", journey.id).maybeSingle();
    if (existing.data) {
      await supabase.from("us_syllabus").update({ content: mods as any, imported_by: myId, imported_at: new Date().toISOString() }).eq("journey_id", journey.id);
    } else {
      await supabase.from("us_syllabus").insert({ journey_id: journey.id, content: mods as any, imported_by: myId });
    }
    setPasteOpen(false);
    setPasteText("");
    setConfirmReplace(null);
    toast.success("Syllabus saved");
    load();
  };

  const toggleExpand = (k: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  };

  const filteredModules = useMemo(() => {
    const q = search.trim().toLowerCase();
    return modules
      .map((m) => ({
        ...m,
        branches: m.branches
          .map((b) => ({
            ...b,
            items: b.items.filter((it) => {
              if (q && !it.toLowerCase().includes(q)) return false;
              if (needsWorkOnly) {
                const k = itemKey(m.name, b.name, it);
                const mine = ratingFor(k, myId ?? "");
                const theirs = partnerId ? ratingFor(k, partnerId) : 0;
                if (mine > 2 && theirs > 2) return false;
              }
              return true;
            }),
          }))
          .filter((b) => b.items.length > 0),
      }))
      .filter((m) => m.branches.length > 0);
  }, [modules, search, needsWorkOnly, ratings, myId, partnerId]);

  // Progress data
  const progress = useMemo(() => {
    const distFor = (uid: string) => {
      const dist = [0, 0, 0, 0, 0, 0];
      let total = 0;
      let sum = 0;
      const moduleAvgs: { name: string; avg: number }[] = [];
      for (const m of modules) {
        let mSum = 0;
        let mCount = 0;
        for (const b of m.branches) {
          for (const it of b.items) {
            const k = itemKey(m.name, b.name, it);
            const r = ratingFor(k, uid);
            dist[r]++;
            sum += r;
            total++;
            mSum += r;
            mCount++;
          }
        }
        moduleAvgs.push({ name: m.name, avg: mCount ? mSum / mCount : 0 });
      }
      return {
        dist: dist.map((v, i) => ({ name: `${i}`, value: v })),
        avg: total ? sum / total : 0,
        total,
        rated4plus: dist[4] + dist[5],
        moduleAvgs,
      };
    };
    return { me: distFor(myId ?? ""), partner: partnerId ? distFor(partnerId) : null };
    /* eslint-disable-next-line */
  }, [modules, ratings, myId, partnerId]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl tracking-widest text-primary">STUDYING</h2>
        {isOwner && (
          <Button size="sm" variant="outline" onClick={() => setPasteOpen(true)}>
            <Upload className="size-4" /> Import
          </Button>
        )}
      </div>

      <Tabs defaultValue="tree">
        <TabsList className="w-full">
          <TabsTrigger value="tree" className="flex-1">Items</TabsTrigger>
          <TabsTrigger value="progress" className="flex-1">Progress</TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="space-y-3">
          {modules.length === 0 ? (
            <p className="text-center italic text-muted-foreground py-10">
              {isOwner ? "Tap Import to paste a syllabus." : "No syllabus yet."}
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <Input placeholder="Search items…" value={search} onChange={(e) => setSearch(e.target.value)} />
                <Button
                  variant={needsWorkOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setNeedsWorkOnly((v) => !v)}
                >
                  <Filter className="size-4" /> Needs work
                </Button>
              </div>
              {filteredModules.map((m) => {
                const mKey = `m:${m.name}`;
                const mOpen = expanded.has(mKey) || !!search || needsWorkOnly;
                return (
                  <div key={m.name} className="parchment-card rounded-xl p-3">
                    <button
                      onClick={() => toggleExpand(mKey)}
                      className="w-full flex items-center gap-2 text-left"
                    >
                      {mOpen ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                      <span className="font-display tracking-wide text-sm">{m.name}</span>
                    </button>
                    {mOpen && (
                      <div className="mt-2 ml-4 space-y-2">
                        {m.branches.map((b) => {
                          const bKey = `b:${m.name}/${b.name}`;
                          const bOpen = expanded.has(bKey) || !!search || needsWorkOnly;
                          return (
                            <div key={b.name}>
                              <button
                                onClick={() => toggleExpand(bKey)}
                                className="flex items-center gap-2 text-xs text-muted-foreground"
                              >
                                {bOpen ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                                {b.name}
                              </button>
                              {bOpen && (
                                <ul className="mt-1 ml-4 space-y-2">
                                  {b.items.map((it) => {
                                    const k = itemKey(m.name, b.name, it);
                                    const mine = ratingFor(k, myId ?? "");
                                    const theirs = partnerId ? ratingFor(k, partnerId) : 0;
                                    return (
                                      <li key={it} className="rounded-lg border border-border/50 p-2 space-y-1.5">
                                        <p className="text-xs leading-snug">{it}</p>
                                        <div className="flex items-center gap-3 flex-wrap">
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[9px] uppercase text-muted-foreground">you</span>
                                            <RatingPill value={mine} onChange={(v) => setMyRating(k, v)} />
                                          </div>
                                          {partnerId && (
                                            <div className="flex items-center gap-1.5 opacity-80">
                                              <span className="text-[9px] uppercase text-muted-foreground">{partnerProfile?.username}</span>
                                              <RatingPill value={theirs} readOnly />
                                            </div>
                                          )}
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </TabsContent>

        <TabsContent value="progress" className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: profile?.username ?? "you", data: progress.me },
              { label: partnerProfile?.username ?? "partner", data: progress.partner },
            ].map(
              ({ label, data }, idx) =>
                data && (
                  <div key={idx} className="parchment-card rounded-xl p-3 text-center">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
                    <div className="font-display text-2xl">{data.avg.toFixed(1)}</div>
                    <div className="h-32">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie data={data.dist} dataKey="value" innerRadius={20} outerRadius={50}>
                            {data.dist.map((_, i) => (
                              <Cell key={i} fill={COLORS[i]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {data.rated4plus} of {data.total} rated 4+
                    </div>
                  </div>
                ),
            )}
          </div>
          <div className="parchment-card rounded-xl p-3 space-y-2">
            <h4 className="font-display text-xs uppercase tracking-widest text-primary">By module</h4>
            {progress.me.moduleAvgs.map((m, idx) => {
              const t = progress.partner?.moduleAvgs[idx];
              return (
                <div key={m.name} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">{m.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] ${ratingColorClass(m.avg)}`}>{m.avg.toFixed(1)}</span>
                  {t && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${ratingColorClass(t.avg)}`}>{t.avg.toFixed(1)}</span>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Paste dialog */}
      <AlertDialog open={pasteOpen} onOpenChange={setPasteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import syllabus</AlertDialogTitle>
            <AlertDialogDescription>
              Use # for modules, - for branches, plain lines for items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea rows={10} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="# Module&#10;- Branch&#10;Item" />
          {pasteError && <p className="text-xs text-destructive">{pasteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleParse}>Parse</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmReplace} onOpenChange={(o) => !o && setConfirmReplace(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace current syllabus?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmReplace && saveSyllabus(confirmReplace)}>Replace</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
