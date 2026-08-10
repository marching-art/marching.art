# Gamification — Progression, Economy & Engagement

Everything that makes marching.art a game you return to: XP and levels, the
CorpsCoin economy, the Shop, achievements and streaks, the season reward ladder,
the daily loop, leagues, records, and live operation.

All figures here are the current in-code values. Source-of-truth files are cited
throughout; treat the code as authoritative if this doc ever drifts.

---

## The unifying idea: the Director's Career

marching.art is not "a fantasy league you replay each season." It is a
**decades-long career as a drum corps director**, where each 49-day season is one
chapter and every system writes into one permanent, ever-growing record. Drum
corps is already a culture about legacy (the retired jacket, the folded corps, the
dynasty); the game is built to be the same.

Three concentric engagement loops, each serving a different motivation:

```
THE CAREER  (meta / lifetime)  — purpose & identity; never flattens
  └ THE SEASON  (macro / 49 days)  — autonomy, mastery, relatedness; a chapter
      └ THE NIGHT  (micro / daily)  — competence & habit; the 2 AM score drop
```

The design test for any feature: **does it feed the Career?** XP that vanishes
into an odometer fails; XP that advances your season ladder and stamps a line in
your biography passes.

---

## Progression: XP & levels

- **Flat 1,000 XP per level.** Level = `floor(xp / 1000) + 1`
  (`functions/src/helpers/xpCalculations.js`).
- **Titles run past Level 10** so long-term directors always have a title to
  chase: Rookie (1) → … → Legend (10) → Icon (15) → Hall of Famer (20) →
  Immortal (25) → Eternal (30). Levels 10+ resolve to the highest tier reached.
- A **level-up stipend of +100 CC** is paid per level gained
  (`engagementRewards.js`, settled daily against `lastRewardedLevel`).
- The dashboard shows an **XP-to-next-level bar** (`ControlBar.jsx`).

### XP sources (`XP_SOURCES` in `xpCalculations.js`)

| Source               | XP                                  | Notes                                             |
| -------------------- | ----------------------------------- | ------------------------------------------------- |
| Daily login          | 25                                  | ~175/wk if daily (`claimDailyLogin`)              |
| Compete in a show    | 25 / show (≤4/wk → ≤100)            | The core act, paid in the nightly run             |
| Weekly participation | 150                                 | Compete in ≥1 show in a week, once per class/week |
| League matchup win   | 100                                 | Byes and ties award nothing                       |
| Daily prediction     | 15 / correct                        | + a perfect-day bonus                             |
| Daily challenges     | 10 each, 2/day                      | + a 100 XP / 100 CC weekly-loop bonus             |
| Streak milestones    | 50–1,000                            | At 3/7/14/30/60/100 days                          |
| Season completion    | 200 / 300 / 400 / 500 by final rank | Guaranteed 200 for finishing                      |
| First Season Journey | 425 one-time                        | The onboarding questline                          |

Design intent: **competing out-earns logging in** — the biggest recurring
earners are participation and league wins, not passive check-ins.

---

## Class unlocks — access vs. achievement

Class unlocks are deliberately an **early, celebrated milestone (a graduation)**,
not the long-term goal. The system separates _access_ (which class you may field
— reachable by anyone who plays) from _achievement_ (status, mastery, records —
the thing you chase for years).

A class unlocks by **any one** of:

| Class   | Seasons completed | XP level (early) | CorpsCoin (skip) | Silent backstop |
| ------- | ----------------- | ---------------- | ---------------- | --------------- |
| A Class | 1                 | 3                | 1,000            | ~52 wks age     |
| Open    | 2                 | 5                | 2,500            | ~56 wks age     |
| World   | 3                 | 10               | 5,000            | ~60 wks age     |

- **Seasons completed** is the standard "play = earning" path (owner-approved
  redesign — the old calendar-week auto-unlock that out-ran active play is gone).
- **XP level** unlocks _early_ for grinders and grants the _Earned, Not Given_
  recognition title; the seasons-completed and CC paths do not.
- **CorpsCoin** is the explicit pay-to-skip lane (the 1,000 CC welcome grant lets
  a newcomer skip straight to A Class — their choice).
- The **backstop** is a distant, silent anti-frustration floor, granted without
  fanfare, set so far out that active play always beats it.

Class unlocks are celebrated (`ClassUnlockModal` / `ClassPurchaseModal`).

---

## The CorpsCoin economy

CorpsCoin (CC) is a **fully closed-loop currency** — earned only by playing,
spent only in-game. There is **no real-money path** (the project is
donation-supported via Buy Me a Coffee). Every transaction is written to the
`corpsCoinHistory` ledger with a type, viewable in-app via `CorpsCoinModal` and
instrumented weekly by `scheduled/economyStats.js` (mint vs. sink).

### Two iron rules

1. **CorpsCoin never buys a competitive edge.** Not extra caption changes, not
   show slots, not score modifiers, not earlier deadlines. It buys **identity,
   ceremony, and status** only. Because nothing purchasable touches scoring,
   fairness is guaranteed by construction — no hoard, fresh or old, changes
   competition.
2. **Sinks must recur.** One-time purchases can't balance perpetual faucets, so
   the catalog carries consumables, seasonal cosmetics, and prestige tiers.

### Faucets (earning)

| Source                       | Amount                                         |
| ---------------------------- | ---------------------------------------------- |
| New-account grant            | 1,000 CC                                       |
| Show participation (nightly) | 50 / 100 / 150 / 200 CC by class (+175 Podium) |
| Weekly league win            | 100 CC                                         |
| Level-up stipend             | 100 CC / level                                 |
| Streak milestones            | 50–1,000 CC (3→100 days)                       |
| Prediction accuracy          | 10 CC / correct + 25 CC perfect day            |
| Daily challenge weekly loop  | 100 CC                                         |
| Season finish bonus          | 1,000 / 750 / 500 / 350 / 250 CC by rank       |
| Season reward ladder         | up to 1,650 CC across 12 tiers                 |
| League prize pool (champion) | commissioner-funded                            |

An active World Class director earns roughly **800–1,200 CC/week**; a SoundSport
rookie roughly 300–500.

### Sinks (spending)

| Sink                      | Cost                                          | Where                                                                  |
| ------------------------- | --------------------------------------------- | ---------------------------------------------------------------------- |
| Class unlocks (skip lane) | 1,000 / 2,500 / 5,000 CC                      | `unlockClassWithCorpsCoin`                                             |
| Streak freeze             | 300 CC                                        | Shop / streak modal                                                    |
| Director titles           | 1,000 / 2,500 / 5,000 / 10,000 CC             | Shop (`shopCatalog.js`) — flair on profile                             |
| Profile frames            | 750 / 1,500 / 3,000 / 7,500 CC                | Shop — avatar border                                                   |
| Corps card themes         | 1,500 / 3,500 / 5,000 CC (seasonal 2,500)     | Shop — dashboard scorecard accent                                      |
| League prediction pools   | small buy-in (e.g. 25 CC)                     | `leaguePools.js` — escrowed, zero-sum                                  |
| Retirement plaques        | 2,500 / 7,500 / 15,000 CC                     | Prestige (`prestigeCatalog.js`) — dresses a retired-corps card         |
| Hall of Champions banner  | 10,000 CC                                     | Prestige — champion's message on their Hall entry                      |
| Show sponsorship          | 10,000 / 15,000 / 25,000 CC                   | Prestige status sink                                                   |
| **Legacy Endowments**     | 5,000 / 12,500 / 25,000 / 50,000 / 100,000 CC | **Recurring** — `legacyCatalog.js`; repeatable forever, uncapped total |

Pricing is anchored to weekly income: consumables ~¼–½ a week, cosmetics 1–3
weeks, prestige items 10–25 weeks (to drain long-term hoards). A closed-loop
cosmetic economy is forgiving — expect to retune prices about once per season.

### Why the sinks needed a recurring tier

Every sink above the Legacy row is **terminal** — bought once, owned forever.
Totalled up, the whole purchasable catalogue is about **56,250 CC** (class
unlocks 8,500 + titles 18,500 + frames 12,750 + card themes 16,500), and the
only true consumable is the 300 CC streak freeze. At 800–1,200 CC/week an active
World Class director exhausts all of it in roughly **11–16 months**, after which
100% of income is dead surplus — permanently, and for the most-retained cohort
in a game whose entire premise is a decades-long career.

**Legacy Endowments** (`helpers/legacyCatalog.js`, `callable/legacy.js`) are the
answer: repeatable forever, so the sink can never be exhausted, and purely
commemorative, so they can never become pay-to-win. That last point matters more
here than in a game with real-money currency — CC is _earned by playing_, so any
advantage bought with it would be grind-to-win.

An endowment converts surplus coin into a permanent, dated line in the
director's record. `legacy.total` is cumulative and uncapped, and crossing a
threshold grants a milestone title:

| Cumulative total | Title           |
| ---------------- | --------------- |
| 5,000 CC         | Patron          |
| 25,000 CC        | Benefactor      |
| 100,000 CC       | Guarantor       |
| 250,000 CC       | Cornerstone     |
| 1,000,000 CC     | Founding Legacy |

The thresholds are deliberately career-scale: at ~400 CC/week of surplus
directed here, Cornerstone is roughly a twelve-year goal and Founding Legacy is
a career's work. The standing renders in the profile hero next to the equipped
title, and the entry list (capped at the 50 most recent — `total` and `count`
are separate scalars, so trimming loses no aggregate) renders in the Shop.

This is the design test from the top of this document applied directly: coin
that vanishes into a balance fails; coin that stamps a line in your biography
passes.

The `economyStats` job breaks sinks out by transaction type, so
`legacy_endowment` shows exactly how much surplus the endowments absorb — read
that before retuning any price here.

### The Shop

The **Corps Identity Shop** (`src/pages/Shop.jsx`, catalog in
`functions/src/helpers/shopCatalog.js`, client mirror `src/utils/cosmetics.js`)
sells director titles, profile frames, and corps card themes. Purchases/equips
are validated server-side against the catalog; `cosmetics.owned/equipped` persists
on the profile. Some items are **seasonal** — purchasable only during a given
season status, owned forever after (collectibles you had to be there for). Some
titles are **grant-only** (e.g. _Laureate_ from the ladder cap, _Earned, Not
Given_ from an early XP class unlock) and can never be bought.

---

## Achievements, streaks & the season ladder

- **Achievements** — a server-authoritative catalog with per-rarity CC rewards
  (`functions/src/helpers/achievements.js`), awarded by the daily sweep. The
  Hall / trophy case reads server-owned `profile.trophies.*`.
- **Login streaks** — server-authoritative (`claimDailyLogin`), with milestones
  at 3/7/14/30/60/100 days (XP + CC + a free freeze at 30). A **streak freeze**
  (300 CC) protects the streak; surfaced in the Shop and streak modal.
- **Season Reward Ladder** — a single free track, **12 tiers, ~1,650 CC total**,
  plus the ladder-exclusive **Laureate** title at the cap
  (`seasonLadder.js`). Progress is the XP you earn _this season_
  (`profile.xp − profile.xpAtSeasonStart`, baselined at rollover). Deliberately
  **not** a battle pass: no premium track, no separate XP pool, no FOMO. Every XP
  source the game already has feeds it automatically. Rendered as the
  `SeasonLadderPanel`.

---

## The daily loop — the Director's Report

The returning director's home is the **Director's Report** dashboard
(`src/pages/Dashboard.jsx`, organized into intention-zones; core cards in
`src/components/Dashboard/sections/`). It consolidates the day's beats into one
"here is today" surface rather than scattering them across the page:

- last night's result and rank change,
- resolved predictions and today's picks,
- today's daily challenges,
- the next deadline countdown (`NextDeadlineChip` — scores drop / trade reset),
- league events,
- the progression hub (season ladder + achievements + XP-to-next bar).

**Daily systems** (all server-authoritative and idempotent):

- **Daily login** — +25 XP, streak increment, milestone bonuses.
- **Daily challenges** — 2 rotating micro-tasks (from a pool of three genuinely
  daily actions: review your lineup, make today's prediction, enter your league
  prediction pool), 10 XP each, plus a weekly-loop bonus (`dailyChallenges.js`).
  Every challenge verifies a same-day action, so none auto-complete off stale
  season state. (The old `register-show` / `set-show-concept` challenges were
  retired from the daily pool for exactly that reason — they're taught and paid
  once by the First Season Journey instead.)
- **Daily predictions** — predict tonight's outcomes, resolve tomorrow; 15 XP +
  10 CC per correct pick, +25 CC for a perfect day (`dailyPredictions.js`).

---

## Onboarding — the First Season Journey

Onboarding extends past minute one into a staged, server-validated **First Season
Journey** questline (`JourneyPanel` + `functions/src/callable/journey.js`), each
step paying CC/XP and teaching one mechanic when it matters: field a lineup →
register for a show → read a recap → make a prediction → make a caption trade in a
change window → join a league → set a show concept → survive Championship Week →
complete your first season. New directors are offered one-tap placement into a
populated **rookie league** (`rookieLeague.js`) so day one isn't solo.

---

## Leagues — the social heartbeat

Social connection is the strongest retention predictor in fantasy sports.
Leagues are the game's relatedness layer:

- **League Activity Feed** (`LeagueActivityFeed.jsx`) — game events piped in as
  system messages so the league is never empty between automations.
- **Chat** — the composer renders on the chat tab (`LeagueDetailView.jsx`), with
  smack-talk co-located.
- **Weekly matchups** — head-to-head, auto-paired, with rank/prize consequences.
- **League Prediction Pools** (the flagship social mechanic) — escrowed, zero-sum
  CorpsCoin wagering on already-determined nightly outcomes
  (`callable/leaguePools.js`, `helpers/leaguePools.js`, `LeaguePoolCard.jsx`).
  They give leagues their own nightly heartbeat and are the recurring
  CC-circulation sink the economy wants.
- **Rivalries** — auto-detected rivals (`scheduled/rivalsComputation.js`) with
  head-to-head history shown in the matchup view (`RivalryHistoryCard.jsx`).
- **Prize pools** — commissioner-funded, paid out at season rollover.

---

## Records & legacy — the lifetime layer

The payoff for playing for years:

- **Records Book** (`src/pages/Records.jsx`, `helpers/gameRecords.js` →
  `game-records/records`) — per-class and all-time records (highest single-night
  score, best GE, biggest climb, longest streak, most Best-in-Show, …) with the
  holder's name, updated nightly and at archival. SoundSport is excluded by
  design. Lifetime leaderboards are computed nightly
  (`scheduled/lifetimeLeaderboard.js`).
- **Caption Mastery** (`helpers/captionMastery.js`) — cumulative lifetime
  performance per caption, a horizontal progression track that rewards the game's
  real skill (caption selection) and never caps.
- **Prestige sinks** (`callable/prestige.js`) — retirement plaques and Hall of
  Champions banners turn a CorpsCoin hoard into permanent, visible legacy.
- **Legacy Endowments** (`callable/legacy.js`) — the recurring version of the
  same idea, and the only sink that never runs out. See "Why the sinks needed a
  recurring tier" above.
- **Director Rating** (`helpers/directorRating.js`) — a synthesized rating.
- **Hall of Champions** and the **Retired Corps gallery** — the browsable history
  of the whole game and of each director's retired corps.
- **Season Recap** (`SeasonRecapModal`) — season archival pays finish bonuses and
  completion XP and announces them, so Finals night is a payday, not silence.

---

## Live operation

The 49-day season is the operating heartbeat. Seasonal **card themes** rotate in
the Shop (`shopCatalog.js` `seasonal` field) as time-limited collectibles, and
off-seasons carry tempo-named narrative themes (adagio, allegro, …).

### Instrumentation — the two dashboards

Both are admin-only docs rendered side by side in **Admin > Jobs**, and both can
be recomputed on demand from that tab.

| Doc                     | Job                                   | Answers                                                                                                      |
| ----------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `admin-stats/economy`   | `economyStats` (weekly, Mon 04:00 ET) | CC minted vs. sunk per week, broken out by transaction type — read this before retuning any price            |
| `admin-stats/retention` | `retentionStats` (nightly, 05:00 ET)  | DAU/WAU/MAU, stickiness (DAU/MAU), D1/D7/D14/D30 cohort retention, signup windows, login-streak distribution |

Retention is nightly and economy is weekly because of what each costs: the
retention rollup is a projected three-field scan of profile docs, while the
economy rollup must query every user's `corpsCoinHistory` subcollection.

Two things the retention numbers deliberately refuse to do, because they are how
this metric usually lies:

- A cohort only counts accounts **old enough to answer it** — a D30 rate never
  includes accounts created last week.
- A rate with nothing eligible reports **null, not 0**, so "no data yet" never
  renders as "nobody came back."

Client-side, the product funnel is instrumented at `createCallable`
(`src/api/funnel.ts`) rather than per component, so it keeps covering new
callables automatically. The nightly score drop's announcement links carry
`?src=push` / `?src=discord`, and `useScoreDropReturn` reports a
`score_drop_return` event with that source plus `days_missed` — which is what
says whether the announcements actually bring anyone back.

---

## Removed / out of scope

To keep the docs honest, these were **explicitly cut** and are not coming back —
do not reintroduce them to plans:

- **Battle Pass** — replaced by the free Season Reward Ladder (no premium track).
- **Real-money / Stripe / CC bundles** — the project is donation-only; the Stripe
  placeholder and dependency were removed.
- **Equipment / execution / morale / readiness** systems (the old fantasy stubs).
  _(Podium has its own rehearsal/condition and staff-market systems — those are a
  separate game, see [`PODIUM.md`](PODIUM.md).)_
- **Alternate league formats** (Survivor / One-Night Slate / Pick'em / Playoff
  Bracket).
- **Cross-class normalized matchups** (mixed-class league pairing).
- **Personalized AI narrative** ("director as protagonist" storylines). The AI
  news engine remains global/editorial — see [`INTEGRATIONS.md`](INTEGRATIONS.md).

## Still open (valid backlog)

Genuinely unbuilt but still on the table: per-5-level cosmetic unlocks and a
fully-wired level-up celebration; expanded Shop tiers (uniform palettes/emblems,
avatar-regeneration pricing); season report cards / personal-best comparisons;
living retirement monuments beyond plaques; a broader dynasty meta-achievement
set.
