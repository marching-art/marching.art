# marching.art — Architecture

System design reference: the stack, how the code is organized, the Firestore
data model, the Cloud Functions surface, and the conventions that keep it
maintainable. For the game rules themselves see [`docs/GAMEPLAY.md`](docs/GAMEPLAY.md);
for progression/economy/engagement systems see [`docs/GAMIFICATION.md`](docs/GAMIFICATION.md).

> This file lives at the repo root. All other docs live under `docs/`.

## Tech stack

| Layer        | Technology                                                                                                                  |
| ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Frontend     | React 18, Vite (Rolldown), Tailwind CSS, Framer Motion                                                                      |
| State        | Zustand (client stores), React Query / TanStack Query (server cache)                                                        |
| Backend      | Firebase — Auth, Firestore, Cloud Functions (2nd gen, two codebases), Hosting, Storage                                      |
| AI / media   | Google Gemini (news + avatars), YouTube Data API v3                                                                         |
| Hosting      | Firebase Hosting (`firebase.json`, `public: build`) and Vercel (`vercel.json`), kept in sync by a CI parity check           |
| CI/CD        | GitHub Actions (`.github/workflows/{ci,deploy-functions,deploy-hosting,security,refresh-venue-gazetteer}.yml`), Node 22     |
| Monetization | Donation-only (Buy Me a Coffee, cosmetic recognition only); CorpsCoin is a closed-loop in-game currency, no real-money path |

## Project structure

```
marching.art/
├── src/                     # React frontend
│   ├── api/                 # Firebase callable wrappers + client (paths, query client)
│   ├── components/          # UI components (feature folders + ui/ design system)
│   ├── config/              # Client config, classRegistry.json (mirror), feature flags
│   ├── context/             # React context providers (auth, etc.)
│   ├── data/                # Static/reference data
│   ├── hooks/               # Custom hooks (useDashboardData, useFeatures, usePodium, …)
│   ├── lib/                 # Query client, error reporter, offline queue, low-level libs
│   ├── pages/               # Route components
│   ├── store/               # Zustand stores (scheduleStore, …)
│   ├── types/               # TypeScript definitions
│   └── utils/               # Pure logic (scoring, seasonClock, corps, cosmetics, …)
├── functions/               # Firebase Cloud Functions — "default" codebase (own package.json, Node 22)
│   ├── src/
│   │   ├── callable/        # HTTPS-callable endpoints (client-invoked)
│   │   ├── scheduled/       # Cron/scheduled jobs (nightly scoring, drop dispatch, automation)
│   │   ├── triggers/        # Firestore/Auth triggers + the onRequest endpoints (sitemap, OG cards, results pages)
│   │   ├── helpers/         # Shared domain logic (scoring, economy, schedule, podium/, …)
│   │   ├── config/          # Runtime params (DATA_NAMESPACE, secrets)
│   │   └── scripts/         # One-off / operational scripts (calibration, harvesting, sims)
│   ├── dciArchiveImporter/  # Historical show-name importer (see its README)
│   └── pressboxImporter/    # Historical scores/rankings importer (see its README)
├── functions-scraper/       # "scraper" codebase — isolated Puppeteer upcoming-events scraper
├── scripts/                 # Repo-level tooling (censuses, ratchets, sync/parity checks, backup setup)
├── e2e/                     # Playwright specs (+ seedEmulator.mjs for the emulator-backed run)
├── firestore-tests/         # Firestore security-rules regression suite (emulator)
├── public/                  # Static assets, PWA manifest, service worker
└── docs/                    # Documentation (this set)
```

### The two functions codebases

`firebase.json` declares two deploy codebases so the heavy scraper never
inflates cold starts for the rest of the backend:

| Codebase  | Source               | Why separate                                                                          |
| --------- | -------------------- | ------------------------------------------------------------------------------------- |
| `default` | `functions/`         | The game backend — callables, scheduled jobs, triggers, HTTP endpoints                |
| `scraper` | `functions-scraper/` | Puppeteer + Chromium for `dci.org/events/`; 2 GB memory, isolated deps and cold start |

The main codebase calls into the scraper over HTTP, authenticated with the
`SCRAPER_INVOKE_KEY` shared secret.

## Firestore data model

All app data is namespaced under `artifacts/{DATA_NAMESPACE}/…` (the namespace
is a deploy-time param; production is `marching-art`). Path construction is
centralized — never hand-write path strings:

- Backend: `functions/src/helpers/paths.js`
- Frontend: `src/api/client.ts`

### Namespaced collections (`artifacts/{ns}/…`)

```
users/{uid}/profile/data          # The main profile: xp, level, corpsCoin, unlockedClasses,
                                  #   cosmetics, trophies, lifetimeStats, seasonLadder, streak…
users/{uid}/private/data          # Private user data
users/{uid}/corps/{class}         # Registered corps per fantasy class (lineup, selectedShows)
users/{uid}/corpsCoinHistory/{id} # CorpsCoin ledger (subcollection — every transaction, typed;
                                  #   callable-only reads, even for the owner)
users/{uid}/podium/{state,career} # Podium simulation state + career
users/{uid}/notifications/…       # In-app + league notifications
leagues/{leagueId}                # League config
leagues/{leagueId}/standings/current
leagues/{leagueId}/matchups/week-{n}
leagues/{leagueId}/activity/{id}  # League feed events
leagues/{leagueId}/recaps/week-{n}
leagueInvitations/{id}
leaderboard/lifetime_{view}       # Precomputed lifetime leaderboards
leaderboard/season_rankings/data  # Precomputed current-season global rankings
show_registrations/{seasonUid}/events/{eventKey}
                                  # Materialized "who's attending" index (server-only;
                                  #   read via the getShowRegistrations callable)
supporters/{emailHash}            # Buy Me a Coffee supporters — PII, backend-only, no client
                                  #   read/write (see docs/BMAC_SUPPORTERS.md)
```

### Top-level collections

```
game-settings/season              # Current season: name, status, seasonUid, currentPointCap,
                                  #   dataDocId, schedule{startDate,endDate}
game-settings/features            # Runtime feature kill-switches (podiumClass, dropScheduling);
                                  #   a missing doc or field means OFF (helpers/features.js)
game-settings/config              # Operational config (e.g. heritageSchedulesEnabled)
schedules/{seasonId}              # The generated competition schedule (competitions[] array)
historical_scores/{year}          # Source DCI results that drive scoring & schedule generation
fantasy_recaps/{seasonUid}/days/{d}
                                  # Per-day results written by the nightly run
fantasy_standings/{seasonUid}[/classes/{class}]
                                  # Nightly materialized season standings — the Scores page
                                  #   reads these docs instead of aggregating every recap day
drop_plans/{showDateET}           # Tonight's score-drop plan: drop/scrape instants, zones, mode,
                                  #   attempt counts. Public; the client's countdown target
scoring_runs/{leaseId}            # Run leases + award ledger that make nightly scoring
                                  #   retry-idempotent (helpers/scoringRunGuard.js, awardLedger.js)
rate_{bucket}/{uid}               # Per-uid callable write budgets. Server-only: no rules match
admin-stats/{economy,retention,scrapeCanary}
                                  # Admin dashboards (see docs/GAMIFICATION.md "Instrumentation")
game-records/records              # The all-time Records Book (updated nightly + at archival)
season_champions/{seasonId}       # Archived champions — the Hall of Champions + sitemap source
seasons/{seasonId}                # Archived season history (champions, results)
podium-config/{curves,balance,podiumSeasons}
                                  # Podium runtime overrides — hot-tunable without a deploy
podium-recaps/{seasonUid}/…       # Podium day results, power rankings, standings
news_hub/…                        # Generated articles + community submissions
news_feed_cache/{id}              # Cached `/api/news` payload and the rendered `sitemap_xml`
youtubeCache/{id}                 # Cached YouTube search results (see docs/INTEGRATIONS.md)
```

> Note: the schedule is stored at **`schedules/{seasonId}` as a `competitions[]`
> array**, not on `game-settings/season`. See [`docs/SCHEDULE_SYSTEM.md`](docs/SCHEDULE_SYSTEM.md).

`firestore.rules` is the authoritative list — anything without an explicit
`match` block is denied. The user-subcollection catch-all is **default-private**
(owner or admin only), so a new subcollection is never accidentally
world-readable; give it its own match block if it needs public reads.

## Cloud Functions

Functions are organized by invocation model. Callables are client-invoked;
scheduled jobs run on cron; triggers fire on Firestore/Auth events. The bulk of
the domain logic lives in `helpers/` so it can be shared and unit-tested.

### Abuse protection on callables

- **Auth guards** — every callable goes through `assertAuth`/`assertAdmin`
  (`helpers/callableGuards.js`); admin is the Firebase custom claim only.
- **Write budgets** — every user-facing mutation callable throttles per-uid via
  `assertAuthWithBudget(db, request, bucket)` (or the two-step
  `assertAuth` + `assertWriteBudget(db, uid, bucket)` when the db handle isn't
  in scope yet). Budgets are windowed and set far above any human rate, backed
  by server-only `rate_{bucket}` collections; bookkeeping failures fail open, so
  the guard can never take a feature down. Place the check **after** input
  validation so invalid calls never burn budget and validation-only tests never
  touch Firestore. `scripts/callableBudgetCensus.mjs --check` fails CI on any
  callable file that ships with neither a budget nor an admin gate;
  genuinely read-only files are exempted with a reason in
  `scripts/callable-budget.baseline.json`.
- **App Check** — enforcement for all callables is a single literal in
  `functions/index.js` (`setGlobalOptions({ enforceAppCheck: false })`). The
  client already attests; the flip and its preconditions are under
  [Security](#security) below.

### Callable groups (`functions/src/callable/`)

| Area             | Files                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Users & profile  | `users.js`, `profile.js`                                                                                                  |
| Corps & lineups  | `corps.js`, `registerCorps.js`, `lineups.js`, `corpsDuplicates.js`                                                        |
| Economy & shop   | `economy.js`, `shop.js`, `prestige.js`, `seasonLadder.js`, `legacy.js` (Legacy Endowments — the recurring sink)           |
| Daily loop       | `dailyOps.js`, `dailyChallenges.js`, `dailyPredictions.js`, `journey.js`                                                  |
| Leagues          | `leagues.js`, `leagueInvitations.js`, `leaguePools.js`, `rookieLeague.js`                                                 |
| Social / content | `comments.js`, `articleComments.js`, `commentModeration.js`                                                               |
| Podium           | `podium.js`, `podiumStaff.js`, `podiumRoute.js`, `podiumJoint.js`, `podiumFan.js`, `podiumHost.js`, `podiumValidation.js` |
| Supporters       | `supporters.js` (BMAC link/wall/visibility — see [`docs/BMAC_SUPPORTERS.md`](docs/BMAC_SUPPORTERS.md))                    |
| Integrations     | `youtube.js`                                                                                                              |
| Admin            | `admin.js`                                                                                                                |

### Scheduled jobs (`functions/src/scheduled/`)

| File                                             | What it runs                                                                                                  |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| `dailyProcessors.js` / `nightlyStages.js`        | The nightly scoring run, split into isolated stages behind one run lease                                      |
| `dropDispatcher.js`                              | The timezone-aware score-drop dispatcher + `podiumNightly` (see [`docs/SCORE_DROPS.md`](docs/SCORE_DROPS.md)) |
| `scoringWatchdog.js`                             | 4:30 AM ET check that the night actually scored; emails admins if not                                         |
| `liveScraper.js`                                 | Live DCI score scraping (legacy 1:30 AM path when `dropScheduling` is off)                                    |
| `scrapeCanary.js`                                | Afternoon dci.org markup-drift audit, so a redesign surfaces before scoring night                             |
| `seasonScheduler.js`                             | Season rollover                                                                                               |
| `leagueAutomation.js`                            | League matchups, standings, recaps                                                                            |
| `lifetimeLeaderboard.js`                         | Nightly lifetime leaderboards, season rankings, show-registration index                                       |
| `economyStats.js`                                | Weekly CorpsCoin mint-vs-sink rollup → `admin-stats/economy`                                                  |
| `retentionStats.js`                              | Nightly DAU/WAU/MAU + cohort retention rollup → `admin-stats/retention`                                       |
| `rivalsComputation.js`                           | Rivalry detection                                                                                             |
| `supporterReconcile.js`                          | Nightly BMAC reconcile — revokes lapsed memberships                                                           |
| `emailNotifications.js` / `pushNotifications.js` | Digest email + FCM sends (incl. the morning score-drop push)                                                  |
| `newsAutoPublish.js`                             | Scheduled article publication                                                                                 |

### Triggers and HTTP endpoints (`functions/src/triggers/`)

Firestore/Auth triggers: `scoreProcessing.js`, `scheduleProcessing.js`,
`avatarGeneration.js`, `newsGeneration.js` / `newsFeed.js` /
`newsSubmissions.js` / `newsAdmin.js`, `emailTriggers.js`, `pushTriggers.js`.

The same folder also holds the `onRequest` endpoints behind the hosting
rewrites — the public, crawlable, auth-free surface:

| Route                     | Function             | Source            | Serves                                                             |
| ------------------------- | -------------------- | ----------------- | ------------------------------------------------------------------ |
| `/api/news`               | `getNewsFeedHttp`    | `newsFeed.js`     | The news feed JSON (cached in `news_feed_cache`)                   |
| `/sitemap.xml`            | `getSitemapHttp`     | `sitemap.js`      | A live sitemap built from Firestore (seasons, champions, articles) |
| `/api/og/**`              | `getOgCardHttp`      | `shareCards.js`   | Dynamic OG share-card images (live score / champion)               |
| `/share/**`               | `getShareHttp`       | `shareCards.js`   | Share landing pages carrying those OG tags                         |
| `/results`, `/results/**` | `getResultsPageHttp` | `resultsPages.js` | Server-rendered season and per-day standings, styled like the site |

Plus `bmacWebhook` (HMAC-verified Buy Me a Coffee membership events).

> `onRequest` endpoints and event triggers are unaffected by the App Check
> global option, which applies to callables only.

Every function is registered in `functions/index.js`; both deploy scripts derive
their function list from that file, so they cannot drift from it.

## Design system

The UI is built on a token-driven "data-terminal" design system (charcoal
surfaces, gold for brand/reward, azure for interaction, green/red for trend),
enforced by a CI census. Full spec, tokens, and contributor rules in
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md). The design primitives live in
`src/components/ui/`.

## Code conventions

These are enforced softly (ESLint warnings + CI visibility) so they guide
without blocking.

### File size / "god-files"

- **Target: keep files under ~700 lines.** ESLint's `max-lines` rule warns past
  that threshold (blanks/comments excluded) — an intentional tech-debt signal,
  not a build failure.
- When a file trips the warning, **split it**: extract pure logic into a
  `src/utils/` (or co-located `*Utils.ts`) module with unit tests; extract
  self-contained sub-components into their own files; extract stateful logic into
  a hook under `src/hooks/`. Examples already in the tree:
  `src/utils/dashboardScoring.ts`, `src/utils/scoresUtils.ts`,
  `src/hooks/useAppBootstrap.ts` (App.jsx's global side effects),
  `src/components/Profile/SettingsModal.jsx`.

### TypeScript migration

The codebase migrates from JS/JSX to TS/TSX incrementally (`allowJs` on, so both
coexist). **Write new files in TypeScript.** When you extract logic out of a
`.jsx` file, put the extracted module in `.ts`. Prefer explicit types on exported
functions and module boundaries.

### Testing extracted logic

Anything extracted into a `utils`/`*Utils` module ships with Vitest unit tests
(frontend) or `node:test` / vitest tests (Cloud Functions — see the many
`*.test.js` files under `functions/src/`). Make time-dependent helpers testable
by accepting an injectable clock (e.g. `now: Date = new Date()`) instead of
reading the wall clock internally.

### The class registry must stay in sync

`functions/src/config/classRegistry.json` is the **canonical** source of truth
for per-class policy (point caps, unlock gates, registration-lock weeks,
participation rewards, capabilities); `src/config/classRegistry.json` is its
client mirror. Functions cannot import outside their deploy root, hence the two
copies — they **must stay byte-identical**. Edit the functions copy, then run
`node scripts/checkClassRegistrySync.js --fix` to sync the mirror; the CI lint
job runs the same script with no flag (checking is its default mode — there is
no `--check` flag).

Read the registry through its accessors, never by re-declaring values:
`functions/src/helpers/classRegistry.js` on the backend, `src/utils/classRegistry`
on the client. Presentation (labels, colors, `CORPS_CLASS_ORDER`) stays in
`src/utils/corps.ts`.

### Design-system census

`npm run census` reports design-token violations; `npm run census:check` is the
CI ratchet that fails any PR raising a frozen count. See
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

## CI gates

`.github/workflows/ci.yml` runs seven blocking jobs on every PR into `main`:
**build**, **unit tests** (with ratcheted coverage floors in `vite.config.js`),
**typecheck** (`tsc --noEmit` for the app, plus `checkJs` over `functions/`),
**lint**, **functions check + tests** (own coverage floors), **Firestore rules**
against the emulator, and **Playwright e2e** — a smoke pass plus an
emulator-backed core-loop run seeded by `e2e/seedEmulator.mjs`, with an axe
accessibility gate.

The lint job carries the ratchets. Each freezes a count as a CI ceiling so a
migration can only converge; when a counter hits zero its rule becomes a hard
error:

| Check                            | Command                                         | Baseline                                           |
| -------------------------------- | ----------------------------------------------- | -------------------------------------------------- |
| Prettier formatting              | `npm run format:check`                          | — (the functions codebases are `.prettierignore`d) |
| Design-system tokens             | `npm run census:check`                          | `scripts/design-census.baseline.json`              |
| Class-registry mirror            | `node scripts/checkClassRegistrySync.js`        | — (byte-identical or fail)                         |
| Hosting-config parity            | `node scripts/checkHostingParity.mjs`           | — (`firebase.json` vs `vercel.json`)               |
| Hand-written Firestore paths     | `node scripts/checkPathLiterals.mjs`            | `scripts/path-literals.baseline.json`              |
| `@ts-nocheck` headers            | `npm run ts-nocheck:check`                      | `scripts/ts-nocheck.baseline.json`                 |
| Callable write budgets           | `node scripts/callableBudgetCensus.mjs --check` | `scripts/callable-budget.baseline.json`            |
| Production-dependency advisories | `npm run audit:check`                           | `scripts/audit-baseline.json`                      |

The hosting-parity check exists because both hosts duplicate the same headers,
CSP, and function rewrites by hand — that exact drift once broke `/api/news` on
Vercel. Add a rewrite or header to one config and you must add it to the other.

## Security

Access control is enforced by `firestore.rules` and `storage.rules` (both
deployed via `firebase.json`), with regression tests in
`firestore-tests/rules.test.mjs` that run in CI **and** as a deploy gate.
Privileged mutations go through callables (the Admin SDK bypasses rules).
Currency, XP, and rank fields are server-only, pinned by
`touchesProtectedProfileFields` / `touchesProtectedCorpsFields`. Admin is the
Firebase custom claim only — there is no `profile.role` path.

**App Check: the client attests, the backend does not yet enforce.** The web app
initializes App Check with reCAPTCHA v3 when configured
(`initializeAppCheckIfConfigured` in `src/api/client.ts`), but enforcement for
callables is still `setGlobalOptions({ enforceAppCheck: false })` in
`functions/index.js`. To finish the rollout: watch the Firebase console's App
Check metrics for Functions until real traffic shows as verified, then change
that literal to `true` and run a full deploy. Flipping it blind locks out users
still running a stale cached bundle. Keep it a plain literal — a `defineBoolean`
param resolves during deploy discovery and hard-fails non-interactive deploys.

## Development

Access control is enforced by `firestore.rules` and `storage.rules` (both
deployed via `firebase.json`), with regression tests in
`firestore-tests/rules.test.mjs`. Privileged mutations go through callables
(Admin SDK bypasses rules).

**App Check is not currently enabled.** Firestore, Functions, and Storage
accept requests from any client that can authenticate; abuse resistance relies
on security rules and callable-side validation. Enabling it would require
registering the web app with an attestation provider (reCAPTCHA
Enterprise/v3) in the Firebase console, shipping the site key and App Check
initialization in the client, a monitor-only rollout before enforcement, and
debug tokens for local/emulator development — do not flip enforcement on
without those steps or all production clients break.

## Development

```bash
npm install          # frontend deps
npm run dev          # dev server
npm test             # unit tests
npm run build        # production build → build/
# Cloud Functions
cd functions && npm install && npm test
# Firestore security rules (needs a JDK 21+ for the emulator)
cd firestore-tests && npm install && npm test
# Deploys are automatic on push to main: deploy-functions.yml (backend paths,
# test-gated) and deploy-hosting.yml (frontend paths → Firebase Hosting);
# both also support workflow_dispatch. deploy-functions.sh remains for local use.
```

Backups, restore, and deploy rollback are documented in
[`docs/OPERATIONS.md`](docs/OPERATIONS.md).
