

# Big update: PWA fixes, Deen page, Private restructure, Today redesign + more

This is a large set of changes. I'll group them into logical phases so we can review the shape before I touch code. No code is written in plan mode.

## 1. PWA full audit & fix

**What's broken now**
- SW registration runs unconditionally in `__root.tsx` — registers inside the Lovable preview iframe, which causes stale content and breaks HMR.
- `sw.js` caches every `supabase.co` request including POST/auth calls — invalid (POST can't be cached) and a security risk (caches authed JSON).
- No old-cache cleanup in `activate`.
- Manifest icons reference `/icon-192.png`, `/icon-512.png`, `/icon-maskable-512.png` but `__root.tsx` `apple-touch-icon` / theme-color / iOS meta tags aren't set, and I need to verify the icon files actually exist in `public/`.
- Notification permission isn't gated on login.
- `notifications.ts` doesn't handle `denied` gracefully and has no daily reminder scheduler.
- `offline-queue.ts` has no online/offline listeners and no flush logic — entries just sit in localStorage.

**Fixes**
- `public/sw.js` rewrite:
  - Versioned caches `static-v2` / `data-v2`; `activate` deletes any cache not in the allowlist + `clients.claim()`.
  - `fetch` handler: skip non-GET entirely (`event.request.method !== "GET"` → return). Skip `supabase.co/auth/*` and any request with an `Authorization` header. Static assets → cache-first. Other GETs → network-first with cache fallback.
  - `notificationclick` handler: focus existing client or open `/today`.
- `__root.tsx`:
  - Guard registration: skip if `window.self !== window.top` (iframe) or hostname contains `lovableproject.com` / `id-preview--`. Also unregister any existing SW in those contexts to clean up past registrations.
  - Add `<link rel="manifest">`, `<meta name="theme-color">` (light + dark via `media`), `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style="default"`, `apple-touch-icon`.
- Verify/create the four icon files in `public/` (`icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png`). If missing, generate simple parchment-tone placeholders so the manifest validates and install prompts work.
- `src/lib/notifications.ts`:
  - Handle `granted` / `denied` / `default` explicitly; on `denied` return silently.
  - Add `scheduleDailyReminder(time: "HH:MM")` using `setTimeout` to next occurrence, then `setInterval` 24h, with cleanup handle.
  - All calls wrapped in `"Notification" in window` checks so unsupported browsers no-op.
  - Permission request only fires from `AppShell` after `useSession` confirms a logged-in user (not at module load).
- `src/lib/offline-queue.ts`:
  - Add `initOfflineQueue()` that wires `online`/`offline` listeners, shows a sonner toast only when actually offline (`!navigator.onLine`), and flushes the queue on `online`.
  - Flush iterates queued entries and pushes them through the supabase client; failed items stay queued.
  - Called once from `AppShell` mount.

## 2. No-contact counter — hours + subtle reset

- Compute `days` and `hours` from `nc_start_date` (treat as midnight start) → render "47 days, 6 hours".
- Replace the labeled reset button with a small ghost icon button (`RefreshCw` 16px) tucked top-right of the counter card. Same confirm dialog as today.

## 3. Mobile layout — counters + today updates side-by-side

- New top section on `/today`: stacked layout
  - Row 1 (full width): "Days of no contact" big counter.
  - Row 2 (2 columns on mobile): "Days since we started talking" | "@partner's birthday in N days".
- Birthday card moves out of Settings → still editable in Settings, but display lives on home.
- Today updates block: 2-column grid on mobile showing "Your update" (full content) | "@partner" (presence pill from `PartnerActivity`, no content).

## 4. Unsent thoughts — picture inputs + minimal media log

**New inputs in Unsent Thoughts tab**
- "Take picture" → `<input type="file" accept="image/*" capture="environment">`.
- "Upload picture" → `<input type="file" accept="image/*">`.
- "Paste screenshot" → window `paste` listener while tab is mounted; reads `ClipboardEvent.clipboardData.items` for image blobs.

**Storage**
- New bucket `unsent-images` (private) with RLS `auth.uid()::text = (storage.foldername(name))[1]`, mirroring `unsent-audio`.
- Path pattern: `{user_id}/{uuid}.{ext}`.

**Schema**
- `unsent_thoughts.kind` already supports values; add `image` value usage. Reuse `audio_path` semantics by adding `image_path text` column.

**Log UI**
- Each entry renders as a minimal row: icon + label only (`📝 text` / `🎙 audio` / `🖼 photo`) + timestamp + optional delete (see #10).
- Tap audio → overlay (Dialog) with `<audio controls>`, progress, play/pause, download button (signed URL → anchor `download`).
- Tap photo → fullscreen Dialog with the image; pinch-zoom via CSS `touch-action: pinch-zoom` + a wrapper using native gestures (no extra lib). Download button included.

## 5. Deen page (replaces Worship + Dua)

- Rename route file `src/routes/dua.tsx` → `src/routes/deen.tsx` (update sidebar link in `AppShell`). Page title "DEEN".
- Keep all existing dua content (daily dua, personal duas) at the top.
- Below, add tracker cards. Shared component `<WeekCircles days={booleanArr} onToggle={...} />` rendering Sa Su Mo Tu We Th Fr (week starts Saturday).
- Week key = ISO-style `YYYY-Www` but anchored to Saturday; reset is automatic because each week has its own row.
- Date range header "Apr 19 – Apr 25" computed from current Saturday.

**New tables (single migration)**
- `deen_prayers (id, user_id, week_start date, prayer text, days bool[7], updated_at)` — one row per user per week per prayer.
- `deen_quran (id, user_id, current_page int, updated_at)` — single row per user; `+1` increments and bumps timestamp. Optional `deen_quran_log (user_id, log_date date, pages int)` for daily delta if needed for calendar; include for completeness.
- `deen_athkar (id, user_id, week_start, kind text /* 'morning'|'evening' */, days bool[7])`.
- `deen_dhikr (id, user_id, kind text /* 'subhanallah'|'alhamdulillah'|'allahuakbar'|'custom' */, count int, updated_at)` — one row per user per kind; `+1` increments.
- `deen_fasting (id, user_id, week_start, days bool[7])`.

All with RLS: owner-only `auth.uid() = user_id` for select/insert/update/delete.

**Trackers**
- Prayer: 5 `WeekCircles` rows.
- Quran: shows `current_page`, big `+1` button.
- Athkar: morning row + evening row of `WeekCircles`; below, a dhikr counter with three preset chips (SubhanAllah / Alhamdulillah / Allahu Akbar) each showing count + `+1` tap.
- Fasting: single `WeekCircles` row.

**Calendar log**: a "View past weeks" link opens a Dialog showing previous `week_start` rows for each tracker as small grids.

**Worship removal**: drop the Worship UI from `/private`. Keep the `worship_logs` table (data preservation) but stop reading/writing.

## 6. Private page — only Journal / Unsent / Goals

- Strip Mood, Vault, Sealed Letter, Building, Reflect sections + their reads/writes from `/private`.
- Render a 3-card grid (1 row × 3 on tablet+, stacked on small mobile) with icons (BookOpen / MessageSquareOff / Target) and labels.
- Tapping a card expands inline to that section's editor + log (using shadcn `Accordion` or simple `useState` toggle). Only one open at a time.

## 7. Today page — 16-option grid + 6h cooldown + push notify

- Replace `STATUS_OPTIONS` in `src/lib/statuses.ts` with the full 16 listed. Update DB enum `status_type` (current values + new ones) via migration: `ALTER TYPE status_type ADD VALUE IF NOT EXISTS 'peace';` etc.
- 2-column × 8-row grid. Each card: icon + text, compact (`p-3 text-sm`). Selecting sets local state only; visible "Confirm" button submits.
- Update DB cooldown trigger `enforce_status_cooldown` from 12h → 6h via migration.
- After successful insert, call a server function `notifyPartnerUpdate({ message: "@username sent you an update 🤍" })` that looks up partner's `push_subscriptions` rows and sends Web Push via `web-push` (server-side). If `web-push` can't run in the Worker, fall back to writing a row in a new `pending_pushes` table that the SW reads on `sync` — but first attempt is direct.
- UI: if cooldown not elapsed, show a soft "next update in 4h 12m" line under the grid and disable Confirm.

## 8. Thinking of you — 3h cooldown + visible timer

- Change `MIN_PING_GAP_MS` to 3 hours.
- After tap, render small muted text "available again in 2h 47m", updating every minute via interval.

## 9. Unlock page — proper selection UI

- Rebuild `/unlock` (or wherever the unlock form lives) with three cards: Journal / Unsent / Goals.
- Each card has a top-level Switch (master on/off → flips `unlock_prefs.share_journal` etc.).
- Granular: each card expandable; lists the user's own entries with per-entry checkboxes.
- For per-entry sharing, add `is_shared boolean default false` to `journal_entries`, `unsent_thoughts`, `goals`. RLS for partner select tightened to `... AND is_shared = true` in addition to existing `partner_shares(...)` flag.
- Save button persists both the master switches and per-entry flags in one transaction (best-effort sequential since supabase-js doesn't expose tx, with optimistic UI + rollback toast on error).
- Partner-side queries already filtered by RLS so no client-side change required beyond the new column behavior.

## 10. Allow-delete toggle fix

- Root cause: delete buttons are likely conditional on a stale local state instead of `journey.allow_private_deletes`.
- Pass `allowDeletes = journey.allow_private_deletes` from `AppShell`/session into Journal, Unsent, Goals. Render delete button on every row when true, regardless of `created_at`. Hide all when false.
- Toggle in Settings updates the journey row + invalidates session; `useSession` re-fetch propagates to all three sections.

## Migrations summary (single file)

- `ALTER TYPE status_type ADD VALUE` for each new status (8 new).
- Update `enforce_status_cooldown` function: `INTERVAL '6 hours'`.
- `ALTER TABLE unsent_thoughts ADD COLUMN image_path text;` and update `kind` checks if any.
- `ALTER TABLE journal_entries ADD COLUMN is_shared boolean DEFAULT false;`
- `ALTER TABLE unsent_thoughts ADD COLUMN is_shared boolean DEFAULT false;`
- `ALTER TABLE goals ADD COLUMN is_shared boolean DEFAULT false;`
- Update partner-share RLS policies on those three tables to also require `is_shared = true`.
- Create Deen tables (`deen_prayers`, `deen_quran`, `deen_quran_log`, `deen_athkar`, `deen_dhikr`, `deen_fasting`) with RLS.
- Create `unsent-images` storage bucket + RLS policies.
- (Optional) `pending_pushes` table only if web-push direct send isn't viable.

## Files touched

**New**
- `src/routes/deen.tsx`
- `src/components/WeekCircles.tsx`
- `src/components/MediaOverlay.tsx` (audio + image overlays)
- `src/components/UnlockSelector.tsx` (or rebuild existing unlock route)
- `public/icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (if missing)

**Edited**
- `public/sw.js`, `public/manifest.webmanifest`
- `src/routes/__root.tsx` (meta + guarded SW registration)
- `src/lib/notifications.ts`, `src/lib/offline-queue.ts`
- `src/lib/statuses.ts` (16 options)
- `src/components/AppShell.tsx` (sidebar rename Dua→Deen, allow-delete plumbing, init offline queue, post-login notification permission)
- `src/components/PartnerActivity.tsx` (already smart-polled)
- `src/routes/today.tsx` (new top counters layout, 16-option grid, confirm, cooldown timer, side-by-side updates, subtle reset icon, hours in counter)
- `src/routes/private.tsx` (strip to 3 sections, 3-card grid, allow-delete wiring, image inputs in Unsent, minimal media log + overlays)
- `src/routes/unlock.tsx` (rebuilt selector)
- `src/server/journey.functions.ts` (notifyPartnerUpdate)
- `src/integrations/supabase/types.ts` regenerates after migration

**Removed**
- `src/routes/dua.tsx` (replaced by `deen.tsx`)
- Worship/Mood/Vault/Letter/Building/Reflect blocks inside `/private`

## Open question before I start

One thing genuinely needs your call: **per-entry unlock granularity in #9** adds an `is_shared` column to journal/unsent/goals and a checklist UI per entry. That's meaningfully more work and UI than master toggles only. If you're fine with master toggles per section (Journal on/off, Unsent on/off, Goals on/off) and skipping per-entry checkboxes, the unlock page is much simpler and ships faster. I'll default to **master-toggle-only** unless you say otherwise — granular per-entry is a follow-up.

