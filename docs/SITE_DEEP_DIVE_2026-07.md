# marching.art — Site Deep Dive & Recommendations (July 2026)

A full audit of the site across six dimensions — frontend architecture, backend
Cloud Functions, security, performance/cost, testing/CI, and product/engagement —
followed by five recommendations expected to produce substantial improvement.

## Implementation status (July 2026, same branch)

| Rec                   | Status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1 — Retention loop    | **Shipped.** Discord score-drop embed (nightly stage + `DISCORD_SCORES_WEBHOOK_URL` secret), morning FCM score-drop push, lineup-deadline reminders, matchup-result pushes. Email intentionally welcome-only (Brevo free tier).                                                                                                                                                                                                                                                                              |
| 2 — Growth surface    | **Plumbing shipped:** `/api/news` fixed on Vercel, hosting-parity CI check, Hall of Champions crawlable + sitemapped. **Remaining:** prerendered public score/champion pages and dynamic OG share cards (design-shaped project).                                                                                                                                                                                                                                                                             |
| 3 — Scores data path  | **Shipped:** registration-indexed scoring loop (was O(shows × all profiles)), rank writes only on movement, dark days skip the historical fetch, hourly (was 5-min) current-season recap staleness, non-blocking fonts. **Remaining:** nightly materialized standings doc + Scores-page consumption of it (larger client rework).                                                                                                                                                                            |
| 4 — Callable lockdown | **Shipped:** per-uid write budgets on economy/vote/notification mutations, hardened `sendCommentNotification`, scoped league `list` (live namespace) with 6 new rules-test pins, App Check enforcement wired as the `ENFORCE_APP_CHECK` deploy param (flip after console metrics confirm attestation).                                                                                                                                                                                                       |
| 5 — Regression safety | **Shipped:** captionStats award-ledger fix (real double-count bug), single scoring orchestrator (was ~95% duplicated), functions `checkJs` typecheck in CI (first run caught two production crashes: `reportComment` and `calculateCorpsStatisticsLogic` calling client-SDK APIs on firebase-admin), deploy tagging + rollback procedure, frontend coverage floors ratcheted to current. **Remaining:** authenticated emulator-backed e2e for the money paths; component tests for Dashboard/Leagues/Scores. |

## State of the site — summary

The codebase is in unusually good shape for a solo/small-team live-ops game.
Things that are genuinely strong and should be protected:

- **Data-layer discipline (frontend).** Three singleton realtime stores
  (profile/season/schedule) with documented single-source-of-truth rules, React
  Query for one-shot reads with sane defaults, cursor-paginated leaderboards,
  an offline lineup-save queue with replay, layered error boundaries, and
  per-route code splitting with stale-chunk retry (`src/utils/lazyWithRetry.ts`).
- **Economy integrity (security).** All currency/XP/rank fields are server-only,
  guarded in `firestore.rules` (`touchesProtectedProfileFields`,
  `touchesProtectedCorpsFields`) and verified by a real emulator rules suite
  (~130 assertions in `firestore-tests/rules.test.mjs`) that runs in CI _and_ as
  a deploy gate. Secrets live in Secret Manager; CSP is tight; XSS surface is
  effectively nil.
- **CI merge gate.** Seven blocking jobs (build, unit, typecheck, lint+ratchets,
  functions tests at 70/80/85 coverage, rules emulator, e2e smoke). The ratchet
  system (ts-nocheck census, path literals, design census, dependency audit,
  class-registry mirror) is a genuinely good mechanism for a migration codebase.
- **Backend scoring core.** Transaction-based run lease (`scoringRunGuard`),
  coin/XP award ledger for retry idempotency, watchdog job with alert emails,
  HMAC-verified webhook, centralized auth guards, strong unit coverage of
  scoring/economy helpers.

The material problems cluster in five areas, which map to the five
recommendations below:

| Area              | Problem in one line                                                                                                                                                                    |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retention         | The nightly score drop — the game's core beat — sends no notification of any kind.                                                                                                     |
| Growth            | Every interesting page (scores, champions, profiles) is auth-walled SPA content; sitemap has 6 URLs; no share cards. No viral or organic loop exists.                                  |
| Scores data path  | Scores page reads up to 49 unbounded recap docs and aggregates client-side; nightly job is O(all profiles × shows) with roster-wide write amplification and one real double-count bug. |
| Abuse surface     | Zero callables enforce App Check; ~40 auth-only callables (incl. economy mutations) have no rate limiting; any signed-in user can enumerate private leagues.                           |
| Regression safety | Frontend coverage ~13%, e2e is unauthenticated smoke only, functions are 0% TypeScript, 213 `@ts-nocheck` files, no deploy rollback story.                                             |

Full per-dimension findings follow the recommendations.

---

## The five recommendations

### 1. Close the daily retention loop: ship score-drop and lineup-deadline notifications

**Why this is #1.** Nightly scoring at ~2 AM ET is the product's heartbeat —
`docs/GAMIFICATION.md` calls it the core daily beat — yet nothing tells a player
their results are in. There is no "scores dropped" push or email, and the
notification types `LINEUP_REMINDER`, `MATCHUP_RESULT`, and email
`SHOW_REMINDER` are already declared in `functions/src/helpers/emailService.js`
and `pushService.js` **with no sender functions**. The infrastructure (push
tokens, email preferences, dedup, batching, rival-diff logic in
`emailNotifications.js`) already exists; only the senders are missing.

**What to build:**

- A morning score-drop push + email: "Results are in — you're #N in World
  Class; \<rival\> passed you." Reuse the rival-context logic already in the
  weekly digest. Trigger it from the end of the nightly pipeline so it never
  fires on a failed run.
- Wire the declared-but-unbuilt `LINEUP_REMINDER` before Saturday lock and
  caption-window resets.
- `MATCHUP_RESULT` for league matchup outcomes (league players are the
  highest-retention cohort; give them a reason to open the app after each
  matchup resolves).

**Expected impact:** this is the cheapest, highest-leverage retention change
available — it converts an existing nightly compute product into a daily
re-engagement channel using plumbing that already exists.

### 2. Build the public growth surface: crawlable results, share cards, and hosting parity

**Why.** The app is a pure SPA. Scores, leaderboards, Hall of Champions, and
profiles are auth-walled and/or robots-disallowed; `public/sitemap.xml` lists
**six** URLs; there is one static OG image. For a fantasy game whose natural
growth loop is players sharing standings and results, there is currently no
shareable artifact and no organic search surface at all.

**What to build:**

- Public, crawlable score/recap and champion pages (prerender or a lightweight
  render service for the read-only surfaces; the data is already
  world-readable per `firestore.rules`).
- Dynamic OG share cards (per-result, per-corps, per-champion) so a shared link
  shows the actual standing — this is the viral loop.
- Expand the sitemap and per-page meta; un-disallow `/hall-of-champions`.
- **Fix the live hosting drift found during the audit:** the `/api/news` →
  `getNewsFeedHttp` rewrite exists in `firebase.json` but is missing from
  `vercel.json`, so `/api/news` on Vercel returns the SPA shell. Add a CI
  parity check for the two hand-maintained hosting configs (headers/CSP are
  duplicated verbatim and will silently diverge again), mirroring the existing
  class-registry mirror check.

**Expected impact:** the only recommendation that creates _acquisition_ rather
than protecting existing users. SEO is compounding; share cards make every
score drop (rec #1) a distribution event.

### 3. Overhaul the scores data path: precompute standings, invert the nightly loop

**Why.** Both ends of the scores pipeline have the same shape problem —
computing per-reader/per-night what should be computed once:

- **Client read side:** `getSeasonRecaps` (`src/api/season.ts:99-109`) reads
  the _entire_ recap subcollection — up to 49 day-docs, each containing every
  show × corps result — with no limit, then `useScoresData.ts:504-576` builds
  all standings/caption ranks client-side, re-fetching every 5 minutes for the
  current season. A nightly materialized `standings/{seasonUid}/{class}` doc
  would collapse the Scores page from ~49 reads + heavy client compute to
  **1 read** (the lifetime leaderboard already follows exactly this
  precompute pattern — extend it).
- **Server write side:** `scoreShowsForDay` (`functions/src/helpers/scoring.js:156-312`)
  iterates every active profile per show — O(shows × all profiles) — and
  `commitDailyScoring` rewrites `seasonRank`/`seasonRankOf` for **every ranked
  corps every night** regardless of participation (`scoring.js:406-416`), so
  read and write volume scale with total roster, not nightly participants.
  Invert the loop using the show-registrations index (already materialized
  nightly by `lifetimeLeaderboard.js:137-169`) and skip rank writes when
  unchanged.
- **Also in this workstream:** batch the league member-profile N+1
  (`src/api/leagues.ts:326-339`, one `getDoc` per member), make the Google
  Fonts stylesheet non-render-blocking (`index.html:89-92`, ~100–300 ms FCP),
  and add width/format transforms for avatars rendered into ≤64 px boxes.

**Expected impact:** the largest Firestore cost and page-speed win available,
and it removes the scaling cliff in the nightly job before user growth (rec #1
and #2) turns it into a 540-second-timeout incident.

### 4. Lock down the callable surface: App Check enforcement, shared rate limiting, and the residual rules gaps

**Why.** Rules-level integrity is excellent, but the function surface is open:
**zero** of ~150 functions set `enforceAppCheck` (the client already attests —
`src/api/client.ts:92-113` — the backend just ignores it), and rate limiting is
used in only 1 of ~19 callable files. Economy mutations
(`unlockClassWithCorpsCoin`, `purchaseShopItem`, `submitPrediction`,
`castFanFavoriteVote`) are invokable by any script with one valid auth token,
unthrottled — an abuse _and_ billing risk.

**What to do:**

- Flip `enforceAppCheck: true` on callables (client rollout is already done).
- Apply the existing `rateLimit.js` helper as a default guard in
  `callableGuards.js` rather than per-file opt-in.
- Close three specific gaps found in review:
  - `sendCommentNotification` (`callable/comments.js:9-41`) lets any user write
    arbitrary-text notifications to any `recipientUid`, unthrottled — derive
    the message server-side and rate-limit it.
  - League `list` is open to all signed-in users (`firestore.rules:456`),
    exposing private leagues' member UID arrays — scope listing to
    `isPublic == true` or strip member arrays off the listable doc.
  - The catch-all subcollection read (`firestore.rules:242-247`) makes any
    _future_ user subcollection world-readable-to-authenticated unless
    denylisted — invert to an allowlist.
- Standardize admin on custom claims only (email fan-out still checks
  `profile.role === "admin"`, `helpers/emailService.js:719`).

**Expected impact:** eliminates the main abuse/cost vectors before recs #1–2
grow the (adversarial) audience, at small implementation cost since all the
building blocks exist.

### 5. Raise the regression-safety floor: retry-safe scoring, authenticated e2e, and type coverage where the money is

**Why.** The backend is well-tested but the safety net is uneven in exactly the
places changes are riskiest:

- **A real correctness bug:** `captionStats` increments in the nightly commit
  (`scoring.js:421-435`) have **no idempotency ledger** — unlike coins/XP — so
  a torn multi-batch commit followed by the scheduler's retry double-banks
  caption mastery. The inline comment claiming the lease prevents this is
  contradicted by `awardLedger.js:6-12`. Extend the existing award ledger to
  cover these increments.
- **~95% duplication** between the off-season and live-season scoring
  orchestrators (`scoring.js:480-656` vs `691-854`) means every payout/flow fix
  must be made twice — a standing correctness-drift risk in the game's most
  critical code. Extract the shared orchestration.
- **e2e covers nothing behind auth** (4 unauthenticated smoke specs against a
  fake Firebase config). Add emulator-backed authenticated Playwright flows for
  the money paths: onboarding → draft → lineup save → scores render → shop
  purchase.
- **Frontend coverage floor is ~13%** (15 of 166 component files tested) while
  functions are held to 70/80/85 — ratchet the frontend floor upward with
  tests for the big pages (Dashboard, Leagues, Scores).
- **Type safety where it matters most:** functions are 0% TypeScript and 213
  frontend files are `@ts-nocheck`. Enable `checkJs` over `functions/src`
  (scoring/economy first) and keep paying down the nocheck ratchet.
- **Deploy rollback:** tag function deploys and add a one-click redeploy-prior-tag
  job — today a bad deploy near the 1:30–2:00 AM scoring window has no fast undo.

**Expected impact:** directly fixes one live double-count bug, and converts the
codebase's biggest ongoing risk (unprotected change velocity in scoring/economy
and the logged-in UI) into a guarded path — which is what makes recs #1–4 safe
to ship quickly.

---

## Smaller items worth picking up opportunistically

- Decide **Podium's fate** — an entire second game sits complete but dark
  behind `game-settings/features.podiumClass`. Dark-launch to a cohort with a
  date, or shelve explicitly; leaving it dark strands the investment.
- Onboarding still seeds `execution/morale/equipment/readiness` — systems
  explicitly cut per `GAMIFICATION.md`. Stop writing dead data.
- `sharp` is a devDependency with no pipeline invoking it — wire it up or drop it.
- `src/stories/` is dead CRA/Storybook scaffolding (no config, no stories) — delete.
- `/styleguide` is a dev reference exposed on a public route.
- Recurring CorpsCoin sinks are thin (mostly one-time cosmetics) versus
  perpetual faucets — add seasonal/consumable sinks to keep the economy
  meaningful across multi-year careers.
- Public league discovery + shareable invite links would turn the
  best-built retention system (leagues) into an acquisition channel.

## Per-dimension audit notes

### Frontend (React/Vite)

- ~88k LOC, 178 components, 32 lazy routes. Routing/code-splitting mature
  (`lazyWithRetry`, per-route Suspense skeletons, hover prefetch).
- State: 3 singleton Zustand realtime stores + React Query for one-shot reads;
  no competing sources of truth; `queryClient.clear()` on sign-out.
- Weaknesses: 213 `@ts-nocheck` files; 176 `.jsx` vs 46 `.tsx`; ~39 files
  > 500 lines (8 >750, incl. `App.jsx` at 757 mixing routing + 6 global
  > side-effects); recurring `*Parts` files split by size not concern; no form
  > library across ~20 hand-validated modals.
- UX robustness strong: error boundaries at 3 layers, offline banner + queued
  lineup saves, aria-live toasts, skip-to-content and route-change focus.

### Backend (Cloud Functions)

- ~150 exported 2nd-gen functions (127 onCall sites, 27 schedules, 11 Firestore
  triggers, 8 pub/sub, 4 HTTP). No `minInstances`/`concurrency` tuning
  anywhere; ~120 functions on default memory/timeout.
- Nightly pipeline: run-lease idempotency + coin/XP ledger + watchdog are
  solid; gaps are the `captionStats` ledger hole, non-atomic multi-batch
  commits, roster-wide rank rewrites, and the O(profiles × shows) loop shape.
- All active profiles are loaded into memory nightly (paged reads, projected
  fields — good — but fully accumulated in a fixed 512 MiB job).
- Importers/scripts (`dciArchiveImporter`, 14 one-off production scripts) are
  human-in-the-loop with only `--dry-run` guards.

### Security

- No critical findings. Server-only economy fields, default-deny Storage,
  Secret Manager for all keys, strict CSP, no raw HTML injection of user/AI
  content, comprehensive rules test suite.
- Ranked residuals (all addressed in rec #4): App Check unenforced; league
  enumeration; notification-spam callable; subcollection catch-all default;
  dual admin source of truth.

### Performance/cost

- Bundle healthy: heavy deps (chart.js, framer-motion, confetti) deferred;
  largest chunk is the Firebase SDK vendor bundle (478 kB / 145 kB gz).
- Main wins are the Scores read path (rec #3), render-blocking fonts,
  full-res avatars in small boxes, league member N+1.
- No list virtualization anywhere — only matters for the full-season Archive
  view today.

### Testing/CI/DX

- CI merge gate strong (7 blocking jobs + ratchets); deploys manual and
  test-gated on the exact ref; both deploy scripts derive the function list
  from `index.js` so they cannot drift.
- Gaps: frontend coverage ~13%; e2e unauthenticated only; functions 0% TS;
  no rollback mechanism; hosting-config drift between Firebase and Vercel
  unguarded (one live break found: `/api/news` on Vercel).

### Product/engagement

- Feature set deep and largely complete: 4 fantasy classes, leagues with
  matchups/pools/rivalries, daily challenges/predictions, streaks, shop,
  prestige, journey questline, Gemini news engine, guest preview, strong
  onboarding (time-to-first-fun in minutes).
- Gaps: silent score drop (rec #1); no public/shareable surface (rec #2);
  declared-but-unbuilt reminder notification types; Podium dark; invite-only
  league discovery; thin recurring coin sinks.
