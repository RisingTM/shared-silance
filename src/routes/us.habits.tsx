import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { UsLockGate } from "@/components/UsLockGate";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/us/habits")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <UsLockGate>
          <div className="space-y-4">
            <Link to="/us" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="size-4" /> Us
            </Link>
            <h2 className="font-display text-3xl tracking-widest text-primary text-center">HABITS</h2>
            <p className="text-center text-muted-foreground italic">Coming next — habit tracker with sections, weekly circles, and shared visibility.</p>
          </div>
        </UsLockGate>
      </AppShell>
    </RequireAuth>
  ),
});
