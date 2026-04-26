import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { UsLockGate } from "@/components/UsLockGate";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronLeft, Pencil, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { replaceSyllabus } from "@/server/us.functions";
import {
  Module,
  itemKey,
  parseSyllabus,
  syllabusToText,
} from "@/lib/syllabus";
import { RatingPill, ratingColorClass } from "@/components/RatingPill";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/us/studying")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <UsLockGate>
          <Studying />
        </UsLockGate>
      </AppShell>
    </RequireAuth>
  ),
});

type Rating = { user_id: string; item_key: string; rating: number };

function Studying() {
  const { user, journey, profile, partnerProfile } = useSession();
  const isOwner = profile?.role === "owner";
  const [modules, setModules] = useState<Module[]>([]);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!journey) return;
    const [{ data: syl }, { data: rs }] = await Promise.all([
      supabase.from("us_syllabus").select("content").eq("journey_id", journey.id).maybeSingle(),
      supabase.from("us_syllabus_ratings").select("user_id, item_key, rating").eq("journey_id", journey.id),
    ]);
    setModules(((syl?.content as Module[]) ?? []) as Module[]);
    setRatings((rs as Rating[]) ?? []);
  };
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [journey?.id]);

  const ratingFor = (uid: string, key: string) =>
    ratings.find((r) => r.user_id === uid && r.item_key === key)?.rating ?? 0;

  const saveRating = async (key: string, value: number) => {
    if (!user || !journey) return;
    const existing = ratings.find((r) => r.user_id === user.id && r.item_key === key);
    if (existing && existing.rating === value) return;
    // optimistic
    setRatings((prev) => {
      const without = prev.filter((r) => !(r.user_id === user.id && r.item_key === key));
      return [...without, { user_id: user.id, item_key: key, rating: value }];
    });
    const { error } = await supabase
      .from("us_syllabus_ratings")
      .upsert(
        { journey_id: journey.id, user_id: user.id, item_key: key, rating: value, updated_at: new Date().toISOString() },
        { onConflict: "user_id,item_key" } as any,
      );
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const openEditor = () => {
    setDraft(modules.length ? syllabusToText(modules) : "# Module name\n- Branch name\nItem one\nItem two\n");
    setParseError(null);
    setEditOpen(true);
  };

  const saveSyllabus = async () => {
    const parsed = parseSyllabus(draft);
    if (!parsed.ok) {
      setParseError(`Line ${parsed.line}: ${parsed.error}`);
      return;
    }
    setBusy(true);
    try {
      await (replaceSyllabus as any)({ data: { modules: parsed.modules } });
      toast.success("Syllabus saved");
      setEditOpen(false);
      load();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not save syllabus");
    } finally {
      setBusy(false);
    }
  };

  // Aggregate stats: average per module across both users.
  const stats = useMemo(() => {
    const partnerId = partnerProfile?.id;
    return modules.map((m) => {
      const yours: number[] = [];
      const theirs: number[] = [];
      let total = 0;
      let yoursDone = 0;
      let theirsDone = 0;
      for (const b of m.branches) {
        for (const it of b.items) {
          const k = itemKey(m.name, b.name, it);
          total += 1;
          const my = user ? ratingFor(user.id, k) : 0;
          const pa = partnerId ? ratingFor(partnerId, k) : 0;
          yours.push(my);
          theirs.push(pa);
          if (my > 0) yoursDone += 1;
          if (pa > 0) theirsDone += 1;
        }
      }
      const avg = (a: number[]) => (a.length ? a.reduce((s, n) => s + n, 0) / a.length : 0);
      return {
        name: m.name,
        total,
        yoursAvg: avg(yours),
        theirsAvg: avg(theirs),
        yoursDone,
        theirsDone,
      };
    });
  }, [modules, ratings, user?.id, partnerProfile?.id]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/us" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Us
        </Link>
        {isOwner && (
          <Button variant="outline" size="sm" onClick={openEditor}>
            <Pencil className="size-4" /> {modules.length ? "Edit" : "Paste syllabus"}
          </Button>
        )}
      </div>

      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">STUDYING</h2>
        <p className="text-muted-foreground italic mt-1">Rate your confidence side by side.</p>
      </div>

      {modules.length === 0 ? (
        <div className="parchment-card rounded-2xl p-6 text-center text-sm text-muted-foreground">
          {isOwner ? (
            <>No syllabus yet. Tap <em>Paste syllabus</em> to begin.</>
          ) : (
            <>Waiting for the owner to add a syllabus.</>
          )}
        </div>
      ) : (
        <>
          {/* Stats summary */}
          <div className="parchment-card rounded-2xl p-4 space-y-3">
            <p className="font-display text-[11px] uppercase tracking-widest text-muted-foreground">Progress by module</p>
            <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 items-center text-xs">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground" />
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground text-right">You</span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground text-right">@{partnerProfile?.username ?? "partner"}</span>
              {stats.map((s) => (
                <Row3 key={s.name} name={s.name} you={s.yoursAvg} them={s.theirsAvg} youDone={s.yoursDone} themDone={s.theirsDone} total={s.total} />
              ))}
            </div>
          </div>

          {/* Items */}
          <div className="space-y-5">
            {modules.map((m) => (
              <div key={m.name} className="parchment-card rounded-2xl p-4 space-y-3">
                <h3 className="font-display text-sm uppercase tracking-widest text-primary">{m.name}</h3>
                {m.branches.map((b) => (
                  <div key={b.name} className="space-y-2">
                    <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{b.name}</p>
                    <div className="space-y-2">
                      {b.items.map((it) => {
                        const k = itemKey(m.name, b.name, it);
                        const mine = user ? ratingFor(user.id, k) : 0;
                        const theirs = partnerProfile ? ratingFor(partnerProfile.id, k) : 0;
                        return (
                          <div key={k} className="rounded-lg border border-border/60 p-2 space-y-2">
                            <p className="text-sm">{it}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">You</p>
                                <RatingPill value={mine} onChange={(v) => saveRating(k, v)} />
                              </div>
                              <div className="space-y-1">
                                <p className="text-[10px] uppercase tracking-widest text-muted-foreground truncate">
                                  @{partnerProfile?.username ?? "partner"}
                                </p>
                                <RatingPill value={theirs} readOnly />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Syllabus</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              Use <code># Module</code>, <code>- Branch</code>, then plain lines for items.
            </p>
            <Textarea
              rows={14}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="font-mono text-xs"
            />
            {parseError && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <AlertCircle className="size-3.5" /> {parseError}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)} disabled={busy}>Cancel</Button>
            <Button onClick={saveSyllabus} disabled={busy}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row3({ name, you, them, youDone, themDone, total }: {
  name: string; you: number; them: number; youDone: number; themDone: number; total: number;
}) {
  return (
    <>
      <span className="truncate font-display tracking-wide">{name}</span>
      <span className={cn("inline-flex items-center justify-center size-7 rounded-full border text-[11px] font-display tabular-nums", ratingColorClass(you))} title={`${youDone}/${total} rated`}>
        {you.toFixed(1)}
      </span>
      <span className={cn("inline-flex items-center justify-center size-7 rounded-full border text-[11px] font-display tabular-nums", ratingColorClass(them))} title={`${themDone}/${total} rated`}>
        {them.toFixed(1)}
      </span>
    </>
  );
}
