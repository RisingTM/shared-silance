import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { duaForDate } from "@/lib/dua";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/dua")({
  component: () => (<RequireAuth><AppShell><DuaPage /></AppShell></RequireAuth>),
});

function DuaPage() {
  const [offset, setOffset] = useState(0);
  const date = new Date(); date.setDate(date.getDate() + offset);
  const dua = duaForDate(date);

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">DAILY DUA</h2>
        <p className="text-muted-foreground italic mt-1">{date.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>

      <div className="parchment-card rounded-2xl p-8 sm:p-10">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground text-center">{dua.theme}</p>
        <p className="font-arabic text-3xl sm:text-4xl text-right leading-loose mt-6 text-foreground">{dua.arabic}</p>
        <p className="mt-6 italic text-muted-foreground text-lg leading-relaxed">{dua.transliteration}</p>
        <div className="mt-6 border-t border-border/50 pt-6">
          <p className="text-lg leading-relaxed">{dua.english}</p>
        </div>
      </div>

      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setOffset(offset - 1)}><ChevronLeft className="size-4" /> Previous</Button>
        <Button variant="ghost" onClick={() => setOffset(0)} disabled={offset === 0}>Today</Button>
        <Button variant="outline" onClick={() => setOffset(offset + 1)}>Next <ChevronRight className="size-4" /></Button>
      </div>
    </div>
  );
}
