import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Lock, Unlock as UnlockIcon, BookOpen, MessageSquareOff, Target } from "lucide-react";
import { toast } from "sonner";
import { MediaOverlay } from "@/components/MediaOverlay";

export const Route = createFileRoute("/unlock")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <UnlockPage />
      </AppShell>
    </RequireAuth>
  ),
});

const SECTIONS = [
  { k: "share_journal", l: "Journal", Icon: BookOpen },
  { k: "share_unsent_text", l: "Unsent thoughts (text)", Icon: MessageSquareOff },
  { k: "share_unsent_audio", l: "Unsent thoughts (audio + photos)", Icon: MessageSquareOff },
  { k: "share_goals", l: "Goals", Icon: Target },
] as const;

type Prefs = Record<string, any>;

function UnlockPage() {
  const { user, partnerProfile } = useSession();
  const [mine, setMine] = useState<Prefs>({});
  const [partner, setPartner] = useState<Prefs | null>(null);
  const [partnerData, setPartnerData] = useState<any>({});
  const [overlay, setOverlay] = useState<{ kind: "audio" | "image"; bucket: "unsent-audio" | "unsent-images"; path: string } | null>(null);

  const load = async () => {
    if (!user || !partnerProfile) return;
    const { data: m } = await supabase.from("unlock_prefs").select("*").eq("user_id", user.id).maybeSingle();
    setMine((m as unknown as Prefs) ?? {});
    const { data: p } = await supabase.from("unlock_prefs").select("*").eq("user_id", partnerProfile.id).maybeSingle();
    setPartner((p as unknown as Prefs) ?? null);
  };
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [user?.id, partnerProfile?.id]);

  useEffect(() => {
    if (!partnerProfile || !partner?.is_unlocked) return;
    const pid = partnerProfile.id;
    const fetches: Record<string, PromiseLike<any>> = {};
    if (partner.share_journal)
      fetches.journal = supabase.from("journal_entries").select("*").eq("user_id", pid).order("created_at", { ascending: false });
    if (partner.share_goals)
      fetches.goals = supabase.from("goals").select("*").eq("user_id", pid).order("created_at", { ascending: false });
    if (partner.share_unsent_text || partner.share_unsent_audio)
      fetches.unsent = supabase.from("unsent_thoughts").select("*").eq("user_id", pid).order("created_at", { ascending: false });

    Promise.all(Object.entries(fetches).map(async ([k, p]) => [k, ((await Promise.resolve(p)) as any).data] as const)).then(
      (entries) => {
        setPartnerData(Object.fromEntries(entries));
      },
    );
  }, [partner, partnerProfile]);

  const save = async () => {
    if (!user) return;
    const allOff = SECTIONS.every((s) => !mine[s.k]);
    const payload = {
      user_id: user.id,
      ...mine,
      is_unlocked: !allOff,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("unlock_prefs").upsert(payload);
    if (error) return toast.error(error.message);
    toast.success("Saved. They'll see only what you chose.");
    load();
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">UNLOCK</h2>
        <p className="text-muted-foreground italic mt-1">Choose what you want them to see.</p>
      </div>

      <div className="parchment-card rounded-2xl p-5">
        <h3 className="font-display text-sm uppercase tracking-widest mb-4">Your sharing</h3>
        <div className="space-y-3">
          {SECTIONS.map(({ k, l, Icon }) => (
            <div key={k} className="flex items-center justify-between rounded-xl border border-border/70 p-3">
              <Label htmlFor={k} className="flex items-center gap-3 cursor-pointer">
                <Icon className="size-4 text-primary" />
                <span>{l}</span>
              </Label>
              <Switch id={k} checked={!!mine[k]} onCheckedChange={(v) => setMine({ ...mine, [k]: v })} />
            </div>
          ))}
          <Button onClick={save} className="w-full mt-2">
            <UnlockIcon className="size-4" /> Save choices
          </Button>
        </div>
      </div>

      <div className="parchment-card rounded-2xl p-5">
        <h3 className="font-display text-sm uppercase tracking-widest mb-4">What they chose to show you</h3>
        {!partner?.is_unlocked ? (
          <div className="flex items-center gap-3 text-muted-foreground">
            <Lock className="size-4" />
            <p className="italic">Nothing yet.</p>
          </div>
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
            {partnerData.goals?.length > 0 && (
              <Section title="Goals">
                <ul className="space-y-1">
                  {partnerData.goals.map((g: any) => (
                    <li key={g.id} className="text-sm">
                      {g.done ? "✓" : "○"} {g.title}
                    </li>
                  ))}
                </ul>
              </Section>
            )}
            {partnerData.unsent?.length > 0 && (
              <Section title="Unsent Thoughts">
                {partnerData.unsent.map((u: any) => (
                  <div key={u.id} className="py-2 border-b border-border/40">
                    <p className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</p>
                    {u.kind === "text" ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm">{u.text_content}</p>
                    ) : u.kind === "audio" && u.audio_path ? (
                      <button
                        onClick={() => setOverlay({ kind: "audio", bucket: "unsent-audio", path: u.audio_path })}
                        className="mt-1 text-sm text-primary hover:underline"
                      >
                        🎙 audio
                      </button>
                    ) : u.kind === "image" && u.image_path ? (
                      <button
                        onClick={() => setOverlay({ kind: "image", bucket: "unsent-images", path: u.image_path })}
                        className="mt-1 text-sm text-primary hover:underline"
                      >
                        🖼 photo
                      </button>
                    ) : null}
                  </div>
                ))}
              </Section>
            )}
          </div>
        )}
      </div>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="font-display text-xs uppercase tracking-widest text-primary mb-2">{title}</h4>
      <div>{children}</div>
    </div>
  );
}
