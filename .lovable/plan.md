

# Birthdays, Important Dates & Partner Activity Indicator

## Database changes

Single migration:
- `profiles.birthday` — `date`, nullable.

RLS: `profiles` already has `read own profile and partner` (any row in the same `journey_id`), so partner birthday reads work with no policy change. `journeys` already has `members update journey`, so the owner's date edits go through existing RLS — owner-only is enforced in the UI.

## Settings panel — Birthdays section

Added inside the existing `Sheet` in `src/components/AppShell.tsx`, styled like the other bordered cards.

- **Your birthday** — Shadcn `DatePicker` (Popover + Calendar with `pointer-events-auto`), pre-filled from `profile.birthday`. Year stored but only month/day used for countdown.
- **@{partnerProfile.username}'s birthday** — read-only display of the date (or "not set yet" placeholder).
- Under each: countdown computed by `daysUntilNextBirthday(date)`:
  - `0` → `🎂 it's their birthday today 🤍` (and `🎂 it's your birthday today 🤍` for self)
  - `>0` → `🎂 N days away` / `🎂 1 day away`
  - `null` → `not set yet` muted text
- Saved alongside other profile fields in the existing `saveSettings` handler (`UPDATE profiles ... birthday = ...`).

## Settings panel — Important Dates (owner only)

New bordered card rendered only when `profile.role === "owner"`:

- **No contact since** — `DatePicker` pre-filled from `journey.nc_start_date`. Subtext: `currently {N} days`.
- **Started talking** — `DatePicker` pre-filled from `journey.talking_since`. Subtext: `currently {N} days` (or `not set` if null).
- Warning: *"Changing these dates will update the counters for both of you."*
- A single **Save important dates** button opens an `AlertDialog`: *"Are you sure? This will update the counter for both you and your partner."* On confirm: `UPDATE journeys SET nc_start_date=?, talking_since=? WHERE id=?` — RLS allows because owner is a member.
- Toast on success; sheet stays open.

## Partner activity indicator (home screen)

Added near the top of `src/routes/today.tsx`, above the existing today/status block.

- Pill-style badge: subtle border, parchment background, small dot icon.
- Two states using the partner's actual username:
  - Checked in today → soft amber/primary glow + check icon: `@{username} checked in today ✓`
  - Not yet → muted, quiet: `waiting for @{username}…`
- **Data source**: query `daily_statuses` filtered by `user_id = partnerProfile.id` and `created_at >= start of today (local)`, `select('id')` only — never selects `status`, so no content leaks. RLS already allows reading journey statuses.
- **Reactivity**: `setInterval` polling every 60s + refetch on `focus` and `online`. Cleared on unmount.
- Visible to both users (not gated by role).

## Reactive home-screen counters

The counters on `/today` already derive from `journey.nc_start_date` / `talking_since` via `useSession`. After the owner saves new dates, the `useSession` journey query is invalidated (or the local journey object is refreshed) so the home screen reflects the change without a reload — done by re-fetching the session journey row after the UPDATE succeeds.

## Files

- **New migration** — `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birthday date;`
- **New** `src/lib/birthday.ts` — `daysUntilNextBirthday(date)` and `formatBirthdayCountdown(days, isSelf)` helpers.
- **New** `src/components/PartnerActivity.tsx` — pill component with polling.
- **Edit** `src/components/AppShell.tsx` — Birthdays section, Important Dates section (owner-gated), birthday state + save, AlertDialog confirm, journey refresh on save.
- **Edit** `src/routes/today.tsx` — render `<PartnerActivity />` near the top.
- **Edit** `src/integrations/supabase/types.ts` — add `birthday` field to `profiles` row types (auto-regenerated, but ensure usage compiles).

No changes to existing RLS policies. No new server functions — owner date edits use the standard supabase client under existing journey RLS.

