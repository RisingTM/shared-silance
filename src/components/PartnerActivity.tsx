import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Check } from "lucide-react";

export function PartnerActivity({ partnerId, partnerUsername }: { partnerId: string | null | undefined; partnerUsername: string | null | undefined }) {
  const [checkedIn, setCheckedIn] = useState<boolean>(false);

  useEffect(() => {
    if (!partnerId) return;
    let cancelled = false;

    const startOfToday = () => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d.toISOString();
    };

    const fetchStatus = async () => {
      const { data } = await supabase
        .from("daily_statuses")
        .select("id")
        .eq("user_id", partnerId)
        .gte("created_at", startOfToday())
        .limit(1);
      if (!cancelled) setCheckedIn((data?.length ?? 0) > 0);
    };

    fetchStatus();
    const interval = window.setInterval(fetchStatus, 60_000);
    const onFocus = () => fetchStatus();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [partnerId]);

  if (!partnerId || !partnerUsername) return null;

  return (
    <div className="flex justify-center">
      <div
        className={[
          "inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-display tracking-widest uppercase parchment-card",
          checkedIn
            ? "border-primary/40 text-primary shadow-[0_0_20px_-8px_hsl(var(--primary)/0.5)]"
            : "border-border/60 text-muted-foreground",
        ].join(" ")}
      >
        {checkedIn ? (
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
