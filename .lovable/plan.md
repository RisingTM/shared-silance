

# Counter hours + pause/resume, break log icon, partner status, shared Deen

## 1. NC counter — true timestamp + live hours

**Schema (migration)**
- `journeys.nc_start_at timestamptz` — exact reset moment. Backfill from existing `nc_start_date` at midnight local-equivalent (use `nc_start_date::timestamptz`).
- Keep `nc_start_date` for back-compat reads but stop relying on it for hours.

**Server**
- `resetCounter` writes `nc_start_at = now()` (in addition to `nc_start_date = today` so legacy code keeps working).

**Client**
- `daysAndHoursBetween(startISO)` already supports timestamps — extend it to accept either a date-only or full ISO and parse accordingly.
- `today.tsx` reads `journey.nc_start_at` (fallback to `nc_start_date`).
- A `setInterval` already ticks every 60s on the page → hours update live.
- Display unchanged: `{days} days, {hours}h`.

## 2. Break log — behind a subtle icon button

- Remove the inline break-log card from `today.tsx`.
- Add a second small ghost icon button next to the reset icon (top-right of NC card) using `ScrollText` (or `History`) icon.
- Tap opens a `Sheet`/`Dialog` listing all `nc_breaks` rows: date, who broke it, optional note, and (new) entry kind for pause/resume events.

## 3. Pause / resume the counter

**Schema (same migration)**
- `journeys.is_paused boolean default false`
- `journeys.paused_at timestamptz` — when current pause began
- `journeys.paused_total_seconds bigint default 0` — accumulated paused time across previous pauses
- Extend `nc_breaks.kind text` (or a new `event_type` column) to allow values `reset` (default for legacy rows) / `pause` / `resume` so the break log can show pause history. Backfill existing rows to `reset`.

  *Note: `nc_breaks.broken_by` is currently NOT NULL — make it nullable (or set a placeholder) for pause/resume rows.*

**Server functions** (new in `journey.functions.ts`)
- `pauseCounter` — owner or partner: confirm not already paused, set `is_paused=true`, `paused_at=now()`, insert `nc_breaks` row with `kind='pause'`.
- `resumeCounter` — confirm currently paused, compute `delta = now() - paused_at`, update `paused_total_seconds += delta`, set `is_paused=false`, `paused_at=null`, insert `nc_breaks` row with `kind='resume'`.

**Client**
- New small icon next to reset: `Pause` (when running) / `Play` (when paused). Confirm dialog: "Are you sure you want to pause? This means you are in contact right now."
- Effective elapsed time formula:
  - `base = journey.nc_start_at`
  - `endpoint = is_paused ? paused_at : now()`
  - `elapsedMs = endpoint - base - (paused_total_seconds * 1000)`
  - Render `daysAndHoursBetween` against this elapsed value (refactor helper to accept ms).
- When paused: show soft "paused" pill in place of the hours portion (still shows accumulated days+hours frozen at `paused_at`).
- `useSession` refresh after pause/resume so both users see it (already polls on focus/visibility — add a `journey` refetch via `refresh()` after the action; the partner sees it on next focus).

## 4. Today page — partner's actual update visible

- Replace the `<PartnerActivity>` presence pill in the right column with the partner's most recent `daily_statuses` row inside the current 6h window (already loaded as `theirs`).
- Render the same `YourUpdateCard` shape for the partner (`emoji`, label, time, username header) — full visual parity with the left column, equal `min-h`.
- If `theirs` is null OR `theirs.created_at` is older than 6h: show soft `waiting for @{username}…` muted state inside the same card frame.
- Delete the `PartnerActivity` import + usage from `today.tsx` (component file stays for now; not used elsewhere). 3×1 counter row above is untouched.

## 5. Deen page — shared visibility + clean week header

**Data**
- For each tracker, also fetch the partner's row(s) for the same `week_start` (Quran: their single row). RLS on `deen_*` tables is currently `user_id = auth.uid()` — partner can't read.
- **Migration**: add a SELECT policy on each Deen table allowing `user_id = partner_user_id()` (read-only). Keep existing all-actions policy unchanged for self.

**UI per tracker card**
- Header shows the week range exactly once (kept in `TrackerCard`); remove any duplicated label inside trackers.
- Body becomes a 2-column section: `You` | `@{partnerUsername}`.
  - Prayer: under each prayer name, two rows of `WeekCircles` labeled You / @partner; partner row uses `readOnly`.
  - Quran: side-by-side current page numbers (no +1 button on partner side).
  - Athkar: morning + evening rows duplicated for partner (read-only); dhikr counter displays partner's counts read-only beside the user's tap buttons.
  - Fasting: two rows You / @partner.
- `WeekCircles` already has `readOnly` prop — use it for partner rows.

**Week range fix**
- Confirm `weekStartSaturday()` correctness for current Saturday rollover (already handled by `(getDay()+1)%7`); ensure each `TrackerCard` only renders the label once (current code already does — verify no inner trackers also print it).

## Migrations summary (single file)

```sql
-- Counter timestamps + pause state
ALTER TABLE journeys
  ADD COLUMN IF NOT EXISTS nc_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_total_seconds bigint NOT NULL DEFAULT 0;
UPDATE journeys SET nc_start_at = (nc_start_date::timestamp) AT TIME ZONE 'UTC' WHERE nc_start_at IS NULL;

-- Break log: pause/resume events
ALTER TABLE nc_breaks
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'reset',
  ALTER COLUMN broken_by DROP NOT NULL;

-- Deen: partner read access
CREATE POLICY "partner read deen_prayers" ON deen_prayers FOR SELECT TO authenticated
  USING (user_id = partner_user_id());
-- (same for deen_quran, deen_quran_log, deen_athkar, deen_dhikr, deen_fasting)
```

## Files

**Edited**
- `src/lib/statuses.ts` — `daysAndHoursBetween` accepts ISO date or timestamp and an optional offset-ms.
- `src/server/journey.functions.ts` — `pauseCounter`, `resumeCounter`; `resetCounter` writes `nc_start_at`.
- `src/routes/today.tsx` — pause/resume/break-log icons in NC card, paused-state rendering, partner update card replacing PartnerActivity, remove inline break log.
- `src/routes/deen.tsx` — partner queries + side-by-side rendering in each tracker.
- `src/lib/session.ts` — extend `Journey` type with `nc_start_at`, `is_paused`, `paused_at`, `paused_total_seconds`.

**New**
- `supabase/migrations/<timestamp>_nc_pause_and_deen_share.sql`

No changes to auth, AppShell, or PWA layer.

