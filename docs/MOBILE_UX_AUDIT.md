# Mobile UX/UI Evaluation — marching.art

**Date:** July 2026 · **Scope:** Full front-end review for mobile browser users (viewport < 768px), covering layout, navigation, touch ergonomics, forms, modals, PWA/offline behavior, performance, and accessibility. Findings are code-verified with `file:line` references.

---

## Executive summary

The mobile foundation is **well above average for a web app**: a real bottom tab bar with haptics and safe-area insets, a 44px touch-target design token, card-ified score tables (no sideways table scrolling), skeleton-first loading, lazy-loaded routes/modals/charts, a complete PWA manifest + hand-rolled service worker, Firestore offline persistence, and thorough `prefers-reduced-motion` support.

The problems are **localized regressions against that baseline**, and they cluster into three themes:

1. **A few flows are broken or invisible on touch** (hover-only controls, dead search boxes).
2. **The shared primitives lag behind the app's own best patterns** (the most-used `Modal` is desktop-centered while three hand-rolled modals already do the correct mobile bottom-sheet pattern; excellent mobile components like `SwipeableTabs`, `ActionSheet`, and `ConfirmationSheet` are shipped but never used).
3. **Consistency drift**: sub-44px targets on primary controls despite the design system defining `min-h-touch: 44px`, and `100vh` used everywhere despite `dvh` tokens existing in the Tailwind config.

---

## P0 — Broken or blocking on mobile (fix first)

### 1. Profile avatar actions are unreachable on touch
`src/components/Profile/DirectorProfile.tsx:199-234` — the **Design Uniform / Regenerate / Change Avatar** buttons live inside an `opacity-0 group-hover:opacity-100` overlay with no tap, focus, or active fallback. `group-hover` never fires on touch devices, so **a phone user cannot design a uniform or change their avatar from the Profile page at all**. (Dashboard's `SeasonScorecard` offers a real button path to uniform design, but the Profile entry point is dead.)
**Fix:** render the actions as a visible row below the avatar on `< md`, or add `focus-within:opacity-100 active:opacity-100` plus a tap-to-reveal.

### 2. The shared `Modal` is desktop-only in design — and it's the dominant modal
`src/components/ui/Modal.tsx:121,162` — always a centered dialog (`flex items-center justify-center`), body capped at `max-h-[70vh]` (static `vh`, clipped by iOS Safari's dynamic toolbar), **no safe-area insets, no keyboard avoidance, no swipe-to-dismiss**. It is imported at ~21 call sites. Meanwhile the codebase already contains the correct pattern three separate times by hand — bottom-anchored sheet on mobile, centered on `sm+`:
- `src/components/modals/LeagueInviteModal.jsx:95`
- `src/components/modals/ProfileEditModal.jsx:228`
- `src/components/Profile/SettingsModal.jsx:315` (with `safe-area-bottom`)

**Fix:** fold the responsive-sheet pattern into `Modal.tsx` once (bottom sheet under `sm`, `dvh` height cap, safe-area padding, `visualViewport` keyboard handling) and all 21 call sites inherit it. `ConfirmModal`'s `h-9` (36px) footer buttons should also move to `min-h-touch`.

### 3. Caption selection — the core game loop — has no search
`src/components/CaptionSelection/CaptionSelectionModal.jsx:703` — the corps list renders in full with **no search/filter input**, making the central draft interaction a long blind scroll on a phone. The flow is otherwise genuinely mobile-first (tap-to-select master/detail with a mobile back button, auto-advance to the next empty caption, Quick Fill) — search is the missing piece. Also in this flow: header actions are `h-8`, footer buttons `h-9`, the close button is `p-1` with a `w-4 h-4` icon (`:549,:556,:560-562`) — all below the 44px minimum — and the container's `max-h-[95vh]` (`:510`) risks the "Lock Lineup" bar sitting under the iOS home indicator.

---

## P1 — High-friction issues

### 4. The headline score is buried on mobile
`src/pages/Dashboard.jsx:300-413` — `grid grid-cols-1 lg:grid-cols-3` stacks the entire main column (lineup table, analyzer, results, predictions) **before** the sidebar on mobile, pushing `SeasonScorecard` (the user's score and rank — the most-glanced datum in a fantasy game) below a long scroll.
**Fix:** reorder with `order-*` utilities so the scorecard renders first under `lg`.

### 5. Navigation IA: Leagues (and other sections) have no nav entry
`src/App.jsx:551` routes `/leagues`, `/soundsport`, `/hall-of-champions`, `/corps-history`, `/retired-corps` — none appear in `TopNav` or `BottomNav` (both carry only News/Dashboard/Schedule/Scores/Profile). Leagues is a core social/retention feature reachable only via in-page links. On mobile there is no overflow/"More" affordance at all; the Help icon in the top bar (`GameShell.jsx:102-108`, ~36px target) is the only extra entry point.
**Fix:** either promote Leagues into the bottom nav (5 → still 5 by folding News under Dashboard, or 6 with tighter items) or add a "More" sheet — `ActionSheet` in `BottomSheet.tsx:239` already exists, unused, for exactly this.

### 6. iOS zoom-on-focus + a dead search box
- `src/pages/HowToPlay.jsx:438-444` — the guide search stores `searchQuery` but `renderTabContent()` (`:402-419`) never uses it: **the search filters nothing**. It's also `text-xs` (12px), so focusing it zooms the page on iOS.
- `src/pages/Leagues.jsx:539-545` — discover-league search is `text-sm` (14px) → iOS zoom. (The global 16px form rule in `src/index.css:60-64` covers most inputs, but these override it with Tailwind text classes at the element level in a way worth verifying; `QuickJoinModal` at `Leagues.jsx:270` does it right with `text-xl`.)
**Fix:** wire up or remove the guide search; use `text-base` minimum on all inputs.

### 7. Tab strips: hidden and overflowing
- `src/pages/ScoresParts.jsx:47` — 7 score tabs in `overflow-x-auto scrollbar-hide` with **no edge-fade/scroll hint**, so "Archive" and "Hall of Champions" are invisible off-screen with no cue they exist.
- `src/pages/Scores.jsx:476-500` — the archive sub-tab row has **no `overflow-x-auto` at all**; five sub-tabs can overflow the viewport on ≤360px phones and cause horizontal page scroll.
**Fix:** add overflow scrolling plus a right-edge fade affordance (the `DataTable` scroll-hint fade at `DataTable.tsx:337-342` is a ready-made pattern).

### 8. Sub-44px touch targets on primary controls
The system defines `--touch-target-min: 44px` and `min-h-touch` (`tailwind.config.cjs:214-231`), but key controls ignore it:
- Class switcher + empty-slot buttons: `px-3 py-1.5 text-[10px]` ≈ 28px (`src/components/Dashboard/sections/ControlBar.jsx:90,102,178`)
- Corps-management kebab (only path to Move/Retire): `p-1.5` + `w-4 h-4` ≈ 28px (`SeasonScorecard.jsx:124-131`)
- Leagues header "Join Code"/"Create" 36px; card Join ≈ 30px (`Leagues.jsx:468,474,214`)
- Profile Share/Edit/Settings ≈ 24–28px (`DirectorProfile.tsx:331-368`)
- `Input`/`Select` heights are 32–40px (`src/components/ui/Input.tsx:24-28`)
- Onboarding caption jump-dots `w-8 h-8` (`OnboardingParts.jsx:88-99`)
**Fix:** sweep to `min-h-touch`/`min-w-touch`; where visual compactness matters, keep the visual size but extend the hit area (padding or pseudo-element).

### 9. `100vh` everywhere, `dvh` nowhere
`tailwind.config.cjs:190,194,198` alias `h-screen`/`min-h-screen` to `100vh`, and grep shows **zero component usage of the `dvh` utilities** the config defines. ~10 pages use `min-h-screen` and modals hardcode `max-h-[85-95vh]` (`ShowRegistrationModal.jsx:654`, `CaptionSelectionModal.jsx:510`, `SettingsModal.jsx:315`, `BottomSheet.tsx:51`, etc.). On iOS Safari the dynamic toolbar makes `100vh` taller than the visible viewport — bottom-anchored actions get clipped.
**Fix:** map `screen` → `100dvh` in the config (one-line change with broad effect) and migrate modal caps to `dvh`.

### 10. Toasts appear top-right — the worst spot on a phone
`src/App.jsx:262` — `react-hot-toast` is positioned `top-right`, colliding with the notch/app header and the offline banner (also top-anchored), and far from the thumb.
**Fix:** `position="bottom-center"` with an offset above the bottom nav (`calc(66px + env(safe-area-inset-bottom))` — the `.main-content-bottom` math in `index.css:177-186` already computes this).

### 11. No focus/scroll management on route change
No `ScrollToTop` or focus-to-`main` exists on navigation; `PageTransition.tsx` is built but never mounted. SPA navigations leave scroll position and screen-reader/keyboard focus stranded — on mobile this reads as "the page didn't change" moments.
**Fix:** small effect on `location.pathname`: scroll the content container to top and move focus to `#main-content`.

---

## P2 — Consistency, polish, and dead machinery

- **Adopt or prune the unused mobile toolkit.** `SwipeableTabs`/`TabBar` (swipe navigation + haptics), `ActionSheet`, and `ConfirmationSheet` (built explicitly as the mobile `ConfirmModal` replacement, `BottomSheet.tsx:303-304`) have **zero usages**. `BottomSheet` and `PullToRefresh` are used exactly once each (`ShowRegistrationModal.jsx:625`, `Scores.jsx:589`). Wiring these into Scores/Schedule/Leagues tabs, confirmations, and Dashboard refresh would raise the native feel substantially with code that already exists.
- **One `useIsMobile` hook.** Mobile branching is re-implemented per component via resize listeners defaulting to desktop (`ShowRegistrationModal.jsx:150-156`), causing a wrong-variant first paint. Centralize with a `matchMedia`-based hook.
- **Lazy-modal Suspense fallbacks are `null`** (`Dashboard.jsx:248` et al.) — on slow cellular, tapping a button does nothing visible while the chunk downloads. Show a spinner overlay or skeleton sheet.
- **PWA install prompt only renders for logged-in users** (`App.jsx:297`); anonymous visitors — the likeliest installers — never see it.
- **Offline banner over-promises**: "Changes will sync when you reconnect" (`OfflineBanner.tsx:57`) but the service-worker background-sync handlers are empty stubs (`public/service-worker.js:311-321`). Either implement queued writes or soften the copy.
- **DataTable has no column-priority concept** (`DataTable.tsx:15-34`) — wide tables rely purely on horizontal scroll; add `hideOnMobile`/priority to the column schema.
- **Deadline details are `title`-tooltip only** (`NextDeadlineChip.jsx:74-97`, `ControlBar.jsx:126`) — hover-only, no touch equivalent for lock/reset times. Move to a tappable popover (the `JargonTooltip` pattern at `JargonTooltip.jsx:70-90` already handles touch correctly).
- **Ticker bar** (`GameShell.jsx:523`) auto-cycles every 8s and costs 40px of a small screen; content within a section still needs horizontal scrolling with no affordance. Consider pausing on touch and adding an edge fade. Also `shellContext headerHeight: 80` (`GameShell.jsx:588`) is stale on mobile where the real header is 88px.
- **Chart touch config**: the `CorpsHistory` line chart uses default hover interaction (`CorpsHistory.jsx:162-188`); add `interaction: { mode: 'index', intersect: false }` for finger-friendly tooltips.
- **Clickable `<div>`s**: `ShowCard` (`ScheduleParts.jsx:140-147`) has `onClick` without `role`/`tabIndex`.
- **Modal a11y consistency**: `useFocusTrap` exists (`a11y/hooks.tsx:11-47`) but isn't applied across all modals; some lack `role="dialog"`/`aria-modal` (also flagged in the internal audits).

---

## What's already strong (keep and build on)

| Area | Evidence |
|---|---|
| Bottom navigation | 44–48px targets, haptics, safe-area, route prefetch on focus, `aria-current` (`BottomNav.tsx`) |
| Native-feel CSS | `touch-action: manipulation`, tap-highlight removal, overscroll containment, 16px form inputs (no iOS zoom), safe-area vars (`index.css`) |
| Reduced motion | Global CSS + `MotionConfig reducedMotion="user"` + ticker/stats auto-cycle gating — above average |
| Score tables | Fully card-ified stacked rows on mobile; no sideways tables (`ScoresParts.jsx`) |
| Auth forms | `h-12 text-base`, correct `autoComplete`, real labels, 44px password toggles (`Login.jsx`, `Register.jsx`) |
| Performance | Route/modal/chart/motion lazy-loading, manualChunks vendor split, `OptimizedImage` with CLS protection, non-blocking fonts |
| PWA | Complete manifest (standalone, maskable icons, shortcuts), per-route SW caching strategies, quality install prompt with iOS instructions |
| Offline reads | Firestore `persistentLocalCache` + tuned React Query retry/reconnect (`api/client.ts:66-69`, `lib/queryClient.ts`) |
| Haptics | Full pattern library wired into 8 surfaces (`hooks/useHaptic.ts`) |

---

## Other factors to consider for a best-in-class mobile experience

1. **Thumb-zone ergonomics as a design rule.** Primary actions (Lock Lineup, Join, Register) should sit in the bottom third of the screen; destructive/rare actions up top. The bottom-sheet migration (P0 #2) naturally moves confirm actions into thumb reach.
2. **Field-error visibility.** Ship prod sourcemaps + an error tracker (Sentry or similar; `vite.config.js:26` currently disables sourcemaps) — mobile-only crashes (Safari quirks, low-memory tab kills) are otherwise invisible.
3. **Real-device Web Vitals.** Add CrUX/`web-vitals` reporting; lab Lighthouse won't catch mid-tier Android jank in the fixed-shell scroll containers.
4. **Mobile e2e assertions.** A Pixel 5 Playwright project exists (`playwright.config.ts:48-51`) but only 3 shallow specs. Add tests for: bottom-nav routing, bottom-sheet open/dismiss, caption-selection flow, no horizontal overflow at 360px, and toast/keyboard overlap.
5. **Offline writes for the core loop.** Lineup edits are the one thing users will try at a stadium with bad signal. Queue lineup saves through the (currently stubbed) background sync, with optimistic UI.
6. **Notification strategy.** FCM plumbing exists (`firebase-messaging-sw.js`); score-processed and lineup-deadline push notifications are the natural mobile retention hooks — with granular opt-in.
7. **Landscape and tablet.** The fixed one-screen GameShell (`index.html:168-183`) should be sanity-checked in landscape phones (48+40px of fixed chrome plus bottom nav leaves little content height).
8. **Text scaling.** Audit at iOS/Android large-font settings; heavy use of `text-[10px]`/`text-xs` in tickers, tabs, and nav labels will not scale (fixed px classes) and is already at legibility limits.
9. **Reduce chrome on scroll.** Consider auto-hiding the ticker (or collapsing top nav) on downward scroll to reclaim ~40px — standard pattern in sports apps this UI emulates.

---

## Suggested sequencing

| Phase | Items | Effort |
|---|---|---|
| 1 (days) | P0 #1 avatar actions · #6 dead search + zoom · #7 tab overflow · #10 toast position · `screen`→`dvh` config flip | Small, surgical |
| 2 (1–2 wks) | P0 #2 responsive Modal (migrates 21 call sites) · #3 caption search + targets · #4 dashboard reorder · #8 touch-target sweep · #11 scroll/focus reset | Medium |
| 3 (ongoing) | #5 nav IA (More sheet / Leagues promotion) · adopt SwipeableTabs/PullToRefresh/ConfirmationSheet · offline lineup writes · push notifications · mobile e2e + vitals | Larger |

*Note: findings are from static code analysis of every mobile-relevant component plus the internal audit docs; the app requires live Firebase credentials, so runtime screenshots weren't reproducible in this environment.*
