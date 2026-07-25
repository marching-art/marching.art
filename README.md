# marching.art — Fantasy Drum Corps 🎺🏆

marching.art is a year-round fantasy drum corps game. Directors build a virtual
corps by drafting captions from real historical DCI performances, register for a
weekly schedule of shows, and compete on nightly-scored leaderboards — season
after season, as a decades-long director career.

The game runs two alternating season types back-to-back all year:

- **Live Season** — fantasy competition driven by _real_ DCI scores during the
  summer touring season.
- **Off-Season** — the same fantasy format driven by _historical_ DCI results,
  so the game never stops between summers.

Both run on an identical **49-day / 7-week** competition calendar. See
[`docs/GAMEPLAY.md`](docs/GAMEPLAY.md) for the full ruleset.

## The five classes

| Class           | Format         | Point cap | Notes                                                                                             |
| --------------- | -------------- | --------- | ------------------------------------------------------------------------------------------------- |
| **SoundSport**  | Fantasy lineup | 90        | Open to everyone; unranked (participation-focused)                                                |
| **A Class**     | Fantasy lineup | 60        | Unlock by completing 1 season / Level 3 / 1,000 CC                                                |
| **Open Class**  | Fantasy lineup | 120       | Unlock by completing 2 seasons / Level 5 / 2,500 CC                                               |
| **World Class** | Fantasy lineup | 150       | Unlock by completing 3 seasons / Level 10 / 5,000 CC                                              |
| **Podium**      | Director sim   | —         | A separate simulation game (rehearsals, divisions, staff). See [`docs/PODIUM.md`](docs/PODIUM.md) |

The four fantasy classes share one lineup-and-scoring engine (draft 8 captions,
score nightly). **Podium** is a distinct director-simulation mode with its own
rules, launched mid-2026.

## Tech stack

| Layer        | Technology                                                                                              |
| ------------ | ------------------------------------------------------------------------------------------------------- |
| Frontend     | React 18, Vite, Tailwind CSS, Framer Motion                                                             |
| State        | Zustand (client), React Query / TanStack Query (server cache)                                           |
| Backend      | Firebase — Auth, Firestore, Cloud Functions, Hosting, Storage                                           |
| AI           | Google Gemini (news generation, corps avatars) · YouTube Data API                                       |
| Hosting      | Firebase Hosting (`firebase.json`) and Vercel (`vercel.json`)                                           |
| CI/CD        | GitHub Actions (`.github/workflows/`) · Node 22                                                         |
| Monetization | Donation-only (Buy Me a Coffee). CorpsCoin is a closed-loop, in-game currency — no real-money purchases |

## Getting started

Prerequisites: **Node 22+**, npm, and a Firebase project.

```bash
npm install
cp .env.local.example .env.local   # fill in your Firebase + API credentials
npm run dev                        # start the Vite dev server
```

Common scripts:

```bash
npm run dev             # dev server
npm run build           # production build (outputs to build/)
npm test                # Vitest unit tests
npm run test:coverage   # unit tests + the ratcheted coverage floors CI enforces
npm run test:e2e        # Playwright end-to-end tests
npm run lint            # ESLint
npm run format          # Prettier
npm run census          # design-system token census (see docs/DESIGN_SYSTEM.md)
npm run census:check    # design-system CI ratchet
npm run ts-nocheck:check # @ts-nocheck census ratchet
npm run audit:check     # production-dependency advisory ratchet
```

CI runs seven blocking jobs (build, unit tests + coverage, typecheck, lint +
ratchets, functions tests, Firestore rules against the emulator, Playwright
e2e). See [`ARCHITECTURE.md`](ARCHITECTURE.md#ci-gates) for what each ratchet
freezes.

Cloud Functions live in two deploy codebases with their own `package.json`s —
`functions/` (the game backend) and `functions-scraper/` (the isolated
Puppeteer upcoming-events scraper). Both deploy via the `deploy-functions.yml`
GitHub Actions workflow (or `deploy-functions.sh`).

## Documentation

| Doc                                                                | What it covers                                                                                                                       |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| [`ARCHITECTURE.md`](ARCHITECTURE.md)                               | System design: stack, project structure, Firestore data model, Cloud Functions & scheduled jobs, CI gates, code conventions          |
| [`docs/GAMEPLAY.md`](docs/GAMEPLAY.md)                             | The rules of play: seasons, classes, caption selection & scoring, change windows, show registration, championships                   |
| [`docs/PODIUM.md`](docs/PODIUM.md)                                 | The Podium director-simulation class — full design                                                                                   |
| [`docs/SCHEDULE_SYSTEM.md`](docs/SCHEDULE_SYSTEM.md)               | Season & schedule engine: generation, the heritage running-order model, calibration, operator runbook                                |
| [`docs/SCORE_DROPS.md`](docs/SCORE_DROPS.md)                       | When each night's scores publish: the timezone-aware drop ladder, the once-per-night scrape, kill switch, day-selection rules        |
| [`docs/GAMIFICATION.md`](docs/GAMIFICATION.md)                     | Progression, economy & engagement: XP/levels, CorpsCoin, the Shop, achievements, streaks, the daily loop, leagues, records, live-ops |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md)                   | Visual identity (the data-terminal token system), typography, motion, and mobile-UX rules                                            |
| [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md)                     | External integrations: Discord, YouTube embeds, Gemini AI news/media, live DCI scraping, and the historical-data importers           |
| [`docs/BMAC_SUPPORTERS.md`](docs/BMAC_SUPPORTERS.md)               | Buy Me a Coffee supporter tiers, the webhook/reconcile pipeline, and the cosmetic-only recognition rules                             |
| [`docs/OPERATIONS.md`](docs/OPERATIONS.md)                         | Ops runbook: Firestore backup policy (PITR + scheduled backups), restore procedures, functions/hosting deploy rollback               |
| [`docs/SITE_DEEP_DIVE_2026-07.md`](docs/SITE_DEEP_DIVE_2026-07.md) | Point-in-time audit (July 2026) across six dimensions, its five recommendations, and their implementation status                     |

## License

Proprietary. All rights reserved.

---

_marching.art — where legends are made._
