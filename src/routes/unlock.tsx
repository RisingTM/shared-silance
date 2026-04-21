import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { daysBetween } from "@/lib/statuses";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock, Unlock as UnlockIcon } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/unlock")({
  component: () => (<RequireAuth><AppShell><UnlockPage /></AppShell></RequireAuth>),
});

const SECTIONS = [
  { k: "share_journal", l: "Journal" },
  { k: "share_mood", l: "Mood history" },
  { k: "share_goals", l: "Goals" },
  { k: "share_worship", l: "Worship log" },
  { k: "share_unsent_text", l: "Unsent thoughts (text)" },
  { k: "share_unsent_audio", l: "Unsent thoughts (audio)" },
] as const;

type Prefs = Record<string, any>;

function UnlockPage() {
  const { user, profile, journey, partnerProfile } = useSession();
  const [mine, setMine] = useState<Prefs>({});
  const [partner, setPartner] = useState<Prefs | null>(null);
  const [partnerData, setPartnerData] = useState<any>({});
  const days = journey ? daysBetween(journey.nc_start_date) : 0;
  const eligible = days >= 365;

  const load = async () => {
    if (!user || !partnerProfile) return;
    const { data: m } = await supabase.from("unlock_prefs").select("*").eq("user_id", user.id).maybeSingle();
    setMine((m as unknown as Prefs) ?? {});
    const { data: p } = await supabase.from("unlock_prefs").select("*").eq("user_id", partnerProfile.id).maybeSingle();
    setPartner((p as unknown as Prefs) ?? null);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user?.id, partnerProfile?.id]);

  // Load whatever partner has shared (RLS will filter)
  useEffect(() => {
    if (!partnerProfile || !partner?.is_unlocked) return;
    const pid = partnerProfile.id;
    const fetches: Record<string, PromiseLike<any>> = {};
    if (partner.share_journal) fetches.journal = supabase.from("journal_entries").select("*").eq("user_id", pid).order("created_at", { ascending: false });
    if (partner.share_mood) fetches.mood = supabase.from("mood_entries").select("*").eq("user_id", pid).order("entry_date", { ascending: false });
    if (partner.share_goals) fetches.goals = supabase.from("goals").select("*").eq("user_id", pid).order("created_at", { ascending: false });
    if (partner.share_worship) fetches.worship = supabase.from("worship_logs").select("*").eq("user_id", pid).order("entry_date", { ascending: false });
    if (partner.share_unsent_text || partner.share_unsent_audio) fetches.unsent = supabase.from("unsent_thoughts").select("*").eq("user_id", pid).order("created_at", { ascending: false });

    Promise.all(Object.entries(fetches).map(async ([k, p]) => [k, (await Promise.resolve(p) as any).data] as const)).then((entries) => {
      setPartnerData(Object.fromEntries(entries));
    });
  }, [partner, partnerProfile]);

  const save = async () => {
    if (!user) return;
    const payload = { user_id: user.id, ...mine, is_unlocked: true, updated_at: new Date().toISOString() };
    const { error } = await supabase.from("unlock_prefs").upsert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved. They'll see only what you chose.");
    load();
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">UNLOCK</h2>
        <p className="text-muted-foreground italic mt-1">After 365 days, choose — slowly — what to share.</p>
      </div>

      <div className="parchment-card rounded-2xl p-6">
        <h3 className="font-display tracking-widest mb-4">YOUR SHARING</h3>
        {!eligible ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Lock className="size-5" />
            <p>Unlocks after 365 days. Currently at <strong>{days}</strong>.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {SECTIONS.map((s) => (
              <div key={s.k} className="flex items-center justify-between">
                <Label htmlFor={s.k}>{s.l}</Label>
                <Switch id={s.k} checked={!!mine[s.k]} onCheckedChange={(v) => setMine({ ...mine, [s.k]: v })} />
              </div>
            ))}
            <Button onClick={save} className="w-full mt-4"><UnlockIcon className="size-4" /> Save choices</Button>
          </div>
        )}
      </div>

      <div className="parchment-card rounded-2xl p-6">
        <h3 className="font-display tracking-widest mb-4">WHAT THEY CHOSE TO SHOW YOU</h3>
        {!partner?.is_unlocked ? (
          <p className="text-muted-foreground italic">Nothing yet.</p>
        ) : (
          <div className="space-y-6">
            {partnerData.journal?.length > 0 && (
              <Section title="Journal">
                {partnerData.journal.map((j: any) => (
                  <div key={j.id} className="border-b border-border/40 py-2">
                    <p className="font-display">{j.title}</p>
                    <p className="text-xs text-muted-foreground">{new Date(j.created_at).toLocaleDateString()}</p>
                    <p className="mt-1 whitespace-pre-wrap">{j.body}</p>
                  </div>
                ))}
              </Section>
            )}
            {partnerData.mood?.length > 0 && (
              <Section title="Mood">
                <div className="flex flex-wrap gap-2">{partnerData.mood.map((m: any) => <span key={m.id} className="text-2xl" title={m.entry_date}>{m.mood}</span>)}</div>
              </Section>
            )}
            {partnerData.goals?.length > 0 && (
              <Section title="Goals">
                <ul className="space-y-1">{partnerData.goals.map((g: any) => <li key={g.id} className="text-sm">{g.done ? "✓" : "○"} {g.title}</li>)}</ul>
              </Section>
            )}
            {partnerData.worship?.length > 0 && (
              <Section title="Worship">
                <ul className="text-sm">{partnerData.worship.map((r: any) => <li key={r.id}>{r.entry_date}: 📖 {r.pages} · 📿 {r.adhkar}</li>)}</ul>
              </Section>
            )}
            {partnerData.unsent?.length > 0 && (
              <Section title="Unsent Thoughts">
                {partnerData.unsent.map((u: any) => (
                  <div key={u.id} className="py-2 border-b border-border/40">
                    <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</p>
                    {u.kind === "text" ? <p className="mt-1 whitespace-pre-wrap">{u.text_content}</p> : <AudioPlayer path={u.audio_path} />}
                  </div>
                ))}
              </Section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-display text-xs uppercase tracking-widest text-primary mb-2">{title}</h4>
      <div>{children}</div>
    </div>
  );
}
function AudioPlayer({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    supabase.storage.from("unsent-audio").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  if (!url) return <p className="text-sm text-muted-foreground">Loading…</p>;
  return <audio src={url} controls className="w-full mt-1" />;
}
