# Gameplay Review — July 2026

A deep review of marching.art from the player's perspective, covering the full
journey from first visit through a multi-season career, followed by five
game-design recommendations. Findings are grounded in the implemented code
(file references throughout), not just the docs.

Scope: Part I covers the four fantasy classes (SoundSport / A / Open / World)
and the systems around them. Part II covers the Podium Class director sim with
its own findings and recommendations.

# Part I — The Fantasy Classes

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

---

# Part II — Podium Class

Podium is reviewed here as what it is: a second, orthogonal game (a
management sim beside a drafting game) sharing one calendar, one economy, one
identity layer, and one nightly moment. The engine
(`functions/src/helpers/podium/engine.js`) is code-complete, unit-tested,
registry-enabled, and gated only by the `game-settings/features.podiumClass`
runtime flag.

## 6. The Podium player journey as implemented

### Discovery and setup

The acquisition funnel is as strong as the fantasy one: a public recruiting
page (`/podium`), a no-signup interactive demo of the daily loop
(`/podium/preview`, with a registration gate after ~6 interactions), and a
15-section plain-language guide (`/podium-guide`). Existing players see a
dashed-gold Podium tab in the ControlBar as a standing recruiting affordance.
Registration is a 4-step flow (corps → show concept → challenge sliders +
audition presets → budget commitment), with a between-seasons financial
preview and carried-staff payroll editor for returning directors
(`src/components/Podium/PodiumRegistration.jsx`).

### The daily loop

Each day a director allocates rehearsal blocks — 12 on a rehearsal day, 20 in
spring training, 8 (at half yield) on show days — across 7 block types plus a
fundraiser, managing stamina, morale, warmup efficiency, repeat diminishing
returns, and neglect decay (`balanceConfig.json`,
`src/components/Podium/RehearsalPlanner.jsx`). Show nights are scored by the
nightly processor on a trajectory-anchored model: each corps rides its own
logistic potential curve (fitted from 1,338 real corps-seasons, 2000–2025),
attainment comes from rehearsed content × cleanliness, and the result is
placed in an envelope between a reputation-independent floor and a
**reputation-gated ceiling** (tier 1 = 0.78 of potential, tier 7 = 1.0). All
randomness is seeded and bounded (mean-reverting form walk ±4%, judge noise
from real day-over-day deltas), so outcomes are reproducible and re-roll-proof.

### The long game

The multi-season spine is genuinely built: reputation attached to the corps
lineage with a climb threshold and dormancy decay, divisions seeded purely
from prior Podium results with published percentile cutoffs, a staff labor
market where Veteran → Legend tiers can only be *earned by retention* across
seasons (3/8/15/22), a hosting ladder (High School → College Bowl → NFL
Stadium), joint rehearsals with private scrimmage reports, the Fan Favorite
ballot, and the deterministic weekly Podium Report column.

## 7. What's working (keep and protect)

- **Calibrated realism** — every score the engine emits is one that could
  plausibly appear on a real recap for that day; the historical envelope is a
  ceiling guardrail, never a shared floor.
- **The free floor** — an unaffordable cost degrades (longer bus ride, gas
  station food) but never blocks play. This is the right answer to
  free-to-play fairness and it's honored throughout `processor.js`.
- **Punishment-light absence** — the assistant director autoplays a saved
  plan at 85% yield; a missed day is opportunity cost, never a recorded loss.
- **The challenge-slider peak-timing meta** — higher challenge buys a higher,
  later-blooming ceiling that installs slower; the season's dramatic shape is
  a real strategic commitment, faithfully implemented.
- **Ops discipline** — funnel metrics (self-play vs. autopilot, D1/D7
  return) are written nightly, and balance/curves are runtime-overridable
  via `podium-config/balance` without a deploy.

## 8. Findings — where the Podium experience falls short

### 8.1 The daily verb is a grind, not a decision

The design doc promises a 2–5 minute daily loop: "allocate today's rehearsal
blocks — **one decision**, real consequences." The implementation is **one
server round-trip per block** (`allocateRehearsalBlock`, one tap each, the
whole grid disabled during each call — `RehearsalPlanner.jsx`). A routine
rehearsal day is 12 sequential taps-with-latency; spring training is 20. On
mobile this is the single largest gap between design intent and shipped feel.
The interesting choices (rest timing, warmup ordering, when to fundraise,
clinician timing) are buried inside a rote block-spam ritual whose
near-optimal allocation is computable — the depth lives at season scale, not
in intraday click order, yet intraday clicks are where the player's time goes.

### 8.2 The receipts didn't ship

The retention thesis (PODIUM.md §11.4) is "skill expression with receipts":
the trajectory-vs-percentile view lets a player *see* they out-directed the
field. In the live app there is **no projected score and no percentile band**
in the daily loop — `PodiumCaptionPanel.jsx` carries a comment deferring the
band chart to a "Phase 6" redesign that never landed; players see raw
content%/clean% bars and their last score. Ironically the *pre-signup demo*
shows a live projected box score while the real game does not. The
`PodiumTrajectoryCard` ghost chart only starts after your first scored show,
so the first week — the highest-churn window — is flying blind.

### 8.3 The reputation ceiling is invisible, and rookies will misread it

A first-season corps is capped at 0.78 of potential: a *perfectly played*
rookie season tops out in the mid/upper 70s while established corps post
90s. This is intentional and load-bearing (it makes the multi-season climb
real and blocks smurf domination), but the UI never says so — the tier name
sits quietly in a panel footer. A rookie who plays optimally for two weeks
and plateaus at 74 with no explanation has every reason to conclude the game
is broken or rigged. The mitigation (you compete within your division, and
divisions are seeded from Podium results only) is also under-communicated in
the nightly surfaces.

### 8.4 The season's biggest decision is made at minute one, blind, and locked

Challenge levels (1–8 per caption) shape the entire season's trajectory and
are **locked at registration** — no update callable exists. Audition presets
exist, but challenge has no presets, no projected-curve preview, and no
plain-language framing of the trade-off at the moment of choice. A
first-time director setting eight sliders in a game they haven't played yet
is making the campaign's most consequential commitment with the least
information they will ever have. FMA veterans loved the lock — the lock is
right — but the *information asymmetry at commit time* is not.

### 8.5 The safety net is opt-in, and a no-plan day is a lost day

With no assistant-director plan saved, a missed day yields nothing (decay
still applies via `pendingEndOfDay`). The plan editor exists
(`CorpsConditionPanel.jsx`) but nothing in registration or the Podium rookie
journey requires or seeds one. In a habit game whose audience includes
players juggling a fantasy corps *and* a sim corps, the default state of the
biggest anti-churn mechanic is "off."

## 9. Five Podium recommendations

### P1 — Make the daily loop one decision: batch day-planning

Add a compose-then-commit mode: the player arranges today's blocks
client-side (the demo already works this way) and submits once
(`allocateRehearsalDay` taking an ordered block list), with two accelerators
— "Run my plan" (execute the saved day-type template at full yield when
manually confirmed) and "Repeat yesterday." Keep per-block allocation for
tinkerers. This closes the 12–20 round-trip grind to 1–2 taps on routine
days, honors the doc's "one decision" promise, and — because it makes the
saved plan the center of the daily UI — directly raises assistant-plan
adoption (P5). Validation stays server-side; nothing about the engine
changes.

### P2 — Ship the receipts: projection + percentile bands in the live loop

Bring the deferred trajectory work back as the core progress surface: a
projected show score under the current plan ("if tonight were a show:
~71.2"), caption curves plotted against the historical percentile bands for
this day of season ("brass tracking 78th percentile of Day-24 brass"), and a
decay forecast on neglected captions. Every input already exists server-side
(`curveData.json` bands, `scoreCorps` is a pure function that can run in
preview mode, `scoreHistory`). This is the difference between "number goes
up" and *seeing yourself out-direct the field* — the game's own stated
retention pillar — and it fills the blind first week before any show has
been scored.

### P3 — Make the ceiling legible; frame everything division-first

State the envelope where the player looks every day: "Season ceiling:
**78.4** (Community Corps) — finish top of your tier to raise it." Show
climb progress (tier performance vs. the 82 threshold) as a season-long
meter, and make nightly recap surfaces lead with division-relative placement
("2nd of 11 in A Division") before absolute score. The reputation system is
one of the best-designed pieces of the game; right now it reads as an
unexplained handicap. A rookie who *knows* they're climbing a published
ladder will accept a 74; one who doesn't will churn.

### P4 — De-risk the locked challenge decision at registration

Three additions to step 3 of registration, all information, no mechanics
changes: (a) challenge presets alongside the audition presets (Safe Opener /
Balanced Book / Boom-or-Bust) that set all eight sliders coherently; (b) a
live projected-curve preview per setting, drawn against the historical bands
— show the player the early-safe curve vs. the late-blooming one *before*
they commit; (c) for a director's **first** Podium season only, a one-time
challenge re-tune allowed through Day 7 (the sim's equivalent of the fantasy
side's unlimited early trade window — the veterans' lock stays intact from
season two onward).

### P5 — Default the safety net on

Seed an assistant-director plan automatically at registration from the
chosen audition/challenge presets, add "review your assistant's plan" as an
explicit Podium rookie-journey step, and send a gentle notification the
first time autopilot runs ("your assistant ran a 12-block day — here's what
they did"). The 15% assistant penalty already prices the trade-off
correctly; the problem is only that the net doesn't exist until a player
builds it by hand. This is the cheapest churn-prevention item in this
review.

## 10. Smaller Podium observations

- The class is enabled in `classRegistry.json` but dark until
  `game-settings/features.podiumClass` is set — a missing doc reads as OFF.
  Document the flag flip in the operator runbook as the single launch
  switch, and alarm if registry and flag disagree for more than a season.
- Fantasy and Podium corps share the Schedule modal but obey different pick
  rules (4/wk vs. 4-3-2 with auto-attended majors); the modal explains
  Podium rows well, but the weekly Director's Report should surface "Podium:
  N picks remaining this week" alongside the fantasy count.
- The Champions Invitational hosted event is design-only (PODIUM.md notes it
  post-launch) — fine, but remove it from player-facing guide text until it
  exists.
- Joint rehearsals are a standout social mechanic with zero discovery path
  outside the condition panel; one league-feed line ("A and B scrimmaged in
  Dayton") already exists — add a journey step or challenge that prompts a
  first proposal.
