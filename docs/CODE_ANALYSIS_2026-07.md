# marching.art — Full Code Analysis & Improvement Plan (July 2026)

A five-track review of the entire codebase: frontend architecture, Cloud
Functions backend, security posture, testing/tooling/CI-CD, and
UX/SEO/product. Each track was reviewed independently against the live code;
findings below are deduplicated, cross-checked, and ranked.

**Scale reviewed:** ~169k lines — `src/` (~93k LOC, 407 files), `functions/`
(~54k LOC non-test, 171 exported functions), `functions-scraper/`,
`firestore-tests/`, `e2e/`, CI workflows, and both hosting configs.

---

## Executive summary

This codebase is in **far better shape than the typical Firebase game
project** — that is the consistent conclusion of every review track. The
engineering-governance layer is genuinely unusual: seven blocking CI jobs,
eight downward-only ratchets (design tokens, `@ts-nocheck`, path literals,
callable write budgets, audit advisories, coverage floors), 1,826 passing
tests (643 frontend + 1,183 backend), an 84-assertion Firestore-rules
regression suite, a fully server-authoritative economy, idempotent nightly
scoring (run lease + award ledger), and a scraper canary that turns a dci.org
redesign into "a 1 PM email instead of a 2 AM scoring incident."

No critical or high-severity security issues were found. The remaining
opportunities cluster into four themes:

1. **Growth is gated by the auth wall, not by code quality.** Director
   profiles, corps pages, and live leaderboards — the content most likely to
   earn organic links and shares — are all login-only. The SSR infrastructure
   to fix this (share cards, results pages, sitemap) already exists.
2. **The frontend's data layer is split-brain.** React Query is configured
   well but adopted by only ~12 files, while 26 components hand-roll
   `useEffect` fetching; the worst offender (`LeagueDetailView.jsx`) mixes
   three state paradigms in one 821-line component.
3. **Deploy automation lags the CI story.** Functions deploys are manual,
   ~35 minutes, and can leave production half-deployed; Firebase Hosting has
   no deploy workflow at all while Vercel auto-deploys — the two hosts can
   serve different builds indefinitely.
4. **A handful of known, deferred hardening items** — App Check enforcement,
   the CTA contrast token, `maxInstances`, the `@getbrevo/brevo` upgrade —
   each already have a written plan and just need to be executed.

### Scorecard

| Area | Grade | One-line verdict |
| --- | --- | --- |
| Security (rules, auth, economy) | **A** | Defense-in-depth, rules-tested, server-authoritative; only medium/low findings |
| Backend correctness | **A−** | Pervasive transactions + idempotency architecture; one real race (corps names) |
| Testing & CI | **A− / B+** | Backend excellent (70/80/85% floors); frontend honest but thin (~16%) |
| Frontend architecture | **B+** | Great performance/code-splitting; data-fetching layer needs consolidation |
| Deployment | **B−** | Manual functions deploys, dual-host drift risk |
| SEO / growth surface | **B** | Best-in-class SPA plumbing, but the valuable content is auth-walled |
| Accessibility | **B** | Strong foundations; known CTA contrast failure carved out of the a11y gate |

---

## Top 10 priorities (ranked by impact ÷ effort)

| # | Item | Impact | Effort | Area |
| --- | --- | --- | --- | --- |
| 1 | Public, shareable director/corps profile pages with SSR OG cards | High (growth) | Medium | Product/SEO |
| 2 | Upgrade `@getbrevo/brevo` 2.5 → 6.x in `functions/` (clears both critical advisories) | High (security hygiene) | Small | Deps |
| 3 | Fix the `interactive` azure contrast token (3.67:1 on every CTA) and delete the axe carve-out | High (a11y, legal) | Small–Medium | UX |
| 4 | Set `maxInstances` globally + per-hot-callable | High (cost ceiling) | Small | Backend |
| 5 | Finish the App Check rollout (site key in prod → watch metrics → flip the literal) | Medium-High | Small (process) | Security |
| 6 | Automate deploys: auto-dispatch functions deploy on `main` merges touching `functions/`; add a Firebase Hosting deploy step (or retire one host) | Medium-High (incident prevention) | Medium | CI/CD |
| 7 | Promote **Leagues** into primary nav (BottomNav + GameShell); surface Shop/Records/orphaned pages | Medium-High (retention) | Small | Product |
| 8 | Fix the corps-name reservation race (`batch.create()` or transaction) | Medium | Small | Backend |
| 9 | Decompose `LeagueDetailView.jsx` onto React Query hooks; begin migrating the 26 manual-fetch components | Medium (maintainability + jank) | Medium-Large | Frontend |
| 10 | In-app notification inbox (bell + unread badge) reusing the email-job event computations | Medium (retention) | Medium | Product |

---

## Security review (posture: strong — no high/critical findings)

**Verified clean:** economy/XP/score/lineup fields are server-only and
denylisted in rules with regression tests pinning past exploits (role
self-grant, XP farming, lineup forgery, invite-code enumeration); admin is
the Firebase custom claim only; all client writes cross-checked against
rules — nothing forgeable affects the game economy; lineup lock windows
enforced server-side; BMAC webhook verifies HMAC-SHA256 over the raw body
before trusting anything; no hardcoded secrets anywhere (all `defineSecret`);
storage rules default-deny; server-rendered HTML/SVG escapes all user data
including the `</script>` JSON edge case; the one `dangerouslySetInnerHTML`
(static JSON-LD in `HowToPlayPublic.jsx:80`) is currently safe.

**Findings (medium → low):**

- **M1 — App Check enforcement globally disabled**
  (`functions/index.js:25`). Documented rollout state; per-uid write budgets
  are the only bot friction until flipped. Finish the rollout.
- **L1 — Admin UID list ships in the public bundle**
  (`src/config/index.ts:80-86`, used in `src/api/client.ts:215-225`). Not
  privilege escalation (server enforces claims), but discloses admin
  accounts and creates two sources of admin truth. Derive client admin state
  from `getIdTokenResult().claims.admin` only.
- **L2 — No size/type caps on owner-writable profile fields** (`bio`,
  `displayName`, etc.) which are world-readable. Add coarse rules caps
  (`request.resource.data.bio.size() < 2000`, key-count cap).
- **L3 — Notifications**: owners can forge their own; and
  `useLeagueNotifications.ts:409-422` writes cross-user notifications
  client-side, which rules silently deny — a functional bug. Move creation
  into callables; narrow the client rule to mark-read/delete.
- **L4 — Legacy league namespace** (`fantasy_drum_corps_v1`) remains fully
  enumerable by any signed-in user (documented tradeoff; verify
  `scripts/stripLeagueInviteCodes.js` ran).

## Backend review (Cloud Functions)

**Verified strong:** transactions on all money/state paths; the nightly
pipeline is protected by a transactional run lease
(`helpers/scoringRunGuard.js`) + per-user award-ledger idempotency tokens
written in the same document write as the `increment` — textbook
retry-safety; caption-change lock windows design away lineup-vs-scoring
races; scoring pages all profiles with field projections (no silent 5,000-cap
drop); structured logging dominates (723 `logger.*` vs 80 `console.*`);
scraper failures retry with backoff and bot-challenge pages are treated as
retryable; a watchdog (4:30 AM) and an afternoon markup-drift canary guard
the pipeline.

**Findings:**

- **Med — Corps-name reservation race**
  (`callable/registerCorps.js:87-91,142`): non-atomic check-then-`batch.set`
  lets two concurrent registrations claim the same name; the duplicate-sweep
  machinery exists to clean up what this race creates. Use `batch.create()`
  (fails-if-exists) or a transaction.
- **Med — No `maxInstances` anywhere** → unbounded fan-out/cost exposure on
  a spike or abusive client. Set a global default plus per-function
  overrides on hot callables.
- **Med — `opsAlerts` only wired to the watchdog and canary.** Terminal
  failures of email/push/league-automation/leaderboard jobs are
  log-visibility only. Route all money-adjacent scheduled-job failures
  through `opsAlerts`.
- **Low** — `getActiveLineupKeys` (`lineups.js:872`) scans every active
  lineup per call (materialize a keys doc, like the `hotCorps` cache);
  `new Date().getFullYear()` in the live strategy breaks year-boundary
  backfills (`helpers/scoring.js:833,844`); profile `batch.update()` in the
  scoring commit fails a chunk if a profile was deleted mid-run (merge-set or
  tolerate per-op failure); 80 residual `console.*` sites; profanity filter
  is a three-word regex.

## Frontend review

**Verified strong:** all 27 routes lazy-load via `lazyWithRetry` (self-heals
stale-chunk 404s after deploys); Dashboard lazy-loads 15 modals; chart.js
behind `React.lazy`; framer-motion via `LazyMotion` exclusively; tuned
`manualChunks` with rationale comments; Zustand stores are textbook
singleton-listener wrappers with proper cleanup; every `onSnapshot` inspected
returns its unsubscribe; nearly all list queries carry `limit()`; a single
ErrorBoundary implementation reused per-route; offline lineup replay queue.

**Findings:**

- **High — React Query adoption ~15% of where it should be.** 12 files use
  `useQuery`/`useMutation` while 26 components/pages hand-roll
  `useState`+`useEffect` fetching (Records, HallOfChampions, Admin + all six
  tabs, Schedule, SupportersWall, NewsFeed, MatchupDetailView, …), losing
  caching/dedup/retry the configured RQ layer already provides.
- **High — God component `LeagueDetailView.jsx` (821 lines):** 16 `useState`
  hooks, a ~300-line data effect, imperative `fetchQuery` results copied into
  local state (cache invalidation never re-renders it), two `onSnapshot`
  subscriptions, and whole-season recap folding on the main thread per open —
  a mobile jank source. Decompose onto `useLeagueDetail`/`useLeagueStats`
  hooks; the query keys already exist in `src/lib/queryClient.ts:108-119`.
- **Med — N+1 member-profile fan-out** (`src/api/leagues.ts:367-380`): one
  full-profile `getDoc` per league member on cold open. Batch with
  `documentId() in` chunks, or serve display-fields-only from a callable.
- **Med — Caption-total formula duplicated 6+ times client-side** (and again
  in `functions/src/helpers/newsData.js:345`). Single
  `computeCaptionTotals()` util before the weights ever change.
- **Med — API-boundary erosion:** 15+ components import `firebase/firestore`
  directly despite the complete `src/api` layer. Enforce with ESLint
  `no-restricted-imports` + grandfathered exceptions.
- **Med — Swallowed errors:** 115 `console.error` sites, many with no user
  feedback or reporter call (e.g. `profileStore.ts:306-309,339-342` return
  bare `false`). Route through `errorReporter`, return discriminated results.
- **Med — `@ts-nocheck` debt is concentrated in the hardest code:** the 174
  grandfathered files include App.jsx, Dashboard, LeagueDetailView,
  ScoresParts, and all Admin tabs, while the typed half is the simpler half.
  De-nocheck the Leagues tree first — it pairs naturally with the RQ refactor.
- **Low** — NewsFeed reimplements `useInfiniteQuery` by hand; Google Fonts
  loaded at runtime (self-host for the offline-first PWA); two `<img>`
  missing `loading="lazy"`.

## Testing, tooling & deployment

**Verified strong:** 643 frontend + 1,183 backend tests all pass; backend
coverage gated at 70% lines / 80% branches / 85% functions; frontend coverage
honestly measured (`all: true`) and ratcheted; seven blocking CI jobs
including rules-against-emulator and Playwright e2e with an axe gate; build
is clean (~6s, largest gzip chunk 144.7 kB eager Firebase vendor); docs are
accurate against the code; Dependabot + weekly audit + advisory ratchet.

**Findings:**

- **Med-High — Deploy gaps.** Functions deploys are `workflow_dispatch` only
  (production can silently lag `main`); the ~140-function batched deploy
  takes ~35 min and a mid-run failure leaves production half-deployed
  (structurally, despite good mitigations); Firebase Hosting has **no**
  deploy workflow while Vercel auto-deploys — configs are parity-checked but
  deployed builds are not. `deploy-single-function.sh` has no test gate.
- **Med — `@getbrevo/brevo` 2.5.0 pulls both critical advisories**
  (deprecated `request` SSRF + old `form-data`); v6.0.2 drops them. The
  single highest-value dependency action. Then `npm audit fix` for `ws`.
- **Med — Frontend unit coverage ~16%.** Hooks and Zustand stores are
  pure-ish and cheap to test; keep raising the ratchet floors.
- **Low** — no root `typecheck` script; root `npm test` doesn't run
  functions/rules suites; `firebase-admin` major skew between
  `functions/` (13) and `functions-scraper/` (14); `firestore-tests/` runs
  firebase SDK 12 while the app runs 11; no dev-mode env validation message;
  `moduleResolution: "bundler"`; react-router advisory is RSC-mode CSRF —
  not applicable to this SPA, monitor rather than downgrade.

## UX, SEO & product

**Verified strong:** per-route SEO hook adopted by all 14 public pages;
dynamic sitemap, SSR results pages, share landing pages + sharp-rendered OG
cards from live Firestore data; hosting-parity check; thoughtful robots.txt;
comprehensive PWA (build-stamped SW, per-route cache strategies, FCM push
with grant-rate analytics, install prompts, offline banner + replay);
mobile-first Tailwind tokens (44/48px touch targets, safe-area insets, dvh);
219 aria attributes, focus traps in 18/20 modals, route-change focus
management; dense engagement machinery (streaks, XP, challenges, predictions,
rivals, season ladder, recap modals, six retention email types with per-type
opt-outs).

**Findings:**

- **High (product) — The valuable content is auth-walled.** `/scores`,
  `/profile/:userId`, `/leagues`, `/schedule` are login-only and disallowed
  in robots.txt; there are no public director/corps/leaderboard URLs to
  share or index. Reuse the `HallOfChampionsEntry` dual-shell pattern +
  existing SSR (`resultsPages.js`/`shareCards.js`) for public read-only
  `/d/:username` and `/corps/:id` routes. Biggest available SEO + viral win.
- **High (a11y, documented) — CTA contrast carve-out:** `interactive` azure
  `#3B82F6` with white text is 3.67:1 (AA needs 4.5:1) on every primary
  button; the axe test excludes `color-contrast` with the remediation plan
  written in the comment (`e2e/a11y.spec.ts:11-17`). Do the token split —
  and note it will be ~1 token change vs ~500 edits only if UI-kit adoption
  consolidates first (only 21 files import from `components/ui` against
  ~507 raw `<button>` elements).
- **Med — Navigation buries the social loop.** Leagues is linked only from
  Profile, an article sidebar, and the 404 page; Shop only from the
  CorpsCoin modal; Records only from inside Hall of Champions;
  `/retired-corps` and `/corps-history` have **zero** inbound links.
- **Med — No in-app notification inbox.** Users who deny push (the common
  case) have no persistent "what happened since I left" surface; the email
  jobs already compute the events a bell + unread badge would need.
- **Med — No a11y/mobile e2e coverage of the authenticated app** (dashboard,
  scores tables, draft flow) — the emulator seeding infra already exists.
- **Med — 20 bespoke modals in `src/components/modals/` use zero of
  `ui/Modal.tsx`** (which has tests and a ConfirmModal); consistency rests on
  convention, not the component.
- **Low** — Hall of Champions is public+sitemapped but client-rendered only
  (social scrapers see default tags); bare `/results` noscript link may 404;
  hardcoded toast palette in `App.jsx:281-299`; `theme-color` duplicated for
  both schemes.

---

## Suggested sequencing

- **Week 1 (small, high-leverage):** brevo upgrade + `npm audit fix`;
  `maxInstances`; corps-name `batch.create()`; test gate in
  `deploy-single-function.sh`; Leagues into nav; root `typecheck` script.
- **Weeks 2–3:** contrast-token split (after routing more buttons through
  `ui/Button`); App Check rollout completion; deploy automation (functions
  auto-dispatch + hosting deploy step or host consolidation); `opsAlerts`
  fan-out.
- **Month 2:** public profile/corps pages with SSR OG cards; in-app
  notification inbox; LeagueDetailView decomposition as the flagship React
  Query migration (de-`@ts-nocheck` the Leagues tree in the same pass).
- **Ongoing ratchets (keep the existing discipline):** RQ migration of the
  remaining manual-fetch components; frontend coverage floors upward;
  `ui/Modal`/`ui/Button` adoption; authed-app axe pass.

## Follow-up areas not fully verified in this pass

- SSRF surface in `helpers/scraping.js` URL discovery (scraper fetches
  attacker-influenceable URLs? — spot checks were clean, full audit pending).
- Unbounded-scan census of `emailNotifications.js`, `pushNotifications.js`,
  `rivalsComputation.js`, `lifetimeLeaderboard.js`.
- Importer (`dciArchiveImporter`/`pressboxImporter`) partial-failure
  handling.
- Confirmation that `scripts/stripLeagueInviteCodes.js` ran against the
  legacy league namespace.
