// Day labels — week starts Saturday and ends Friday.
// Index 0 = Saturday, 6 = Friday.
export const DAY_LABELS = ["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"];

export function WeekCircles({
  days,
  onToggle,
  size = "md",
  readOnly = false,
  tone = "gold",
}: {
  days: boolean[];
  onToggle?: (index: number, next: boolean) => void;
  size?: "sm" | "md";
  readOnly?: boolean;
  tone?: "gold" | "muted";
}) {
  const dim = size === "sm" ? "size-7 text-[10px]" : "size-9 text-xs";
  const onClass =
    tone === "muted"
      ? "bg-amber-200/30 dark:bg-amber-900/30 text-foreground/70 border-amber-200/40 dark:border-amber-900/40"
      : "bg-primary/80 text-primary-foreground border-primary";
  return (
    <div className="flex justify-between gap-1">
      {DAY_LABELS.map((d, i) => {
        const on = !!days[i];
        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            aria-label={`${d} ${on ? "done" : "not done"}`}
            onClick={() => !readOnly && onToggle?.(i, !on)}
            className={[
              "rounded-full border font-display tracking-wider flex items-center justify-center transition-colors",
              dim,
              on ? onClass : "bg-muted/40 text-muted-foreground border-border hover:bg-accent/40",
              readOnly && "cursor-default opacity-90",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {d}
          </button>
        );
      })}
    </div>
  );
}

// Saturday-anchored week. Returns YYYY-MM-DD of the Saturday that begins the
// week containing `d`.
export function weekStartSaturday(d: Date = new Date()): string {
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (local.getDay() + 1) % 7;
  local.setDate(local.getDate() - offset);
  const yyyy = local.getFullYear();
  const mm = String(local.getMonth() + 1).padStart(2, "0");
  const dd = String(local.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function weekRangeLabel(weekStartISO: string): string {
  const start = new Date(`${weekStartISO}T00:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (x: Date) => x.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${fmt(start)} – ${fmt(end)}`;
}
