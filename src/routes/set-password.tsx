import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { setOwnPassword } from "@/server/journey.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/set-password")({
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const { profile, loading, refresh } = useSession();
  const nav = useNavigate();
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!profile) nav({ to: "/" });
    else if (!profile.must_set_password) nav({ to: "/today" });
  }, [loading, profile, nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd !== confirm) return toast.error("Passwords don't match");
    if (pwd.length < 8) return toast.error("At least 8 characters");
    setBusy(true);
    try {
      await setOwnPassword({ data: { newPassword: pwd } });
      toast.success("Your password is set. Welcome.");
      await refresh();
      nav({ to: "/today" });
    } catch (err: any) {
      toast.error(err.message ?? "Could not set password");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="parchment-card rounded-2xl p-8 max-w-md w-full">
        <h1 className="font-display text-2xl tracking-widest text-center text-primary">YOUR PASSWORD</h1>
        <p className="text-center text-sm text-muted-foreground italic mt-3">
          Set a password only you know. He cannot see it. He cannot reset it.
        </p>
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <Label className="font-display text-xs uppercase tracking-widest">New password</Label>
            <Input type="password" required minLength={8} value={pwd} onChange={(e) => setPwd(e.target.value)} />
          </div>
          <div>
            <Label className="font-display text-xs uppercase tracking-widest">Confirm</Label>
            <Input type="password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button type="submit" disabled={busy} className="w-full">{busy ? "Saving…" : "Seal it"}</Button>
        </form>
      </div>
    </div>
  );
}
