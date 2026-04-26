import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RequireAuth } from "@/components/RequireAuth";
import { UsLockGate } from "@/components/UsLockGate";
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { WeekCircles, weekRangeLabel, weekStartSaturday } from "@/components/WeekCircles";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/us/habits")({
  component: () => (
    <RequireAuth>
      <AppShell>
        <UsLockGate>
          <Habits />
        </UsLockGate>
      </AppShell>
    </RequireAuth>
  ),
});

type Section = { id: string; name: string; user_id: string; sort_order: number };
type Visibility = "private" | "visible" | "shared";
type Habit = {
  id: string;
  name: string;
  user_id: string;
  section_id: string | null;
  visibility: Visibility;
  sort_order: number;
};
type Log = { id: string; habit_id: string; user_id: string; week_start: string; days: boolean[] };

const EMPTY: boolean[] = [false, false, false, false, false, false, false];

function Habits() {
  const { user, journey, profile, partnerProfile } = useSession();
  const ws = useMemo(() => weekStartSaturday(), []);
  const [sections, setSections] = useState<Section[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [newSection, setNewSection] = useState("");
  const [addOpenFor, setAddOpenFor] = useState<string | null>(null); // section_id or "__none__"
  const [newHabitName, setNewHabitName] = useState("");
  const [newHabitVis, setNewHabitVis] = useState<Visibility>("visible");

  const load = async () => {
    if (!journey || !user) return;
    const [{ data: secs }, { data: hbs }, { data: lgs }] = await Promise.all([
      supabase
        .from("us_habit_sections")
        .select("*")
        .eq("journey_id", journey.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase
        .from("us_habits")
        .select("*")
        .eq("journey_id", journey.id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true }),
      supabase.from("us_habit_logs").select("*").eq("week_start", ws),
    ]);
    setSections((secs as Section[]) ?? []);
    setHabits((hbs as Habit[]) ?? []);
    setLogs((lgs as Log[]) ?? []);
  };

  useEffect(() => {
    load();
    /* eslint-disable-next-line */
  }, [journey?.id, ws]);

  const myHabits = habits.filter((h) => h.user_id === user?.id);
  const partnerHabits = habits.filter(
    (h) => h.user_id !== user?.id && (h.visibility === "visible" || h.visibility === "shared"),
  );
  const mySections = sections.filter((s) => s.user_id === user?.id);
  const partnerSections = sections.filter((s) => s.user_id !== user?.id);

  const logFor = (habitId: string, ownerId: string) =>
    logs.find((l) => l.habit_id === habitId && l.user_id === ownerId);

  const addSection = async () => {
    if (!user || !journey || !newSection.trim()) return;
    const max = Math.max(0, ...mySections.map((s) => s.sort_order));
    const { error } = await supabase.from("us_habit_sections").insert({
      journey_id: journey.id,
      user_id: user.id,
      name: newSection.trim(),
      sort_order: max + 1,
    });
    if (error) return toast.error(error.message);
    setNewSection("");
    load();
  };

  const removeSection = async (s: Section) => {
    if (!confirm(`Delete section "${s.name}"? Habits inside will move to "no section".`)) return;
    await supabase.from("us_habits").update({ section_id: null }).eq("section_id", s.id);
    const { error } = await supabase.from("us_habit_sections").delete().eq("id", s.id);
    if (error) return toast.error(error.message);
    load();
  };

  const addHabit = async (sectionId: string | null) => {
    if (!user || !journey || !newHabitName.trim()) return;
    const max = Math.max(0, ...myHabits.map((h) => h.sort_order));
    const { error } = await supabase.from("us_habits").insert({
      journey_id: journey.id,
      user_id: user.id,
      name: newHabitName.trim(),
      section_id: sectionId,
      visibility: newHabitVis,
      sort_order: max + 1,
    });
    if (error) return toast.error(error.message);
    setNewHabitName("");
    setNewHabitVis("visible");
    setAddOpenFor(null);
    load();
  };

  const removeHabit = async (h: Habit) => {
    if (!confirm(`Delete habit "${h.name}"?`)) return;
    const { error } = await supabase.from("us_habits").delete().eq("id", h.id);
    if (error) return toast.error(error.message);
    load();
  };

  const updateVisibility = async (h: Habit, v: Visibility) => {
    const { error } = await supabase.from("us_habits").update({ visibility: v }).eq("id", h.id);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleDay = async (h: Habit, idx: number, next: boolean) => {
    if (!user || h.user_id !== user.id) return;
    const existing = logFor(h.id, user.id);
    const days = [...(existing?.days ?? EMPTY)];
    days[idx] = next;
    if (existing) {
      const { error } = await supabase
        .from("us_habit_logs")
        .update({ days, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) return toast.error(error.message);
      setLogs((prev) => prev.map((l) => (l.id === existing.id ? { ...l, days } : l)));
    } else {
      const { data, error } = await supabase
        .from("us_habit_logs")
        .insert({ habit_id: h.id, user_id: user.id, week_start: ws, days })
        .select()
        .single();
      if (error) return toast.error(error.message);
      setLogs((prev) => [...prev, data as Log]);
    }
  };

  const renderHabitRow = (h: Habit, mine: boolean) => {
    const log = logFor(h.id, h.user_id);
    return (
      <div key={h.id} className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-display tracking-wide truncate">{h.name}</p>
          {mine ? (
            <div className="flex items-center gap-1">
              <Select value={h.visibility} onValueChange={(v) => updateVisibility(h, v as Visibility)}>
                <SelectTrigger className="h-7 w-[110px] text-[11px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="visible">Visible</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="size-7" onClick={() => removeHabit(h)} aria-label="Delete habit">
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ) : (
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{h.visibility}</span>
          )}
        </div>
        <WeekCircles
          days={log?.days ?? EMPTY}
          onToggle={(i, next) => toggleDay(h, i, next)}
          size="sm"
          readOnly={!mine}
          tone={mine ? "gold" : "muted"}
        />
      </div>
    );
  };

  const renderSectionGroup = (title: string, secs: Section[], hbs: Habit[], mine: boolean) => {
    const grouped = secs.map((s) => ({ section: s, items: hbs.filter((h) => h.section_id === s.id) }));
    const orphans = hbs.filter((h) => !h.section_id);
    return (
      <div className="space-y-4">
        <h3 className="font-display text-sm uppercase tracking-widest text-primary">{title}</h3>
        {grouped.length === 0 && orphans.length === 0 && (
          <p className="text-xs italic text-muted-foreground">No habits yet.</p>
        )}
        {grouped.map(({ section, items }) => (
          <div key={section.id} className="parchment-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">{section.name}</p>
              {mine && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => setAddOpenFor(section.id)} aria-label="Add habit">
                    <Plus className="size-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="size-7" onClick={() => removeSection(section)} aria-label="Delete section">
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              )}
            </div>
            {items.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No habits.</p>
            ) : (
              items.map((h) => renderHabitRow(h, mine))
            )}
          </div>
        ))}
        {(orphans.length > 0 || mine) && (
          <div className="parchment-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Other</p>
              {mine && (
                <Button variant="ghost" size="icon" className="size-7" onClick={() => setAddOpenFor("__none__")} aria-label="Add habit">
                  <Plus className="size-3.5" />
                </Button>
              )}
            </div>
            {orphans.length === 0 ? (
              <p className="text-xs italic text-muted-foreground">No habits.</p>
            ) : (
              orphans.map((h) => renderHabitRow(h, mine))
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/us" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="size-4" /> Us
        </Link>
      </div>
      <div className="text-center">
        <h2 className="font-display text-3xl tracking-widest text-primary">HABITS</h2>
        <p className="text-muted-foreground italic mt-1">{weekRangeLabel(ws)}</p>
      </div>

      <div className="parchment-card rounded-2xl p-4 space-y-2">
        <p className="text-[11px] uppercase tracking-widest text-muted-foreground">New section</p>
        <div className="flex gap-2">
          <Input value={newSection} onChange={(e) => setNewSection(e.target.value)} placeholder="e.g. Health, Spiritual…" />
          <Button onClick={addSection} disabled={!newSection.trim()}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      </div>

      {renderSectionGroup("Your habits", mySections, myHabits, true)}

      {(partnerHabits.length > 0 || partnerSections.length > 0) && (
        <div className="pt-2 border-t border-border/60">
          {renderSectionGroup(
            `@${partnerProfile?.username ?? "partner"}'s habits`,
            partnerSections,
            partnerHabits,
            false,
          )}
        </div>
      )}

      <Dialog open={addOpenFor !== null} onOpenChange={(o) => !o && setAddOpenFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add habit</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={newHabitName}
              onChange={(e) => setNewHabitName(e.target.value)}
              placeholder="Habit name"
              autoFocus
            />
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">Visibility</p>
              <Select value={newHabitVis} onValueChange={(v) => setNewHabitVis(v as Visibility)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private — only you</SelectItem>
                  <SelectItem value="visible">Visible — partner can see</SelectItem>
                  <SelectItem value="shared">Shared — partner sees & is encouraged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => addHabit(addOpenFor === "__none__" ? null : addOpenFor)}
              disabled={!newHabitName.trim()}
            >
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {profile && partnerProfile && (
        <p className="text-center text-[10px] italic text-muted-foreground pt-2">
          Saturday → Friday week. Toggle a circle to mark a day done.
        </p>
      )}
    </div>
  );
}
