import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/lib/session";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useSession();
  const nav = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      nav({ to: "/" });
      return;
    }
    if (user && !profile) {
      nav({ to: "/setup" });
      return;
    }
    if (profile?.must_set_password) {
      nav({ to: "/set-password", search: { username: profile.username } as any });
    }
  }, [loading, user, profile, nav]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="font-display text-sm uppercase tracking-widest text-muted-foreground">Loading…</div>
      </div>
    );
  }
  if (!user || !profile) return null;
  return <>{children}</>;
}
