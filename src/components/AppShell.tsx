import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useSession, signOut } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { LogOut, Heart, Sparkles, BookOpen, Unlock, Moon, Sun } from "lucide-react";
import { OnboardingTour } from "./OnboardingTour";

const TABS = [
  { to: "/today", label: "Today", icon: Heart },
  { to: "/private", label: "Private", icon: Sparkles },
  { to: "/dua", label: "Dua", icon: BookOpen },
  { to: "/unlock", label: "Unlock", icon: Unlock },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile } = useSession();
  const loc = useLocation();
  const [tourOpen, setTourOpen] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (!user) return;
    const key = `our-journey:tour-seen:${user.id}`;
    if (typeof window !== "undefined" && !window.localStorage.getItem(key)) {
      setTourOpen(true);
    }
  }, [user]);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? window.localStorage.getItem("our-journey:theme") : null;
    const preferDark = saved ? saved === "dark" : false;
    setDark(preferDark);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("dark", dark);
    window.localStorage.setItem("our-journey:theme", dark ? "dark" : "light");
  }, [dark]);

  const closeTour = () => {
    if (user && typeof window !== "undefined") {
      window.localStorage.setItem(`our-journey:tour-seen:${user.id}`, "1");
    }
    setTourOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-card/70 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="font-arabic text-2xl text-primary leading-none">بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ</span>
            <span className="font-display text-xs uppercase tracking-[0.3em] text-muted-foreground mt-1">
              Our Journey
            </span>
          </div>
          <div className="flex items-center gap-3">
            {profile && (
              <span className="hidden sm:inline text-sm text-muted-foreground">
                Salaam, <span className="text-foreground font-medium">{profile.display_name ?? profile.username}</span>
              </span>
            )}
            <Button variant="ghost" size="icon" onClick={() => setDark((v) => !v)} aria-label="Toggle dark mode">
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </Button>
            {profile && (
              <span className="sm:hidden text-xs text-muted-foreground">{profile.display_name ?? profile.username}</span>
            )}
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => (window.location.href = "/"))}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <nav className="mx-auto hidden w-full max-w-3xl px-2 pb-2 sm:flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const active = loc.pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={[
                  "flex items-center gap-2 px-4 py-2 rounded-md font-display text-xs uppercase tracking-widest transition-colors whitespace-nowrap",
                  active
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/40",
                ].join(" ")}
              >
                <Icon className="size-3.5" />
                {t.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-6 pb-24 sm:pb-8">{children}</main>

      <footer className="border-t border-border/60 bg-card/40 mt-8">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center">
          <p className="font-arabic text-xl text-foreground/90 leading-loose">
            وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ
          </p>
          <p className="mt-2 text-sm italic text-muted-foreground">
            "Perhaps you dislike a thing and it is good for you." — Al-Baqarah 2:216
          </p>
          <button
            onClick={() => setTourOpen(true)}
            className="mt-4 text-xs italic text-muted-foreground hover:text-primary underline-offset-4 hover:underline"
          >
            Take the tour again
          </button>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-card/95 backdrop-blur sm:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-4 gap-1 px-2 py-2">
          {TABS.map((t) => {
            const active = loc.pathname.startsWith(t.to);
            const Icon = t.icon;
            return (
              <Link
                key={t.to}
                to={t.to}
                className={[
                  "flex min-h-12 flex-col items-center justify-center rounded-md text-[11px] uppercase tracking-wider",
                  active ? "bg-primary/15 text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                <Icon className="size-4" />
                {t.label}
              </Link>
            );
          })}
        </div>
      </nav>

      <OnboardingTour open={tourOpen} onClose={closeTour} />
    </div>
  );
}
