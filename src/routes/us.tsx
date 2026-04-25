import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { UsLockGate } from "@/components/UsLockGate";
import { Image as ImageIcon, ListChecks, GraduationCap } from "lucide-react";

export const Route = createFileRoute("/us")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <UsLockGate>
          <UsHome />
        </UsLockGate>
      </AppShell>
    </RequireAuth>
  ),
});

const CARDS = [
  { to: "/us/gallery", label: "Gallery", Icon: ImageIcon },
  { to: "/us/habits", label: "Habits", Icon: ListChecks },
  { to: "/us/studying", label: "Studying", Icon: GraduationCap },
] as const;

function UsHome() {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">US</h2>
        <p className="text-muted-foreground italic mt-1">Just for the two of you.</p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {CARDS.map(({ to, label, Icon }) => (
          <Link
            key={to}
            to={to}
            className="parchment-card rounded-2xl p-4 flex flex-col items-center justify-center gap-2 hover:bg-accent/30 transition-colors min-h-[110px]"
          >
            <Icon className="size-6 text-primary" />
            <span className="font-display text-[11px] uppercase tracking-widest text-center leading-tight">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
