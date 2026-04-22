import { ReactNode, useEffect, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useSession, signOut } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Heart, Sparkles, BookOpen, Unlock, Moon, Sun, Settings, LogOut } from "lucide-react";
import { OnboardingTour } from "./OnboardingTour";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Switch } from "./ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { notify, registerPushSubscription, requestNotificationPermission } from "@/lib/notifications";
import { flushOfflineQueue } from "@/lib/data-client";
import { setAllowPrivateDeletes } from "@/server/journey.functions";

const TABS = [
  { to: "/today", label: "Today", icon: Heart },
  { to: "/private", label: "Private", icon: Sparkles },
  { to: "/dua", label: "Dua", icon: BookOpen },
  { to: "/unlock", label: "Unlock", icon: Unlock },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, partnerProfile, journey } = useSession();
  const loc = useLocation();
  const [tourOpen, setTourOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bio, setBio] = useState("");
  const [counterLabel, setCounterLabel] = useState("");
  const [reminderTime, setReminderTime] = useState("21:00");
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [allowPrivateDeletes, setAllowPrivateDeletes] = useState(false);

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

  useEffect(() => {
    if (!profile) return;
    setBio(profile.bio ?? "");
    setCounterLabel(profile.counter_label ?? "");
    setReminderEnabled(profile.reminder_enabled ?? true);
    setReminderTime((profile.reminder_time ?? "21:00:00").slice(0, 5));
    setAllowPrivateDeletes(!!journey?.allow_private_deletes);
  }, [profile, journey?.allow_private_deletes]);

  const saveSettings = async () => {
    if (!profile) return;
    const { error: pErr } = await supabase
      .from("profiles")
      .update({
        bio: bio.trim() || null,
        counter_label: counterLabel.trim() || "Days of no contact",
        reminder_time: `${reminderTime}:00`,
        reminder_enabled: reminderEnabled,
      })
      .eq("id", profile.id);
    if (pErr) return toast.error(pErr.message);
    if (profile.role === "owner" && journey) {
      try {
        await (setAllowPrivateDeletes as any)({ data: { allow: allowPrivateDeletes } });
      } catch (err: any) {
        return toast.error(err?.message ?? "Could not update owner setting");
      }
    }
    toast.success("Settings saved");
    setSettingsOpen(false);
  };

  const closeTour = () => {
    if (user && typeof window !== "undefined") {
      window.localStorage.setItem(`our-journey:tour-seen:${user.id}`, "1");
    }
    setTourOpen(false);
  };

  useEffect(() => {
    if (!user) return;
    requestNotificationPermission().then((p) => {
      if (p === "granted") registerPushSubscription(user.id).catch(() => undefined);
    }).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    const sync = () => flushOfflineQueue().catch(() => undefined);
    window.addEventListener("online", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  useEffect(() => {
    if (!profile?.reminder_enabled) return;
    const [h, m] = (profile.reminder_time ?? "21:00:00").split(":").map((v) => Number(v));
    const now = new Date();
    const target = new Date();
    target.setHours(h, m || 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
    const ms = target.getTime() - now.getTime();
    const timer = window.setTimeout(() => {
      notify("Shared Silance", "You haven't written today yet 🤍").catch(() => undefined);
    }, ms);
    return () => window.clearTimeout(timer);
  }, [profile?.reminder_enabled, profile?.reminder_time]);

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
            <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open settings">
                  <Settings className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Settings</SheetTitle>
                  <SheetDescription>Personal preferences and private profile details.</SheetDescription>
                </SheetHeader>
                <div className="mt-6 space-y-5">
                  <div className="rounded-xl border border-border/70 p-4 space-y-2">
                    <p className="text-sm"><strong>You:</strong> @{profile?.username}</p>
                    <p className="text-sm"><strong>Linked with:</strong> @{partnerProfile?.username ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{profile?.display_name ?? profile?.username} and {partnerProfile?.display_name ?? partnerProfile?.username ?? "your partner"} are connected in this journey.</p>
                  </div>

                  <div className="flex items-center justify-between rounded-xl border border-border/70 p-4">
                    <Label htmlFor="theme-toggle">Dark mode</Label>
                    <Button id="theme-toggle" variant="outline" size="sm" onClick={() => setDark((v) => !v)}>
                      {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
                      {dark ? "Light" : "Dark"}
                    </Button>
                  </div>

                  <div>
                    <Label className="text-xs uppercase tracking-widest">Your bio (shared with partner)</Label>
                    <Textarea rows={3} value={bio} onChange={(e) => setBio(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-widest">Partner bio</Label>
                    <div className="rounded-md border border-border/70 bg-muted/40 p-3 text-sm text-muted-foreground min-h-16">
                      {partnerProfile?.bio?.trim() ? partnerProfile.bio : "No bio yet."}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs uppercase tracking-widest">No-contact counter label</Label>
                    <Input value={counterLabel} onChange={(e) => setCounterLabel(e.target.value)} placeholder="Days of no contact" />
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-end">
                    <div>
                      <Label className="text-xs uppercase tracking-widest">Reminder time</Label>
                      <Input type="time" value={reminderTime} onChange={(e) => setReminderTime(e.target.value)} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-2">
                      <Label htmlFor="reminder-enabled">Enable</Label>
                      <Switch id="reminder-enabled" checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
                    </div>
                  </div>
                  {profile?.role === "owner" && (
                    <div className="flex items-center justify-between rounded-xl border border-border/70 p-4">
                      <Label htmlFor="allow-private-deletes">Allow deleting entries in Private</Label>
                      <Switch id="allow-private-deletes" checked={allowPrivateDeletes} onCheckedChange={setAllowPrivateDeletes} />
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">If you forget your password, your journal entries cannot be recovered.</p>
                  <div className="space-y-2">
                    <Button className="w-full" onClick={saveSettings}>Save settings</Button>
                    <Button variant="outline" className="w-full" onClick={() => signOut().then(() => (window.location.href = "/"))}>
                      <LogOut className="size-4" /> Logout
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
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
