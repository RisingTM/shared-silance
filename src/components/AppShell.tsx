import { ReactNode } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useSession, signOut } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { LogOut, Heart, Calendar, Sparkles, BookOpen, Unlock } from "lucide-react";

const TABS = [
  { to: "/today", label: "Today", icon: Heart },
  { to: "/counter", label: "Counter", icon: Calendar },
  { to: "/private", label: "Private", icon: Sparkles },
  { to: "/dua", label: "Dua", icon: BookOpen },
  { to: "/unlock", label: "Unlock", icon: Unlock },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { profile } = useSession();
  const loc = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between gap-4">
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
            <Button variant="ghost" size="sm" onClick={() => signOut().then(() => (window.location.href = "/"))}>
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
        <nav className="mx-auto max-w-5xl px-2 pb-2 flex gap-1 overflow-x-auto">
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

      <main className="flex-1 mx-auto max-w-5xl w-full px-4 py-8">{children}</main>

      <footer className="border-t border-border/60 bg-card/40 mt-8">
        <div className="mx-auto max-w-3xl px-4 py-6 text-center">
          <p className="font-arabic text-xl text-foreground/90 leading-loose">
            وَعَسَىٰ أَن تَكْرَهُوا شَيْئًا وَهُوَ خَيْرٌ لَّكُمْ
          </p>
          <p className="mt-2 text-sm italic text-muted-foreground">
            "Perhaps you dislike a thing and it is good for you." — Al-Baqarah 2:216
          </p>
        </div>
      </footer>
    </div>
  );
}
