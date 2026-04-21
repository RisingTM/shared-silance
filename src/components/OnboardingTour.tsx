import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Heart, Calendar, Sparkles, BookOpen, Unlock } from "lucide-react";

const STEPS = [
  {
    icon: Heart,
    title: "Today",
    body:
      "Each day, set how you're feeling. One small choice, every twelve hours. You'll see hers beside yours — a quiet check-in, no words needed.",
  },
  {
    icon: Calendar,
    title: "Counter",
    body:
      "Your shared no-contact streak lives here. Milestones light up as you reach them. If it breaks, the log stays — not as shame, but as memory.",
  },
  {
    icon: Sparkles,
    title: "Private",
    body:
      "Yours alone. Journal, sealed letter, memory vault, voice notes — she will never see this unless you choose to share at day 365.",
  },
  {
    icon: BookOpen,
    title: "Dua",
    body:
      "A new dua each day, drawn from the Qur'an and Sunnah. For steadfastness, patience, and trust in Him.",
  },
  {
    icon: Unlock,
    title: "Unlock",
    body:
      "After 365 unbroken days, you may choose — piece by piece — what to show her of who you became in silence.",
  },
];

export function OnboardingTour({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (open) setStep(0);
  }, [open]);

  const isLast = step === STEPS.length - 1;
  const Icon = STEPS[step].icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="parchment-card border-primary/30 max-w-md">
        <div className="text-center pt-4">
          <p className="font-arabic text-2xl text-primary leading-none">۞</p>
          <div className="mx-auto mt-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 border border-primary/30">
            <Icon className="size-6 text-primary" />
          </div>
          <h2 className="mt-4 font-display text-2xl tracking-widest text-primary uppercase">
            {STEPS[step].title}
          </h2>
          <p className="mt-4 text-base text-foreground/85 leading-relaxed font-serif italic px-2">
            {STEPS[step].body}
          </p>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={[
                "h-1.5 rounded-full transition-all",
                i === step ? "w-6 bg-primary" : "w-1.5 bg-primary/25",
              ].join(" ")}
            />
          ))}
        </div>

        <div className="mt-6 flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            Back
          </Button>
          {isLast ? (
            <Button onClick={onClose}>Begin</Button>
          ) : (
            <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
