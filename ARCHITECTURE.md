# marching.art — Architecture

System design reference: the stack, how the code is organized, the Firestore
data model, the Cloud Functions surface, and the conventions that keep it
maintainable. For the game rules themselves see [`docs/GAMEPLAY.md`](docs/GAMEPLAY.md);
for progression/economy/engagement systems see [`docs/GAMIFICATION.md`](docs/GAMIFICATION.md).

> This file lives at the repo root. All other docs live under `docs/`.

## Tech stack

| Layer        | Technology                                                                                               |
| ------------ | -------------------------------------------------------------------------------------------------------- |
| Frontend     | React 18, Vite, Tailwind CSS, Framer Motion                                                              |
| State        | Zustand (client stores), React Query / TanStack Query (server cache)                                     |
| Backend      | Firebase — Auth, Firestore, Cloud Functions (2nd gen), Hosting, Storage                                  |
| AI / media   | Google Gemini (news + avatars), YouTube Data API v3                                                      |
| Hosting      | Firebase Hosting (`firebase.json`, `public: build`) and Vercel (`vercel.json`)                           |
| CI/CD        | GitHub Actions (`.github/workflows/{ci,deploy-functions,security,refresh-venue-gazetteer}.yml`), Node 22 |
| Monetization | Donation-only (Buy Me a Coffee); CorpsCoin is a closed-loop in-game currency, no real-money path         |

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
│   ├── lib/                 # Query client, low-level libs
│   ├── pages/               # Route components
│   ├── store/               # Zustand stores (scheduleStore, …)
│   ├── stories/             # Storybook stories
│   ├── types/               # TypeScript definitions
│   └── utils/               # Pure logic (scoring, seasonClock, corps, cosmetics, …)
├── functions/               # Firebase Cloud Functions (own package.json, Node 22)
│   ├── src/
│   │   ├── callable/        # HTTPS-callable endpoints (client-invoked)
│   │   ├── scheduled/       # Cron/scheduled jobs (nightly scoring, automation)
│   │   ├── triggers/        # Firestore/Auth triggers (scoring, news, avatars, email/push)
│   │   ├── helpers/         # Shared domain logic (scoring, economy, schedule, podium/, …)
│   │   ├── config/          # Runtime params (DATA_NAMESPACE, secrets)
│   │   └── scripts/         # One-off / operational scripts (calibration, harvesting, sims)
│   ├── dciArchiveImporter/  # Historical show-name importer (see its README)
│   └── pressboxImporter/    # Historical scores/rankings importer (see its README)
├── scripts/                 # Repo-level tooling (design census, class-registry sync check)
├── e2e/                     # Playwright specs
└── docs/                    # Documentation (this set)
```

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
users/{uid}/corpsCoinHistory/{id} # CorpsCoin ledger (subcollection — every transaction, typed)
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
```

### Top-level collections

```
game-settings/season              # Current season: name, status, seasonUid, currentPointCap,
                                  #   dataDocId, schedule{startDate,endDate}
game-settings/features            # Runtime feature kill-switches (e.g. podiumClass)
game-settings/config              # Operational config (e.g. heritageSchedulesEnabled)
schedules/{seasonId}              # The generated competition schedule (competitions[] array)
historical_scores/{year}          # Source DCI results that drive scoring & schedule generation
game-records/records              # The all-time Records Book (updated nightly + at archival)
seasons/{seasonId}                # Archived season history (champions, results)
youtubeCache/{id}                 # Cached YouTube search results (see docs/INTEGRATIONS.md)
```

> Note: the schedule is stored at **`schedules/{seasonId}` as a `competitions[]`
> array**, not on `game-settings/season`. See [`docs/SCHEDULE_SYSTEM.md`](docs/SCHEDULE_SYSTEM.md).

## Cloud Functions

Functions are organized by invocation model. Callables are client-invoked;
scheduled jobs run on cron; triggers fire on Firestore/Auth events. The bulk of
the domain logic lives in `helpers/` so it can be shared and unit-tested.

### Callable groups (`functions/src/callable/`)

| Area             | Files                                                                                              |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Users & profile  | `users.js`, `profile.js`                                                                           |
| Corps & lineups  | `corps.js`, `registerCorps.js`, `lineups.js`, `corpsDuplicates.js`                                 |
| Economy & shop   | `economy.js`, `shop.js`, `prestige.js`, `seasonLadder.js`                                          |
| Daily loop       | `dailyOps.js`, `dailyChallenges.js`, `dailyPredictions.js`, `journey.js`                           |
| Leagues          | `leagues.js`, `leagueInvitations.js`, `leaguePools.js`, `rookieLeague.js`                          |
| Social / content | `comments.js`, `articleComments.js`, `commentModeration.js`                                        |
| Podium           | `podium.js`, `podiumStaff.js`, `podiumRoute.js`, `podiumJoint.js`, `podiumFan.js`, `podiumHost.js` |
| Integrations     | `youtube.js`                                                                                       |
| Admin            | `admin.js`                                                                                         |

### Scheduled jobs (`functions/src/scheduled/`)

`dailyProcessors.js` / `nightlyStages.js` (the nightly scoring run),
`seasonScheduler.js` (season rollover), `leagueAutomation.js`,
`liveScraper.js` (live DCI score scraping), `lifetimeLeaderboard.js`,
`economyStats.js` (mint-vs-sink instrumentation), `rivalsComputation.js`,
`emailNotifications.js`, `pushNotifications.js`, `newsAutoPublish.js`.

### Triggers (`functions/src/triggers/`)

`scoreProcessing.js`, `scheduleProcessing.js`, `avatarGeneration.js`,
`newsGeneration.js` / `newsFeed.js` / `newsSubmissions.js` / `newsAdmin.js`,
`emailTriggers.js`, `pushTriggers.js`.

Every function is registered in `functions/index.js`.

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

`src/config/classRegistry.json` and `functions/src/helpers/classRegistry.js`
(the JSON mirror) are the single source of truth for per-class policy (point
caps, unlock gates, participation rewards, capabilities). Functions cannot import
outside their deploy root, hence the copy — they **must stay byte-identical**.
CI enforces it via `node scripts/checkClassRegistrySync.js --check`.

### Design-system census

`npm run census` reports design-token violations; `npm run census:check` is the
CI ratchet that fails any PR raising a frozen count. See
[`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md).

## Development

```bash
npm install          # frontend deps
npm run dev          # dev server
npm test             # unit tests
npm run build        # production build → build/
# Cloud Functions
cd functions && npm install && npm test
# Functions deploy via .github/workflows/deploy-functions.yml (or deploy-functions.sh)
```
