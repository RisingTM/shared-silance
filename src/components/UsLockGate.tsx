import { useEffect, useState } from "react";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { isUsUnlocked, markUsUnlocked } from "@/lib/us-session";
import { setUsPassword, usPasswordStatus, verifyUsPassword } from "@/server/us.functions";
import { toast } from "sonner";
import { Lock } from "lucide-react";

export function UsLockGate({ children }: { children: React.ReactNode }) {
  const { journey } = useSession();
  const [unlocked, setUnlocked] = useState<boolean>(() => isUsUnlocked(journey?.id));
  const [hasPassword, setHasPassword] = useState<boolean | null>(null);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setUnlocked(isUsUnlocked(journey?.id));
    if (!journey?.id) return;
    (async () => {
      try {
        const r = await (usPasswordStatus as any)({});
        setHasPassword(!!r?.isSet);
      } catch {
        setHasPassword(false);
      }
    })();
  }, [journey?.id]);

  if (unlocked) return <>{children}</>;
  if (hasPassword === null) {
    return <p className="text-center text-muted-foreground py-12">Loading…</p>;
  }

  const onCreate = async () => {
    if (pwd.length < 6) return toast.error("Use at least 6 characters");
    if (pwd !== confirm) return toast.error("Passwords don't match");
    setBusy(true);
    try {
      await (setUsPassword as any)({ data: { password: pwd } });
      if (journey?.id) markUsUnlocked(journey.id);
      setUnlocked(true);
      toast.success("Us password set");
    } catch (e: any) {
      toast.error(e?.message ?? "Could not set password");
    } finally { setBusy(false); }
  };

  const onVerify = async () => {
    setBusy(true);
    try {
      await (verifyUsPassword as any)({ data: { password: pwd } });
      if (journey?.id) markUsUnlocked(journey.id);
      setUnlocked(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Wrong password");
    } finally { setBusy(false); }
  };

  return (
    <div className="max-w-sm mx-auto mt-10 parchment-card rounded-2xl p-6 space-y-4 text-center">
      <Lock className="size-6 mx-auto text-primary" />
      <h2 className="font-display text-xl tracking-widest text-primary">US</h2>
      {hasPassword ? (
        <>
          <p className="text-sm text-muted-foreground">Enter your shared Us password to continue.</p>
          <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="Password" autoFocus />
          <Button className="w-full" onClick={onVerify} disabled={busy || pwd.length === 0}>Unlock</Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">Create a shared password for your Us page. Both of you will use this — it is separate from your account password.</p>
          <Input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} placeholder="New password (min 6)" />
          <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Confirm password" />
          <Button className="w-full" onClick={onCreate} disabled={busy}>Create Us password</Button>
        </>
      )}
    </div>
  );
}
