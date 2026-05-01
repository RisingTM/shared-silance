# Plan

Six tightly-scoped changes. The big one is collapsing the `/us/*` routes into the existing Private/Sanctuary page as inline subviews (same pattern Private already uses).

---

## 1. Today Log (subtle popup + button)

**File:** `src/routes/today.tsx`

- Add a small icon button (Clock, no label) at the top of the page next to the title. Tapping opens a `Sheet` (right side) showing the Today Log.
- Log content: today-only chronological list (oldest → newest) of partner activity, queried from existing tables on open:
  - `daily_statuses` where `user_id = partner.id` and `created_at >= start of today` → `"3:42 pm — {emoji} {label}"` (using `statusMeta`).
  - `thinking_pings` where `sender_id = partner.id` and `sent_at >= start of today` → `"6:15 pm — thinking of you 🤍"`.
- Empty state: italic "nothing yet today…".
- Read-only list, no actions.

**Auto-popup logic:**
- Key: `silance_today_last_viewed:{userId}` in `localStorage`, value = ISO timestamp.
- On Today page mount and on `focus`/`visibilitychange` → visible: query partner's most recent `daily_statuses.created_at` and `thinking_pings.sent_at`. If max(those) > stored timestamp → open the sheet automatically.
- On sheet close (manual or outside tap): write `Date.now()` to that key so it doesn't reopen until new partner activity arrives.
- First-ever visit (no key stored): seed key = now, do NOT auto-open.
- Only partner activity counts — own rows excluded.

---

## 2. Deen — Prayer & Fasting grid alignment

**File:** `src/routes/deen.tsx`

- Replace the current `grid-cols-2` layout for prayers/fasting with a per-row 2-column grid using `grid-cols-[80px_1fr]` so the label column is fixed width and circles always align horizontally regardless of username length.
- New row structure for each prayer:
  ```
  [PRAYER NAME header]
  [ "You"        | 7 circles gold     ]
  [ @username    | 7 circles muted RO ]
  ```
- Apply the identical `grid-cols-[80px_1fr]` structure to the Fasting tracker.
- Username cell uses `truncate` so long names are clipped, never expanding.
- `YouRow`/`PartnerRow` helpers replaced by a single inline 2-col row.

---

## 3. Dhikr — add Astaghfirullah in 1+3 layout

**File:** `src/routes/deen.tsx`

- Add `astaghfirullah` to `DHIKR_PRESETS` but render it separately (not in the 3-col grid).
- Layout:
  - Row 1: Astaghfirullah — full-width prominent card, larger count text (e.g. `text-4xl`), same `tap +1` behavior, same partner count line beneath.
  - Row 2: existing 3-column grid with SubhanAllah, Alhamdulillah, Allahu Akbar.
- All four use the same `incDhikr` upsert into `deen_dhikr` (table already supports any `kind` string).

---

## 4. Today's-day indicator across all weekly trackers

**File:** `src/components/WeekCircles.tsx`

- Add an internal helper `todayIndex()` that returns `(new Date().getDay() + 1) % 7` (Saturday = 0, Friday = 6) — matches the existing Saturday-anchored week.
- For the circle whose index matches today, add an extra ring class regardless of on/off state, e.g. `ring-2 ring-primary/50 ring-offset-1 ring-offset-background shadow-[0_0_0_2px_hsl(var(--primary)/0.25)]`. Subtle glow, not a CTA.
- Works for both `gold` and `muted` tones, and for `readOnly` rows.
- Because every tracker (prayers, athkar, fasting, habits, partner habits) uses `WeekCircles`, the change applies everywhere with no per-route edits.

---

## 5. Merge Us into Sanctuary (Private page) as inline subviews

This is the largest change. The Us page becomes a second card group inside the existing Private route — no separate routes, no router navigation, no password gate.

### Routing & navigation cleanup

**Files:**
- Delete `src/routes/us.tsx`, `src/routes/us.gallery.tsx`, `src/routes/us.habits.tsx`, `src/routes/us.studying.tsx`. (TanStack regenerates `routeTree.gen.ts`.)
- Delete `src/components/UsLockGate.tsx` and `src/lib/us-session.ts` (no longer used).
- `src/components/AppShell.tsx`: remove the `/us` entry from `TABS`. Bottom nav already uses `grid-cols-4` so the layout naturally accommodates the now-4 tabs.

### New Sanctuary structure

**File:** `src/routes/private.tsx` (rename header label to "SANCTUARY", route stays `/private`)

```
SANCTUARY
  Personal section (header)
    [Journal] [Unsent Thoughts] [Goals]   ← unchanged
  Us section (header)
    [Gallery] [Habits] [Studying] [Favourite Things] [Check-in Calendar]
```

- One `useState<SectionKey | null>(null)` drives both groups. `SectionKey` extended to:
  `"journal" | "unsent" | "goals" | "us-gallery" | "us-habits" | "us-studying" | "us-favourites" | "us-checkin"`.
- When `open !== null`, render only that subview + a Back button (`setOpen(null)`).
- Each Us subview is implemented as an inline component in this same file (or split into co-located files under `src/components/sanctuary/` for readability — same module boundary, no routes).
- Data for each subview loads inside its own `useEffect` when mounted (i.e. when its card is opened) — not on Sanctuary page mount.
- No `<Link>` or `navigate()` calls anywhere in the Sanctuary tree.

### Us subview specs (each is a self-contained inline component)

#### Gallery
- Tabs at top: **All Photos** (flat grid, ordered by `created_at desc`), **Albums** (grid of album cards).
- Either user can create albums; toggle `is_shared` at create time and after.
- Long-press (≥500ms via `pointerdown`+timer) on any photo enters selection mode → checkboxes overlay → bulk Delete (own-only unless owner) and bulk Move-to-album.
- Photo viewer: fullscreen `Dialog`, `<img style={{ touchAction: "pinch-zoom" }}>`, Download button, uploader's `@username` shown subtly at the bottom.
- Permissions enforced client-side AND by existing RLS:
  - Owner (`profile.role === "owner"`) can delete any photo/album.
  - Partner can upload to shared albums and delete only own uploads.
  - Private albums: only creator sees them (RLS already does this).
- Storage: `us-gallery` bucket, path `{journey_id}/{uuid}.{ext}`.
- Signed URLs generated fresh on every load via `createSignedUrl(path, 3600)` — never persisted.
- No upload limits.

#### Habits
- Each user manages their own sections + habits independently. No defaults — start empty.
- For each habit row, a `WeekCircles` (Sa→Fr) with today's indicator from change #4. Gold for self, muted+read-only for partner.
- Visibility per habit: `private` / `visible` / `shared` (existing column).
- For `shared` habits: render BOTH circle rows inline under the same habit name (your row gold, partner's row muted) — not pushed to a "partner's habits" section at the bottom.
- Streak counter next to each habit name (e.g. `🔥 5`): query `us_habit_logs` for that habit + last N weeks, count consecutive days with `true` ending at today. Computed in-memory from already-loaded logs.
- "Add habit" button at bottom of each section AND a top-level one.
- **Stats card at top:** side-by-side blocks for you and partner showing % done today and % done this week, computed live from loaded logs.
- **Per-habit log button** opens a Sheet with weekly/monthly tabs:
  - Weekly: past N weeks of circle rows, completion %, current streak.
  - Monthly: best week, average completion, total days hit.
  - Loads extra `us_habit_logs` rows for that `habit_id` on open.
- Bottom of view: partner's `visible` (non-shared) habits as muted read-only rows. Private partner habits hidden entirely (RLS already enforces).

#### Studying
- Owner-only paste-import via existing `parseSyllabus`. Show inline error with line number on parse failure; nothing saved.
- Confirmation `AlertDialog` before replacing an existing syllabus.
- Owner can edit (rename/add/remove modules/branches/items) using the same paste editor.
- One active syllabus per journey (existing `us_syllabus` table).
- Tree UI: modules as collapsibles → branches as collapsibles → items.
- Top bar: search input filters tree in real time (case-insensitive substring on item text), and a "Needs work" toggle showing only items where `min(yourRating, partnerRating)` is 0–2.
- Each item row: two `RatingPill` columns side-by-side — You (editable), Partner (read-only). Existing 6-segment 0–5 colors already match spec.
- **Progress tab** (toggle at top, second view of the same data):
  - Pie charts (`recharts` `PieChart`) per person of confidence distribution (count of 0/1/2/3/4/5).
  - Overall average per person side-by-side.
  - Per-module average (color-coded with `ratingColorClass`).
  - Per-branch averages within each module.
  - Counts: "X of Y items rated 4 or above".
- Add `recharts` if not yet installed (it is a common shadcn dep — verify in step 0).

#### Favourite Things About You
- New table `us_favourites` (see DB migration below).
- Each user maintains own list, partner read-only.
- "+" button reveals an inline `Input`/`Textarea` row, save collapses it. No limit.
- Each entry shows the date below text in muted small type.
- Top-level **Shuffle** button surfaces one random own entry (or partner's? — spec says "things they love about their partner", so each list is what *I love about you*; shuffle picks from MY list to re-read).
- Scrollable list, newest at top. Partner's list shown in a separate read-only section below (or in a tab — implement as a tab toggle "Mine"/"Theirs" to keep it clean).

#### Check-in Calendar
- Month view of which days each user submitted a `daily_statuses` entry that month.
- Build from a single query: `daily_statuses` for the journey, between month start and end, grouped by user/day.
- Render: 7-col grid of date cells. Each cell shows date number + small dots: gold for self (if checked in that day), muted for partner. Both dots if both checked in.
- Today's cell has a subtle ring.
- Prev/Next month chevrons.
- Summary line below: "you checked in X of N days" and "@partner checked in Y of N days".
- No content shown — presence only.

### Database migration

One new table, no other schema changes (all other Us tables already exist with correct RLS):

```sql
CREATE TABLE public.us_favourites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journey_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.us_favourites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "favourites select" ON public.us_favourites
  FOR SELECT TO authenticated
  USING (journey_id = current_journey_id());
CREATE POLICY "favourites insert" ON public.us_favourites
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND journey_id = current_journey_id());
CREATE POLICY "favourites delete" ON public.us_favourites
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "favourites update" ON public.us_favourites
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
```

Both partners can read all entries in the journey (per spec — partner can read but not edit). Only the author can delete/edit their own.

### Onboarding tour
- `src/components/OnboardingTour.tsx` likely references "Us" — check and update copy to mention Sanctuary > Us instead. (Will verify in implementation.)

---

## 6. Misc cleanup

- Verify `recharts` is in `package.json` (likely yes via shadcn `chart.tsx`). If missing, `bun add recharts`.
- After deleting `src/routes/us*.tsx`, the auto-generated `routeTree.gen.ts` will rebuild without those entries — no manual edit.
- Keep all existing parchment styling, dark/light mode, mobile-first sizes.

---

## Out of scope / explicit non-changes
- Personal group cards (Journal, Unsent, Goals) — code untouched.
- Auth, Today counter, Deen Quran/Athkar storage shapes — untouched aside from items above.
- Existing `us_*` tables (albums, photos, habits, sections, habit_logs, syllabus, ratings) — schema unchanged, only new `us_favourites`.
- The Us password infrastructure (`us_password_hash` column, `setUsPassword`/`verifyUsPassword`/`resetUsPassword` server fns) is left in the DB/server but no longer invoked from UI. Removing the column is risky and not requested — leaving it is safe and reversible.
