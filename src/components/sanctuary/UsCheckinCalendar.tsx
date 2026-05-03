import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Status = { user_id: string; created_at: string };

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function UsCheckinCalendar() {
  const { user, journey, profile, partnerProfile } = useSession();
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [statuses, setStatuses] = useState<Status[]>([]);

  const myId = user?.id;
  const partnerId = partnerProfile?.id;

  const monthStart = cursor;
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

  useEffect(() => {
    const load = async () => {
      if (!journey) return;
      const start = new Date(monthStart);
      start.setDate(start.getDate() - start.getDay());
      const end = new Date(monthEnd);
      end.setDate(end.getDate() + (6 - end.getDay()));
      const { data } = await supabase
        .from("daily_statuses")
        .select("user_id, created_at")
        .eq("journey_id", journey.id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());
      setStatuses((data ?? []) as any);
    };
    load();
  }, [journey?.id, cursor.getTime()]);

  const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const checkInsByDay = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const s of statuses) {
      const d = new Date(s.created_at);
      const k = dayKey(d);
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(s.user_id);
    }
    return map;
  }, [statuses]);

  // Build grid of cells
  const cells = useMemo(() => {
    const firstDay = monthStart.getDay();
    const daysInMonth = monthEnd.getDate();
    const arr: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let i = 1; i <= daysInMonth; i++) arr.push(new Date(cursor.getFullYear(), cursor.getMonth(), i));
    while (arr.length % 7 !== 0) arr.push(null);
    return arr;
  }, [cursor]);

  const today = new Date();
  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();

  // Counts for current month only
  const monthStats = useMemo(() => {
    let me = 0;
    let p = 0;
    for (let i = 1; i <= monthEnd.getDate(); i++) {
      const k = dayKey(new Date(cursor.getFullYear(), cursor.getMonth(), i));
      const set = checkInsByDay.get(k);
      if (!set) continue;
      if (myId && set.has(myId)) me++;
      if (partnerId && set.has(partnerId)) p++;
    }
    return { me, p, total: monthEnd.getDate() };
  }, [checkInsByDay, cursor, myId, partnerId, monthEnd]);

  return (
    <div className="space-y-4">
      <div className="text-center">
        <h2 className="font-display text-2xl tracking-widest text-primary">CHECK-IN</h2>
      </div>

      <div className="parchment-card rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <div className="font-display tracking-widest text-sm">
            {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center">
          {DAYS.map((d, i) => (
            <div key={i} className="text-[10px] uppercase tracking-widest text-muted-foreground py-1">{d}</div>
          ))}
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const k = dayKey(d);
            const set = checkInsByDay.get(k);
            const meIn = !!(myId && set?.has(myId));
            const pIn = !!(partnerId && set?.has(partnerId));
            return (
              <div
                key={i}
                className={cn(
                  "aspect-square rounded-lg border border-border/40 flex flex-col items-center justify-center gap-0.5 text-[10px]",
                  isToday(d) && "ring-2 ring-primary/60",
                )}
              >
                <span className="text-muted-foreground">{d.getDate()}</span>
                <div className="flex gap-0.5">
                  {meIn && <span className="size-1.5 rounded-full bg-primary" />}
                  {pIn && <span className="size-1.5 rounded-full bg-muted-foreground/60" />}
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-xs text-center text-muted-foreground space-y-1 pt-2 border-t border-border/40">
          <div>
            <span className="text-primary">●</span> {profile?.username ?? "you"} checked in {monthStats.me} of {monthStats.total} days
          </div>
          <div>
            <span className="text-muted-foreground">●</span> {partnerProfile?.username ?? "partner"} checked in {monthStats.p} of {monthStats.total} days
          </div>
        </div>
      </div>
    </div>
  );
}
