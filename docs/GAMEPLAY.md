# Gameplay — The Rules of Play

How the core fantasy game works: seasons, classes, drafting a lineup, scoring,
change windows, show registration, and championships. This is the four fantasy
classes (SoundSport / A / Open / World). The **Podium** class is a separate
simulation game documented in [`PODIUM.md`](PODIUM.md).

Authoritative constants live in code and should be treated as the source of
truth if this doc ever drifts:

- Class caps / unlocks / rewards: `src/config/classRegistry.json`
- Caption-change windows: `functions/src/helpers/captionWindows.js` (mirrored
  client-side in `src/utils/seasonClock.js`)
- Show registration limits: `functions/src/callable/lineups.js`

## The two-season model

The game runs year-round, alternating two season types on an identical
**49-day / 7-week** competition calendar (week = `ceil(day / 7)`):

- **Live Season** — the summer. Real DCI scores from the current touring season
  drive the fantasy competition. Shown in the UI as a single year (e.g. `LIVE 2026`).
- **Off-Season** — the rest of the year. Historical DCI results drive the same
  fantasy format, so play never stops between summers. Off-seasons are given
  tempo-themed names (adagio, allegro, andante, …).

Seasons roll over automatically (`functions/src/scheduled/seasonScheduler.js`).
The schedule engine that builds each 49-day calendar is documented separately in
[`SCHEDULE_SYSTEM.md`](SCHEDULE_SYSTEM.md).

## Classes

There are four fantasy classes plus Podium. Each fantasy class has a **point
cap** — the maximum total cost of your 8 drafted captions.

| Class          | Point cap | Fantasy-ranked | Unlock (any one path)                              |
| -------------- | --------- | -------------- | -------------------------------------------------- |
| **SoundSport** | 90        | No             | Default — open to everyone                          |
| **A Class**    | 60        | Yes            | Complete **1** season · or Level **3** · or **1,000** CC |
| **Open Class** | 120       | Yes            | Complete **2** seasons · or Level **5** · or **2,500** CC |
| **World Class**| 150       | Yes            | Complete **3** seasons · or Level **10** · or **5,000** CC |

The lower cap on A Class (60) makes it a distinct tighter-budget puzzle, not a
"weaker World Class." SoundSport is unranked by design — it's the on-ramp and the
participation class.

**Unlock paths** (see [`GAMIFICATION.md`](GAMIFICATION.md) for the full rationale):

- **Seasons completed** — the standard "play = earning" path. Finishing a season
  you competed in graduates you to the next class.
- **XP level** — the early/"did it the hard way" path; grinders unlock before a
  season ends and earn the _Earned, Not Given_ recognition title.
- **CorpsCoin** — the explicit pay-to-skip lane.
- A distant silent **backstop** (roughly a year of account age) unlocks classes
  for very irregular players so no one is permanently walled out; it's set far
  enough out that any active play beats it.

Unlocks are additive and never revoked.

## Drafting a lineup — the 8 captions

A corps lineup is **8 captions**, each drafted from a different real historical
corps performance:

| Slot  | Caption            |
| ----- | ------------------ |
| GE1   | General Effect 1   |
| GE2   | General Effect 2   |
| VP    | Visual Proficiency |
| VA    | Visual Analysis    |
| CG    | Color Guard        |
| B     | Brass              |
| MA    | Music Analysis     |
| P     | Percussion         |

Rules:

- Each caption carries a **cost** derived from that corps' historical
  performance in that caption. The **sum of your 8 costs must not exceed your
  class point cap.** Building a strong, legal lineup under the cap is the game's
  central strategic act.
- **No duplicate lineups per season** — if two directors submit the exact same
  8-caption lineup, the first to submit keeps it.
- A **show concept** can grant synergy bonuses; the Lineup Analyzer helps
  evaluate a build.

## Scoring

Scores are processed in a **nightly run at ~2:00 AM ET** (the nightly
processors). Each night a corps competed, its captions are scored from the
underlying DCI data (real, in Live Season; historical, in Off-Season) and its
fantasy total updates. The nightly "score drop" is the game's core daily beat —
you set a lineup, register for shows, and wake up to results and rank changes.

## Caption-change windows

How often you can change your lineup tightens as the season progresses. Rules,
in competition days (1–49):

| Days                        | Changes allowed                                                   |
| --------------------------- | ----------------------------------------------------------------- |
| **1–14**                    | **Unlimited**, ending when Day 14 ends (8:00 PM ET in summer)     |
| **15–42**                   | **3 per week per class** — spend one at a time or all at once; the counter resets each week |
| **43–44**                   | **No changes** at all                                             |
| **45–49** (Championship Wk) | **2 per class per day**, for each class still competing that day — resets nightly |

Championship Week follows the DCI Finals bracket — only the classes still
competing on a given day may change captions:

| Day | Classes that may change      |
| --- | ---------------------------- |
| 45  | Open Class, A Class          |
| 46  | Open Class, A Class          |
| 47  | All classes                  |
| 48  | World Class, SoundSport      |
| 49  | World Class, SoundSport      |

A class not competing that day is done for the season and locked out (Open/A
after Day 47, World/SoundSport after Day 49).

Additional locks:

- Every **Saturday at 8:00 PM ET** (the end of days 7/14/21/28/35/42), changes
  **lock** until that night's scores are processed (the 2:00 AM ET nightly run;
  if a day had no events, changes reopen at 2:00 AM ET).
- During Championship Week, changes close at **8:00 PM ET each day** and reopen
  once scores are processed; each competing class gets a fresh 2 changes each day.

The client display (`src/utils/seasonClock.js`) is kept exactly in sync with
what the server (`captionWindows.js`) enforces on save, so the countdown you see
is the rule that applies.

## Show registration

Each week you register your corps for the shows you want to compete in that week
(from the generated schedule). You may register for **up to 4 shows per week** —
**except the final week (week 7), which allows up to 7** to accommodate
Championship Week.

Registrations save to your corps' `selectedShows.week{N}`. Register before the
nightly run to compete that night.

## Championship Week (Days 45–49)

The final week's marquee events use **automatic enrollment** based on class and
advancement — you don't manually register for these; they're filtered out of the
show-selection UI and placed by the schedule engine.

| Day | Event                                   | Eligible / advancement                                   |
| --- | --------------------------------------- | -------------------------------------------------------- |
| 45  | Open & A Class Prelims                  | All Open + A Class corps                                 |
| 46  | Open & A Class Finals                   | Top 8 Open + Top 4 A Class from Day 45                   |
| 47  | World Championship Prelims              | All World + Open + A Class corps                         |
| 48  | World Championship Semifinals           | Top 25 from Day 47 (ties at 25th all advance)           |
| 49  | World Championship Finals               | Top 12 from Day 48 (ties at 12th all advance)           |
| 49  | SoundSport Championship (festival)      | All SoundSport corps                                     |

Class restrictions: World/Open/A cannot enter the SoundSport festival, and
SoundSport cannot enter the World Championship (Days 47–49) or Open/A events
(Days 45–46). Champions receive gold/silver/bronze trophies; results feed the
Hall of Champions and the Records Book.

The exact championship placement, event branding, and advancement logic live in
`functions/src/helpers/scheduleGeneration.js` — see [`SCHEDULE_SYSTEM.md`](SCHEDULE_SYSTEM.md).
