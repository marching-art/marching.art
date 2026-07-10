# Podium Class — Design Document

**A director-simulation game class for marching.art, spiritual successor to Fantasy Marching Arts**

Status: Proposal v1.3 · July 2026 — v1 open questions resolved (guard sectionals in, live
season in with spring training design, no evening reveal window, director-hosted events added);
v1.2 promotes the round-two backlog into committed design (regional anchors, joint rehearsals,
assistant director, historical shadows, climate, Director Rating, named hardware) and clarifies
that Podium is never locked out of week-1 events; v1.3 names the anchor calendar after the real
DCI majors and adds integrated World / Open / A divisions inside Podium; v1.4 specs the
two-night Eastern Classic split; v1.5 hard-codes the branded majors in the schedule generator
(implemented) and sets the counts-as-one / even-split / Podium-auto-registration rules; v1.6
adds the Gap & Conflict Register (§14) — open design decisions live there

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
2. **Allocate today's rehearsal blocks** (the seven blocks, §5.2) — or declare a light day / full rest
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

### 5.2 Rehearsal — the seven blocks

The daily verb. Each rehearsal day grants a number of **blocks** (base 3; modified by day type and
condition). Each block is assigned to one of seven rehearsal types. Caption effect matrix
(P = primary gain, S = secondary, in both `content` and `clean` with a season-phase-dependent
split):

| Block | GE1 | GE2 | VP | VA | CG | B | MA | P |
|---|---|---|---|---|---|---|---|---|
| **Visual Basics** | | | **P** | S | S | | | |
| **Visual Ensemble** | | **P** | S | **P** | S | | | |
| **Guard Sectionals** | | S | | S | **P** | | | |
| **Front Ensemble** | S | | | | | | S | **P** |
| **Brass Sectionals** | S | | | | | **P** | S | |
| **Percussion Sectionals** | | | | | | | S | **P** |
| **Full Ensemble** | **P** | **P** | | S | S | S | **P** | S |

Notes:

- Color guard (`CG`) has its own sectional block (primary CG, secondary VA/GE2 — the guard *is*
  a visual-effect engine) and still gains secondarily from Visual Ensemble and Full Ensemble, so
  a guard-forward build is viable and an ensemble-only guard stays merely adequate.
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
- **Assistant director (plan template):** every corps can save a default weekly rehearsal plan.
  On any day the director doesn't log in, the assistant executes the template at **~85% yield**
  and cannot declare rest days or accept joint rehearsals. Active play strictly dominates, but a
  vacation doesn't wreck a season. This one mechanic fixes both of FMA's opposite complaints at
  once: inactive groups coasting on stale scores, and an energy system that punished anyone who
  couldn't log in 3–4 times a day.

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

*How distances are known when schedules are regenerated every season:* the schedule is random per
season, but the **venue universe is not** — every generated schedule samples historical events, and
every event (historical or live-scraped) carries a `location` string. Across the 13-year archive
there are only ~414 distinct location strings, so travel resolves against a one-time
**venue gazetteer** (`podium-config/venues`): a build script normalizes each distinct string
(trim punctuation, canonicalize state names, fuzzy-match dirty entries like "Rockford Illinois")
and geocodes it once to lat/lon from a bundled offline city dataset — a few hundred rows,
hand-reviewable, zero runtime API dependency. Resolution happens at **schedule-generation time**:
when `generateOffSeasonSchedule` builds a season (or the scraper ingests a live event), each event
is stamped with its resolved `venueId` + coordinates, so schedule docs are self-contained and all
downstream distance math is trivial and deterministic. A never-seen live-season city falls back in
tiers: fuzzy match → one cached geocoding call → state centroid + admin-review flag; scoring never
blocks on it. Distance itself is haversine × 1.2 road factor, then **bucketed into travel tiers**
(Local &lt;75 mi / Day Trip / Overnight Haul / Long Haul / Cross-Country &gt;1,200 mi) — buckets, not raw
mileage, are the gameplay interface: legible to players, tunable in `podium-config/balance`, and
free of false precision. A corps' route is the chain of legs between its consecutive attended
shows, and the season's first leg starts from the corps' **hometown** — the `location` field
directors already set at registration finally matters mechanically (it's also where spring
training is housed). Costs are shown in the weekly show picker *before* selections are confirmed,
so routing is played as an open-information puzzle, and hosted events (§5.10) slot in automatically
because hosts choose their venue city from the same gazetteer.

**Climate (deterministic):** venue latitude + calendar date produce a published **heat index** per
show that scales that day's stamina drain — a July swing through Texas genuinely costs more than a
week in Ohio, and a director can see it in the show picker before committing. No RNG, no weather
rolls: the index is a fixed function of geography and date (tunable table in
`podium-config/balance`), so it adds routing texture without violating the determinism covenant.

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
- **Divisions — World / Open / A, inside Podium (season 2+):** Podium divides into its own three
  DCI-named divisions, competing on the same engine but ranked, cut, and crowned separately:
  - **Naming:** *World Class / Open Class / A Class* — deliberately the DCI names (and the game's
    existing vocabulary). UI always shows the compound to avoid collision with the fantasy tabs:
    "Podium · Open Class". The multi-season climb A → Open → World is the career arc, and it is
    the strongest possible answer to "what persists between seasons."
  - **Seeding — transparent and Podium-only** (the anti-FMA principle; FMA secretly weighted
    influence and bank balance into division placement and players raged about it for a decade):
    a published **seeding score** = decayed average of your last three Podium season finals
    results (weights 0.5 / 0.3 / 0.2). Nothing else enters: not CorpsCoin, not XP, not fantasy
    results, not account age. Every corps' seeding number is public before the season starts.
  - **Movement:** automatic promotion/relegation bands published with the formula (e.g. top 4 of
    A promote, bottom 4 of Open relegate — constants in `podium-config/balance`). Plus the
    DCI-authentic **petition up**: any corps may opt into a higher division at registration.
    No petitioning down, ever, and a returning division champion cannot re-enter that division —
    the two sandbagging guards.
  - **Inaugural season:** everyone competes in a single unified division (call it Open Class);
    its final standings seed the three-division structure for season 2. No history is invented.
  - **Population-adaptive:** division count follows active Podium population (1 division below
    ~24 corps, 2 below ~48, 3 beyond; never a division under 8). This is the direct fix for
    FMA's hollow Division III — thin divisions merge upward instead of limping.
  - **What divisions change:** rankings/leaderboards, championship-week brackets (World runs
    Prelims → Semis → Finals on days 47–49; Open and A crown earlier in the week, mirroring real
    DCI's Marion/Michigan City cadence), performance order and division blocks at the three
    regional anchors, show participation CorpsCoin (tiered by division, matching the existing
    class-reward pattern), and per-division caption awards.
  - **What divisions never change:** the scoring engine, the historical envelope, challenge-level
    access, rehearsal mechanics. A brilliant rookie in A Class can post the best raw score in the
    game — and the stats archive will let the forum argue about whether they'd have won World,
    which is exactly the argument FMA's players loved having for fifteen years.
- **Trophy case & awards:** end-of-season caption awards (Best Brass, Best GE, Most Improved,
  Iron-Corps for best condition management) written into the existing achievements/prestige
  systems. FMA's community ran these in Google Sheets; here they're product.
- **Named finals hardware:** the finals-week caption trophies carry persistent names, ideally
  honoring community figures — the Hall-of-Fame-into-product move FMA's volunteers would have made
  themselves. Winning "the [Name] Trophy for Brass" writes a named line into the trophy case,
  which is categorically stickier than a generic badge.
- **Director Rating:** a lifetime cross-class rating — the analogue of FMA's Player Directory sort
  key, the number its players chased for 15 years. It aggregates **placements** (percentile
  finishes, championship results, caption awards) across all five classes; it never touches raw
  scores, so fantasy and Podium results stay incomparable while still summing to one career
  number. Slots into the existing `lifetimeLeaderboard` job and profile lifetime stats.

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

### 5.9 Live seasons and spring training

Podium runs in **both** season types on the same schedule system, with no schedule changes:

- **Off-season (49 days):** day 1 is the first show, as today. The registration window doubles as
  implicit pre-season (challenge levels, staff, show concept) and captions initialize from the
  corpus baseline for the chosen challenge profile.
- **Live season (70 days = 21 spring training + 49 competition):** the 21 spring-training days —
  which the fantasy classes skip over entirely — become Podium's best content, not a problem to
  integrate:
  - **Move-in is a purchase decision.** Directors choose their move-in day (up to 21 days early).
    Each spring-training day costs CorpsCoin (housing + food for a corps that isn't earning), so
    a long camp is a real investment — exactly the economics that separate real corps. A late,
    cheap move-in is playable; it just arrives at the first show dirtier.
  - **All-days:** spring-training days grant 4–5 blocks (vs. 3 in-season), no travel costs, and
    feed `content` almost exclusively — this is where the book gets installed. Stamina drains
    faster and morale sags under consecutive max-block days ("the grind of everydays"), so even
    camp needs rest-day rhythm.
  - **Family Day:** the final spring-training day is an unscored exhibition run-through that
    returns a full diagnostic caption recap — your first look at the season, on the record for
    you, invisible to the leaderboard. It's the calibration checkpoint and a natural community
    moment (preview-show chatter is a DCI ritual).
  - The strategic identity of spring training is the install-vs-clean dial: come out of camp with
    90% content installed and filthy, or 70% and performance-ready. Both are historically
    authentic openings and the trajectory bands will show the trade-off all June.

**Podium is never locked out of week-1 events.** The two season types resolve this differently,
and neither needs a special rule:

- In **live seasons**, spring training occupies the existing 21 calendar days during which the
  nightly processor already skips scoring entirely — there are no events for *any* class in that
  window. Podium's camp fills what is currently dead air in the player experience, and every
  class hits competition day 1 together.
- In **off-seasons** there is no spring-training period at all (calendar day 1 is scored
  competition day 1), so Podium corps initialize **competition-ready** from the historical day-1
  percentile bands for their challenge profile — which is precisely what those bands describe: a
  real corps at its first show. The paid move-in mechanic simply doesn't exist in off-seasons.
- In both season types, **opening-show timing is elective** anyway: show attendance is already
  "up to 4 per week," not mandatory. A director may skip week-1 shows and pour those days into
  rehearsal — the authentic "we don't open until DeKalb" strategy — trading early recorded scores
  and CorpsCoin for a cleaner debut. Late-open vs. early-open is a strategic identity, not a rule.
- Mid-season registrants get the compressed catch-up baseline (§9): the corpus knows what a median
  day-N corps looks like. Playable, never advantaged.

### 5.10 Director-hosted competitions (all classes)

The FMA event-hosting system, rebuilt without its failure modes — and scoped game-wide, not just
Podium:

- **Hosting:** any director with enough CorpsCoin can host a show on an open date in the current
  season schedule: pick the day, name the event, choose a **venue tier** (high-school stadium →
  college bowl → NFL stadium: rising rental cost, rising corps capacity and payout ceiling).
  The event appears in the schedule subcollection alongside the historical events, selectable by
  every class through the existing `selectUserShows` flow.
- **Open enrollment, no gatekeeping.** FMA hosts accepted/declined applicants, which let
  profit-maximizing hosts exclude low-draw groups and froze out newer players (a documented
  decade-long complaint). Here enrollment is first-come within venue capacity, full stop.
- **Payout by attendance:** the host earns CorpsCoin per enrolled corps (scaled by venue tier),
  paid at the nightly processing of the event — instant gratification, not FMA's season-end lump.
  A full NFL-tier show profits well; a half-empty one loses money. The skill is picking the right
  date (avoid clashing with regional anchors), right tier, and building an event reputation.
- **Prestige loop:** events persist as named history — "The 5th Annual Rohn Invitational" — with
  the event's past winners on its page. Hosts can fund a trophy tier (extra CorpsCoin sink) that
  writes a real achievement to the winners' trophy cases. Leagues can host from the league bank
  (FMA's league-championship culture, productized).
- **Guardrails:** hosted-event cap per day (protects schedule legibility), host must field a corps
  that season, payouts tuned so the average host roughly breaks even and a *good* host profits —
  hosting is a skill sink, not a faucet. Scores at hosted events are computed identically to any
  other show; hosting confers zero competitive advantage.

### 5.11 Regional anchor days

Because directors pick up to 4 shows a week, two rivals might not share a floor for weeks — a
problem FMA never had, since its events were globally visible. The fix, straight from the real DCI
tour: **all of Podium Class attends the three majors and Championships Week.** The majors are
**hard-coded, branded, and exclusive** — like Championship Week, they are fixed events on fixed
days at fixed sites, never sourced from the historical pool, and **no other event shares their
day** (for any class):

| Major | Site | Day | Status |
|---|---|---|---|
| **marching.art Southwestern Championship** | Dallas, Texas | 28 | **Implemented** (`scheduleGeneration.js`, this branch) |
| **marching.art Southeastern Championship** | Atlanta, Georgia | 35 | **Implemented** |
| **marching.art Eastern Classic** | Allentown, Pennsylvania | 41–42 | **Implemented** — one event placed on both days with `multiNight: { nights: [41, 42] }` |
| **marching.art World Championships** | Prelims/Semis/Finals | 45–49 | Existing exclusive placement + auto-enrollment |

Implemented alongside: events carry an `eventTier: 'regional'` field (extending, not replacing,
the existing `isChampionship` boolean), threaded through every schedule persistence/read path
(`writeScheduleToCollection`, `getScheduleDay(s)`, the admin `regenerateOffSeasonSchedule`
transform, and the client `transformCompetitionToShow`), and the historical source majors
(`DCI Southwestern` / `DCI Southeastern` / `DCI East` / `DCI Eastern Classic`) are excluded from
the random pool so they can't reappear on neighboring days. Live seasons keep the real scraped
events untouched (live score matching is by event name); they get `eventTier` designation by
name-match at ingest instead.

- **Auto-registered for every active Podium corps, consuming one weekly slot:** in weeks 4, 5,
  and 6 a Podium director gets the major plus **3 free selections** (the standard weekly cap is
  4). Majors are **travel-subsidized** (no CorpsCoin leg; stamina cost still applies, so routing
  *around* an anchor still matters — Dallas in July is a real heat-index day). For the fantasy
  classes the majors are elective, but since the major is the only event on its day, attending
  week 4/5/6 shows means engaging with them.
- Full-field head-to-head meets: the guaranteed rivalry collisions, the recap everyone reads, and
  the community's shared reference points ("wait for San Antonio" is a real DCI sentence).
- **Calibration benchmarks** — the explicit veteran request from the FMA Rework thread: with the
  whole class scored on the same night at the same show, the trajectory-percentile claims become
  publicly verifiable.
- **Championship seeding input:** performance order and division cut lines for days 45–49 derive
  from anchor results by a published formula — transparent seeding, the anti-FMA-division-rage
  principle applied to scheduling. The three anchors also give the season its natural act
  structure: San Antonio answers "who's real," Atlanta answers "who's peaking," Allentown is the
  last full-field look before Indy.

**The Eastern Classic is a two-night stand (days 41–42), exactly like the real event.** The
generator places one branded event on both days, and the registration rule applies to **every
class**: *you register for one, you're registered for both* — the Eastern Classic counts as a
**single show** against the weekly cap (auto-registered for Podium), each corps performs on
exactly **one assigned night**, and attendees are **split evenly per class** across the two
nights:

- **Balanced snake split, published in advance.** After the day-38 nightly run (post-Atlanta
  standings), each class's registrants are distributed across the two nights by a snake draft —
  Podium on current seeding *within each division*, fantasy classes on current class rank
  (seeds 1, 4, 5, 8… one night; 2, 3, 6, 7… the other) — so both nights carry equal strength
  and every class and division appears both nights. The night lineups publish on day 39 — a
  mid-week community moment that mirrors DCI's real lineup announcements and gives the feed two
  days of "who got Friday?" chatter. `selectUserShows` needs the counts-as-one/no-double-select
  validation for `multiNight` events; night assignment happens server-side at the day-41 nightly
  run and persists so day 42 scores the complement.
- **One performance, one residency.** Each corps performs on its assigned night only
  (auto-enrolled, no weekly slot, no travel coin). The *other* Allentown day is a full rehearsal
  day at the site with no travel leg — the corps is housed in the Lehigh Valley between nights,
  exactly like the real tour.
- **The night-two effect is real, and we keep it.** A Saturday corps carries one extra day of
  growth relative to Friday scores — which is precisely why Saturday Allentown reads hotter on
  real DCI recaps. The snake split distributes that small uniform bump evenly across strength
  tiers, the effect is published rather than hidden, and night parity alternates season to season
  so no corps is structurally the Friday corps forever.
- **Two nightly drops, one event.** Each night scores in its own nightly run (half the field per
  recap — two consecutive evenings of results to argue about), and the UI presents a combined
  Eastern Classic standings view merging both nights once Saturday processes.
- **Generalized mechanism:** the schedule day gains `multiNight: { eventId, nights: [41, 42] }`
  metadata and the split/assignment logic is written event-agnostic, so any future two-night
  event (a hosted mega-event, a two-night league championship) reuses it.

### 5.12 Joint rehearsals

Two corps sharing a rehearsal day — the tour reality of shared housing sites and ensemble exchanges,
turned into the class's social mechanic. Fully mutual, capped, and deterministic:

- **The handshake.** Director A proposes a joint rehearsal to Director B for a specific upcoming
  day (both must be active Podium corps in the current season). B accepts or declines; the
  proposal expires unanswered at that day's block allocation. Assistant-director autoplay (§5.2)
  never accepts on a director's behalf — this is a deliberately *human* handshake.
- **Geography gates it.** Using the venue gazetteer, each corps has a "current location" at all
  times (hometown before its first show, otherwise its most recent venue). A joint rehearsal
  requires the two corps to be within the **Day Trip tier (≤250 mi)** of each other on that day —
  or one party pays the normal travel cost to close the gap. Tour routing thus shapes your social
  calendar, exactly as it does in real life: you rehearse with whoever's housed nearby.
- **What it does mechanically.** On the shared day, each corps' **Full Ensemble block yields
  +25%** and both receive a **morale bump** (+6; performing for an audience of peers). The bonus
  touches only Full Ensemble — it can sharpen ensemble captions, never substitute for balanced
  sectional work.
- **The scrimmage report (the real prize).** Both directors receive a **private head-to-head
  diagnostic**: a full caption-by-caption comparison scored as if tonight were a show — unofficial,
  invisible to leaderboards and recaps. It's scouting: the only way, outside a shared show or a
  regional anchor, to see exactly where you stand against a specific corps. Choosing *whom* to
  scrimmage (the rival you'll meet Saturday? the class leader, to calibrate?) is itself strategy.
- **Caps and anti-collusion.** One joint rehearsal per corps per week, consumed by both parties.
  Repeat pairings decay: the second joint with the same partner in a season yields half the
  ensemble bonus, the third none (the scrimmage report always works) — so the mechanic pushes the
  social graph outward instead of letting two friends farm each other. Because Podium scores are
  absolute against the historical envelope rather than relative, a mutual buff is not zero-sum
  and cannot manufacture placement by collusion; the cap and decay exist to keep balance-of-
  rehearsal dominant.
- **The feed line.** Every joint rehearsal emits a public recap-feed item — "The Rohn Regiment and
  the Sun Devils held a joint rehearsal in Allentown" — with the diagnostic kept private. Public
  smoke, private fire: it seeds forum speculation the way real corps' shared-site rumors do.

---

## 6. UI — What Renders in Zone C

When `activeCorpsClass === 'podiumClass'`, `Dashboard.jsx` Zone C swaps
`ActiveLineupTable` + `LineupSimulatorPanel` for three new components (same footprint, same
`data-tour` region):

1. **`RehearsalPlanner`** *(replaces ActiveLineupTable — the primary interactive surface)*
   Today's day type (rehearsal / show / travel), block allocator with the seven blocks as large
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
   marginal yield tomorrow." **Historical shadows** ride along free: the engine knows every
   historical caption score by day, so show nights annotate with lines like "your 84.3 tonight —
   2012 Crown was 84.1 on this day." Zero mechanics, pure delight for the DCI-literate, and a
   nightly advertisement of the realism calibration.

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
    planTemplate: { mon: ['visualBasics','fullEnsemble','brassSectionals'], ... }, // §5.2 assistant
    jointRehearsals: { usedThisWeek: 1,
                       partnersThisSeason: { '<uid>': 2 },   // repeat-pair decay counter
                       pending: { withUid, day, proposedBy } | null },
  }
}
```

### 7.2 New/changed documents

| Path | Purpose |
|---|---|
| `podium-config/curves` | Percentile bands, delta bounds, archetype params from the corpus job (§4.1) |
| `podium-config/venues` | Venue gazetteer: normalized location string → `{venueId, city, state, lat, lng}` (§5.3); appended-to when live scraping meets a new city |
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
| `savePlanTemplate` | Stores the assistant-director weekly plan (§5.2); the nightly processor executes it at ~85% yield on unplayed days |
| `proposeJointRehearsal` / `respondJointRehearsal` | The §5.12 handshake; validates weekly cap, geography tier, repeat-pair decay; on acceptance both corps are flagged for the shared day and the diagnostic is generated at nightly processing |
| `hostEvent` (all classes) | Creates a §5.10 hosted show in the schedule subcollection: validates date/venue-tier/CorpsCoin, stamps gazetteer venue data; attendance payouts settle in the nightly run |

### Extended: nightly pipeline (`dailyProcessors.js`)

New stage `processPodiumDay(seasonUid, day)` after fantasy scoring, inside the existing run guard:

1. Apply overnight recovery + neglect decay to every active Podium corps.
2. For corps performing today: compute caption scores (§4.2), clamp to bands, write recap entries.
3. Charge travel for tomorrow's movements; roll `today` state forward.
4. `computePodiumRankings` → `seasonRank` per corps.
5. Existing downstream (rivals job, leaderboards, league matchups) picks Podium up via class
   filters.

### New scripts

- `functions/scripts/buildPodiumCurves.js` — the corpus-mining job from §4.1. Run manually per new
  data year; output committed as JSON + uploaded to `podium-config/curves`.
- `functions/scripts/buildVenueGazetteer.js` — extracts every distinct `location` string from
  `historical_scores`, normalizes + geocodes offline, emits `podium-config/venues` (§5.3).
  Schedule generation and the live scraper stamp events with resolved venue data at ingest time.

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
| **2 — Condition & logistics** | Stamina/morale, venue gazetteer + travel costs, climate index, food plans, rest days, decay, regional anchors, `CorpsConditionPanel`, historical shadows in the trajectory panel | 2–3 wks |
| **3 — Economy & persistence** | Staff (named, tiered, persistent), clinicians, assistant-director templates, unlock flow, season archival/rollover, caption awards + named finals hardware | 2 wks |
| **4 — Social & polish** | Joint rehearsals, director-hosted events (all classes), season feed, press releases, auto power-rankings column, league integration, division seeding design, Director Rating | 3–4 wks |
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

## 12. Decisions & Open Questions

**Resolved in v1.1:**

1. **Guard Sectionals is a canonical seventh block** (§5.2) — CG primary, VA/GE2 secondary.
2. **Live season ships**, with spring training as a purchasable, block-rich install camp ending in
   the Family Day diagnostic exhibition (§5.9).
3. **No evening recap reveal.** An 8 PM ET reveal would carve a dead no-rehearse window between
   reveal and the 02:00 processing run. Scores land in the existing nightly job and the recap is
   waiting at breakfast — the communal moment is the *morning* Director's Sheet, and the daily
   rehearsal decision is made with fresh recap data in hand, which is better game design anyway.
4. **Same schedule system, unchanged** — both season types, plus director-hosted events inserted
   into the same schedule subcollection (§5.10).
5. **Director-hosted competitions are in scope for all classes** (§5.10).

**Resolved in v1.2:**

6. **No week-1 lockout** (§5.9): live-season spring training overlaps the existing 21-day
   no-scoring window; off-season corps initialize competition-ready from the day-1 bands; opening
   timing is elective in both.
7. **The round-two backlog is committed design**: regional anchors (§5.11), joint rehearsals
   (§5.12), assistant director (§5.2), historical shadows (§6), deterministic climate (§5.3),
   Director Rating and named finals hardware (§5.7). The former backlog section is retired.

**Resolved in v1.3:**

8. **Anchor calendar is the real DCI majors** (§5.11): Southwestern (San Antonio, day 28),
   Southeastern (Atlanta, day 35), Eastern Classic (`DCI East`/Allentown, day 41), Championships
   (days 45–49). Two of the four are already pinned by `scheduleGeneration.js`; Eastern Classic
   needs one new pin; events gain an `eventTier` field.
9. **Podium has integrated World / Open / A divisions** (§5.7): transparent Podium-only seeding
   (decayed 3-season average, published), auto promotion/relegation plus petition-up,
   population-adaptive division count, single unified division in the inaugural season. This
   supersedes the earlier "division cut population" open question.
10. **The Eastern Classic is a two-night anchor** (§5.11): even snake split of the field across
    days 41–42 balanced by seeding within each division, lineups published day 39, one
    performance + one on-site rehearsal day per corps, night parity alternating by season, split
    logic built event-agnostic (`multiNight` metadata).

**Resolved in v1.5 (majors hard-coded — implemented on this branch):**

11. **The three majors are hard-coded, branded, exclusive events** in
    `generateOffSeasonSchedule`: marching.art Southwestern Championship (Dallas, day 28),
    marching.art Southeastern Championship (Atlanta, day 35), marching.art Eastern Classic
    (Allentown, days 41–42, `multiNight`). No other events on those days; historical source
    majors excluded from the random pool; `eventTier` threaded through all schedule
    write/read/transform paths (server + client). Verified with a dry run against the local
    13-year corpus: correct placement, no leaks, no empty days.
12. **Eastern registration counts as one show for every class** — register once, perform one
    assigned night, even per-class split. **Podium is auto-registered at all majors and gets 3
    other selections in weeks 4/5/6** (the major consumes a weekly slot; supersedes the earlier
    "does not consume a slot" rule). The `selectUserShows` validation and night-assignment
    scoring logic are specced (§5.11) and land with Phase 1.

**Still open:**

1. **Point-cap semantics** — Podium has no lineup and no cap; confirm nothing downstream assumes
   every class has a cap (`currentPointCap`, Lineup Analyzer efficiency math, trade windows).
2. **Name** — Podium Class is the recommendation; Circuit/Command/Maestro on the bench.
3. **Hosted-event pricing curve** — venue rental vs. per-corps payout constants need the §9
   simulation harness treatment before launch (economy inflation risk).

---

*§13 (round-two backlog) was promoted into the body in v1.2 — see §12 for the mapping.*

---

## 14. Gap & Conflict Register (v1.6 audit)

A deliberate pass over everything the FMA research surfaced vs. what §1–§11 commit to, and over
every place Podium's philosophy grinds against the existing codebase. Gaps are candidate design
additions; conflicts are things that **must** be resolved before Phase 1 code.

### 14.1 Gaps — FMA elements not yet in the design

1. **Auditions (the missing pre-season ritual).** FMA's pre-season had *two* knobs: challenge
   levels AND audition point allocation (spend ~300 points across captions via sliders to set
   starting stats). We kept challenge levels but initialize captions purely from corpus baselines
   — no player agency in the starting *distribution*. Proposal: an *Auditions* step at
   registration — a fixed budget of audition points allocated across the 8 captions, shifting the
   day-1 starting position **within** the historical day-1 band for the chosen challenge profile
   (identity: "we recruit brass talent"). Bounded by the envelope, so no power creep — pure
   distribution choice. This was FMA's single most tactile pre-season moment; skipping it wastes
   a beloved ritual that costs one screen.
2. **Campaigns — the rehearse-vs-fundraise tradeoff.** FMA's passive campaigns (energy → money
   or influence) made income an *opportunity cost of rehearsal*. Our economy earns passively
   (participation rewards). Proposal: any rehearsal block may be converted to a **Fundraiser**
   (CorpsCoin/budget instead of caption growth) — the guns-vs-butter choice, one line in the
   allocator. Especially meaningful early season when cash for staff/travel is tight.
3. **Per-show medals.** FMA profiles accumulate lifetime gold/silver/bronze medals for every
   regular-season event (veterans flaunt "70+ golds"). Cheap collector hook: top-3 at any Podium
   show banks a medal counter on the profile. Distinct from trophies (majors/finals hardware).
4. **Director skill tree — sidegrades only.** FMA's director levels → skill points → buffs was a
   core long-game hook we dropped entirely (to avoid power compounding). Recoverable as
   **specializations with tradeoffs** (e.g. "Brass pedagogue: +5% brass block yield, −2% guard")
   — identity, not power. Optional; Phase 3+.
5. **Fan Favorite votes.** FMA's community ran "FMA VOTES" / fan-favorite polls by hand. The
   `dailyPredictions` infrastructure already exists — a Fan Favorite ballot at each major
   (cosmetic banner, no score impact) is nearly free and productizes another community ritual.
6. **Stats-archive parity.** FMA's queryable all-seasons stats archive (/stats) is a documented
   retention engine. Podium results must flow into `dci-stats`, the records book
   (`gameRecords.js`), and season archives from day one — per-division, per-caption records
   included. Currently unspecced.
7. **Rookie onboarding.** The existing `journey.js` first-season quest covers fantasy; Podium's
   deeper loop needs its own guided first week (set challenge levels → first rehearsal → read the
   trajectory panel → first show). FMA was brutal to newcomers; we shouldn't be.
8. **Hosted-event alt-farming guard.** FMA's endgame was alt-account cheating. Hosted-event
   payouts scale with attendance — attendance must count only *distinct, active* corps (activity
   threshold: scored ≥1 show that season), with per-host and per-day caps, or alts farm payouts.

### 14.2 Conflicts — where Podium grinds against existing code/philosophy

1. **[LOAD-BEARING] Money touching score breaks the site's core covenant.**
   `scoring.js` states the existing invariant: *competitive score comes ONLY from historical
   data — show concepts, coins, streaks never modify it.* Podium deliberately breaks this inside
   its own class: CorpsCoin buys staff, clinicians, camp days, food, travel — all of which shape
   score. Because CorpsCoin is a **shared cross-class wallet**, a veteran with a 50k stockpile
   from years of fantasy play starts Podium with a purchased advantage — exactly FMA's influence
   compounding, reintroduced through the wallet. **Recommended resolution: a dual-currency
   split.** CorpsCoin stays cosmetic/unlock currency game-wide (covenant intact); Podium's
   competitive inputs are paid from a **Corps Budget** — a per-season, class-internal currency
   that starts equal for every corps in a division, is earned only by in-class activity
   (show payouts, fundraiser blocks, hosting), and resets at archival. Realistic (corps budgets
   are annual), self-balancing, and it makes the §14.1.2 fundraiser blocks meaningful. The
   alternative (shared CC with per-season spend caps) is simpler but leaves the optics problem.
2. **Lineup-assumption coupling.** Large parts of the code assume every class has a lineup and a
   point cap: `saveLineup`/`validateLineup` validClasses, `activeLineups` uniqueness,
   `weeklyTrades`, `captionWindows` deadlines, `LineupSimulatorPanel`, `CaptionSelectionModal`,
   `lineupNeedsUpdate`/`duplicateConflict` flags, trade-deadline UI in `seasonClock`. Podium has
   none of these. Piecemeal `if (podium) skip` guards will rot. **Recommended resolution: a
   central class-capability registry** (single module consumed by both `src/` and `functions/`)
   declaring per-class capabilities — `hasLineup`, `isRanked`, `hasDivisions`, `pointCap`,
   `usesRehearsal` — replacing the ~9 mirrored constant sites §8 already flags. This is Phase 1
   pre-work and it pays for itself even if Podium never ships (the mirrored constants are an
   existing bug farm).
3. **The nightly processor treats spring training as dead air.** `processDailyLiveScores`
   early-returns on calendar days 1–21 ("No scoring today"). Podium needs those days *processed*
   (recovery, decay, assistant-director autoplay, camp economics) without waking the fantasy
   pipeline. The daily job needs restructuring into per-system stages with their own day gates —
   touching the `scoringRunGuard` idempotency lease, which currently guards the whole run.
4. **Day-boundary semantics for rehearsal.** Fantasy deadlines run on ET wall-clock
   (`seasonClock.js` is the declared single source of truth). Podium's "one day's blocks" must
   adopt the same ET day boundary explicitly (blocks roll at the 02:00 ET processing hour), or
   players near midnight double-allocate. Every Podium callable validates "today" server-side
   against the same clock module — never client time.
5. **Profile-write security.** Podium state lives on the profile doc
   (`corps.podiumClass.podium.*`), parts of which are legitimately client-writable (biography,
   avatar). Firestore rules must deny client writes to the `podium` subtree specifically —
   otherwise caption values are editable in the browser console. The fantasy classes never had
   this exposure (their competitive inputs live in server-validated lineups); Podium's
   competitive state on a user-owned doc is a **new** attack surface. Alternative: move Podium
   state to a server-only subcollection (`.../podium/state`) and keep the profile doc clean.
6. **Auto-registration vs. `selectedShows` shape.** The majors auto-register Podium corps, but
   `selectedShows` is user-written via `selectUserShows` (max 4, one/day). The major entries must
   be server-injected (week rollover writes them, UI shows them locked, validation counts them
   against the cap) — or scoring treats majors as virtual attendance without touching
   `selectedShows`. Decide once, in Phase 1; retrofitting is painful.
7. **Live-season envelope contamination.** The live scraper writes the *current* year into
   `historical_scores/{year}` as the season progresses. Podium's realism envelope must be built
   from **completed** years only, or mid-season the envelope shifts under players' feet (and
   early-season live data would define absurdly tight day bands).
8. **Cosmetic inconsistency: Dallas vs. San Antonio.** Off-season hard-codes the Southwestern in
   Dallas; live seasons keep the real scraped event (San Antonio). Accepted as branding freedom,
   noted so nobody files it as a bug.
9. **Faucet inflation.** Podium participation rewards + hosting payouts add a new CorpsCoin
   faucet on top of a user's existing four classes. If conflict #1 resolves to dual currency,
   most of this pressure disappears (Podium activity pays Budget, not CC); the residual
   (unlock/participation CC) needs one `economyStatsJob` calibration pass.

---

*Sources: full crawl of fantasymarchingarts.com (guide sections 1–17, stats archive seasons 1–140,
player directory, forums incl. FMA Rework viewtopic/4475, division-assignment threads, World
Championship proposals, Suggestions board) and a full architectural survey of this repository
(dashboard, class system, scoring pipeline, schedule system, economy, and the unbuilt Staff/
Equipment systems planned in `project_plan.txt`).*
