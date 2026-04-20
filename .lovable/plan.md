
# Our Journey — Private Sanctuary App

A two-person, deeply private sanctuary for navigating a no-contact period rooted in Islamic values. Warm parchment aesthetic, fully isolated per-user data, secure auth with row-level security.

## Authentication & Account Setup
- **He** signs up first with email + password, becoming the account owner of the shared "journey"
- During his signup he creates **her username** (no password, no email required)
- She logs in with that username + a temporary first-login flow → forced to set her own password before seeing anything. He never sees, never resets it.
- Each journey is a paired bond — both users linked via a `journey_id`
- All private tables enforced with strict RLS: users can only ever read/write their own rows
- Logout available from header

## Shared Layout (visible to both)
- **Header**: Bismillah in Arabic, current user name, logout
- **Footer**: Ayah from Al-Baqarah 2:216 (Arabic + English)
- **Background**: Cream/parchment with very subtle geometric Islamic star pattern at low opacity
- **Navigation**: Tabs — Today · Counter · Private · Dua · Unlock (when eligible)

## Shared Features

### Daily Status (Today tab)
- Pick one of 6 status options (🌿 🤲 🌙 💪 🌧️ ✨)
- Updateable max once per 12 hours (enforced server-side)
- Side-by-side cards: "You" and "Them" showing each current status + timestamp
- "View History" button → modal with full chronological log of both people's past statuses

### No Contact Counter
- One shared NC start date for the journey
- Live day count, large parchment-styled card
- Milestone ribbons: 7, 14, 21, 30, 60, 90, 180, 365 — lit up as reached, dimmed otherwise
- **Reset** button → dialog asks: Who broke it (Him/Her)? + optional note → confirm resets to today
- **Break log section**: hidden entirely until the very first reset. Once visible, stays forever. Lists every break: date, who, note. Quiet visual deterrent.

## Private Features (per user, fully invisible to the other)

Tabbed within the Private section, each user sees only their own:

1. **Why I'm Here** — single editable note
2. **Journal** — titled timestamped entries, newest first
3. **Stayed Strong Log** — timestamped wins
4. **Trigger Log** — what almost broke streak + the urge, to surface patterns
5. **Mood Tracker** — daily emoji mood + history view
6. **Goals** — add, check off, delete personal goals
7. **Sealed Letter** — write once, confirmation dialog, then permanently locked & read-only
8. **Memory Vault** — entries with user-set unlock day threshold; locked entries show only "🔒 Unlocks at day X" until NC count reaches it
9. **Building Toward** — editable vision note
10. **Weekly Reflection** — one rotating question per week (resets Sunday) from a curated Islamic-themed list, user writes the answer; past answers archived
11. **Quran & Dhikr Tracker** — daily input: pages read, adhkar count. Cumulative totals shown alongside NC streak
12. **Monthly Auto-Summary** — server-generated at month end: days on streak, moods, journal count, goals completed, strength moments. Browsable by month.
13. **Unsent Thoughts** — "things I wish I could tell you right now"
    - Write it (text)
    - Say it (browser MediaRecorder → Supabase Storage)
    - Upload it (MP3 → Supabase Storage)
    - Chronological list with inline audio playback

## 365-Day Unlock
- Activates per-user once their NC streak reaches 365 unbroken days
- Granular toggles per private section (journal, letter, mood, strength, triggers, unsent text, unsent audio, etc.) — nothing shared by default
- Save → the other user sees a **"What they chose to show you"** read-only view of only the toggled sections, beautifully presented
- Per-user; doesn't require both to reach 365

## Daily Dua
- Curated list of duas on themes: steadfastness, patience, tawakkul, gratitude, hearts not deviating
- One per day, deterministic by date
- Arabic (right-aligned, Amiri font), transliteration, English meaning
- Previous / Next day navigation

## Design System
- **Palette**: parchment `#f5ecd9`, cream `#faf3e3`, deep brown `#3a2a1a`, gold accent `#b8902c`
- **Fonts**: Amiri (Arabic/duas), Cormorant Garamond (body), Cinzel (headings/labels)
- **Mobile-first**, fully responsive
- Toast notifications on every save/action
- Smooth tab transitions
- No tracking, no ads

## Tech & Data
- Lovable Cloud (Supabase) — auth, Postgres with strict RLS, Storage for audio
- React + TanStack Start
- All audio uploads go to a private Storage bucket with owner-only access
- Server-side enforcement of: 12h status cooldown, sealed letter immutability, memory vault unlock threshold, 365-day unlock eligibility

## Build Order
1. Database schema + RLS + storage bucket
2. Auth (his signup creates her account; her first-login password set)
3. Shared layout, header, footer, theme, fonts
4. Today (daily status) + history
5. NC Counter + reset flow + conditional break log
6. Private section shell with tabs
7. Each private feature module
8. Daily Dua with curated content
9. 365-day Unlock flow + read-only "shared with you" view
10. Monthly auto-summary generator
