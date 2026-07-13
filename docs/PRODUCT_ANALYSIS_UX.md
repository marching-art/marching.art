# Product Analysis & UX Recommendations

> Generated: July 2026
> Scope: full product review — onboarding, core gameplay loop, navigation/IA, accessibility, social/retention, monetization — with five prioritized UX recommendations.

---

## 1. Product Overview

marching.art is a fantasy drum corps game (React 18 + Firebase) built around a daily loop:

1. **Build a corps** — pick 8 captions (GE1, GE2, VP, VA, CG, Brass, MA, Perc) from historical DCI performances under a class-specific point budget (SoundSport 90 → World 150).
2. **Register for shows** — up to 4 shows/week (7 in Championship Week) via the Schedule page.
3. **Scores drop overnight** — scheduled functions run at ~02:00 (`functions/src/scheduled/dailyProcessors.js`), live DCI scraping at 01:30. Players return each morning to see results.
4. **Progress** — XP levels (1,000 XP/level), class unlocks (XP level _or_ weeks-elapsed timer), daily login streaks with milestone rewards, CorpsCoin as an earn-only currency.
5. **Compete socially** — leagues with automated weekly matchups, chat, rivalries, and class-segmented leaderboards.

### What's working well

The product has genuinely strong bones, and several areas are above industry baseline:

- **Retention architecture is deep**: streaks with a 5-tier visualization, streak freezes (300 CC, plus a free one at the 30-day milestone), rival-context weekly email digests that suppress quiet weeks, win-back emails, push reminders before shows, and an overnight scoring cadence that creates a natural "check back tomorrow" hook.
- **Performance UX is thoughtful**: route-level code splitting with a stale-chunk auto-reload wrapper (`src/utils/lazyWithRetry.js`), manual vendor chunking, page-specific skeletons, hover/focus route prefetching (`src/lib/prefetch.ts`), deferred framer-motion loading, and a pre-hydration HTML app loader.
- **Mobile fundamentals are solid**: bottom tab nav with haptics and safe-area insets, 44px touch targets as design tokens, BottomSheet registration flow, a dedicated two-view mobile caption-selection flow.
- **Empty states are consistently good** across Dashboard, Leagues, and Rivals panels; the shared `ui/Modal.tsx` has proper focus trapping, restoration, and ARIA.
- **The lineup builder is feature-rich**: Quick Fill, saved templates, a Draft Helper (Hot/Value/History), a budget bar, and a Lineup Analyzer with actionable weak-spot callouts.

The gaps are not in the ambition or the systems — they're in **broken promises** (UI that displays rewards and states that don't exist), **invisible time** (players can't see deadlines), and **first-session friction**.

---

## 2. Detailed Findings by Area

### 2.1 First-session funnel (landing → playing)

The flow is: Landing → Register (4 fields) → 3-step Onboarding → confetti → Dashboard 5-tooltip tour. Findings:

| Finding                                                                                                                                                                                                                                                                  | Evidence                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Registration collects a "Director Name" that is **discarded** — `signUp(email, password)` never receives it. Onboarding Step 1 then asks for the name again.                                                                                                             | `src/pages/Register.jsx:70,155-172`, `src/pages/Onboarding.jsx:441-457`                                                                    |
| The "Try Demo First" guest preview is fully **read-only** — every interactive element opens a registration gate. Yet `useGuestPreview` contains complete interactive machinery (`updateGuestLineup`, engagement-based prompt thresholds) that **no component consumes**. | `src/pages/GuestDashboard.jsx:228-231,367-387`, `src/hooks/useGuestPreview.js:144-232`                                                     |
| The registration gate tells engaged guests _"Your preview progress will be saved when you register"_ — no mechanism transfers guest state into a new account.                                                                                                            | `src/components/GuestPreview/RegistrationGate.jsx:167-175`                                                                                 |
| Two parallel corps-setup flows with different tone and terminology: the friendly 3-step Onboarding vs. the 5-step `SeasonSetupWizard` ("a rigid registration form, not a game tutorial", per its own header comment).                                                    | `src/pages/Onboarding.jsx`, `src/components/SeasonSetupWizard/SeasonSetupWizard.jsx:4`, trigger in `src/hooks/useDashboardData.js:150-207` |
| Onboarding Step 3 (the hardest step — 8 caption picks under budget) has **no jargon tooltips**; "caption" is never defined in-flow. Landing pages have `JargonTooltip`, onboarding doesn't.                                                                              | `src/pages/OnboardingParts.jsx:180-183`                                                                                                    |
| Onboarding data-load failures leave the user on a perpetual "Loading available corps..." pulse with no retry UI.                                                                                                                                                         | `src/pages/Onboarding.jsx:74-97,609-616`                                                                                                   |
| Login's "Remember me" checkbox has no state binding or handler — it's decorative.                                                                                                                                                                                        | `src/pages/Login.jsx:166-171`                                                                                                              |

### 2.2 Core gameplay loop

| Finding                                                                                                                                                                                                                                                                                                   | Evidence                                                                                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Deadlines are nearly invisible.** Nothing tells the player when lineup edits lock, when the 3-changes-per-week trade counter resets, when show registration closes, or that scoring runs overnight. `isRegistrationLocked` exists in the season store but is only consumed by the class-purchase modal. | `src/pages/Schedule.jsx:827-829`, `src/components/CaptionSelection/CaptionSelectionParts.jsx:315`, `src/pages/Dashboard.jsx:861`           |
| **Onboarding copy contradicts the rules**: QuickStartGuide says _"You can change your lineup anytime"_ (there's a 3-trades/week limit) and _"register for up to 4 shows per week"_ (week 7 allows 7).                                                                                                     | `src/components/Dashboard/QuickStartGuide.jsx:33,40` vs `CaptionSelectionParts.jsx:284-320`, `src/utils/captionPricing.js:298-305`         |
| **"Points" is overloaded** — it means roster _cost_ in the lineup builder and _competition score_ everywhere else, on the same screens. Corps are also silently filtered to `points <= 50` with no explanation.                                                                                           | `src/components/CaptionSelection/CaptionSelectionModal.jsx:69,190`                                                                         |
| **Class naming is inconsistent**: "A Class" vs "Class A" across constants, Scores tabs, and Schedule; two class-key naming schemes (`aClass/openClass/worldClass` vs `aClass/open/world`) require manual mapping.                                                                                         | `src/components/Dashboard/sections/constants.js:5,12`, `src/pages/Scores.jsx:36`, `src/components/Dashboard/sections/ControlBar.jsx:16-24` |
| The rank-change arrow in SeasonScorecard is dead — Dashboard hard-wires `rankChange={null}`, so players never see rank movement despite the UI existing.                                                                                                                                                  | `src/pages/Dashboard.jsx:590`, `SeasonScorecard.jsx:233-246`                                                                               |
| Fabricated event names (`MOCK_EVENT_NAMES`) are substituted for SoundSport shows missing an `eventName` — real-looking but fake data shown to users.                                                                                                                                                      | `src/pages/ScoresParts.jsx:217-225,257-258`                                                                                                |
| Dashboard sidebar stacks seven bordered widgets, including a card-in-a-card (`RunningOrder` inside `NextPerformancePanel`); QuickStats auto-rotates every 5s alongside multiple `animate-pulse` dots.                                                                                                     | `src/components/Dashboard/NextPerformancePanel.jsx:232-240`, `sections/QuickStats.jsx:96-102`                                              |
| Schedule page has no error branch (only loading/no-season); caption modal swallows load failures into an empty list.                                                                                                                                                                                      | `src/pages/Schedule.jsx:792-814`                                                                                                           |
| Dead code: `LineupPanel`, `SchedulePanel`, `StandingsPanel`, `TeamSwitcher`, `LeagueStatus` are exported but never rendered. `QuickStats.jsx:62` has a destructuring bug making its denominator always fall back to 8.                                                                                    | `src/components/Dashboard/index.js:22-25,34`                                                                                               |

### 2.3 Reward loops and social features

| Finding                                                                                                                                                                                   | Evidence                                                                                      |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Daily Challenges are cosmetic.** Completion is stored only in `localStorage` and the displayed "+10 XP" is never awarded server-side. Progress is lost on cache clear or device switch. | `src/components/Dashboard/sections/DailyChallenges.jsx:2,46,66`                               |
| **Achievements are client-side only** — 18 achievements recomputed from dashboard data with no persistence or reward.                                                                     | `src/components/Dashboard/sections/AchievementTrackerPanel.jsx:16`                            |
| **League prize pools are never paid.** `createLeague` stores `prizePool: 1000` CC; no code distributes it.                                                                                | `functions/src/callable/leagues.js:9`                                                         |
| **@mention push notifications never fire**: `postLeagueMessage` writes `{userId, message}` but the trigger reads `{senderId, text}`. Verified field mismatch.                             | `functions/src/callable/leagues.js:742-746` vs `functions/src/triggers/pushTriggers.js:77-81` |
| League chat has no server-side message length cap or rate limiting.                                                                                                                       | `functions/src/callable/leagues.js:717-748`                                                   |
| Class unlock can dead-end: a player can spend CorpsCoin to unlock a class, then hit "registration closed" and get nothing usable until next season.                                       | `src/components/modals/ClassPurchaseModal.tsx:142-167`                                        |
| No first-run prompt ties new users into a league; social discovery depends entirely on the Leagues page.                                                                                  | `src/pages/Leagues.jsx`                                                                       |

### 2.4 Navigation, accessibility, PWA

| Finding                                                                                                                                                                                                                  | Evidence                                                                                                 |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| **No global `prefers-reduced-motion` CSS.** Framer-motion respects it via `MotionConfig`, but Tailwind keyframe animations (pulse skeletons, shimmer, ping), the 8s auto-cycling ticker, and QuickStats rotation do not. | `src/index.css` (no match), `tailwind.config.cjs:133-183`, `src/components/Layout/GameShell.jsx:222-230` |
| `useReducedMotion` conflates OS preference with mobile/slow-connection heuristics — mobile users get animations suppressed even without requesting it.                                                                   | `src/hooks/useReducedMotion.ts:170-182`                                                                  |
| **Contrast failures**: `text-muted #808080` on `#0A0A0A` ≈ 3.5:1 (below WCAG AA 4.5:1); ticker uses `text-gray-500` at 9–10px.                                                                                           | `tailwind.config.cjs:40,57`, `GameShell.jsx:355,395,566`                                                 |
| Skip-to-content link targets `#main-content`, which only exists inside GameShell — it's broken on all public pages (Landing, auth, articles, legal).                                                                     | `src/components/a11y/SkipToContent.tsx:17-38`, `GameShell.jsx:611-614`                                   |
| `useAnnounce` ignores its `priority` argument (always `aria-live="polite"`); `useFocusTrap`/`useAnnounce` are barely wired into feature modals.                                                                          | `src/components/a11y/SkipToContent.tsx:104`                                                              |
| Loading fallbacks are inconsistent: main pages get skeletons, but `/admin`, `/hall-of-champions`, `/retired-corps`, `/corps-history`, `/soundsport` get a full-screen spinner or nothing.                                | `src/App.jsx:521-599`                                                                                    |
| PWA manifest `background_color: "#FFFFFF"` against the dark `#0A0A0A` theme causes a white splash flash; service-worker background-sync handlers are empty stubs.                                                        | `public/manifest.json:11`, `public/service-worker.js:311-321`                                            |
| No breadcrumbs; public pages have no shared nav shell at all.                                                                                                                                                            | `src/App.jsx:311-609`                                                                                    |

---

## 3. Five Recommendations for Improving User Experience

Ranked by expected impact on activation, retention, and trust.

### Recommendation 1 — Make time visible: surface every deadline and the scoring cadence

**Problem.** The entire game runs on a clock the player cannot see. Scores drop at ~02:00; trades reset weekly; show registration closes; Championship Week auto-enrolls — and none of this is surfaced. The trade indicator says "3 Changes Left This Week" without saying when the week ends, and `isRegistrationLocked` is computed but only used for one modal. In a deadline-driven fantasy game, invisible deadlines are the single largest source of missed actions, lost streak-adjacent engagement, and "why did my lineup lock?" confusion.

**Recommendation.**

- Add a persistent **"Next: …" countdown** to the dashboard ControlBar and Schedule header (e.g., "Scores drop in 6h 12m", "Lineup locks Sat 11:59 PM", "Trades reset Sunday").
- Show the reset time inline in `TradesRemainingIndicator` and the lock time in the lineup modal's footer next to "Lock Lineup".
- Surface `isRegistrationLocked` on ShowCards and the lineup table, not just in the class-purchase modal.
- Derive all of it from one shared season-clock utility so the times can't drift apart across surfaces.

**Impact:** directly increases weekly lineup-set and show-registration rates (the two actions that drive scoring participation), and removes the most common trust-damaging surprise.

### Recommendation 2 — Fix the broken reward promises (real XP for challenges, paid prize pools, working mentions)

**Problem.** Several visible reward loops are fake or broken, which is worse than not having them: Daily Challenges display "+10 XP" but award nothing and live in `localStorage`; achievements are unrewarded client-side recomputations; league prize pools are configured and shown but never paid out; @mention push notifications never fire due to a field-name mismatch; the rank-change arrow is permanently null. Players who notice (and multi-device players will) lose trust in _all_ the game's numbers.

**Recommendation.**

- Back Daily Challenges with a server-side callable (mirroring `claimDailyLogin`) that validates completion and grants the displayed XP; persist completion in the profile.
- Pay out `prizePool` in the season-end league processing, or remove the field from league creation until it works.
- Fix the one-line trigger mismatch (`senderId/text` → `userId/message`) so @mention pushes fire.
- Wire `rankChange` from the daily leaderboard snapshots (data already exists for rivals computation), or remove the dead arrow.
- Persist achievements server-side (even without rewards at first) so progress survives devices.

**Impact:** converts the strongest engagement surface (daily dashboard) from decorative to trustworthy; every one of these is a small, bounded fix with outsized retention credibility.

### Recommendation 3 — Streamline the first session: one name, one wizard, a demo that's actually playable

**Problem.** The activation funnel has compounding friction: users type their name twice (the first is discarded); the "Try Demo" promises play but gates every tap behind a registration modal — while fully-built interactive guest machinery sits unused in `useGuestPreview`; the gate promises "your preview progress will be saved" but nothing saves it; and new users can encounter two different corps-setup wizards with conflicting tone and terminology.

**Recommendation.**

- Pass the Register form's Director Name through `signUp` (or drop the field) and prefill Onboarding Step 1.
- Wire up `updateGuestLineup` so guests can actually draft a demo lineup, and trigger the registration gate on the _existing_ engagement thresholds (3 lineup interactions) instead of the first tap. On signup, import the guest lineup into onboarding Step 3 — fulfilling the "progress saved" promise and skipping the hardest step.
- Consolidate `SeasonSetupWizard` and Onboarding into one flow (or at least one shared vocabulary and component set), and add the `JargonTooltip`s (caption, GE, corps) to the lineup step where they're most needed.
- Add a retry state to onboarding data-load failures.

**Impact:** the demo-to-signup conversion path is currently a static screenshot; making it playable is the highest-leverage acquisition change available, and it's mostly already built.

### Recommendation 4 — One rules vocabulary: fix contradictory copy and the "points" overload

**Problem.** The game explains itself inconsistently. QuickStartGuide says lineups can change "anytime" (they can't — 3 trades/week) and "4 shows per week" (wrong in week 7). The same class is "A Class", "Class A", and "SS"/"SoundSport" depending on the screen. "Points" means both roster cost and competition score, side by side in the lineup builder, and corps are silently filtered to ≤50 points with no explanation. For a game whose domain (drum corps) is already niche, inconsistent self-description is a real comprehension tax on new players.

**Recommendation.**

- Rename budget "points" to **"cost"** (or "salary", the fantasy-standard term) everywhere in caption selection; reserve "points/score" for competition results.
- Create a single constants module for class labels and rules copy (trade limits, show caps per week) and have QuickStartGuide, HowToPlay, tooltips, and indicators read from it — the wrong copy exists because the rules are hand-written in multiple places.
- Unify the two class-key naming schemes flagged in `ControlBar.jsx:16-24` while touching this.
- Explain (or badge) the ≤50-point availability filter in the corps picker.

**Impact:** cheap, systematic fix that reduces new-player confusion and prevents future copy drift; also removes a fragile engineering seam.

### Recommendation 5 — Accessibility and motion pass: reduced motion, contrast tokens, consistent loading states

**Problem.** The app is dense with perpetual motion — an 8-second auto-cycling ticker, 5-second rotating QuickStats, multiple pulsing "live" dots — and none of it respects `prefers-reduced-motion` at the CSS level (only framer-motion animations do). Core text tokens fail WCAG AA (`text-muted` ≈ 3.5:1 on the dark background; 9–10px gray ticker text). The skip link is broken on every public page. Five routes fall back to a spinner instead of the skeletons built for the app, and the PWA splash flashes white on a dark-themed app.

**Recommendation.**

- Add a global `@media (prefers-reduced-motion: reduce)` block that disables Tailwind keyframe animations and pauses the ticker/QuickStats auto-cycles (both already have the interval logic isolated — it's a conditional).
- Split `useReducedMotion` so OS preference and performance heuristics are separate signals.
- Raise `text-muted` to ≥ #9A9A9A (4.5:1 on #0A0A0A) in `tailwind.config.cjs` and bump ticker text to 11px minimum.
- Render `#main-content` + skip target on public pages; give the five spinner-fallback routes skeletons; set manifest `background_color` to `#0A0A0A`.

**Impact:** moves the ~80% WCAG AA compliance meaningfully toward the stated 90%+ target, reduces motion fatigue on the most-viewed screen, and polishes the first-paint experience — all low-risk token/CSS-level changes.

---

## 4. Suggested sequencing

| Order | Work                                                                                                    | Effort  | Why first                                               |
| ----- | ------------------------------------------------------------------------------------------------------- | ------- | ------------------------------------------------------- |
| 1     | Rec 2 quick fixes: mention-trigger field mismatch, remove/wire rank arrow, prize-pool payout or removal | Hours   | One-line-to-small fixes, immediate trust repair         |
| 2     | Rec 1 deadline surfacing                                                                                | Days    | Highest retention leverage per unit of work             |
| 3     | Rec 4 vocabulary/copy consolidation                                                                     | Days    | Unblocks consistent copy for everything after           |
| 4     | Rec 3 funnel streamlining + playable demo                                                               | ~1 week | Biggest acquisition win; guest machinery already exists |
| 5     | Rec 5 a11y/motion pass + server-backed challenges (Rec 2 remainder)                                     | ~1 week | Systematic polish once the loops are honest             |
