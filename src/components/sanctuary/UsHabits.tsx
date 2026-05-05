import { useEffect, useMemo, useState } from "react";
import { useSession } from "@/lib/session";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { WeekCircles, weekStartSaturday } from "@/components/WeekCircles";
import { Plus, Trash2, History, Eye, EyeOff, Users, Pencil, Check } from "lucide-react";
import { toast } from "sonner";

type Section = { id: string; name: string; user_id: string; sort_order: number };
type Habit = {
  id: string;
  name: string;
  user_id: string;
  section_id: string | null;
  visibility: "private" | "visible" | "shared";
  sort_order: number;
};
type Log = { id: string; habit_id: string; user_id: string; week_start: string; days: boolean[] };

const WEEK = weekStartSaturday();

export function UsHabits() {
  const { user, journey, profile, partnerProfile } = useSession();
  const [sections, setSections] = useState<Section[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [allLogs, setAllLogs] = useState<Log[]>([]);
  const [historyHabit, setHistoryHabit] = useState<Habit | null>(null);
  const [newSection, setNewSection] = useState("");
  const [editMode, setEditMode] = useState(false);

  const myId = user?.id;
  const partnerId = partnerProfile?.id;

  const load = async () => {
    if (!journey || !myId) return;
    const [{ data: s }, { data: h }, { data: l }] = await Promise.all([
      supabase.from("us_habit_sections").select("*").eq("journey_id", journey.id).order("sort_order"),
      supabase.from("us_habits").select("*").eq("journey_id", journey.id).order("sort_order"),
      supabase.from("us_habit_logs").select("*").eq("week_start", WEEK),
    ]);
    setSections((s ?? []) as any);
    setHabits((h ?? []) as any);
    setLogs((l ?? []) as any);
  };
  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [journey?.id, myId]);

  const mySections = sections.filter((s) => s.user_id === myId);
  const partnerSections = sections.filter((s) => s.user_id === partnerId);

  const logFor = (habit_id: string, user_id: string) =>
    logs.find((x) => x.habit_id === habit_id && x.user_id === user_id);

  const toggleDay = async (habit: Habit, dayIdx: number, next: boolean) => {
    if (!myId) return;
    const existing = logFor(habit.id, myId);
    const days = existing ? [...existing.days] : [false, false, false, false, false, false, false];
    days[dayIdx] = next;
    if (existing) {
      await supabase.from("us_habit_logs").update({ days, updated_at: new Date().toISOString() }).eq("id", existing.id);
    } else {
      await supabase
        .from("us_habit_logs")
        .insert({ habit_id: habit.id, user_id: myId, week_start: WEEK, days });
    }
    load();
  };

  const addSection = async () => {
    if (!myId || !journey || !newSection.trim()) return;
    await supabase
      .from("us_habit_sections")
      .insert({ name: newSection.trim(), user_id: myId, journey_id: journey.id, sort_order: mySections.length });
    setNewSection("");
    load();
  };

  const deleteSection = async (id: string) => {
    await supabase.from("us_habits").delete().eq("section_id", id);
    await supabase.from("us_habit_sections").delete().eq("id", id);
    load();
  };

  const addHabit = async (section_id: string | null) => {
    if (!myId || !journey) return;
    const name = window.prompt("Habit name?")?.trim();
    if (!name) return;
    await supabase.from("us_habits").insert({
      name,
      user_id: myId,
      journey_id: journey.id,
      section_id,
      visibility: "shared",
      sort_order: habits.filter((h) => h.section_id === section_id && h.user_id === myId).length,
    });
    load();
  };

  const updateHabitVis = async (habit: Habit, visibility: Habit["visibility"]) => {
    await supabase.from("us_habits").update({ visibility }).eq("id", habit.id);
    load();
  };

  const deleteHabit = async (id: string) => {
    if (!confirm("Delete this habit?")) return;
    await supabase.from("us_habit_logs").delete().eq("habit_id", id);
    await supabase.from("us_habits").delete().eq("id", id);
    load();
  };

  // Streak: count consecutive completed days walking back from yesterday across loaded weeks (just current week here).
  const streakFor = (habit_id: string, user_id: string): number => {
    const log = logFor(habit_id, user_id);
    if (!log) return 0;
    let s = 0;
    for (let i = log.days.length - 1; i >= 0; i--) {
      if (log.days[i]) s++;
      else break;
    }
    return s;
  };

  // Stats
  const stats = useMemo(() => {
    const compute = (uid: string | undefined) => {
      if (!uid) return { today: 0, week: 0 };
      const myHabits = habits.filter((h) => h.user_id === uid);
      if (myHabits.length === 0) return { today: 0, week: 0 };
      const today = (new Date().getDay() + 1) % 7;
      let todayDone = 0;
      let weekDone = 0;
      let weekTotal = 0;
      for (const h of myHabits) {
        const log = logFor(h.id, uid);
        if (log?.days[today]) todayDone++;
        for (let i = 0; i < 7; i++) {
          weekTotal++;
          if (log?.days[i]) weekDone++;
        }
      }
      return {
        today: Math.round((todayDone / myHabits.length) * 100),
        week: weekTotal ? Math.round((weekDone / weekTotal) * 100) : 0,
      };
    };
    return { me: compute(myId), partner: compute(partnerId) };
    /* eslint-disable-next-line */
  }, [habits, logs, myId, partnerId]);

  const openHistory = async (habit: Habit) => {
    setHistoryHabit(habit);
    const { data } = await supabase
      .from("us_habit_logs")
      .select("*")
      .eq("habit_id", habit.id)
      .order("week_start", { ascending: false })
      .limit(20);
    setAllLogs((data ?? []) as any);
  };

  const renderHabit = (h: Habit, ownerIsMe: boolean) => {
    const myLog = logFor(h.id, myId ?? "");
    const partnerLog = partnerId ? logFor(h.id, partnerId) : undefined;
    const showPartnerRow = ownerIsMe ? h.visibility === "shared" : true;
    const myStreak = streakFor(h.id, myId ?? "");
    return (
      <div key={h.id} className="rounded-xl border border-border/70 bg-card/50 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex-1 text-sm font-display tracking-wide truncate">{h.name}</span>
          {myStreak > 0 && ownerIsMe && (
            <span className="text-[11px] text-amber-600 dark:text-amber-400">🔥 {myStreak}</span>
          )}
          {ownerIsMe ? (
            editMode ? (
              <>
                <Select value={h.visibility} onValueChange={(v) => updateHabitVis(h, v as any)}>
                  <SelectTrigger className="h-7 w-[100px] text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">
                      <EyeOff className="size-3 inline mr-1" /> Private
                    </SelectItem>
                    <SelectItem value="visible">
                      <Eye className="size-3 inline mr-1" /> Visible
                    </SelectItem>
                    <SelectItem value="shared">
                      <Users className="size-3 inline mr-1" /> Shared
                    </SelectItem>
                  </SelectContent>
                </Select>
                <button onClick={() => deleteHabit(h.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              </>
            ) : (
              <button onClick={() => openHistory(h)} className="text-muted-foreground hover:text-foreground">
                <History className="size-4" />
              </button>
            )
          ) : (
            <span className="text-[10px] text-muted-foreground italic">{partnerProfile?.username ?? "partner"}</span>
          )}
        </div>
        {ownerIsMe ? (
          <WeekCircles
            days={myLog?.days ?? [false, false, false, false, false, false, false]}
            onToggle={(i, n) => toggleDay(h, i, n)}
            size="sm"
          />
        ) : (
          <WeekCircles
            days={partnerLog?.days ?? [false, false, false, false, false, false, false]}
            readOnly
            tone="muted"
            size="sm"
          />
        )}
        {ownerIsMe && showPartnerRow && partnerProfile && (
          <div className="pt-1 border-t border-border/40">
            <div className="text-[10px] text-muted-foreground mb-1">{partnerProfile.username}</div>
            <WeekCircles
              days={partnerLog?.days ?? [false, false, false, false, false, false, false]}
              readOnly
              tone="muted"
              size="sm"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="text-center relative">
        <h2 className="font-display text-2xl tracking-widest text-primary">HABITS</h2>
        <button
          onClick={() => setEditMode((v) => !v)}
          className="absolute top-0 right-0 size-8 rounded-full text-muted-foreground/70 hover:text-primary hover:bg-accent/40 inline-flex items-center justify-center transition-colors"
          aria-label={editMode ? "Done editing" : "Edit habits"}
        >
          {editMode ? <Check className="size-4" /> : <Pencil className="size-4" />}
        </button>
      </div>

      {/* Stats */}
      <div className="parchment-card rounded-2xl p-4 grid grid-cols-2 gap-3">
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{profile?.username ?? "you"}</div>
          <div className="font-display text-xl">{stats.me.today}%</div>
          <div className="text-[10px] text-muted-foreground">today · {stats.me.week}% week</div>
        </div>
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{partnerProfile?.username ?? "partner"}</div>
          <div className="font-display text-xl">{stats.partner.today}%</div>
          <div className="text-[10px] text-muted-foreground">today · {stats.partner.week}% week</div>
        </div>
      </div>

      {/* Add section — only when editing */}
      {editMode && (
        <div className="flex gap-2">
          <Input placeholder="New section name…" value={newSection} onChange={(e) => setNewSection(e.target.value)} />
          <Button onClick={addSection}>
            <Plus className="size-4" /> Section
          </Button>
        </div>
      )}

      {/* My sections */}
      {mySections.map((sec) => {
        const myHabits = habits.filter((h) => h.section_id === sec.id && h.user_id === myId);
        const groups: { key: Habit["visibility"]; label: string; icon: any }[] = [
          { key: "shared", label: "Shared", icon: Users },
          { key: "visible", label: "Visible", icon: Eye },
          { key: "private", label: "Private", icon: EyeOff },
        ];
        return (
          <div key={sec.id} className="parchment-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="flex-1 font-display text-sm uppercase tracking-widest text-primary">{sec.name}</h3>
              {editMode && (
                <button onClick={() => deleteSection(sec.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="size-4" />
                </button>
              )}
            </div>
            {groups.map((g) => {
              const items = myHabits.filter((h) => h.visibility === g.key);
              if (items.length === 0) return null;
              const GIcon = g.icon;
              return (
                <div key={g.key} className="space-y-2">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
                    <GIcon className="size-3" /> {g.label}
                  </p>
                  {items.map((h) => renderHabit(h, true))}
                </div>
              );
            })}
            {editMode && (
              <Button variant="ghost" size="sm" onClick={() => addHabit(sec.id)}>
                <Plus className="size-3" /> Add habit
              </Button>
            )}
          </div>
        );
      })}

      {/* Unsectioned habits */}
      <div className="parchment-card rounded-2xl p-4 space-y-3">
        <h3 className="font-display text-sm uppercase tracking-widest text-primary">Other</h3>
        {(["shared", "visible", "private"] as const).map((vis) => {
          const items = habits.filter((h) => h.user_id === myId && !h.section_id && h.visibility === vis);
          if (items.length === 0) return null;
          const Icon = vis === "shared" ? Users : vis === "visible" ? Eye : EyeOff;
          const label = vis === "shared" ? "Shared" : vis === "visible" ? "Visible" : "Private";
          return (
            <div key={vis} className="space-y-2">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground inline-flex items-center gap-1">
                <Icon className="size-3" /> {label}
              </p>
              {items.map((h) => renderHabit(h, true))}
            </div>
          );
        })}
        {editMode && (
          <Button variant="ghost" size="sm" onClick={() => addHabit(null)}>
            <Plus className="size-3" /> Add habit
          </Button>
        )}
      </div>

      {/* Partner read-only (visible only) */}
      {partnerSections.length > 0 && (
        <div className="space-y-3 opacity-90">
          <div className="text-center text-[10px] uppercase tracking-widest text-muted-foreground">
            {partnerProfile?.username}'s habits
          </div>
          {partnerSections.map((sec) => {
            const partnerHabits = habits.filter(
              (h) => h.section_id === sec.id && h.user_id === partnerId && (h.visibility === "visible" || h.visibility === "shared"),
            );
            if (partnerHabits.length === 0) return null;
            return (
              <div key={sec.id} className="rounded-2xl border border-border/60 p-4 space-y-3 bg-muted/20">
                <h4 className="font-display text-xs uppercase tracking-widest text-muted-foreground">{sec.name}</h4>
                {partnerHabits.map((h) => renderHabit(h, false))}
              </div>
            );
          })}
        </div>
      )}

      {/* History sheet */}
      <Sheet open={!!historyHabit} onOpenChange={(o) => !o && setHistoryHabit(null)}>
        <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{historyHabit?.name}</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-3">
            {allLogs.length === 0 && (
              <p className="text-sm italic text-muted-foreground text-center py-6">No history yet.</p>
            )}
            {allLogs.map((l) => {
              const done = l.days.filter(Boolean).length;
              return (
                <div key={l.id} className="rounded-xl border border-border/60 p-3 space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Week of {l.week_start}</span>
                    <span>{done}/7 days</span>
                  </div>
                  <WeekCircles days={l.days} readOnly size="sm" highlightToday={false} />
                </div>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
