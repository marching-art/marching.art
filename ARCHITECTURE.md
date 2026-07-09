# marching.art Architecture

> Last verified: December 2025

## Overview

marching.art is a fantasy drum corps game built with React 18 and Firebase. Users create virtual drum corps by selecting 8 captions from historical DCI performances, competing for points during the live DCI season.

## Tech Stack

| Layer    | Technology                                           |
| -------- | ---------------------------------------------------- |
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion          |
| State    | Zustand (client), React Query (server)               |
| Backend  | Firebase (Auth, Firestore, Cloud Functions, Storage) |
| Hosting  | Vercel (frontend), Firebase (functions)              |
| Monetization | Donation-based (Buy Me a Coffee) — no integrated purchases |

## Project Structure

```
marching.art/
├── src/
│   ├── api/              # Firebase callable function wrappers
│   ├── components/       # UI components
│   │   └── ui/           # Design system (Button, Card, Input, etc.)
│   ├── hooks/            # Custom React hooks
│   ├── pages/            # Route components
│   ├── stores/           # Zustand state stores
│   ├── styles/           # Global CSS
│   └── types/            # TypeScript definitions
├── functions/
│   └── src/
│       ├── callable/     # Cloud Functions (HTTP callable)
│       └── helpers/      # Shared utilities
└── public/               # Static assets
```

## Implemented Features

### Core Systems (100% Complete)

| System                | Status   | Details                                     |
| --------------------- | -------- | ------------------------------------------- |
| **Authentication**    | Complete | Email/password, anonymous auth              |
| **Draft System**      | Complete | 8-caption selection from historical corps   |
| **Season Management** | Complete | Live/Off-season, automatic resets           |
| **Schedule System**   | Complete | 49-day off-season calendar with shows       |
| **Leaderboards**      | Complete | Per-class rankings, weekly/monthly/lifetime |
| **Battle Pass**       | Complete | 50 levels, free/premium tracks              |
| **XP/Levels**         | Complete | Daily XP check-in, level progression        |
| **Class Unlocking**   | Complete | SoundSport → A → Open → World Class         |

### Partial/In-Progress

| System                | Status | Notes                                 |
| --------------------- | ------ | ------------------------------------- |
| **Leagues**           | 90%    | Core functions work, chat coming soon |
| **CorpsCoin Economy** | 60%    | Class unlocks work, cosmetics planned |

### Not Implemented

These systems have TypeScript types defined but NO backend support:

- Equipment system (condition, repair, upgrades)
- Execution multiplier (readiness, morale)
- Daily operations beyond XP check-in

## Cloud Functions

Located in `functions/src/callable/`:

| File            | Functions                | Purpose                 |
| --------------- | ------------------------ | ----------------------- |
| `users.js`      | User CRUD, XP management | Core user operations    |
| `economy.js`    | CorpsCoin transactions   | Class unlocking         |
| `battlePass.js` | Level claims, XP awards  | Full Battle Pass system |
| `leagues.js`    | League CRUD, invites     | League management       |
| `lineups.js`    | Caption selection        | Draft system            |
| `corps.js`      | Corps registration       | Season registration     |
| `dailyOps.js`   | Daily rehearsal          | XP bonus system         |
| `admin.js`      | Admin operations         | Staff management        |
| `comments.js`   | League comments          | Social features         |
| `profile.js`    | Profile operations       | User profiles           |

## Database Collections

### Primary Collections

```
users/{uid}                    # User profiles, stats, settings
corps/{corpId}                 # Registered corps data
leagues/{leagueId}             # League configuration
seasons/{seasonId}             # Historical season data
game-settings/season           # Current season config + schedule
historical_scores/{year}       # DCI historical data
```

### User Sub-collections

```
users/{uid}/corps/{corpId}     # User's corps for each class
users/{uid}/battle-pass        # Battle Pass progress
users/{uid}/achievements       # Unlocked achievements
```

## Design System

Based on ESPN Fantasy Sports aesthetic (see `docs/ESPN_REDESIGN_PROMPTS.md`):

### Colors (tailwind.config.cjs)

```javascript
colors: {
  espn: {
    red: '#d00',
    blue: '#006BB7',
  },
  charcoal: {
    900: '#0a0a0a',
    800: '#1a1a1a',
    // ... scale to 50
  },
  trend: {
    up: '#16a34a',
    down: '#dc2626',
  }
}
```

### Component Library

Located in `src/components/ui/`:

- Button, Card, Input, Modal, Badge, Spinner
- DataTable, Tabs, Tooltip
- All components have Storybook stories and tests

## Season Structure

### Live Season (10 weeks)

- June through second Saturday of August
- Real DCI scores drive fantasy competition
- Limited lineup changes as season progresses

### Off-Season (42 weeks / 49 game days)

- September through May
- 7 weeks of simulated competition
- Historical show data creates realistic schedule

### Caption Change Rules

| Days                  | Changes Allowed                       |
| --------------------- | ------------------------------------- |
| 1-14                  | Unlimited (until 8 PM ET on Day 14)   |
| 15-42                 | 3 per week per class                  |
| 43-44                 | None                                  |
| 45-49 (Championships) | 2 total per class, lock 8 PM ET daily |

Changes always lock from Saturday 8:00 PM ET until scores are processed
(nightly run at 2:00 AM ET). Enforced by `functions/src/helpers/captionWindows.js`
(mirrored client-side in `src/utils/seasonClock.js`).

## Class System

| Class       | Point Limit | Unlock Requirement          |
| ----------- | ----------- | --------------------------- |
| SoundSport  | 90          | Default                     |
| A Class     | 60          | Level 3 OR 1,000 CorpsCoin  |
| Open Class  | 120         | Level 5 OR 2,500 CorpsCoin  |
| World Class | 150         | Level 10 OR 5,000 CorpsCoin |

## Code Conventions

These conventions keep the codebase maintainable as it grows. They are enforced
softly (ESLint warnings + CI visibility) rather than as hard gates, so they guide
without blocking.

### File size / "god-files"

- **Target: keep files under ~700 lines.** ESLint's `max-lines` rule warns past
  that threshold (blank lines and comments excluded). The warning is intentional
  tech-debt signal, not a build failure.
- **When a file trips the warning, split it** rather than growing it further:
  - Extract **pure logic** (data transforms, formatting, calculations) into a
    module under `src/utils/` (or co-located `*Utils.ts`) — and add unit tests.
    Pure functions are the easiest thing to test and the riskiest thing to leave
    untested.
  - Extract **self-contained sub-components** (modals, panels, rows) into their
    own files.
  - Extract **stateful logic** into custom hooks under `src/hooks/`.
- Examples of this pattern already in the tree: `src/utils/dashboardScoring.ts`,
  `src/utils/scoresUtils.ts`, `src/components/Landing/newsFeedUtils.ts`,
  `src/components/Profile/SettingsModal.jsx`.

### TypeScript migration

The codebase is migrating from JS/JSX to TS/TSX incrementally (`allowJs` is on,
so the two coexist).

- **Write new files in TypeScript** (`.ts` / `.tsx`).
- **When you extract logic out of a `.jsx` file, put the extracted module in
  `.ts`** — this advances the migration for free on code that's already being
  touched and reviewed.
- Prefer explicit types on exported functions and module boundaries.

### Testing extracted logic

Anything extracted into a `utils`/`*Utils` module should ship with Vitest unit
tests (frontend) or `node:test` tests (Cloud Functions). Make time-dependent
helpers testable by accepting an injectable clock (e.g. `now: Date = new Date()`)
instead of reading the wall clock internally.

## Known Issues

See `CODE_AUDIT_REPORT.md` for current issues:

- Security: Credentials in .env.production need rotation
- Performance: Missing React.memo in some components
- Accessibility: ~60% WCAG compliance
- Cloud Functions not deployed to production

## Development

```bash
# Install dependencies
npm install

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build

# Deploy functions
cd functions && npm run deploy
```

## Documentation Index

| Document                         | Purpose                     |
| -------------------------------- | --------------------------- |
| `README.md`                      | Project overview and setup  |
| `ARCHITECTURE.md`                | This file - system design   |
| `SCHEDULE_SYSTEM.md`             | Schedule generation details |
| `docs/LIFELONG_GAMIFICATION_ROADMAP.md` | Gamification strategy (current) |
| `docs/ENGAGEMENT_ECONOMY_REVIEW.md`     | CorpsCoin/XP economy plan (current) |
| `CODE_AUDIT_REPORT.md`           | Security/code audit (Dec 2025, historical) |
| `docs/ESPN_REDESIGN_PROMPTS.md`  | ESPN redesign prompts (completed, historical) |
| `scripts/README_STAFF_IMPORT.md` | Staff data import guide     |
