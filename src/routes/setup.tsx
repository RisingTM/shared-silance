import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { setupJourney } from "@/server/journey.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/setup")({
  component: SetupPage,
});

function SetupPage() {
  const { user, profile, loading, refresh } = useSession();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) nav({ to: "/" });
    else if (profile) nav({ to: "/today" });
  }, [loading, user, profile, nav]);

  const [ownerName, setOwnerName] = useState("");
  const [partnerUsername, setPartnerUsername] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [ncDate, setNcDate] = useState(new Date().toISOString().slice(0, 10));
  const [submitting, setSubmitting] = useState(false);
  const [tempPwd, setTempPwd] = useState<string | null>(null);
  const [partnerLogin, setPartnerLogin] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await setupJourney({
        data: {
          ownerDisplayName: ownerName,
          partnerUsername: partnerUsername,
          partnerDisplayName: partnerName,
          ncStartDate: ncDate,
        },
      });
      setTempPwd(res.tempPassword);
      setPartnerLogin(res.partnerUsername);
      toast.success("Journey created");
      await refresh();
    } catch (err: any) {
      console.error("Setup failed:", err);
      let msg = err?.message;
      if (err instanceof Response) {
        try { msg = await err.text(); } catch { msg = `Error ${err.status}`; }
      }
      toast.error(msg ?? "Setup failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (tempPwd) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="parchment-card rounded-2xl p-10 max-w-lg w-full text-center">
          <h1 className="font-display text-2xl tracking-widest text-primary">SHARE THIS WITH HER</h1>
          <p className="mt-4 text-muted-foreground italic">
            She will use this once to sign in, then set her own password — one only she will know.
          </p>
          <div className="mt-6 space-y-2 text-left bg-secondary/40 rounded-lg p-4 font-mono text-sm break-all">
            <div><span className="text-muted-foreground">Username: </span><strong>{partnerLogin}</strong></div>
            <div><span className="text-muted-foreground">Temporary password: </span><strong>{tempPwd}</strong></div>
          </div>
          <Button className="mt-6 w-full" onClick={() => nav({ to: "/today" })}>
            I've shared it. Continue.
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="parchment-card rounded-2xl p-8 max-w-lg w-full">
        <h1 className="font-display text-2xl tracking-widest text-center text-primary">SET UP THE JOURNEY</h1>
        <p className="text-center text-sm text-muted-foreground italic mt-2">
          You're creating both accounts. She'll set her own password the first time she signs in.
        </p>

        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label className="font-display text-xs uppercase tracking-widest">Your name</Label>
            <Input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} />
          </div>
          <div>
            <Label className="font-display text-xs uppercase tracking-widest">Her username</Label>
            <Input required value={partnerUsername} onChange={(e) => setPartnerUsername(e.target.value)} placeholder="letters, numbers, . _ -" />
          </div>
          <div>
            <Label className="font-display text-xs uppercase tracking-widest">Her name</Label>
            <Input required value={partnerName} onChange={(e) => setPartnerName(e.target.value)} />
          </div>
          <div>
            <Label className="font-display text-xs uppercase tracking-widest">No-contact start date</Label>
            <Input type="date" required value={ncDate} onChange={(e) => setNcDate(e.target.value)} />
          </div>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Creating…" : "Create our journey"}
          </Button>
        </form>
      </div>
    </div>
  );
}
