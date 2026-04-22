import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check, Loader2 } from "lucide-react";

type State = "loading" | "checked" | "waiting";

// Refetch only when the app becomes visible / regains focus / comes online,
// plus a slow safety poll (5 min) while the tab is visible. No fixed 60s loop.
const SAFETY_POLL_MS = 5 * 60 * 1000;
const MIN_REFETCH_GAP_MS = 30 * 1000;

export function PartnerActivity({
  partnerId,
  partnerUsername,
}: {
  partnerId: string | null | undefined;
  partnerUsername: string | null | undefined;
}) {
  const [state, setState] = useState<State>("loading");
  const lastFetchRef = useRef(0);

  useEffect(() => {
    if (!partnerId) return;
    let cancelled = false;

    // Start of today in the partner's local time zone — same as the device's
    // current local zone (couples typically share a region; we use the
    // viewer's local midnight as a close proxy and convert to ISO/UTC for
    // the timestamptz comparison).
    const startOfTodayLocalISO = () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    };

    const fetchStatus = async (force = false) => {
      const now = Date.now();
      if (!force && now - lastFetchRef.current < MIN_REFETCH_GAP_MS) return;
      lastFetchRef.current = now;
      const { data, error } = await supabase
        .from("daily_statuses")
        .select("id")
        .eq("user_id", partnerId)
        .gte("created_at", startOfTodayLocalISO())
        .limit(1);
      if (cancelled) return;
      if (error) {
        setState("waiting");
        return;
      }
      setState((data?.length ?? 0) > 0 ? "checked" : "waiting");
    };

    fetchStatus(true);

    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchStatus();
    };
    const onFocus = () => fetchStatus();
    const onOnline = () => fetchStatus(true);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") fetchStatus();
    }, SAFETY_POLL_MS);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.clearInterval(interval);
    };
  }, [partnerId]);

  if (!partnerId || !partnerUsername) return null;

  const base =
    "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-display tracking-widest uppercase parchment-card";

  if (state === "loading") {
    return (
      <div className="flex justify-center">
        <div className={`${base} border-border/60 text-muted-foreground`}>
          <Loader2 className="size-3.5 animate-spin" />
          <span>checking on @{partnerUsername}…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center">
      <div
        className={`${base} ${
          state === "checked"
            ? "border-primary/40 text-primary shadow-[0_0_20px_-8px_hsl(var(--primary)/0.5)]"
            : "border-border/60 text-muted-foreground"
        }`}
      >
        {state === "checked" ? (
          <>
            <Check className="size-3.5" />
            <span>@{partnerUsername} checked in today</span>
          </>
        ) : (
          <>
            <span className="size-1.5 rounded-full bg-muted-foreground/60" />
            <span>waiting for @{partnerUsername}…</span>
          </>
        )}
      </div>
    </div>
  );
}
