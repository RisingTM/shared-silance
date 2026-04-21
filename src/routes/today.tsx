import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_OPTIONS, statusMeta, type StatusKey } from "@/lib/statuses";
import { regeneratePartnerTempPassword } from "@/server/journey.functions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { History, KeyRound } from "lucide-react";

export const Route = createFileRoute("/today")({
  component: () => (<RequireAuth><AppShell><TodayPage /></AppShell></RequireAuth>),
});

type Row = { id: string; user_id: string; status: string; created_at: string };

function TodayPage() {
  const { profile, partnerProfile, journey } = useSession();
  const [mine, setMine] = useState<Row | null>(null);
  const [theirs, setTheirs] = useState<Row | null>(null);
  const [history, setHistory] = useState<Row[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    if (!journey || !profile) return;
    const { data: all } = await supabase
      .from("daily_statuses")
      .select("*")
      .eq("journey_id", journey.id)
      .order("created_at", { ascending: false });
    const rows = (all ?? []) as Row[];
    setHistory(rows);
    setMine(rows.find((r) => r.user_id === profile.id) ?? null);
    if (partnerProfile) setTheirs(rows.find((r) => r.user_id === partnerProfile.id) ?? null);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.id, journey?.id, partnerProfile?.id]);

  const setStatus = async (key: StatusKey) => {
    if (!profile || !journey) return;
    setSubmitting(true);
    const { error } = await supabase.from("daily_statuses").insert({
      user_id: profile.id, journey_id: journey.id, status: key,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error.message.includes("12 hours") ? "You've already shared today. Try again in 12 hours." : error.message);
      return;
    }
    toast.success("Status shared");
    load();
  };

  const cooldownRemaining = (() => {
    if (!mine) return null;
    const next = new Date(mine.created_at).getTime() + 12 * 3600 * 1000;
    const ms = next - Date.now();
    if (ms <= 0) return null;
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  })();

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">TODAY</h2>
        <p className="text-muted-foreground italic mt-1">A single word for each other.</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <StatusCard label="You" name={profile?.display_name ?? "You"} row={mine} />
        <StatusCard label="Them" name={partnerProfile?.display_name ?? "—"} row={theirs} />
      </div>

      <div className="parchment-card rounded-2xl p-6">
        <h3 className="font-display text-sm uppercase tracking-widest text-muted-foreground text-center mb-4">
          {cooldownRemaining ? `Next update in ${cooldownRemaining}` : "How are you, right now?"}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.key}
              disabled={submitting || !!cooldownRemaining}
              onClick={() => setStatus(s.key)}
              className="flex flex-col items-center gap-2 rounded-xl border border-border bg-card hover:bg-accent/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors p-4"
            >
              <span className="text-3xl">{s.emoji}</span>
              <span className="text-sm">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="w-full"><History className="size-4" /> View history</Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-display tracking-widest">FULL HISTORY</DialogTitle></DialogHeader>
          <ScrollArea className="h-96 pr-4">
            <ul className="space-y-2">
              {history.length === 0 && <li className="text-sm text-muted-foreground italic text-center py-8">Nothing yet.</li>}
              {history.map((r) => {
                const m = statusMeta(r.status);
                const who = r.user_id === profile?.id ? (profile?.display_name ?? "You") : (partnerProfile?.display_name ?? "Them");
                return (
                  <li key={r.id} className="flex items-center justify-between border-b border-border/40 py-2">
                    <span className="flex items-center gap-2"><span className="text-xl">{m.emoji}</span><span className="text-sm">{m.label}</span></span>
                    <span className="text-xs text-muted-foreground">{who} · {new Date(r.created_at).toLocaleString()}</span>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {profile?.role === "owner" && <RegeneratePartnerPassword />}
    </div>
  );
}

function RegeneratePartnerPassword() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<{ username: string; tempPassword: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const run = async () => {
    setLoading(true);
    try {
      const r = await regeneratePartnerTempPassword();
      setResult(r);
      toast.success("New temporary password generated");
    } catch (err: any) {
      toast.error(err?.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setResult(null); }}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="w-full text-xs italic text-muted-foreground hover:text-primary">
          <KeyRound className="size-3.5" /> She forgot her password — generate a new temporary one
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="font-display tracking-widest">RESET HER PASSWORD</DialogTitle></DialogHeader>
        {!result ? (
          <>
            <p className="text-sm text-muted-foreground italic">
              This creates a new temporary password for her. She'll use it once to sign in, then set a new private password.
              Her existing password (if she set one) will stop working.
            </p>
            <Button onClick={run} disabled={loading} className="w-full">
              {loading ? "Generating…" : "Generate new temporary password"}
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground italic">Share this with her. Shows only once.</p>
            <div className="space-y-2 text-left bg-secondary/40 rounded-lg p-4 font-mono text-sm break-all">
              <div><span className="text-muted-foreground">Username: </span><strong>{result.username}</strong></div>
              <div><span className="text-muted-foreground">Temporary password: </span><strong>{result.tempPassword}</strong></div>
            </div>
            <Button onClick={() => setOpen(false)} className="w-full">I've shared it</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StatusCard({ label, name, row }: { label: string; name: string; row: Row | null }) {
  const m = row ? statusMeta(row.status) : null;
  return (
    <div className="parchment-card rounded-2xl p-6 text-center">
      <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground">{label}</p>
      <p className="font-display text-lg mt-1">{name}</p>
      <div className="my-6 text-6xl">{m?.emoji ?? "·"}</div>
      <p className="text-base">{m?.label ?? "Not yet today"}</p>
      {row && <p className="text-xs text-muted-foreground mt-2">{new Date(row.created_at).toLocaleString()}</p>}
    </div>
  );
}
