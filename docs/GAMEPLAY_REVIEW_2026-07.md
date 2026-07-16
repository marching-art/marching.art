# Gameplay Review — July 2026

A deep review of marching.art from the player's perspective, covering the full
journey from first visit through a multi-season career, followed by five
game-design recommendations. Findings are grounded in the implemented code
(file references throughout), not just the docs.

Scope: the four fantasy classes (SoundSport / A / Open / World) and the systems
around them. Podium is treated as context, not the subject of this review.

---

## 1. The player journey as implemented

### First hour

The funnel is genuinely strong. A guest can play with a real interactive
dashboard at `/preview` (`src/pages/GuestDashboard.jsx`), draft a SoundSport
lineup before ever registering, and have those picks carried into onboarding
(`importGuestLineup`). Registration promises "under 2 minutes" and delivers: a
3-step wizard (`src/pages/Onboarding.jsx`) with live username checks, a guided
caption-by-caption draft with jargon tooltips and an auto-fill escape hatch,
auto-registration into up to 4 of this week's shows, a one-tap rookie-league
join, and a celebration modal. A 5-step spotlight tour and the First Season
Journey questline (`JourneyPanel` + `functions/src/callable/journey.js`) then
teach each mechanic when it matters. This is a textbook onboarding.

### The daily loop

The Director's Report (`src/components/Dashboard/sections/DirectorsReport.jsx`)
consolidates the day into one "Today · X of Y done" surface: auto-claimed daily
login, three server-verified daily challenges, daily predictions, and pending
season-ladder claims. The 2:00 AM ET nightly scoring run
(`functions/src/scheduled/dailyProcessors.js`) is the heartbeat: register
shows, wake up to results and rank changes. XP sources are tuned so competing
out-earns logging in — a healthy incentive structure.

### The strategic core

The central act is drafting 8 captions under a class point cap
(`saveLineup`, `functions/src/callable/lineups.js`), then managing a tightening
change budget (unlimited → 3/week → blackout → 2/day in Championship Week,
`functions/src/helpers/captionWindows.js`) toward a 5-day championship bracket
with real advancement cutoffs. The change-window taper is excellent design: it
creates a "peak timing" meta, escalating stakes, and real tension in the final
week, and the client countdown is kept exactly in sync with server enforcement.

### The long game

The Career layer is unusually well-built for a niche game: season history,
Records Book, Hall of Champions, caption mastery, retired-corps gallery,
prestige sinks, and a closed-loop cosmetic economy with two iron rules
(CC never buys competitive edge; sinks must recur) that are actually honored
in code — the scoring pipeline explicitly forbids any game system from
touching competitive scores (`functions/src/helpers/scoring.js`).

---

## 2. What's working (keep and protect)

- **Onboarding and the guest funnel** — best-in-class for an indie title.
- **The change-window taper and Championship Week bracket** — the season has a
  dramatic arc, not a flat grind.
- **The non-pay-to-win covenant** — enforced by construction, not policy.
- **The Director's Report** — one surface for the whole daily loop.
- **Career permanence** — records, halls, mastery, retirement; the "decades-long
  career" framing has real systems behind it.
- **Server-authoritative engagement systems** — challenges, streaks, ladder,
  achievements are all idempotent server sweeps, not client trust.

---

## 3. Findings — where the experience falls short

### 3.1 The draft puzzle is shallower than advertised (and than it should be)

`docs/GAMEPLAY.md` says each caption carries a cost "derived from that corps'
historical performance **in that caption**." The implementation prices the
**whole corps**: one `points` value per corps (`dci-data/{doc}.corpsValues[]`),
identical across all 8 captions. Off-season pools are exactly 25 corps priced
25→1, one per integer tier (`startNewOffSeason`,
`functions/src/helpers/season.js`). Scoring even discards any per-caption
component — `scoring.js` reads only `corpsName|sourceYear`.

Consequences for the player:

- There is one obvious value ordering. The in-app Draft Helper's "Value" tab
  (score-per-point > 4.5) essentially prints the answer.
- **World Class — the flagship — has the loosest puzzle.** The 8 most expensive
  captions cost 172 total against a 150 cap, so an elite build sheds only ~22
  points from the theoretical max. A Class (60 cap, avg 7.5/slot) is a far
  deeper puzzle than the class players spend three seasons unlocking.
- Optimal lineups converge. The only anti-mirroring mechanic is exact-8-tuple
  uniqueness (`activeLineups/{lineupKey}`, lineups.js) — two directors can
  differ by one caption and both field the near-optimal build.

### 3.2 Lineup cost is client-supplied and unverified (competitive-integrity hole)

`saveLineup` sums the point value embedded in the **client-submitted** string
(`selection.split("|")`, last segment — lineups.js:38–47) and validates only
that `corpsName|sourceYear` exists this season. It never cross-checks the
submitted cost against the authoritative `corpsValues`. A modified client can
field `Blue Devils|2025|1` — an elite caption declared at 1 point — and pass
the cap check. In a game whose entire competitive claim is "best build under
the cap," this is the single most important fix in this review.

### 3.3 The social layer is the retention engine, and it's hidden

Leagues — chat, weekly H2H matchups, prediction pools, rivalries, prize pools —
are the game's strongest retention systems, and they are absent from primary
navigation. Both `src/components/BottomNav.tsx` and the desktop nav
(`src/components/Layout/GameShell.jsx`) expose only News / Dashboard /
Schedule / Scores / Profile. Leagues, Shop, Achievements, and Records are
reachable only through in-page affordances (Journey step, ControlBar HUD). A
player who skips the Journey may never find the league system at all.

Related: `dailyProcessors.js` carries a comment claiming H2H matchup generation
was removed, while `generateWeeklyMatchups` / `processWeeklyMatchups` are fully
active and paying rewards — stale signals like this invite accidental regression
of a live retention system.

### 3.4 The score drop is a background job, not an event

The nightly result is the game's core dopamine moment, but the game never asks
players if it can tell them about it. Push infrastructure is fully wired
(`src/api/pushNotifications.ts`, server jobs in
`functions/src/scheduled/pushNotifications.js`), yet the **only** opt-in path is
a toggle inside Profile → Settings (`SettingsModal.jsx:281`); `App.jsx`
initializes push only if permission was already granted. There is no contextual
prompt at the moments a player most wants it ("your first scores arrive
tonight — want the morning report?"). The Podium design doc itself states the
standard: the score drop "must be presented as a communal event, not a
background job." The fantasy classes don't yet meet that bar.

### 3.5 Standings are last-night-only, and interpolated nights roll dice

Two related fairness/feel issues in the scoring core:

- Rank is by **latest** nightly total — `commitDailyScoring` overwrites
  `corps.{class}.totalSeasonScore` with tonight's score (scoring.js:343+).
  This is authentically DCI (placement is the most recent recap), but it means
  a 49-day season's consistency has no expression anywhere: nights 1–44 carry
  almost no weight beyond participation rewards, and one night defines the
  cutoff seed.
- Regression-interpolated caption scores add **unseeded random jitter** of
  ±0.25 per caption (`getRealisticCaptionScore`,
  `functions/src/helpers/scoringMath.js:126`). Real historical/scraped nights
  are deterministic; interpolated ones are not. Near a top-25/top-12
  championship cutoff, ties can effectively be broken by RNG, and a re-run of
  the same night would produce different scores.

---

## 4. Five recommendations

### R1 — Per-caption, server-authoritative pricing (depth + integrity in one move)

Make the doc true: price each corps **per caption** from its historical
caption-level data (the data already exists in `historical_scores` recaps —
GE/VIS/MUS caption lines). A corps with legendary brass but a weak guard
becomes a 22-point Brass pick and a 9-point Color Guard pick. In the same
change, stop trusting the wire: `saveLineup` should look up every cost from
`corpsValues` server-side and ignore any client-supplied number (closing §3.2
immediately, even before per-caption pricing ships).

Why this is the #1 lever: it multiplies the size of the decision space
(25 corps × 8 captions with distinct values vs. 25 scalar values), naturally
diversifies lineups without any artificial rule, makes the Draft Helper and
Lineup Analyzer genuinely interesting tools, and restores the strategic depth
the game already advertises. Ship the integrity fix first (one small PR), then
the pricing model at a season boundary.

### R2 — A living market: reprice captions weekly from pick rates

Static season-long prices mean the metagame is solved by Day 3. Add a
**weekly repricing drift** at each trade-window reset (the game already has a
natural cadence at Saturday locks): captions with high ownership drift up
1–2 points; neglected ones drift down. Existing lineups are grandfathered at
purchase price until the owner trades that slot — which turns the 3/week trade
budget into a real portfolio decision ("my GE1 is now overpriced; do I bank
the equity or hold?"). This violates neither iron rule — nothing here touches
scoring, only cost — and it gives the mid-season weeks (currently the
flattest stretch) a market meta to argue about in league chat. Surface
ownership % in the draft UI so the market is legible. Instrument it with the
same weekly stats pattern as `economyStats.js`.

### R3 — Promote the social layer to primary navigation and the daily surface

Put **Leagues** in `BottomNav` and the desktop nav (five slots is a
convention, not a law — News can live behind the logo/landing route for
authenticated users). Add the day's league beat to the Director's Report:
"Matchup vs. <rival>: you're up 1.4 with 2 nights left" is the single most
compelling sentence this game can show a returning player, and the data
already exists (`processWeeklyMatchups`, `RivalsPanel`). Extend one-tap league
placement past rookies: any leagueless director should get a "find me a
league" affordance on the dashboard. Finally, delete the stale
"matchups removed" comment in `dailyProcessors.js` so nobody ever cleans up
the live system it mislabels.

### R4 — Turn the score drop into a ritual

Three concrete steps:

1. **Contextual push opt-in** — prompt at the two moments of maximum intent:
   right after first show registration ("scores land overnight — want your
   Director's Report at 8 AM?") and after a first Championship Week
   registration. Never on load, never in a settings modal only.
2. **A Morning Report notification + landing surface** — one push linking to
   a recap view framed as the day's front page: your score, rank delta,
   matchup swing, prediction results, one league headline. Most of this
   content is already computed nightly; it needs packaging, not plumbing.
3. **A shareable nightly recap card** — a small rendered scorecard (corps
   name, score, placement, rank arrow) suitable for posting into league chat
   or externally. Drum corps culture is recap-sheet culture; give players the
   artifact.

### R5 — Make the full tour count, and de-RNG the margins

Keep last-night-is-your-score as the *placement* rule — it's authentic — but
add a visible, career-feeding expression of season-long quality:

- A **Tour Average** (or best-N-of-M nights) stat per corps per season, shown
  on the scorecard and archived into `seasonHistory`, with Records Book
  entries and achievements for consistency (e.g., "most nights above 95").
  Nights 1–44 immediately matter without changing championship math.
- **Seed the jitter.** Derive interpolated-night jitter from a hash of
  `(seasonUid, day, corpsName, sourceYear, caption)` instead of
  `Math.random()` (`scoringMath.js:126`). Same realistic texture, but
  deterministic, re-run-safe, and immune to "the RNG decided the cutoff"
  complaints — which will otherwise eventually happen in public, on a
  Semifinals night, to a player with a screenshot.
- Consider zero jitter on Days 45–49 specifically: championship nights should
  be pure data.

---

## 5. Smaller observations (worth a backlog line each)

- World Class's 150 cap is loose relative to its 172-point ceiling (§3.1);
  if R1 ships, retune caps per class against the new per-caption
  distribution — aim for World to feel at least as tight as Open.
- `docs/GAMEPLAY.md` and `dailyProcessors.js` each contradict the code in one
  place (per-caption costs; "matchups removed") — both are cheap fixes that
  prevent future design work from building on a false premise.
- The duplicate-lineup rejection ("already claimed") is a dead end for the
  loser — suggest the nearest legal variation ("swap any one caption") in the
  error UI instead of just refusing.
- Week-7 registration allows 7 shows but championship events auto-enroll;
  make the distinction visible earlier so Week 6 players understand what
  they do and don't control in the finale.
