
## Overview

Six changes covering one big new page (Study), one Today redesign, two Habits changes, two Deen reorders. Habits moves out of Sanctuary's Us cards (Studying card removed entirely; Habits stays). New top-level `/study` route. All existing data preserved.

---

## 1. Study page — new top-level route `/study`

### Bottom nav (`src/components/AppShell.tsx`)
Update `TABS` to: Today, Sanctuary, Deen, **Study (GraduationCap)**, Unlock. Bottom nav uses 5 columns (`grid-cols-5`).

### Sanctuary cleanup (`src/routes/private.tsx`)
Remove the `us-studying` card from `US_CARDS` and its render branch + `UsStudying` import. The component file stays on disk (not deleted, in case of future use) — actually delete `src/components/sanctuary/UsStudying.tsx` since Study replaces it cleanly and the syllabus moves to its own table.

### Route file `src/routes/study.tsx`
Single route with `<RequireAuth><AppShell>` shell. Top: 4-tab bar (`Tabs` from shadcn) — Dashboard / Session / Subjects / Achievements. State held at page level so timer keeps running when switching tabs.

### Dashboard tab
- `useEffect` loads all `study_sessions` for the journey from the last 12 weeks.
- Stats grid (2 cols, you / partner): hours today, week, month, current streak. Computed in-memory by grouping sessions by date.
- Heatmap (custom SVG/divs, no lib):
  - Columns = weeks (12 desktop / 8 mobile via `useIsMobile`), rows = Mon–Sun
  - Color scale based on minutes/day buckets (0, 1–30, 30–90, 90–180, 180+)
  - Toggle (Tabs or Switch) Together vs Separate
  - Together: split-cell with two SVG triangles (gold left, teal right) when both studied
  - Separate: two stacked grids labelled "You" / `@username`
  - Month labels above column where the week's Monday is the 1st–7th
  - Today's cell: `ring-1 ring-primary/60`
- Subject breakdown: hours per subject this week as horizontal bars, color-coded per module (hash module name → HSL).

### Session tab
- Subject picker: `Select` rendering "General study" + flat list of `# module — branch` entries from `study_syllabus`.
- Inputs: session minutes (default from profile.study_session_duration_default || 90), break minutes (default 20). On change, debounced save to `profiles`.
- Timer state in localStorage:
  ```
  silance_study_timer:{userId} = {
    phase: "session"|"break",
    startedAt: number,
    durationSec: number,
    subjectKey: string|null,
    subjectName: string|null,
  }
  ```
  On mount, read state, compute `elapsed = (now - startedAt)/1000`, derive remaining. If remaining ≤ 0 in session phase → log session, switch to break phase. If ≤ 0 in break → clear and notify.
- Buttons: Start, Pause (writes `pausedAt` into the localStorage object so resume re-anchors `startedAt`), Stop with `AlertDialog` confirm.
- On stop or natural end of session phase: insert `study_sessions` row with actual elapsed seconds, `started_at`, `ended_at`.
- `notify()` (existing helper) for soft notifications.
- Session history list below: query last 50 sessions for the journey; partner rows muted.

### Subjects tab
- Reuse `parseSyllabus` from `src/lib/syllabus.ts` (already correct format).
- Owner-only paste-import textarea + `AlertDialog` confirm before replacing.
- Tree: modules `Collapsible` → branches `Collapsible` → topics.
- Each topic row shows two pill toggles side-by-side (you editable, partner read-only). 3 states cycled: not_started (grey), in_progress (amber), confident (teal). Stored in `study_ratings` per `item_key` from `itemKey(mod, branch, topic)`.
- Module card header: total hours this week (you / partner) + average confidence dot color.

### Achievements tab
- 14 hardcoded definitions in a `STUDY_ACHIEVEMENTS` const array.
- On every session insert and on Subjects rating change, run an `evaluateAchievements()` function that queries the relevant tables and inserts any newly-earned `study_achievements` rows (UNIQUE constraint prevents dupes).
- Grid of cards: earned = gold border + filled icon + earner @ + date; locked = muted + lock icon.
- After a successful insert, `toast("you earned <name> 🌅")`.
- Same-day shared earn: if both rows for the same `achievement_key` have `earned_at::date = today`, render a "shared celebration" banner on Dashboard.

### Database migration
```sql
CREATE TABLE public.study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL,
  user_id UUID NOT NULL,
  subject_key TEXT,
  subject_name TEXT,
  duration_seconds INTEGER NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.study_syllabus (
  journey_id UUID PRIMARY KEY,
  content JSONB NOT NULL DEFAULT '[]'::jsonb,
  imported_by UUID,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.study_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL,
  user_id UUID NOT NULL,
  item_key TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('not_started','in_progress','confident')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(journey_id, user_id, item_key)
);

CREATE TABLE public.study_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL,
  user_id UUID NOT NULL,
  achievement_key TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(journey_id, user_id, achievement_key)
);

ALTER TABLE public.profiles
  ADD COLUMN study_session_duration_default INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN study_break_duration_default INTEGER NOT NULL DEFAULT 20;
```

RLS for all four new tables: `journey_id = current_journey_id()` for SELECT; INSERT/UPDATE/DELETE require `user_id = auth.uid() AND journey_id = current_journey_id()`. `study_syllabus` insert/update/delete also require `is_journey_owner()`.

---

## 2. Today page — grouped mood picker (`src/lib/statuses.ts`, `src/routes/today.tsx`)

Expand `STATUS_OPTIONS` so every label in the spec exists with a `group` field: `"faith" | "strength" | "hard" | "gentle" | "love"`. Keep existing keys where they match; add new keys for new entries. `statusMeta()` lookup unchanged.

In `PickerInline` and `PickerCollapsed`, replace the flat `grid-cols-2` with a `space-y-4` of group sections. Each group:
```
<div>
  <p className="font-display text-[10px] uppercase tracking-widest text-muted-foreground mb-2">{groupLabel}</p>
  <div className="grid grid-cols-2 gap-2">{group options…}</div>
</div>
```
Confirm button, cooldown, push, progress line untouched.

---

## 3 + 4. Habits — edit mode + visibility grouping (`src/components/sanctuary/UsHabits.tsx`)

### Edit mode
- New `editing` boolean state, default `false`. Pencil icon button at top.
- Wrap all controls (add section input + button, add habit buttons, delete buttons, visibility `Select`) behind `{editing && (...)}` checks.
- Hold mutations in **draft state** instead of writing immediately:
  - `draftSections: Section[]` — diff vs server set yields creates / deletes
  - `draftHabits: Habit[]` — same for habits, plus visibility changes
  - `draftDeletedSectionIds: Set<string>`, `draftDeletedHabitIds: Set<string>`
- Save button (sticky bottom bar): runs all the diffed inserts/updates/deletes in one Promise.all batch, then `editing = false` and reload.
- Cancel: `editing = false` and reset drafts from server snapshot.
- Day-circle toggling stays write-through (logs are not part of edit mode).
- Empty sections hidden in normal view: filter `mySections` by `habits.some(h => h.section_id === sec.id)` when `!editing`.

### Visibility grouping
- Inside each section, group habits by `visibility`:
  ```ts
  const groups = ["private", "visible", "shared"].map(vis =>
    ({ vis, items: myHabits.filter(h => h.visibility === vis) })
  ).filter(g => g.items.length > 0);
  ```
- Render each non-empty group as one wrapper `div` with subtle header (`text-[10px] uppercase tracking-widest text-muted-foreground` showing "private" / "visible" / "shared") and the habit rows stacked inside. The wrapper is a soft card (`rounded-xl border border-border/40 bg-card/30 p-3 space-y-2`).
- Apply the same grouping to the partner read-only section at the bottom.
- In edit mode, individual controls remain on each habit row inside the group container.

---

## 5 + 6. Deen page reorder (`src/routes/deen.tsx`)

### Component order (`DeenPage`)
```
Week date range header (already present, kept exactly once)
<PrayerTracker />
<AthkarTracker />     ← moved up, restructured below
<QuranTracker />
<FastingTracker />
<DuaSection />
```

### `AthkarTracker` internal order
Currently: athkar trackers first, then dhikr counter at bottom. Swap to:
1. Dhikr counter first (Astaghfirullah full-width, then 3-col SubhanAllah/Alhamdulillah/AllahuAkbar) — same code already exists, just hoist above the `ATHKAR_KINDS.map` loop.
2. Morning athkar tracker
3. Evening athkar tracker

Dhikr cumulative counts unchanged — same upsert logic, never reset.

---

## Validation checklist
- Bottom nav shows 5 tabs in order: Today, Sanctuary, Deen, Study, Unlock
- Switching tabs inside `/study` keeps the timer running (state lives at page level + localStorage backup on every interval)
- Heatmap renders 12 cols on `md+`, 8 on mobile via `useIsMobile`
- All new tables enforce RLS by `current_journey_id()`
- Habits Save/Cancel are sticky-bottom on mobile (`fixed bottom-16 inset-x-4` while editing)
- Cancel discards drafts entirely — no partial writes
- Existing `deen_dhikr` rows untouched by reorder
- Visibility groups apply to both your habits and partner's habits sections
- Today picker still requires Confirm; cooldown / push / progress line untouched

---

## File touch list

**New**
- `src/routes/study.tsx`
- `src/lib/study-achievements.ts` (definitions + evaluator)
- `src/lib/study-timer.ts` (localStorage shape + helpers)
- `supabase/migrations/<ts>_study.sql`

**Edited**
- `src/components/AppShell.tsx` (TABS + grid-cols-5)
- `src/lib/statuses.ts` (add group field, expand options)
- `src/routes/today.tsx` (group rendering in pickers)
- `src/components/sanctuary/UsHabits.tsx` (edit mode + grouping)
- `src/routes/deen.tsx` (reorder + AthkarTracker internal order)
- `src/routes/private.tsx` (remove us-studying card)

**Deleted**
- `src/components/sanctuary/UsStudying.tsx`
