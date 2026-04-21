import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const [hasRecovery, setHasRecovery] = useState(false);
  const [checked, setChecked] = useState(false);
  const [pwd, setPwd] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setHasRecovery(true);
    });
    // Also check existing session (link may have already established it)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasRecovery(true);
      setTimeout(() => setChecked(true), 800);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Password must be at least 8 characters");
    if (pwd !== confirm) return toast.error("Passwords don't match");
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setSubmitting(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated");
    nav({ to: "/today" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="parchment-card rounded-2xl p-8 max-w-md w-full">
        <h1 className="font-display text-2xl tracking-widest text-center text-primary">
          SET A NEW PASSWORD
        </h1>
        {!hasRecovery && checked ? (
          <div className="mt-6 text-center">
            <p className="text-muted-foreground italic">
              This recovery link is invalid or has expired.
            </p>
            <Button className="mt-4" onClick={() => nav({ to: "/" })}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <Label className="font-display text-xs uppercase tracking-widest">New password</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
            </div>
            <div>
              <Label className="font-display text-xs uppercase tracking-widest">Confirm password</Label>
              <Input
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={submitting || !hasRecovery} className="w-full">
              {submitting ? "Saving…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
