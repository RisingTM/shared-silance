
# Big update: Deen reorder, Us page (Gallery + Habits + Studying), real Web Push

This is a large addition. Grouping into phases for clarity.

## 1. Deen page reorganization

- Render order: Prayers → Athkar → Quran progress → Fasting → Dua card + Personal duas
- Move week range label (`Apr 19 – Apr 25`) to a single page-level header at the very top; remove the per-card `weekRangeLabel` from `TrackerCard`
- `WeekCircles` gets a new `tone` prop: `"gold" | "muted"`. Mine = gold (current `bg-primary`), partner = muted (`bg-amber-200/30 dark:bg-amber-900/20`, no hover, fully read-only). Each row clearly labelled "You" / `@partnerUsername`
- Personal duas: hide the form behind a `+` button; tapping reveals the inputs in a small inline panel; collapse on save

## 2. Us page (new top-level route)

### 2.1 Nav + entry gate
- Add `/us` route + nav tab (icon: `Heart` or `Users`) in `AppShell` — switches main tab grid to 5 items (Today, Private, Deen, Us, Unlock)
- First entry: prompt to **create** a shared Us password (6+ chars). Store as bcrypt-style hash on `journeys.us_password_hash` (server fn). On subsequent entries: prompt to enter password; verify server-side; on success cache an unlock flag in `sessionStorage` (cleared on tab close)
- Owner-only **reset** in Settings sheet ("Reset Us password") — clears hash, next visit re-prompts both users to create new one. Resets do NOT delete gallery/habit/study data
- Us page itself = card grid like Private: Gallery, Habits, Studying

### 2.2 Gallery
- Storage bucket `us-gallery` (private) with RLS: only authenticated users in the same `journey_id` can read/write
- Tables:
  - `us_albums` (id, journey_id, owner_id, name, is_shared bool, created_at)
  - `us_photos` (id, journey_id, album_id nullable, uploader_id, storage_path, caption, sort_order int, created_at)
- Main view: all photos ordered by `sort_order` then upload date; long-press / drag to reorder (manual `sort_order` updates)
- Albums: either user can create. Private (creator only) vs Shared (both). Convert private→shared via toggle by owner of album
- Permissions enforced in RLS:
  - Journey owner (profile.role = 'owner') = admin: can delete any photo or any album in their journey
  - Partner: can upload to shared albums; can delete only their own uploads (uploader_id = auth.uid())
  - Private albums: only creator can read/write photos in them, until is_shared flipped
- Album view: photo grid, tap → fullscreen modal with pinch-zoom (use `react-zoom-pan-pinch` or simple `touch-action: pinch-zoom` CSS) + Download button (signed URL → anchor download)
- No upload limits

### 2.3 Habits tracker
- Tables (RLS scoped to journey + visibility flag):
  - `us_habit_sections` (id, user_id, journey_id, name, sort_order, created_at)
  - `us_habits` (id, user_id, journey_id, section_id, name, visibility text in ['private','visible','shared'], sort_order, created_at)
  - `us_habit_logs` (id, habit_id, user_id, week_start date, days bool[7], updated_at) — same Saturday-anchored format
- Each user creates own sections + habits; no defaults. Sections always visible (no collapse) with header label
- Habits visibility:
  - `private` — only creator sees (default), togglable to `visible` later
  - `visible` — partner sees name + their own progress logs but cannot toggle
  - `shared` — both track independently against the same habit name; rendered side-by-side under matching section header
- Weekly 7-circle row, gold for self, muted read-only for partner, resets every Saturday (week_start key)
- Stats card pinned at top: % completed today, % completed this week — recomputed live on toggle
- Per-habit Log button → Sheet with weekly/monthly toggle:
  - Weekly view: list past `us_habit_logs` rows, completion %, current streak
  - Monthly view: aggregate by month — best week, average completion, total days hit
- Partner section: at bottom of own page, show partner's sections + visible/shared habits with muted read-only WeekCircles. Private habits hidden

### 2.4 Studying
- Tables:
  - `us_syllabus` (id, journey_id, content jsonb [{module, branches:[{name, items:[string]}]}], imported_by, imported_at) — single row per journey (UPSERT, replaces on import)
  - `us_syllabus_ratings` (id, journey_id, user_id, item_key text, rating int 0–5) — `item_key` = `module/branch/item` path; UNIQUE(journey_id, user_id, item_key)
- Owner-only import (RLS check on `us_syllabus`): paste textarea, parser handles:
  - `# X` → module
  - `- Y` → branch (must be after a `#`)
  - other lines → item (must be after a `-`)
  - Branches without preceding module or items without preceding branch → parser surfaces a clear inline error toast with line number; nothing saved
- New import shows AlertDialog "Replace current syllabus?" before overwriting
- Owner can edit syllabus tree post-import (rename/add/remove module/branch/item) — writes back to `us_syllabus.content`
- Renders as expandable tree (`<details>`-style or `<Accordion>`)
- Each item row: side-by-side toggles (You | @partner). Toggle is a 6-segment pill (0–5) with color ramp:
  - 0 red, 1 orange-red, 2 orange, 3 yellow, 4 yellow-green, 5 green (Tailwind classes)
- Each user only writes their own ratings (RLS: user_id = auth.uid()); partner column read-only
- Progress tab/button at top → opens progress sheet:
  - Pie chart per person of distribution 0–5 (use `recharts` — already installed via `chart.tsx`)
  - Per-module average for both, color-coded swatch
  - Per-branch averages within each module
  - Counts: "12 of 34 items rated ≥4"

## 3. Real Web Push for partner status updates

- Already capturing `push_subscriptions` (endpoint, p256dh, auth)
- Add VAPID keys as Lovable Cloud secrets: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:…). I'll request these via `add_secret` after the plan is approved (with a one-shot generator script the user can run, or I generate them in a server fn and you copy the values back — easiest path: I generate locally with a node script and ask you to paste them as secrets)
- Update `notifyPartnerUpdate` server fn:
  - Use `web-push` package with the VAPID keys
  - Fetch partner's `push_subscriptions` rows
  - Send `{ title: "@<senderUsername>", body: <statusLabel>, url: "/today" }` payload
  - Best-effort: catch 404/410 and delete dead subs
- `today.tsx` already calls `notifyPartnerUpdate({ partnerId, message: "@me · I'm healing 🌱" })` — change payload to include `senderUsername` + the exact `statusLabel` (no emoji prefix munging)
- Update `public/sw.js` `push` handler to read JSON payload `{ title, body, url }` and call `showNotification` + open URL on click. (Sw already handles notificationclick — confirm and patch)
- Expose VAPID **public** key to client via `VITE_VAPID_PUBLIC_KEY` env var so `registerPushSubscription` can call `pushManager.subscribe({ userVisibleOnly:true, applicationServerKey })` instead of just reading existing subs

## Database migration (single file)

- `journeys`: add `us_password_hash text`
- `us_albums`, `us_photos` tables + RLS
- `us_habit_sections`, `us_habits`, `us_habit_logs` tables + RLS
- `us_syllabus`, `us_syllabus_ratings` tables + RLS
- Storage bucket `us-gallery` (private) + storage RLS policies (insert by journey member, read by journey member, delete by uploader OR journey owner)
- All policies use existing `current_journey_id()` and `partner_user_id()` helpers
- Add helper SQL function `is_journey_owner()` returning bool for owner-admin gallery deletes

## Files to create

- `src/routes/us.tsx` — gate + card grid
- `src/routes/us.gallery.tsx` — albums list + photos
- `src/routes/us.habits.tsx` — full habit tracker
- `src/routes/us.studying.tsx` — syllabus + ratings + progress tab
- `src/components/UsLockGate.tsx` — create/enter password UI
- `src/components/PinchZoomImage.tsx` — fullscreen pinch zoom
- `src/components/RatingPill.tsx` — 0–5 segmented control with color ramp
- `src/lib/syllabus.ts` — parser (`parseSyllabus(text): { modules } | { error }`)
- `src/lib/us-session.ts` — sessionStorage unlock helper
- `src/server/us.functions.ts` — `setUsPassword`, `verifyUsPassword`, `resetUsPassword`, syllabus replace/edit
- `src/server/push.functions.ts` — `sendPushToPartner` using `web-push`
- `supabase/migrations/<ts>_us_features.sql`

## Files to edit

- `src/routes/deen.tsx` — reorder, page-level week label, gold/muted props, collapsible personal-dua form
- `src/components/WeekCircles.tsx` — add `tone` prop
- `src/components/AppShell.tsx` — Us tab in nav, Settings sheet adds "Reset Us password" (owner-only)
- `src/server/journey.functions.ts` — `notifyPartnerUpdate` calls real push send; add `resetUsPassword` (owner gate)
- `src/lib/notifications.ts` — `registerPushSubscription` actually subscribes via `pushManager.subscribe` using `VITE_VAPID_PUBLIC_KEY`
- `src/routes/today.tsx` — pass `{ senderUsername, body: statusLabel }` into notifyPartnerUpdate
- `public/sw.js` — proper `push` event JSON parsing + notification UI
- `package.json` — add `web-push`, `bcryptjs`, `react-zoom-pan-pinch`

## Open items needing your action after approval

1. I will request **VAPID keys** as secrets (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`) — I'll generate them in chat for you to paste, since they need to live in both server secrets and client env (`VITE_VAPID_PUBLIC_KEY`)
2. Confirmed in your answers: owner-only Us password reset, real Web Push.

No existing functionality (auth, session, private page, NC counter) is touched.
