import { cn } from "@/lib/utils";

const COLORS = [
  "bg-red-500/80 text-white border-red-500",
  "bg-orange-600/80 text-white border-orange-600",
  "bg-orange-400/80 text-white border-orange-400",
  "bg-yellow-400/80 text-foreground border-yellow-400",
  "bg-lime-400/80 text-foreground border-lime-400",
  "bg-emerald-500/80 text-white border-emerald-500",
];
const IDLE = "bg-muted/40 text-muted-foreground border-border";

export function RatingPill({
  value,
  onChange,
  readOnly,
}: {
  value: number;
  onChange?: (v: number) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-1">
      {[0, 1, 2, 3, 4, 5].map((n) => {
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            disabled={readOnly}
            onClick={() => !readOnly && onChange?.(n)}
            className={cn(
              "size-7 rounded-full border text-[11px] font-display tabular-nums transition-all",
              active ? COLORS[n] : IDLE,
              readOnly && "opacity-80 cursor-default",
              !readOnly && !active && "hover:bg-accent/40",
            )}
            aria-label={`Rating ${n}`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}

export function ratingColorClass(avg: number): string {
  const idx = Math.max(0, Math.min(5, Math.round(avg)));
  return COLORS[idx];
}
