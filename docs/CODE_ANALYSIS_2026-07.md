# marching.art — Full Code Analysis & Improvement Plan (July 2026)

> **HISTORICAL RECORD.** Every finding in this document has been actioned
> (the one open deferral, the App Check flip, is tracked in
> [NEXT.md](NEXT.md) with everything else current). Kept for its reasoning,
> not as a queue.

A seven-track review of the entire codebase: frontend architecture, Cloud
Functions backend structure/correctness, a functions security sweep (all 130
callables + 6 HTTP endpoints), a rules/client security review, a cost &
performance deep dive, a data-pipeline reliability deep dive, and
testing/tooling/UX/SEO/product. Each track was reviewed independently against
the live code; findings below are deduplicated, cross-checked, and ranked.

**Scale reviewed:** ~169k lines — `src/` (~93k LOC, 407 files), `functions/`
(~54k LOC non-test, 171 exported functions), `functions-scraper/`,
`firestore-tests/`, `e2e/`, CI workflows, and both hosting configs.

> **Status: every finding below has been actioned** on
> `claude/code-analysis-improvements-u4ydyy`, except the two items called out
> as deliberately deferred at the end of this section. The findings are kept
> in their original diagnostic form — they document why each change was made,
> and they are the baseline the next review should measure against.
>
> **Deferred on purpose:**
>
> 1. **App Check enforcement** (`functions/index.js`) stays `false`. Flipping
>    it is a console-metrics decision, not a code change: enforcing before
>    real traffic shows as verified locks out every client still running a
>    cached bundle. The rollout steps are in ARCHITECTURE.md.
> 2. ~~**Sharding `historical_scores/{year}`**~~ — since done: the events live
>    in a `historical_scores/{year}/events/` subcollection
>    (helpers/historicalScores.js), so the 1 MiB cliff is gone. Only the App
>    Check flip above remains open from this review.
>
> Post-change verification: 1,252 functions tests, 676 frontend tests, 104
> rules-emulator tests, both typechecks, all eight ratchets, and the
> production build all pass.

---

## Executive summary

This codebase is in **far better shape than the typical Firebase game
project** — that is the consistent conclusion of every review track. The
engineering-governance layer is genuinely unusual: seven blocking CI jobs,
eight downward-only ratchets, 1,826 passing tests (643 frontend + 1,183
backend), an 84-assertion Firestore-rules regression suite, a fully
server-authoritative economy, idempotent nightly scoring (transactional run
lease + award ledger), real prompt-injection hardening on every user-derived
Gemini input, and a scraper canary that turns a dci.org redesign into "a 1 PM
email instead of a 2 AM scoring incident."

**No critical or high-severity security vulnerabilities were found** — no
privilege escalation, no SSRF, no hardcoded secrets, no XSS in
server-rendered HTML, webhook HMAC done textbook-correctly. The remaining
opportunities cluster into five themes:

1. **Growth is gated by the auth wall, not by code quality.** Director
   profiles, corps pages, and live leaderboards — the content most likely to
   earn organic links and shares — are all login-only. The SSR infrastructure
   to fix this (share cards, results pages, dynamic sitemap) already exists.
2. **A few unmetered cost-amplification paths.** No `maxInstances` anywhere,
   an AI avatar generator with no rate limit, public news endpoints with
   unclamped limits and attacker-controlled cache-doc writes, and `sharp`
   eagerly loaded into every one of ~150 function instances.
3. **Two data-integrity time bombs in the score pipeline.** A missing recap
   date silently mis-dates events by one day (scoring then silently falls
   back to regression), and `historical_scores/{year}` is a single unbounded
   array document that will hit Firestore's 1 MiB cap mid-season.
4. **The frontend's data layer is split-brain.** React Query is configured
   well but adopted by only ~12 files while 26 components hand-roll
   `useEffect` fetching; the worst offender (`LeagueDetailView.jsx`, 821
   lines) mixes three state paradigms.
5. **Deploy automation lags the CI story.** Functions deploys are manual and
   can leave production half-deployed; Firebase Hosting has no deploy
   workflow while Vercel auto-deploys — the two hosts can serve different
   builds indefinitely.

### Scorecard

| Area                            | Grade       | One-line verdict                                                                              |
| ------------------------------- | ----------- | --------------------------------------------------------------------------------------------- |
| Security (rules, auth, economy) | **A−**      | Defense-in-depth, rules-tested, server-authoritative; a handful of medium abuse/cost findings |
| Backend correctness             | **A−**      | Pervasive transactions + idempotency architecture; one real race (corps names)                |
| Pipeline reliability            | **B+**      | Top-decile design (lease, canary, watchdog); two high-severity data-integrity gaps            |
| Testing & CI                    | **A− / B+** | Backend excellent (70/80/85% floors); frontend honest but thin (~16%)                         |
| Frontend architecture           | **B+**      | Great performance/code-splitting; data-fetching layer needs consolidation                     |
| Cost & performance              | **B**       | Strong scaling helpers exist but adoption is uneven; no spend ceilings                        |
| Deployment                      | **B−**      | Manual functions deploys, dual-host drift risk                                                |
| SEO / growth surface            | **B**       | Best-in-class SPA plumbing, but the valuable content is auth-walled                           |
| Accessibility                   | **B**       | Strong foundations; known CTA contrast failure carved out of the a11y gate                    |

---

## Top priorities (ranked by impact ÷ effort)

| #   | Item                                                                                                                                                                                                                                                             | Impact                 | Effort    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- | --------- |
| 1   | **Public, shareable director/corps profile pages with SSR OG cards** — biggest available SEO + viral-loop win; the SSR machinery already exists                                                                                                                  | High (growth)          | Medium    |
| 2   | **Close the unthrottled-spend paths:** rate-budget `generateCorpsAvatar` (AI image gen, currently unlimited per signed-in user); clamp `getRecentNews` limit; allowlist/sanitize the news-feed cache key (unauthenticated callers can mint unbounded cache docs) | High (cost/abuse)      | Small     |
| 3   | **Set `maxInstances`** globally + per-function (only 2 of ~171 functions have one)                                                                                                                                                                               | High (cost ceiling)    | Small     |
| 4   | **Harden the scrape-date join:** fail hard on unparseable recap dates; validate the parsed recap date against the listing's `dateKey` (a silent one-day mis-date currently degrades scoring to regression invisibly)                                             | High (data integrity)  | Small     |
| 5   | **Shard `historical_scores/{year}`** out of its single unbounded-array document before the 1 MiB cap fails a merge mid-season at 1:30 AM                                                                                                                         | High (time bomb)       | Medium    |
| 6   | **Upgrade `@getbrevo/brevo` 2.5 → 6.x** in `functions/` — clears both critical npm advisories (`request` SSRF, `form-data`); then `npm audit fix` for `ws`                                                                                                       | High (hygiene)         | Small     |
| 7   | **Fix the `interactive` azure contrast token** (3.67:1 white-on-blue on every primary CTA; AA needs 4.5:1) and delete the axe carve-out — the remediation plan is already written in `e2e/a11y.spec.ts:11-17`                                                    | High (a11y)            | Small–Med |
| 8   | **Lazy-load `sharp`** in `shareCards.js` — a native module needed by 2 functions, currently loaded on every cold start of all ~150                                                                                                                               | High (latency)         | Tiny      |
| 9   | **Finish the App Check rollout** (site key in prod → watch metrics → flip the literal) — reduces the blast radius of every abuse finding at once                                                                                                                 | Med-High               | Small     |
| 10  | **Automate deploys:** auto-dispatch the functions deploy on `main` merges touching `functions/`; add a Firebase Hosting deploy step (or retire one host); add the test gate to `deploy-single-function.sh`                                                       | Med-High               | Medium    |
| 11  | **Promote Leagues into primary nav** (BottomNav + GameShell); surface Shop/Records; link or delete the orphaned `/retired-corps` and `/corps-history` pages                                                                                                      | Med-High (retention)   | Small     |
| 12  | **Fix job configs:** `weeklyMatchupPushJob` and `updateLeagueRivalries` run full-population scans at the default 60s timeout; `sweepDuplicateCorps` scans every profile ever into 256 MiB; `migrateUserProfiles`/`fixProfileFields` are bare `onCall`            | Med-High (reliability) | Small     |
| 13  | **Fix the corps-name reservation race** (`batch.create()` or transaction in `registerCorps.js`)                                                                                                                                                                  | Medium                 | Small     |
| 14  | **Decompose `LeagueDetailView.jsx`** onto React Query hooks; begin migrating the 26 manual-fetch components; de-`@ts-nocheck` the Leagues tree in the same pass                                                                                                  | Medium                 | Med-Large |
| 15  | **In-app notification inbox** (bell + unread badge) reusing the events the email jobs already compute — retention shouldn't depend on push-permission grants                                                                                                     | Medium (retention)     | Medium    |

---

## Security review

**Verified clean (both the rules-level review and the per-callable sweep):**
economy/XP/score/lineup fields are server-only, denylisted in rules, with
regression tests pinning past exploits (role self-grant, XP farming, lineup
forgery, invite-code enumeration); admin is the Firebase custom claim only —
every admin callable checked, `setUserRole` correctly gated, no escalation
path; all client writes cross-checked against rules — nothing forgeable
affects the game economy; lineup lock windows enforced server-side; BMAC
webhook verifies HMAC-SHA256 over the raw body, constant-time, before any
parsing; no hardcoded secrets (everything via `defineSecret`); storage rules
default-deny; server-rendered HTML/SVG/JSON-LD escaping is disciplined
including the `</script>` edge case; no SSRF (scraper targets are hardcoded
or discovered from dci.org's own sitemap; `page.evaluate` uses
structured-clone args); prompt-injection hardening (`promptSafety.js`)
applied to every user-derived Gemini field.

**Findings (medium → low):**

- **Med — `generateCorpsAvatar` has no rate limit**
  (`triggers/avatarGeneration.js:152-208`): bare `assertAuth`, then Gemini
  image generation + Cloudinary upload per call — the most expensive
  unthrottled callable in the codebase. Root cause is structural: the CI
  budget census scans `functions/src/callable/` only, while 20+ callables
  live in `triggers/`, and it matches per-file, not per-callable. Fix the
  callable and the census.
- **Med — Public news endpoints amplify cost** (`triggers/newsFeed.js`):
  `getRecentNews` accepts an unclamped `limit` (a `{limit: 100000}` call runs
  a 100k-doc collectionGroup read, unauthenticated); every cache miss writes
  a doc keyed by attacker-controlled `category`/`limit` — unbounded
  write/doc-mint amplification plus path injection on a write. Clamp with the
  existing `clampLimit`, allowlist `category`, sanitize the cache key.
- **Med — App Check enforcement globally disabled**
  (`functions/index.js:25`). Documented staged rollout; per-uid write budgets
  are the compensating control. Flipping it reduces the blast radius of every
  abuse finding above.
- **Med — Unbounded text fields:** `updateProfile` caps `displayName`/`bio`
  but not `location`/`favoriteCorps` (~1 MB strings on a world-readable doc);
  `submitNewsForApproval` has minimum lengths but no maximums and no write
  budget (also fans out email to all admins per submission); `reportComment`
  stores unvalidated client text with no cap or budget. Firestore rules also
  lack coarse size caps on owner-writable public profile fields.
- **Low/Med — Submitted article `imageUrl` has no scheme allowlist** and
  trusted authors publish automatically — allows `javascript:`/`data:` URLs
  and off-site tracking pixels in published articles. Allowlist http(s) and
  prefer re-hosting.
- **Low —** Admin UID list ships in the public bundle
  (`src/config/index.ts:80-86`) — discloses admin accounts; derive client
  admin state from claims only. `setUserRole` clobbers the whole custom-claims
  object and doesn't coerce `makeAdmin` to boolean. Scraper invoke key
  compared with `!==` instead of `timingSafeEqual`. Several doc-ids
  (`articleId`, `commentId`, `leagueId`) used unvalidated in paths — add a
  shared `assertDocId`. Pub/Sub scrape workers fetch `{url}` with no host
  allowlist (IAM-gated, defense-in-depth). Owner-forgeable notifications; and
  `useLeagueNotifications.ts:409-422` writes cross-user notifications
  client-side, which rules silently deny — a functional bug; move creation
  server-side. Legacy league namespace remains enumerable (documented
  tradeoff; verify `stripLeagueInviteCodes.js` ran).

## Backend correctness & structure

**Verified strong:** transactions on all money/state paths (purchases,
transfers, streaks, username changes — several with comments citing the exact
duplicate-identity bug they fixed); the nightly pipeline is protected by a
transactional per-(season, day) run lease with stale-lease takeover
(`scoringRunGuard.js`) plus per-user award-ledger idempotency tokens written
in the same document write as the coin/XP `increment` — textbook retry
safety; caption-change lock windows design away lineup-vs-scoring races;
structured logging dominates (726 `logger.*`, zero `console.*` in deployed
functions source); duplication engineered out (one scoring orchestrator with
per-season-type strategy objects).

**Findings:**

- **Med — Corps-name reservation race**
  (`callable/registerCorps.js:87-91,142`): non-atomic check-then-`batch.set`
  lets two concurrent registrations claim the same name; the duplicate-sweep
  machinery exists to clean up what this race creates. Use `batch.create()`
  or a transaction.
- **Med — `opsAlerts` only wired to the watchdog and canary.** Terminal
  failures of email/push/league-automation/leaderboard jobs are
  log-visibility only. Route all money-adjacent scheduled-job failures
  through `opsAlerts`.
- **Low** — `new Date().getFullYear()` in the live strategy breaks
  year-boundary backfills (`helpers/scoring.js:833,844`); profile
  `batch.update()` in the scoring commit fails a chunk if a profile was
  deleted mid-run; profanity filter is a three-word regex; 171 functions in
  one codebase is a heavy deploy surface (mitigated by the separate scraper
  codebase).

## Data-pipeline reliability (DCI scrape → score)

**Verified strong (top-decile):** transactional scoring lease with correct
stale-lease recovery; award-ledger closes the torn-commit double-pay hole;
zero-row and Cloudflare-challenge detection refuse to treat a plausible 200
as success; `lastScrapedDate` stamped only on real success; per-recap failure
isolation; poison-message vs transient-failure distinction in Pub/Sub
handlers; ancillary stages (Podium/Discord/fan-favorite) isolated so they can
never fail fantasy scoring; the watchdog's `findUnscoredNightProblem` catches
the hardest failure class (a night that leaves no evidence); DST handling is
the most carefully engineered part of the codebase — no DST bug found.

**Findings:**

- **High — Missing recap date silently mis-dates events**
  (`helpers/scraping.js:92-102`): an absent/unparseable date block falls back
  to scrape time (next UTC day at 1:30 AM ET), the day-join misses, and
  scoring silently falls back to regression while every health check reads
  green. Make unparseable dates a hard failure; promote the canary's
  date-block check from warning to problem.
- **High — The listing's authoritative `dateKey` is discarded**
  (`scheduled/liveScraper.js:53-97`): the scraper already knows the expected
  Eastern date per event but never validates the parsed recap against it.
  Thread it through and reject mismatches.
- **High — `historical_scores/{year}` is one unbounded array document**
  (`helpers/historicalScores.js:26-94`): a full season lands near Firestore's
  1 MiB cap; the merge will start failing mid-season with no size guard.
  Shard to an `events` subcollection (the `fantasy_recaps` refactor already
  demonstrates the pattern), or at minimum alert above ~700 KB.
- **Med** — the 1:30 AM scrape swallows all errors (a total failure writes no
  `scrape_runs` doc and exits green; detection deferred 3 hours); Discord/
  podium leases share `scoring_runs`, so a failed webhook pages the operator
  with a _critical scoring_ alert two nights running (add a `kind` field);
  `scrapeAttempts` increments _after_ the scrape, so a timing-out scrape
  burns unlimited proxy credits (increment before); `dciFetch`'s worst-case
  retry budget (~294s/URL) exceeds the canary's 120s timeout — a slow-proxy
  afternoon kills the canary before its alerting block runs; `processDciScores`
  has no `maxInstances` while its upstream is capped at 3 — deep scrapes
  stampede the year document; the watchdog's own core check is unwrapped and
  has no dead-man's switch; the offline importers do non-transactional
  whole-doc `set()` against the same document the live pipeline writes
  transactionally — running one during a live season can silently drop a
  scraped event.
- **Low** — regression-fallback nights are indistinguishable from real ones
  in `fantasy_recaps` (stamp `usedRegressionFallback: true`); the canary
  isn't wired into `manualTrigger` despite its docstring; event-date parsing
  depends on `TZ=UTC`; `dciArchiveImporter` ships with every deploy
  (missing from `firebase.json` ignore).

## Cost & performance (Cloud Functions)

**Verified strong:** purpose-built scaling helpers (`ChunkedWriter`,
`processAllInPages`, projected `select()` queries, `getAll` + `fieldMask` in
several hot paths); materialized snapshots (`seasonRankings`,
`computed/hotCorps`, news/sitemap caches) convert O(N) scans into 1-doc
reads; the lifetime-leaderboard staleness gate that skips full-population
rebuilds unless a season rolled over is the single best cost decision in the
repo.

**Findings:**

- **High — `sharp` loaded at module top-level** (`shareCards.js:15`) into
  every instance of every function; needed by exactly 2 of ~150. Move the
  `require` inside the handlers (every other heavy dep already follows that
  pattern); longer-term, split the public HTTP surface into its own codebase.
- **High — `podium/processor.js` N+1:** 2 sequential reads + 3 sequential
  writes per roster corps nightly, including a second full roster scan that
  re-reads state already held in memory. At scale this exceeds the 540s
  budget on latency alone. Carry state forward in a Map, batch reads with
  `getAll`, route writes through the already-imported `ChunkedWriter`.
- **High — Unbounded scans on hot or default-config paths:**
  `getActiveLineupKeys` (user-facing, uncached, O(active players) per call —
  materialize a computed doc like `hotCorps`); `sweepDuplicateCorps` (every
  profile ever, unprojected, into 256 MiB); `migrateUserProfiles`/
  `fixProfileFields` (bare `onCall`, 60s/256 MiB — cannot complete at scale
  and leave partial migrations); `getUserRankings`' post-rollover fallback is
  a thundering herd (O(A²) reads in one morning — serve stale instead).
- **Med** — `weeklyMatchupPushJob` and `updateLeagueRivalries` full-scan at
  the default 60s timeout (their three siblings each set 540s);
  `refreshLeagueActivityJob` reads full unmasked profile docs for every
  league membership daily and writes every league unconditionally (add
  `fieldMask`, skip no-op writes); `retentionStatsJob` reads every profile in
  the database nightly, unfiltered (move to incremental counters or weekly);
  email jobs call `admin.auth().getUser()` per user per day across three jobs
  (batch with `getUsers()` or cache email on the private doc); push fan-out
  reads 2 docs per recipient per job (prefetch with chunked masked `getAll`);
  the identical league matchup history is re-read by Sunday recaps and again
  by Monday rivalries (compute once); `leaguePools` has a silent `.limit(500)`
  cap plus a sequential per-league read inside the scoring run; supporter
  reconcile runs a sequential transaction per record (~5,000 × 2 round-trips
  vs a 300s timeout).
- **Low** — the 02:00–05:30 block stacks five separate full/near-full profile
  scans (scoring, rivals, lifetime, retention, league-activity); one
  consolidated scan feeding all five reducers would cut daily read volume
  ~60-70%. No `minInstances` anywhere (every interactive callable cold-starts);
  no explicit region in `setGlobalOptions`; several hand-rolled 400-op batch
  loops duplicate `ChunkedWriter`.

## Frontend architecture

**Verified strong:** all 27 routes lazy-load via `lazyWithRetry` (self-heals
stale-chunk 404s after deploys); Dashboard lazy-loads 15 modals; chart.js
behind `React.lazy`; framer-motion via `LazyMotion` exclusively; tuned
`manualChunks` with rationale comments; Zustand stores are textbook
singleton-listener wrappers with cleanup; every inspected `onSnapshot`
returns its unsubscribe; nearly all list queries carry `limit()`; single
ErrorBoundary implementation reused per-route; offline lineup replay queue.

**Findings:**

- **High — React Query adoption ~15% of where it should be.** 12 files use
  `useQuery`/`useMutation` while 26 components/pages hand-roll
  `useState`+`useEffect` fetching (Records, HallOfChampions, Admin + all six
  tabs, Schedule, SupportersWall, NewsFeed, MatchupDetailView, …), losing
  caching/dedup/retry the configured RQ layer already provides.
- **High — God component `LeagueDetailView.jsx` (821 lines):** 16 `useState`
  hooks, a ~300-line data effect, `fetchQuery` results copied into local
  state (cache invalidation never re-renders it), two `onSnapshot`
  subscriptions, and whole-season recap folding on the main thread per open —
  a mobile jank source. Decompose onto hooks; the query keys already exist in
  `src/lib/queryClient.ts:108-119`.
- **Med** — N+1 member-profile fan-out (`src/api/leagues.ts:367-380` — one
  full-profile `getDoc` per league member; batch with `documentId() in`
  chunks or serve display fields from a callable); caption-total formula
  duplicated 6+ times client-side plus once server-side (single
  `computeCaptionTotals()` before the weights ever change); 15+ components
  import `firebase/firestore` directly despite the complete `src/api` layer
  (enforce with `no-restricted-imports`); 115 `console.error` sites swallow
  errors without user feedback or reporter calls; `@ts-nocheck` debt (174
  files) is concentrated in precisely the most complex code (App, Dashboard,
  LeagueDetailView, ScoresParts, Admin tabs) while the typed half is the
  simpler half.
- **Low** — NewsFeed hand-rolls `useInfiniteQuery`; Google Fonts loaded at
  runtime (self-host for the offline-first PWA); two `<img>` missing
  `loading="lazy"`.

## Testing, tooling & deployment

**Verified strong:** 643 frontend + 1,183 backend tests all pass; backend
coverage gated at 70/80/85%; frontend coverage honestly measured
(`all: true`) and ratcheted; seven blocking CI jobs including
rules-against-emulator and Playwright e2e with an axe gate; build is clean
(~6s; largest eager chunk is the Firebase vendor at 144.7 kB gzip); docs are
accurate against the code; Dependabot + weekly audit + advisory ratchet.

**Findings:**

- **Med-High — Deploy gaps.** Functions deploys are `workflow_dispatch` only
  (production can silently lag `main`); the ~140-function batched deploy
  takes ~35 min and a mid-run failure leaves production half-deployed;
  Firebase Hosting has no deploy workflow while Vercel auto-deploys —
  configs are parity-checked but deployed builds are not;
  `deploy-single-function.sh` has no test gate.
- **Med — `@getbrevo/brevo` 2.5.0 pulls both critical advisories**
  (deprecated `request` SSRF + old `form-data`); v6 drops them — the single
  highest-value dependency action. Then `npm audit fix` for `ws`.
- **Med — Frontend unit coverage ~16%.** Hooks and Zustand stores are
  pure-ish and cheap to test; keep raising the ratchet floors.
- **Med — CI census blind spots** (root cause of two findings above): the
  callable-budget census only scans `functions/src/callable/` and matches
  per-file; extend to `triggers/` + `scheduled/` and per-callable granularity.
- **Low** — no root `typecheck` script; root `npm test` doesn't run
  functions/rules suites; `firebase-admin` major skew between `functions/`
  (13) and `functions-scraper/` (14); `firestore-tests/` runs firebase SDK 12
  while the app runs 11; no dev-mode env validation message;
  `moduleResolution: "bundler"`; the react-router advisory is RSC-mode CSRF —
  not applicable to this SPA; monitor rather than downgrade.

## UX, SEO & product

**Verified strong:** per-route SEO hook on all 14 public pages; dynamic
sitemap, SSR results pages, share landing pages + sharp-rendered OG cards
from live Firestore data; hosting-parity check; thoughtful robots.txt;
comprehensive PWA (build-stamped SW, per-route cache strategies, FCM push
with grant-rate analytics, install prompts, offline banner + replay);
mobile-first Tailwind tokens (44/48px touch targets, safe-area insets, dvh);
219 aria attributes, focus traps in 18/20 modals, route-change focus
management; dense engagement machinery (streaks, XP, challenges, predictions,
rivals, season ladder, recaps, six retention email types with per-type
opt-outs).

**Findings:**

- **High (product) — The valuable content is auth-walled.** `/scores`,
  `/profile/:userId`, `/leagues`, `/schedule` are login-only and disallowed
  in robots.txt; there are no public director/corps/leaderboard URLs to share
  or index. Reuse the `HallOfChampionsEntry` dual-shell pattern + existing
  SSR for public read-only `/d/:username` and `/corps/:id` routes.
- **High (a11y, documented) — CTA contrast carve-out:** `interactive` azure
  `#3B82F6` with white text is 3.67:1 on every primary button; the axe test
  excludes `color-contrast` with the remediation plan written in the comment.
  Note it's a 1-token fix only if UI-kit adoption consolidates first — only
  21 files import from `components/ui` against ~507 raw `<button>` elements.
- **Med** — Navigation buries the social loop (Leagues linked only from
  Profile, an article sidebar, and the 404 page; Shop only from the CorpsCoin
  modal; Records only inside Hall of Champions; `/retired-corps` and
  `/corps-history` have zero inbound links); no in-app notification inbox
  (users who deny push have no "what happened since I left" surface); no
  a11y/mobile e2e coverage of the authenticated app (the emulator seeding
  infra already exists); 20 bespoke modals use zero of the tested
  `ui/Modal.tsx`.
- **Low** — Hall of Champions is public+sitemapped but client-rendered only
  (social scrapers see default tags — SSR it like `/results`); bare
  `/results` noscript link may 404; hardcoded toast palette in `App.jsx`;
  `theme-color` duplicated for both schemes.

---

## Suggested sequencing

- **Week 1 (small, high-leverage):** avatar-gen rate budget + news-endpoint
  clamps; `maxInstances`; lazy `sharp`; brevo upgrade + `npm audit fix`;
  scrape-date hard-fail + `dateKey` validation; job timeout/memory configs;
  corps-name `batch.create()`; test gate in `deploy-single-function.sh`;
  Leagues into nav; root `typecheck` script.
- **Weeks 2–3:** `historical_scores` sharding; contrast-token split (after
  routing more buttons through `ui/Button`); App Check rollout completion;
  deploy automation; `opsAlerts` fan-out + `kind` field on scoring-run
  leases; census scope fix (triggers/scheduled, per-callable); podium
  processor batching.
- **Month 2:** public profile/corps pages with SSR OG cards; in-app
  notification inbox; `LeagueDetailView` decomposition as the flagship React
  Query migration (de-`@ts-nocheck` the Leagues tree in the same pass);
  consolidate the 02:00–05:30 profile-scan block.
- **Ongoing ratchets (keep the existing discipline):** RQ migration of the
  remaining manual-fetch components; frontend coverage floors upward;
  `ui/Modal`/`ui/Button` adoption; authed-app axe pass; field-size caps in
  rules and callables.

## Small residual items not fully verified

- Confirmation that `scripts/stripLeagueInviteCodes.js` ran against the
  legacy league namespace.
- Whether a bare `/results` (no path) request is served by
  `getResultsPageHttp` (the `index.html` noscript block links it).
