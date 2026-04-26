import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { UsLockGate } from "@/components/UsLockGate";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/us/studying")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <UsLockGate>
          <div className="space-y-4">
            <Link to="/us" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ChevronLeft className="size-4" /> Us
            </Link>
            <h2 className="font-display text-3xl tracking-widest text-primary text-center">STUDYING</h2>
            <p className="text-center text-muted-foreground italic">Coming next — paste your syllabus and rate confidence side-by-side.</p>
          </div>
        </UsLockGate>
      </AppShell>
    </RequireAuth>
  ),
});
