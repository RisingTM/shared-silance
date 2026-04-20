import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { resetCounter } from "@/server/journey.functions";
import { MILESTONES, daysBetween } from "@/lib/statuses";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";

export const Route = createFileRoute("/counter")({
  component: () => (<RequireAuth><AppShell><CounterPage /></AppShell></RequireAuth>),
});

type Break = { id: string; broken_by: "him" | "her"; note: string | null; created_at: string };

function CounterPage() {
  const { journey, refresh } = useSession();
  const [breaks, setBreaks] = useState<Break[]>([]);
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState<"him" | "her">("him");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!journey) return;
    const { data } = await supabase.from("nc_breaks").select("*").eq("journey_id", journey.id).order("created_at", { ascending: false });
    setBreaks((data ?? []) as Break[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [journey?.id]);

  const days = journey ? daysBetween(journey.nc_start_date) : 0;

  const submit = async () => {
    setBusy(true);
    try {
      await resetCounter({ data: { brokenBy: who, note: note.trim() || undefined } });
      toast.success("Counter reset. Begin again.");
      setOpen(false); setNote("");
      await refresh(); load();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">NO CONTACT</h2>
        <p className="text-muted-foreground italic mt-1">Each day is a small act of worship.</p>
      </div>

      <div className="parchment-card rounded-2xl p-10 text-center">
        <div className="font-display text-7xl sm:text-8xl text-primary tabular-nums">{days}</div>
        <p className="font-display text-xs uppercase tracking-[0.4em] text-muted-foreground mt-2">
          {days === 1 ? "day" : "days"} · since {journey ? new Date(journey.nc_start_date + "T00:00").toLocaleDateString() : "—"}
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {MILESTONES.map((m) => {
            const reached = days >= m;
            return (
              <span key={m} className={[
                "px-3 py-1 rounded-full text-xs font-display tracking-widest border",
                reached ? "bg-primary/15 text-primary border-primary/40" : "bg-muted text-muted-foreground border-border",
              ].join(" ")}>{m}d</span>
            );
          })}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" className="mt-8">Reset counter</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle className="font-display tracking-widest">RESET COUNTER</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="font-display text-xs uppercase tracking-widest">Who broke it?</Label>
                <RadioGroup value={who} onValueChange={(v) => setWho(v as any)} className="mt-2 flex gap-6">
                  <label className="flex items-center gap-2"><RadioGroupItem value="him" /> Him</label>
                  <label className="flex items-center gap-2"><RadioGroupItem value="her" /> Her</label>
                </RadioGroup>
              </div>
              <div>
                <Label className="font-display text-xs uppercase tracking-widest">What happened (optional)</Label>
                <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={3} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>{busy ? "Resetting…" : "Confirm reset"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {(journey?.has_been_reset || breaks.length > 0) && (
        <div className="parchment-card rounded-2xl p-6">
          <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground mb-4">Break log</h3>
          {breaks.length === 0 && <p className="text-sm italic text-muted-foreground">No breaks recorded.</p>}
          <ul className="space-y-3">
            {breaks.map((b) => (
              <li key={b.id} className="border-b border-border/40 pb-3 last:border-0">
                <div className="flex justify-between items-baseline">
                  <span className="font-display text-sm tracking-widest">{b.broken_by === "him" ? "HIM" : "HER"}</span>
                  <span className="text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</span>
                </div>
                {b.note && <p className="text-sm text-muted-foreground mt-1 italic">"{b.note}"</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
