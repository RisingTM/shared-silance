

# Fix "Create journey does nothing" + add PWA install + password reset + onboarding tour

## Part 1 — Fix the broken setup flow (root cause)

**Root cause:** `setupJourney`, `setOwnPassword`, and `resetCounter` are server functions guarded by a middleware that requires an `Authorization: Bearer <access_token>` header. The browser never attaches that header, so every call fails with 401 silently — that's why clicking **Create our journey** appears to do nothing.

A second possible cause: if email confirmation is on, the owner has no session at all after signup, so `/setup` can't authenticate.

**Fixes:**

1. **Inject the Supabase access token into every server-function request.** Add a tiny client bootstrap that wraps `globalThis.fetch` and, for same-origin requests to `/_serverFn/*`, attaches `Authorization: Bearer <access_token>` from the current Supabase session. Imported once from `src/router.tsx` (or a new `src/lib/server-fn-auth.ts`).
2. **Disable email confirmation** in auth config so owner signup immediately yields a session and lands on `/setup` ready to act. (Per the project's auth setup, the owner is the only email user; partner uses synthesized credentials.)
3. **Surface errors visibly** in `setup.tsx`: log the raw error to the console and show the message in the toast (already wired via `toast.error(err.message)`, but currently the request is rejected before reaching the handler with a plain `Response` — improve the error parsing so the toast shows "Unauthorized" instead of nothing).
4. **Verify**: after the fix, clicking **Create our journey** completes and shows the temp-password screen.

## Part 2 — Make it an installable PWA (no service worker)

The user wants a PWA they can put on their phones. Per Lovable guidance, full PWAs with service workers are problematic in the editor preview. Since the app does not need offline support, we'll do the **simpler installable-PWA approach**: a web app manifest + icons + meta tags. No `vite-plugin-pwa`, no service worker — just "Add to Home Screen" support on iOS and Android with a standalone (chromeless) launch.

**Adds:**
- `public/manifest.webmanifest` — name "Our Journey", short_name "Journey", `display: "standalone"`, parchment theme color `#f5ecd9`, background `#faf3e3`, start_url `/`.
- `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` — generated parchment-and-gold crescent icons.
- `public/apple-touch-icon.png` (180×180) for iOS home screen.
- Update `src/routes/__root.tsx` head: link the manifest, add `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`, `apple-mobile-web-app-title`, theme-color meta tags, and the apple-touch-icon link.

**Result:** open the published URL on phone → browser menu → "Add to Home Screen" → opens fullscreen, no browser chrome, with the parchment splash colors.

## Part 3 — Owner password reset

- **Sign-in tab** (`src/routes/index.tsx`): add a small "Forgot password?" link. Reveals an inline email field; submits via `supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })`. Toast confirms.
- **New public route `src/routes/reset-password.tsx`** (no `RequireAuth`): listens for the recovery `onAuthStateChange` event, shows a parchment card with two password fields, submits via `supabase.auth.updateUser({ password })`, then navigates to `/today`. If no recovery session is detected after a short wait, shows "This link is invalid or expired."
- Copy on the sign-in tab clarifies "for email accounts only" — partners use a different login.

## Part 4 — First-login onboarding tour

- **New `src/components/OnboardingTour.tsx`** — a 5-step parchment modal (reuses `parchment-card`), one step per tab (Today, Counter, Private, Dua, Unlock). Each step: Cinzel title, 3–4 sentences in Cormorant Garamond, Back / Next / Begin buttons, dot indicator.
- **Trigger**: shown automatically once per user, persisted in `localStorage` under `our-journey:tour-seen:{user.id}`.
- **Mount**: inside `AppShell` so it covers all authenticated pages. A small "Take the tour again" link in the footer reopens it.
- No DB changes.

## Part 5 — Publish

The app is already published at `shared-silance.lovable.app`. After this round of changes, we'll just push an update so the fixes and PWA manifest go live — no new publishing flow needed. Open that URL on your phone, then "Add to Home Screen."

## Files changed/created

- **Create** `src/lib/server-fn-auth.ts` — fetch wrapper that injects Supabase Bearer token on `/_serverFn/*` calls.
- **Edit** `src/router.tsx` — import the wrapper once on startup.
- **Edit** `src/routes/setup.tsx` — better error surfacing.
- **Auth config** — disable email confirmation for owner signup.
- **Create** `public/manifest.webmanifest`, `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png`, `public/apple-touch-icon.png`.
- **Edit** `src/routes/__root.tsx` — manifest link + Apple PWA meta tags + theme color.
- **Edit** `src/routes/index.tsx` — "Forgot password?" inline form on sign-in tab.
- **Create** `src/routes/reset-password.tsx` — recovery page.
- **Create** `src/components/OnboardingTour.tsx` — 5-step tour.
- **Edit** `src/components/AppShell.tsx` — mount the tour + "Take the tour again" footer link.

