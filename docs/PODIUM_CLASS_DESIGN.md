# Podium Class — Design Document

**A director-simulation game class for marching.art, spiritual successor to Fantasy Marching Arts**

Status: Proposal v1 · July 2026

---

## 1. Executive Summary

Podium Class is a fifth corps class that lives beside World / Open / A Class / SoundSport in the
dashboard ControlBar. Where the four existing classes are *fantasy* classes — you draft historical
caption performances and your score is derived from what those corps actually did — Podium Class is
a *simulation* class: **you are the director of your own corps, and your score is built from
scratch, every day, by how you rehearse, travel, feed, and rest your members across the season.**

It occupies the exact screen real estate of the Active Lineup / Lineup Analyzer panels (Dashboard
Zone C) when its tab is selected, rides the *same* 49-day season schedule, the same shows, the same
nightly scoring window, the same recaps and leaderboard plumbing — but its scoring is fully
separate, computed by a rehearsal-driven growth engine calibrated against the entire
`historical_scores` database so that every score it emits is one that could plausibly have appeared
on a real DCI recap for that day of the season.

The design goal in one sentence: **take the deterministic, daily-ritual, identity-rich gameplay
that kept Fantasy Marching Arts players returning for 15 years, fix the ten years of community
complaints its creator never addressed, and anchor the whole thing to real historical scoring data
so that it feels like DCI instead of a spreadsheet.**

### Why "Podium"

The working name conveys what "e-sports" was gesturing at — competitive, skill-expressed,
head-to-head — without the terminology clash:

- **Podium Class** *(recommended)* — the double meaning is perfect: the podium is where the drum
  major/director stands, and the podium is where medalists stand. It says "you conduct" and "you
  compete" in one word. Tab label: `Podium`. Class key: `podiumClass`.
- Alternates considered: **The Circuit** (competitive-circuit connotation, slight esports echo, but
  collides with the leagues' "circuit-style" language already in the codebase), **Command Class**
  (director authority, slightly militaristic), **Maestro Class** (directing, but soft on
  competition), **Corps Command** (reads like a different product).

The rest of this document uses Podium Class / `podiumClass`.

---

## 2. Research Foundations

### 2.1 What made FMA work for 15 years (keep all of this)

From a deep dive of fantasymarchingarts.com — guide, stats archive, player directory, and forums
(including the community "FMA Rework" thread, viewtopic/4475):

1. **The daily score drop.** Every event scores once daily at 8 PM Eastern. The entire community
   checks results simultaneously and argues about them in season megathreads. It is a shared,
   scheduled dopamine moment — the single strongest hook. marching.art already has a nightly
   scoring job; Podium Class must present it as a *communal event*, not a background job.
2. **Deterministic optimization.** Rehearsal maps to caption growth with near-zero randomness (FMA's
   only variance is ±0.005-scale "judge perspective" jitter added in 2012 to break ties).
   Placement feels *earned*. Veteran players explicitly warned the Rework effort not to add
   creative/subjective scoring — "it would fundamentally alter the game's stat-focused design."
3. **The challenge-level knob.** At season start you pick 1-of-8 difficulty per show section: low =
   early, safe, capped growth; high = late, risky, higher ceiling. This one slider generates the
   entire "peak timing" metagame and is the most-loved strategic mechanic. Podium Class keeps it.
4. **Identity and permanence.** 15-year-old corps with names, hometowns, repertoire, trophy cases,
   and rivalry history. Players return after 80-season absences because *their corps is still
   there*. marching.art already has corps identity, `seasonHistory`, Hall of Champions — Podium
   Class inherits all of it.
5. **The rehearsal verb.** FMA's guide: "you will probably spend the most time on the Rehearsal
   page." Spending energy on sectionals/ensemble actions and watching "+43 Music Ensemble" pop is
   the core minute-to-minute loop.
6. **Multi-group portfolio play.** Directors run corps + band + guard + drumline simultaneously.
   marching.art's per-class corps map is the same shape — Podium Class simply becomes a fifth
   portfolio slot with a completely different management texture.
7. **Community authorship.** Press releases, player-maintained ranking spreadsheets with caption
   awards, fan votes, a community-run fantasy side game. The social layer was the product; the sim
   was the pretext. Where FMA left this to volunteers, marching.art should build it in
   (see §5.8).

### 2.2 What FMA players begged for and never got (fix all of this)

Ten years of Suggestions-board and Rework-thread sentiment, distilled:

| Complaint | Podium Class answer |
|---|---|
| Abandonment — no meaningful update in ~a decade | Shipping this class *is* the answer; it's the "FMA 3.0" the Rework thread tried to spec |
| Dated UI (site still ships jQuery 1.8.3) | marching.art's existing React/Tailwind dashboard aesthetic |
| Opaque division assignment (influence + bank secretly weighted; chronic misplacements) | Transparent, published formula; divisions seeded purely from prior Podium results (§5.7) |
| Nothing to spend money on ("other than staff and comps, there's nothing to buy") | Travel, food, staff, clinicians are real recurring CorpsCoin sinks (§5.6) |
| Rich-get-richer influence compounding — catch-up is "generational" | No influence stat. Staff bonuses are capped and season-scoped; skill expression dominates account age |
| Inactive groups keep scores; activity doesn't matter enough | Cleanliness decay for unrehearsed captions; condition system makes daily attention matter (§5.3, §5.4) |
| No morale/wellness layer (top Rework request: "motivation mechanic requiring energy upkeep") | The condition system: rest, meals, travel fatigue (§5.3) |
| No stat decay, no clinicians, no named staff (Rework requests) | All three included (§5.4, §5.6) |
| No moderation, alt-account cheating | Idempotent server-side actions, per-day action budget, existing auth/admin tooling (§9) |

### 2.3 Codebase integration points (what already exists)

From the architecture survey — this class was designed against the actual code:

- **Tabs:** `src/components/Dashboard/sections/ControlBar.jsx` iterates `CORPS_CLASS_ORDER`
  (`src/utils/corps.ts`). Adding `podiumClass` to the order + labels + colors adds the tab.
- **The render space:** `src/pages/Dashboard.jsx` Zone C renders `ActiveLineupTable` +
  `LineupSimulatorPanel` keyed off `activeCorpsClass`. `LineupSimulatorPanel` already returns
  `null` for SoundSport — the conditional-render precedent exists.
- **Separate scoring precedent:** SoundSport is excluded from `RANKED_CLASSES` in
  `functions/src/helpers/scoring.js` and gets ratings instead of placements. Podium Class uses the
  same exclusion mechanism but gets its *own* ranking pass.
- **Schedule:** `game-settings/season` defines the 49-day (off-season) / 70-day (live) calendar;
  shows live in a schedule subcollection with locations; championship auto-enrollment (days 45–49)
  already exists in `scoringAwards.js`. Podium corps ride this unchanged.
- **Historical data:** `historical_scores/{year}` docs contain per-event, per-corps caption
  breakdowns (`GE1, GE2, VP, VA, CG, B, MA, P`, each 0–20) with `offSeasonDay` 1–49 — exactly the
  training corpus the scoring engine needs. The regression machinery in
  `functions/src/helpers/scoringMath.js` already fits historical curves.
- **Nightly pipeline:** `dailyOffSeasonProcessor` / `processDailyLiveScores` (02:00 ET) +
  `scoringRunGuard.js` idempotency + `chunkedWriter.js`. Podium scoring is a new stage in the same
  run.
- **Economy:** CorpsCoin earn/spend (`functions/src/callable/economy.js`), XP levels, shop and
  prestige catalogs — reused as-is for unlocks, staff, and logistics costs.
- **Unbuilt-but-planned systems:** `project_plan.txt` ("Ultimate Director Sim v5.3") already
  promised Staff Management, Equipment & Logistics, and rehearsal as future features, and
  `ARCHITECTURE.md` notes TS types exist without backends. Podium Class is the vehicle that
  finally ships them.

---

## 3. The Core Fantasy and the Three Loops

**The fantasy:** it's the first week of June. Your corps is at spring training with a hard book and
62 points of potential. Every day between now and Finals week you decide what the corps works on,
when it travels, what it eats, and when it rests — and every night the recap tells you whether you
called it right.

### Daily loop (2–5 minutes, the habit)

1. Open the dashboard → Podium tab. **Director's Sheet** shows today: rehearsal day, show day, or
   travel day, plus corps condition (stamina, morale) and yesterday's caption deltas.
2. **Allocate today's rehearsal blocks** (the six blocks, §5.2) — or declare a light day / full rest
   day. One decision, real consequences, informed by last night's recap.
3. On show days: watch for the nightly score drop; read the recap; compare caption-by-caption
   against rivals.

### Weekly loop (the strategy)

- Select next week's shows (existing 4-per-week mechanic) — but now the *route matters*: distances
  between venues cost stamina and CorpsCoin (§5.3).
- Review the **Trajectory Panel**: your caption curves plotted against historical percentile bands
  for this day of the season ("your brass is tracking the 78th percentile of historical Day-24
  brass scores").
- Adjust the rehearsal plan for the coming week; consider a clinician hire for a lagging caption.

### Seasonal loop (the campaign)

- **Pre-season (registration window):** name/keep your corps, choose show concept, and set the
  eight **Challenge Levels** — one per caption, 1–8 (§5.1). This is the FMA audition/challenge
  ritual reborn.
- **Weeks 1–2:** install content. Growth is fast, everything is dirty, everyone is fresh.
- **Weeks 3–5:** the grind. Trade-offs bite: travel fatigue accumulates, neglected captions decay,
  mid-season slumps are real and must be managed.
- **Week 6 (days 43–49):** the peak push. Do you rest into Finals or clean until the last minute?
  Championship auto-enrollment (existing system) gives everyone the Prelims → Semis → Finals arc.
- **Season end:** recap with caption awards, trophy case updates, staff carry-over decisions, and
  the next season's registration opens — FMA's "always another season" cadence, which marching.art
  already runs back-to-back.

---

## 4. Scoring Engine — Rooted in `historical_scores`

This is the heart of the class and the thing FMA never had: **realism calibrated against 20+ years
of actual DCI recaps.**

### 4.1 Mining the corpus (one-time + per-season refresh)

An offline analysis job (`functions/scripts/buildPodiumCurves.js`) processes every
`historical_scores/{year}` document:

1. **Normalize trajectories.** For every corps-season, for each of the 8 captions, extract the
   `(offSeasonDay, captionScore)` series.
2. **Fit growth curves.** Fit a logistic (S-curve) per corps-season-caption:
   `score(d) = L / (1 + e^(−k(d − d₀)))` — parameters: ceiling `L`, growth rate `k`, inflection day
   `d₀`. Drum corps score growth is famously logistic (fast June growth, July grind, August
   compression), so fit quality should be high; fall back to the existing regression from
   `scoringMath.js` where it isn't.
3. **Build day-indexed percentile bands.** For each caption × day 1–49: p5/p25/p50/p75/p95/max of
   all historical scores at that day. These bands are the **realism envelope** — no Podium corps
   can ever score outside what the historical record says is possible for that caption on that day.
4. **Build delta distributions.** Distribution of day-over-day caption changes at each phase of the
   season (captures the truth that +0.4/day in brass is normal in June and absurd in August, and
   that captions *do* go down — the p25 delta is negative in some late-season windows).
5. **Cluster into archetypes.** k-means over `(L, k, d₀)` per caption yields 3–5 named growth
   archetypes (e.g. *Early Installer*, *Steady Climber*, *August Surger*). These become the
   observable shapes that Challenge Levels select between (§5.1) — so the risk/reward knob is
   literally parameterized by how real corps seasons unfolded.

Output: a compact `podium-config/curves` Firestore document (plus a bundled JSON fallback in
`functions/src/helpers/podium/curveData.json`) — percentile bands, delta bounds, and archetype
parameters. Regenerated whenever a new season of live-scraped data lands in `historical_scores`.

### 4.2 The corps model

Each Podium corps carries, per caption `c ∈ {GE1, GE2, VP, VA, CG, B, MA, P}`:

| Field | Range | Meaning |
|---|---|---|
| `challenge[c]` | 1–8 | Set at registration, locked for the season. Selects the growth archetype: ceiling `L(c)` and inflection timing. Higher = higher ceiling, later and less certain payoff |
| `content[c]` | 0–100% | How much of the book/technique is *installed*. Grows from rehearsal, front-loaded value |
| `clean[c]` | 0–100% | Execution quality of installed content. Grows from rehearsal, decays if neglected, is what converts potential into score |
| `peak[c]` | derived | The effective ceiling today: `L(c) × f(content, clean)` |

**Daily caption score:**

```
raw(c, d)   = L(c) · logistic(d; k(c), d₀(c)) · content(c) · (0.72 + 0.28 · clean(c))
score(c, d) = clamp(raw(c,d) + condition(d) + variance(d,c), band_p5(c,d), band_max(c,d))
total(d)    = min(100, [GE1+GE2] + [VP+VA+CG]/2 + [B+MA+P]/2)
```

- The total formula is **identical to the existing fantasy formula** in `scoring.js` (GE full
  weight, Visual/Music halved) so Podium scores read exactly like every other score in the game and
  like a real DCI recap.
- `condition(d)` is the small signed modifier from stamina/morale (§5.3) — bounded to roughly
  ±0.15 per caption (±1.2 total), enough to decide a rivalry, never enough to fake a season.
- `variance(d,c)` is FMA-faithful judge jitter: deterministic per `(seasonUid, day, uid, caption)`
  seed, magnitude ≈ ±0.05 per caption. It breaks ties and makes recaps breathe; it never changes a
  well-managed season's outcome. **No other randomness exists anywhere in the engine.**
- The clamp against the historical band is the realism guarantee: a Day-10 brass score cannot be
  18.4 because no Day-10 brass score in history was 18.4.

### 4.3 The season arc this produces

Calibration targets, straight from the corpus: a top-percentile-managed corps arcs roughly 70–72
(day 1) → 84–86 (day 25) → 97–99 (day 49); a median corps 60 → 75 → 85; a neglected corps installs
early points then visibly plateaus and slides down the rankings as everyone else's slope continues.
Caption peaks and lows emerge naturally: hammer brass for two weeks and your visual captions sit at
low `clean` values, plateau, and start decaying — the recap will show exactly the lopsided,
realistic caption profile a real corps with that rehearsal balance would show.

---

## 5. Systems Design

### 5.1 Challenge Levels (the FMA knob, per caption)

At registration, eight sliders (1–8), one per caption. Level maps to archetype parameters mined in
§4.1:

- **Level 1–2:** *Early Installer* curve — low ceiling (`L` ≈ p40 of historical finals scores for
  that caption), early inflection, high `content` gain per block. You will look great in June.
- **Level 4–5:** *Steady Climber* — median ceiling, textbook logistic.
- **Level 7–8:** *August Surger* — ceiling at p90–p97, late inflection, `content` installs slowly
  and `clean` gains are back-loaded; skipping rehearsal days is punished hardest here.

Total challenge across captions is **unconstrained** — running eight 8s is legal and historically
authentic (it's the Blue-Devils-hard-book gambit), but the condition system (§5.3) makes it brutally
expensive to actually clean. The interesting builds mix: an 8 in brass and GE1, 5s elsewhere, is a
"music corps" identity that the recap will reflect all season.

### 5.2 Rehearsal — the six blocks

The daily verb. Each rehearsal day grants a number of **blocks** (base 3; modified by day type and
condition). Each block is assigned to one of six rehearsal types. Caption effect matrix
(P = primary gain, S = secondary, in both `content` and `clean` with a season-phase-dependent
split):

| Block | GE1 | GE2 | VP | VA | CG | B | MA | P |
|---|---|---|---|---|---|---|---|---|
| **Visual Basics** | | | **P** | S | S | | | |
| **Visual Ensemble** | | **P** | S | **P** | S | | | |
| **Front Ensemble** | S | | | | | | S | **P** |
| **Brass Sectionals** | S | | | | | **P** | S | |
| **Percussion Sectionals** | | | | | | | S | **P** |
| **Full Ensemble** | **P** | **P** | | S | S | S | **P** | S |

Notes:

- Color guard (`CG`) trains through Visual Ensemble and Full Ensemble — the guard cleans inside the
  ensemble, which is defensible and keeps the block list at the canonical six. A dedicated
  **Guard Sectional** seventh block is a fast follow if CG-focused builds feel starved (flagged in
  §12 open questions).
- **Diminishing returns within a day:** the 2nd consecutive block of the same type yields ~60%, the
  3rd ~35%. Balance is mechanically rewarded, spam is not — this is the direct implementation of
  "realistic variation in caption peaks and lows based on a balance of rehearsal."
- **Phase-dependent yield:** early season, blocks feed mostly `content`; late season, mostly
  `clean`. The engine surfaces this ("Full Ensemble today: +2.1% GE content, +0.4% clean") so the
  player learns the season's texture.
- **Neglect decay:** a caption unrehearsed for 3+ consecutive days loses `clean` at an accelerating
  trickle (calibrated from the negative tail of the historical delta distributions). Decay never
  touches `content` — you don't forget the book, you get dirty. This is the Rework thread's #1
  requested mechanic and the anti-idle backbone.
- The FMA "Action Complete!" moment is sacred: every allocation returns an immediate, satisfying
  itemized result panel. Instant feedback on the action; competitive consequence only at the
  nightly drop.

### 5.3 Condition — travel, food, rest, performance load

Two meters, both 0–100, both visible at all times:

- **Stamina** — drained by rehearsal blocks (heavier for high-challenge captions), show
  performances (−12), and travel; recovered by rest (+30/rest day, +8 overnight baseline) and food
  quality.
- **Morale** — moved by results (beating a rival +, a slide −), rest cadence, food quality, and
  streaks of maxed-out rehearsal days (grind fatigue). Recovers on show days that go well.

Effects are deliberately gentle but persistent: high condition adds up to +0.15/caption and +5%
block yield; depleted condition subtracts the same and, below thresholds, costs a rehearsal block
("the corps is cooked — 2 blocks today"). Condition **cannot** raise a score above what rehearsal
built — it modulates, never substitutes (the FMA-purist constraint from §2.1.2).

**Travel:** show venues have locations (already in the schedule data). Each attended show charges a
stamina + CorpsCoin cost from the distance to the previous location — the existing "pick 4 shows a
week" mechanic silently becomes a routing puzzle. A Texas swing after a Florida weekend is a real
decision with a real cost, exactly like the actual tour.

**Food:** a weekly food-budget setting (per week, three tiers): *Gas-station* (cheap, −stamina
recovery, morale risk), *Standard* (baseline), *Full kitchen crew* (CorpsCoin cost, +recovery,
+morale floor). One decision a week, compounding effect — not micromanagement.

**Rest days:** declaring a full rest day forfeits all blocks, recovers big, and shields against
decay for that day. The Finals-week question — *rest into Saturday or clean until the last
minute?* — falls out of the mechanics with zero special-casing.

### 5.4 Show days and the nightly drop

- Podium corps attend the **same shows on the same schedule** as everyone else (selected via the
  existing `selectUserShows` flow). Show days grant 1 rehearsal block (morning run-through), charge
  performance stamina, and are the only days a Podium corps receives an official score.
- Scores post in the existing nightly pipeline. The recap entry carries the full caption breakdown,
  placement *within Podium Class only*, and phase-appropriate color ("Brass +0.3 since
  Tuesday — 2nd in class").
- Non-show days still matter (that's when you out-rehearse the corps you'll meet on Saturday), but
  nothing is scored — so skipping a quiet Tuesday costs you growth, never a recorded result.
  Forgiving to miss, rewarding to show up: the retention-safe version of FMA's energy pressure.

### 5.5 Separate scoring, shared everything else

Hard requirement, clean solution — the SoundSport precedent, extended:

- `podiumClass` is added to class configs everywhere but **kept out of `RANKED_CLASSES`** in
  `scoring.js`, so the fantasy ranking pass never sees it.
- A dedicated `computePodiumRankings` pass ranks Podium corps against each other only, writing
  `seasonRank`/`seasonRankOf` on the corps map entry exactly like the fantasy classes get — same
  fields, different competition.
- Recap entries live in the **same** `fantasy_recaps/{seasonUid}/days/{day}` documents with
  `corpsClass: 'podiumClass'`, filtered by class everywhere recaps are read (the filter already
  exists for class-specific views). Leaderboards, leagues, rivals, and the Hall of Champions can
  then adopt Podium with per-class filters rather than new collections.
- Podium scores and fantasy scores are never summed, compared, or cross-ranked anywhere. Same
  season, same shows, same night, different game.

### 5.6 Economy — finally, something to buy

All existing currency; new recurring sinks (the FMA community's "nothing to spend money on" fix):

| Sink | Cost shape | Effect |
|---|---|---|
| **Class unlock** | Level 8 or 4,000 CorpsCoin (between Open and World) | Access to Podium Class |
| **Caption staff** (8 slots, named + persistent) | Hire + per-season retainer | +yield% on mapped rehearsal blocks; capped tiers (bronze/silver/gold) so veterans get identity, not runaway power |
| **Clinicians** (Rework request) | One-off, 3-day engagement | Temporary large yield boost on one block type; the "my brass is drowning" panic button |
| **Travel** | Per-mile per show | The routing cost (§5.3) |
| **Food plan** | Weekly tier | Recovery/morale (§5.3) |

Earn side reuses existing hooks: show participation (Podium tier ≈ 175, between Open and World),
league wins, season-finish bonuses. Staff persistence between seasons is the long-game attachment
(FMA's staff ladder) with hard caps to avoid the influence-compounding trap (§2.2).

### 5.7 Progression, divisions, and season persistence

- **Persists across seasons:** corps identity, trophy case, `seasonHistory`, staff roster, director
  XP/level. **Resets:** captions, condition, challenge levels (new show every season). Exactly
  FMA's persistence split, minus influence.
- **Divisions (season 2+ of the class):** once population supports it, split Podium into divisions
  seeded *transparently and only* from the previous Podium season's final score (published
  formula, promotion/relegation shown on the season recap). This answers a decade of FMA division
  rage. Season 1 runs as a single open division.
- **Trophy case & awards:** end-of-season caption awards (Best Brass, Best GE, Most Improved,
  Iron-Corps for best condition management) written into the existing achievements/prestige
  systems. FMA's community ran these in Google Sheets; here they're product.

### 5.8 The social layer (build in what FMA's community had to invent)

Phase-4 scope, listed because it is *why* FMA survived abandonment:

- **Season megathread, in-product:** a per-season Podium discussion feed anchored to the nightly
  drop (existing comments infrastructure).
- **Press releases:** corps announcements (show reveal, staff hires) as structured posts —
  FMA's most active forum board, productized.
- **Rankings column:** the nightly job already computes everything a "power rankings" article
  needs; the existing news-generation pipeline can publish a weekly Podium column with caption
  awards automatically.
- **Leagues:** Podium corps join existing leagues; weekly head-to-head uses Podium scores within
  Podium matchups only.

---

## 6. UI — What Renders in Zone C

When `activeCorpsClass === 'podiumClass'`, `Dashboard.jsx` Zone C swaps
`ActiveLineupTable` + `LineupSimulatorPanel` for three new components (same footprint, same
`data-tour` region):

1. **`RehearsalPlanner`** *(replaces ActiveLineupTable — the primary interactive surface)*
   Today's day type (rehearsal / show / travel), block allocator with the six blocks as large
   tap-targets, live yield preview per block given current phase/condition/staff, the
   "Action Complete" result panel, and rest-day / light-day declarations. One-thumb mobile
   operation is a hard requirement — this is the daily habit surface.
2. **`CorpsConditionPanel`** *(compact strip)*
   Stamina + morale meters, food-plan setting, this week's travel route with costs, decay warnings
   ("Percussion: 3 days unrehearsed").
3. **`CaptionTrajectoryPanel`** *(replaces LineupSimulatorPanel — the analyzer analogue)*
   Eight sparkline curves of the season so far, each drawn over its historical percentile band
   (p25–p75 shaded, p95 dashed) for the current day — "your VA is 74th percentile for Day 31."
   Weak-spot callouts mirror the Lineup Analyzer's swap suggestions: "Visual Ensemble has the best
   marginal yield tomorrow."

ControlBar: `podiumClass` appended to `CORPS_CLASS_ORDER` with short label `Podium`, its own class
color, and the existing locked/create/active tab states. `NextPerformancePanel`, `SeasonScorecard`,
rivals, and recap feeds work unchanged (they key off the corps map entry and recap docs, which
Podium populates identically).

---

## 7. Data Model

### 7.1 Corps map entry (new fields on the existing profile shape)

```js
// artifacts/marching-art/users/{uid}/profile/data → corps.podiumClass
{
  corpsName, location, showConcept, class: 'podiumClass',      // existing identity fields
  totalSeasonScore, lastScoredDay, weeklyScores, seasonRank,   // existing scoring fields
  selectedShows: { week1: [...], ... },                        // existing show selection

  podium: {
    challenge:  { GE1: 6, GE2: 5, VP: 4, VA: 4, CG: 3, B: 8, MA: 5, P: 7 },
    captions:   { GE1: { content: 0.42, clean: 0.31, lastRehearsed: 17 }, ... },
    condition:  { stamina: 71, morale: 84 },
    foodPlan:   'standard',                     // per-week tier, current week
    staff:      { B: { name, tier, hiredSeason }, ... },
    clinician:  { block: 'brassSectionals', expiresDay: 24 } | null,
    today:      { day: 22, blocksUsed: 2, blocks: ['visualBasics','fullEnsemble'],
                  restDay: false },             // written by the callable, read by the processor
    travelLog:  [{ day, fromShow, toShow, miles, coinCost, staminaCost }],
  }
}
```

### 7.2 New/changed documents

| Path | Purpose |
|---|---|
| `podium-config/curves` | Percentile bands, delta bounds, archetype params from the corpus job (§4.1) |
| `podium-config/balance` | Tunables: block yields, decay rates, condition coefficients — hot-adjustable without deploys |
| `fantasy_recaps/{seasonUid}/days/{d}` | Existing docs; Podium results appear as entries with `corpsClass: 'podiumClass'` |
| `game-settings/season` | Unchanged — Podium reads the same schedule |
| `firestore.rules` | Podium fields writable only via functions (all mutations go through callables) |

Every game-state mutation is server-side (callable-validated) — client never writes caption or
condition values. This is non-negotiable for a competitive class (FMA's alt-account cheating
lesson).

---

## 8. Cloud Functions

### New: `functions/src/callable/podium.js`

| Callable | Does |
|---|---|
| `registerPodiumCorps` | Extends existing registration; validates challenge levels; initializes caption state from the corpus baselines for the chosen challenge profile |
| `allocateRehearsalBlock` | The daily verb. Validates block budget for the day (server-derived from day type + condition), applies yields (staff/clinician/phase/diminishing-return multipliers), applies immediate state update, returns the itemized result panel. Idempotency: per-`(uid, seasonUid, day, blockIndex)` |
| `setRestDay` / `setFoodPlan` / `hireStaff` / `hireClinician` | Setup verbs; CorpsCoin transactions via the existing economy helpers |

### Extended: nightly pipeline (`dailyProcessors.js`)

New stage `processPodiumDay(seasonUid, day)` after fantasy scoring, inside the existing run guard:

1. Apply overnight recovery + neglect decay to every active Podium corps.
2. For corps performing today: compute caption scores (§4.2), clamp to bands, write recap entries.
3. Charge travel for tomorrow's movements; roll `today` state forward.
4. `computePodiumRankings` → `seasonRank` per corps.
5. Existing downstream (rivals job, leaderboards, league matchups) picks Podium up via class
   filters.

### New script: `functions/scripts/buildPodiumCurves.js`

The corpus-mining job from §4.1. Run manually per new data year; output committed as JSON +
uploaded to `podium-config/curves`.

### Config touchpoints (the mirrored-constant checklist)

`src/utils/corps.ts` (`CORPS_CLASS_ORDER`, labels, colors) · `src/config/index.ts`
(`GAME_CONFIG.corpsClasses`) · `sections/constants.js` (unlock level/cost) ·
`src/utils/captionPricing.js` (unlock mirrors; Podium has **no point cap** — flag it exempt) ·
`functions/src/callable/lineups.js` `validClasses` (Podium must be *rejected* by `saveLineup` — it
has no lineup) · `registerCorps.js` (registration lock: 5 weeks, matching Open) ·
`economy.js` (unlock cost, participation reward) · `scoring.js` (excluded from `RANKED_CLASSES`) ·
`firestore.rules`.

---

## 9. Balance, Fairness, Anti-Exploit

- **Determinism audit:** given identical decisions, two corps score identically up to the seeded
  jitter. Publish this fact; it's the FMA covenant.
- **No catch-up walls:** a mid-season joiner gets a compressed content baseline (the corpus knows
  what a Day-20 median corps looks like) so late starts are playable but never advantaged.
- **Action-budget enforcement server-side:** blocks/day derived from server state; replayed or
  parallel calls are idempotent no-ops. Alt accounts gain nothing transferable (no trades, no
  gifting in Podium).
- **Tunables in Firestore, not code** (`podium-config/balance`): the first two seasons will need
  live rebalancing; no deploy required.
- **Simulation harness before launch:** a test script plays 1,000 archetypal seasons (greedy
  brass-spam, perfectly balanced, chronically absent, rest-optimizer) and asserts the resulting
  score distributions sit inside historical bands and that "balanced + present" strictly dominates
  "spam + absent." This is the tuning loop and the regression suite in one.

---

## 10. Implementation Phases

| Phase | Scope | Est. effort |
|---|---|---|
| **0 — Corpus & engine on paper** | `buildPodiumCurves.js`, band/archetype validation notebook, balance doc with concrete coefficients, simulation harness | 1–2 wks |
| **1 — Core loop (internal alpha)** | Class registration + config touchpoints, `allocateRehearsalBlock`, nightly `processPodiumDay` (no condition system), `RehearsalPlanner` + `CaptionTrajectoryPanel` in Zone C, recap integration | 3–4 wks |
| **2 — Condition & logistics** | Stamina/morale, travel costs off show locations, food plans, rest days, decay, `CorpsConditionPanel` | 2–3 wks |
| **3 — Economy & persistence** | Staff (named, tiered, persistent), clinicians, unlock flow, season archival/rollover, caption awards | 2 wks |
| **4 — Social & polish** | Season feed, press releases, auto power-rankings column, league integration, division seeding design | 2–3 wks |
| **Beta** | One full off-season cycle (49 days) with a capped cohort, tunables live-adjusted weekly, then general unlock the following season | 1 season |

Phases 1–2 are the minimum lovable product: the daily rehearsal habit, real scores at real shows,
trajectory bands. Everything after deepens rather than gates.

---

## 11. Why This Retains Players (the addiction audit, honestly)

1. **A reason to open the app every single day** that takes two minutes and is a *decision*, not a
   claim button — and whose consequence arrives at a communal nightly moment.
2. **Streak-compatible, punishment-light:** missing a day costs growth (opportunity) and risks
   decay (mild), never a recorded loss. FMA's model, softened at the edges.
3. **Seasons end.** 49 days, a championship, a recap, a trophy — then a fresh sheet with your name
   still on the door. The "one more season" loop is FMA's deepest hook and marching.art already
   runs the calendar for it.
4. **Skill expression with receipts:** the trajectory-vs-percentile view lets a player *see* they
   out-directed the field, and the deterministic engine means it's true.
5. **Identity accrual:** named staff, trophy shelves, caption-award banners, rivalry history —
   possessions that make quitting feel like abandoning something.
6. **Two-game texture:** fantasy classes are *drafting* games (evaluation skill); Podium is a
   *management* game (planning skill). Existing players get a second, orthogonal reason to log in;
   the two share one schedule, one economy, one identity, one nightly moment.

---

## 12. Open Questions

1. **Guard sectional as a 7th block** — ship with six (user-canonical) and watch CG-build health,
   or include from day one?
2. **Live-season behavior** — during live seasons the schedule has 21 spring-training days before
   day 1. Proposal: Podium treats spring training as pure rehearsal days (content installation
   with no shows) — arguably the *best* version of the class — but it doubles the calibration
   surface. Off-season-only for v1?
3. **Point-cap semantics** — Podium has no lineup and no cap; `currentPointCap` on
   `game-settings/season` is irrelevant to it. Confirm nothing downstream assumes every class has
   a cap.
4. **Nightly-drop presentation** — scores currently process ~02:00 ET. Keep the processing time but
   add an evening "recap reveal" moment (notification + feed post at 8 PM ET for the *previous*
   night's full recap), or move Podium's reveal to align with FMA's sacred 8 PM ritual?
5. **Name** — Podium Class is the recommendation; Circuit/Command/Maestro are on the bench.

---

*Sources: full crawl of fantasymarchingarts.com (guide sections 1–17, stats archive seasons 1–140,
player directory, forums incl. FMA Rework viewtopic/4475, division-assignment threads, World
Championship proposals, Suggestions board) and a full architectural survey of this repository
(dashboard, class system, scoring pipeline, schedule system, economy, and the unbuilt Staff/
Equipment systems planned in `project_plan.txt`).*
