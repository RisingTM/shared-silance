import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { claimPartnerPassword, partnerEmailForUsername } from "@/server/journey.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/set-password")({
  validateSearch: (search: Record<string, unknown>) => ({
    username: typeof search.username === "string" ? search.username : "",
  }),
  component: SetPasswordPage,
});

function SetPasswordPage() {
  const { username } = Route.useSearch();
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const claim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return toast.error("Missing username.");
    setLoading(true);
    try {
      await claimPartnerPassword({ data: { username, newPassword: password } });
      const { email } = await partnerEmailForUsername({ data: { username } });
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Password created. Welcome.");
      nav({ to: "/today" });
    } catch (err: any) {
      toast.error(err?.message ?? "Could not claim account");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="parchment-card rounded-2xl p-8 max-w-md w-full">
        <h1 className="font-display text-2xl tracking-widest text-center text-primary">SET YOUR PASSWORD</h1>
        <p className="text-sm text-center text-muted-foreground mt-2 italic">Claiming @{username}</p>
        <form onSubmit={claim} className="mt-6 space-y-4">
          <div>
            <Label className="font-display text-xs uppercase tracking-widest">New password</Label>
            <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Saving..." : "Set password and continue"}
          </Button>
        </form>
      </div>
    </div>
  );
}
