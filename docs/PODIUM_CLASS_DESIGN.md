# Podium Class — Design Document

**A director-simulation game class for marching.art, spiritual successor to Fantasy Marching Arts**

Status: v3.0 · July 2026 — LIVE (launched mid-live-season 2026); v3.0 logs the launch-week
decision sheet: three divisions (26), the hosting ladder (27), staff careers (28), historical
shadows (29), Fan Favorite (30), the Podium Report article (31), the commitment-cap re-tune
(32), 12-click days (33), records parity (34), skill tree dropped (35), instrumentation now
(36), runtime curve rebuilds (37). Earlier: Proposal v1.3 — v1 open questions resolved (guard
sectionals in, live
season in with spring training design, no evening reveal window, director-hosted events added);
v1.2 promotes the round-two backlog into committed design (regional anchors, joint rehearsals,
assistant director, historical shadows, climate, Director Rating, named hardware) and clarifies
that Podium is never locked out of week-1 events; v1.3 names the anchor calendar after the real
DCI majors and adds integrated World / Open / A divisions inside Podium; v1.4 specs the
two-night Eastern Classic split; v1.5 hard-codes the branded majors in the schedule generator
(implemented) and sets the counts-as-one / even-split / Podium-auto-registration rules; v1.6
adds the Gap & Conflict Register (§14) — open design decisions live there; v1.7 adds simple
auditions, the no-competitive-donations rule, and the Reputation / Champion Status
multi-season climb (§5.13); v1.8 specs dormancy and comebacks; v1.9 replaces the staff
purchase ladder with a living labor market (§5.6); v2.0 is the authoritative eight-phase build
plan (§10); v2.1 folds in the final FMA sweep (§14.3); v2.2 places the sweep items (Scores-tab
recap sheets with the caption-privacy rule, all-class profile résumés) and swaps Stretching /
Physical Warmup in as the condition block; v2.3 anchors the onboarding economy to the 1,000-CC
starting grant and sweeps stale CorpsCoin references to Corps Budget; v2.4 settles the economy
model — one currency, CC spendable in Podium up to a division-equal cap, free floor guaranteed
— the design is complete and build-ready

---

## 1. Executive Summary

Podium Class is a fifth corps class that lives beside World / Open / A Class / SoundSport in the
dashboard ControlBar. Where the four existing classes are _fantasy_ classes — you draft historical
caption performances and your score is derived from what those corps actually did — Podium Class is
a _simulation_ class: **you are the director of your own corps, and your score is built from
scratch, every day, by how you rehearse, travel, feed, and rest your members across the season.**

It occupies the exact screen real estate of the Active Lineup / Lineup Analyzer panels (Dashboard
Zone C) when its tab is selected, rides the _same_ 49-day season schedule, the same shows, the same
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

- **Podium Class** _(recommended)_ — the double meaning is perfect: the podium is where the drum
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
   scoring job; Podium Class must present it as a _communal event_, not a background job.
2. **Deterministic optimization.** Rehearsal maps to caption growth with near-zero randomness (FMA's
   only variance is ±0.005-scale "judge perspective" jitter added in 2012 to break ties).
   Placement feels _earned_. Veteran players explicitly warned the Rework effort not to add
   creative/subjective scoring — "it would fundamentally alter the game's stat-focused design."
3. **The challenge-level knob.** At season start you pick 1-of-8 difficulty per show section: low =
   early, safe, capped growth; high = late, risky, higher ceiling. This one slider generates the
   entire "peak timing" metagame and is the most-loved strategic mechanic. Podium Class keeps it.
4. **Identity and permanence.** 15-year-old corps with names, hometowns, repertoire, trophy cases,
   and rivalry history. Players return after 80-season absences because _their corps is still
   there_. marching.art already has corps identity, `seasonHistory`, Hall of Champions — Podium
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

| Complaint                                                                                    | Podium Class answer                                                                                    |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Abandonment — no meaningful update in ~a decade                                              | Shipping this class _is_ the answer; it's the "FMA 3.0" the Rework thread tried to spec                |
| Dated UI (site still ships jQuery 1.8.3)                                                     | marching.art's existing React/Tailwind dashboard aesthetic                                             |
| Opaque division assignment (influence + bank secretly weighted; chronic misplacements)       | Transparent, published formula; divisions seeded purely from prior Podium results (§5.7)               |
| Nothing to spend money on ("other than staff and comps, there's nothing to buy")             | Travel, food, staff, clinicians are real recurring Corps Budget sinks (§5.6, §14.2.1)                  |
| Rich-get-richer influence compounding — catch-up is "generational"                           | No influence stat. Staff bonuses are capped and season-scoped; skill expression dominates account age  |
| Inactive groups keep scores; activity doesn't matter enough                                  | Cleanliness decay for unrehearsed captions; condition system makes daily attention matter (§5.3, §5.4) |
| No morale/wellness layer (top Rework request: "motivation mechanic requiring energy upkeep") | The condition system: rest, meals, travel fatigue (§5.3)                                               |
| No stat decay, no clinicians, no named staff (Rework requests)                               | All three included (§5.4, §5.6)                                                                        |
| No moderation, alt-account cheating                                                          | Idempotent server-side actions, per-day action budget, existing auth/admin tooling (§9)                |

### 2.3 Codebase integration points (what already exists)

From the architecture survey — this class was designed against the actual code:

- **Tabs:** `src/components/Dashboard/sections/ControlBar.jsx` iterates `CORPS_CLASS_ORDER`
  (`src/utils/corps.ts`). Adding `podiumClass` to the order + labels + colors adds the tab.
- **The render space:** `src/pages/Dashboard.jsx` Zone C renders `ActiveLineupTable` +
  `LineupSimulatorPanel` keyed off `activeCorpsClass`. `LineupSimulatorPanel` already returns
  `null` for SoundSport — the conditional-render precedent exists.
- **Separate scoring precedent:** SoundSport is excluded from `RANKED_CLASSES` in
  `functions/src/helpers/scoring.js` and gets ratings instead of placements. Podium Class uses the
  same exclusion mechanism but gets its _own_ ranking pass.
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

- Select next week's shows (existing 4-per-week mechanic) — but now the _route matters_: distances
  between venues cost stamina and Corps Budget (§5.3).
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
   that captions _do_ go down — the p25 delta is negative in some late-season windows).
5. **Cluster into archetypes.** k-means over `(L, k, d₀)` per caption yields 3–5 named growth
   archetypes (e.g. _Early Installer_, _Steady Climber_, _August Surger_). These become the
   observable shapes that Challenge Levels select between (§5.1) — so the risk/reward knob is
   literally parameterized by how real corps seasons unfolded.

Output: a compact `podium-config/curves` Firestore document (plus a bundled JSON fallback in
`functions/src/helpers/podium/curveData.json`) — percentile bands, delta bounds, and archetype
parameters. Regenerated whenever a new season of live-scraped data lands in `historical_scores`.

### 4.2 The corps model

Each Podium corps carries, per caption `c ∈ {GE1, GE2, VP, VA, CG, B, MA, P}`:

| Field          | Range   | Meaning                                                                                                                                                                |
| -------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `challenge[c]` | 1–8     | Set at registration, locked for the season. Selects the growth archetype: ceiling `L(c)` and inflection timing. Higher = higher ceiling, later and less certain payoff |
| `content[c]`   | 0–100%  | How much of the book/technique is _installed_. Grows from rehearsal, front-loaded value                                                                                |
| `clean[c]`     | 0–100%  | Execution quality of installed content. Grows from rehearsal, decays if neglected, is what converts potential into score                                               |
| `peak[c]`      | derived | The effective ceiling today: `L(c) × f(content, clean)`                                                                                                                |

**Daily caption score:**

```
raw(c, d)   = L(c) · logistic(d; k(c), d₀(c)) · content(c) · (0.72 + 0.28 · clean(c))
ceiling(c,d)= band(repTier.percentile, c, d)          // reputation-gated top of the band (§5.13)
score(c, d) = clamp(raw(c,d) + condition(d) + variance(d,c), band_p5(c,d), ceiling(c,d))
total(d)    = min(99.70, [GE1+GE2] + [VP+VA+CG]/2 + [B+MA+P]/2)   // the unicorn cap
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
  18.4 because no Day-10 brass score in history was 18.4. The _top_ of each corps' band is gated
  by its multi-season Reputation tier (§5.13) — a first-season corps peaks in the historical
  mid-percentiles no matter how perfectly it is managed, and only Champion-Status corps can touch
  the top of the envelope. **No corps ever scores 100**: the hard cap is **99.70** — deliberately
  just above DCI's real all-time best (99.65, Blue Devils 2014) so beating history is _possible_
  but requires a true unicorn: Champion Status, maximum challenge, a near-perfect season, peak
  condition, and the variance breaking your way, all at once. Asserted by the harness
  (decision 25).

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

- **Level 1–2:** _Early Installer_ curve — low ceiling (`L` ≈ p40 of historical finals scores for
  that caption), early inflection, high `content` gain per block. You will look great in June.
- **Level 4–5:** _Steady Climber_ — median ceiling, textbook logistic.
- **Level 7–8:** _August Surger_ — ceiling at p90–p97, late inflection, `content` installs slowly
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

| Block                                                | GE1   | GE2   | VP    | VA    | CG    | B     | MA    | P     | Condition                                                                                                    |
| ---------------------------------------------------- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ------------------------------------------------------------------------------------------------------------ |
| **Stretching / Physical Warmup**                     |       |       | S     |       |       |       |       |       | **P** — cuts stamina drain of the day's remaining blocks, mitigates grind fatigue, raises burnout resistance |
| **Visual Basics**                                    |       |       | **P** | S     | S     |       |       |       |                                                                                                              |
| **Visual Ensemble**                                  |       | **P** | S     | **P** | S     |       |       |       |                                                                                                              |
| **Guard Sectionals**                                 |       | S     |       | S     | **P** |       |       |       |                                                                                                              |
| **Brass Sectionals**                                 | S     |       |       |       |       | **P** | S     |       |                                                                                                              |
| **Percussion Sectionals** (battery + front ensemble) | S     |       |       |       |       |       | S     | **P** |                                                                                                              |
| **Full Ensemble**                                    | **P** | **P** |       | S     | S     | S     | **P** | S     |                                                                                                              |

Notes:

- **Stretching / Physical Warmup is the condition block.** Its caption yield is nearly nil (a
  small VP trickle — marching fitness); its real product is _efficiency_: the day's remaining
  blocks drain less stamina, consecutive-max-day grind fatigue accrues slower, and burnout
  resistance rises. Every real corps day starts with the stretch block; here it's the classic
  "sharpen the axe" tradeoff — a block that makes the other blocks cheaper. Especially potent
  during spring-training all-days and brutal-travel weeks.
- **Percussion Sectionals covers the whole percussion program** — battery _and_ front ensemble —
  feeding `P` primary and `MA` secondary.
- Color guard (`CG`) has its own sectional block (primary CG, secondary VA/GE2 — the guard _is_
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
stamina + Corps Budget cost from the distance to the previous location — the existing "pick 4 shows a
week" mechanic silently becomes a routing puzzle. A Texas swing after a Florida weekend is a real
decision with a real cost, exactly like the actual tour.

_How distances are known when schedules are regenerated every season:_ the schedule is random per
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
training is housed). Costs are shown in the weekly show picker _before_ selections are confirmed,
so routing is played as an open-information puzzle, and hosted events (§5.10) slot in automatically
because hosts choose their venue city from the same gazetteer.

**Climate (deterministic):** venue latitude + calendar date produce a published **heat index** per
show that scales that day's stamina drain — a July swing through Texas genuinely costs more than a
week in Ohio, and a director can see it in the show picker before committing. No RNG, no weather
rolls: the index is a fixed function of geography and date (tunable table in
`podium-config/balance`), so it adds routing texture without violating the determinism covenant.

**Food:** a weekly food-budget setting (per week, three tiers): _Gas-station_ (cheap, −stamina
recovery, morale risk), _Standard_ (baseline), _Full kitchen crew_ (Corps Budget cost, +recovery,
+morale floor). One decision a week, compounding effect — not micromanagement.

**Rest days:** declaring a full rest day forfeits all blocks, recovers big, and shields against
decay for that day. The Finals-week question — _rest into Saturday or clean until the last
minute?_ — falls out of the mechanics with zero special-casing.

### 5.4 Show days and the nightly drop

- Podium corps attend the **same shows on the same schedule** as everyone else (selected via the
  existing `selectUserShows` flow). Show days grant 1 rehearsal block (morning run-through), charge
  performance stamina, and are the only days a Podium corps receives an official score.
- Scores post in the existing nightly pipeline. The recap entry carries the full caption breakdown,
  placement _within Podium Class only_, and phase-appropriate color ("Brass +0.3 since
  Tuesday — 2nd in class").
- **The recap sheet is a first-class artifact, and it lives in the Scores tab.** FMA's
  most-screenshotted surface is the event box score — a per-division table with every caption
  column, total, and place. Every Podium show gets one, and the Scores page is redesigned around
  it (see _The Scores tab redesign_ below). The community's daily argument needs a daily exhibit.

**The Scores tab redesign (screenshot-worthy by design).** The existing Scores page already has
the right bones — class sub-tabs, a condensed GE/VIS/MUS `RecapDataGrid`, archive, Hall of
Champions. The redesign turns each event recap into a _sheet_, not a grid:

- **Masthead:** event name, venue city/state, season name + day, `eventTier` badge
  (Regional / Championship), and the Eastern Classic night badge (Night 1 / Night 2). The
  masthead is the screenshot's headline.
- **The Podium sheet (full captions):** division-sectioned table — Place · Corps (avatar chip +
  name) · GE1 · GE2 │ VP · VA · CG │ B · MA · P │ GE · VIS · MUS │ Total, with movement arrows
  vs. the corps' previous outing and **caption-box-toppers bolded** exactly like a real DCI
  recap. Mobile: frozen corps column + horizontal scroll, tabular-nums throughout.
- **The fantasy sheets (condensed captions):** identical masthead and typography, columns
  Place · Corps · GE · VIS · MUS · Total. **World/Open/A never display per-caption values —
  this is a hard privacy rule, not a layout choice: per-caption visibility would let players
  harvest each other's lineups from the score column.** (The recap documents already store only
  the condensed trio for fantasy classes, so the rule is enforced by the data shape itself, not
  by UI discipline.)
- **The footer strip:** marching.art wordmark + season/day — every screenshot shared to Discord
  or a forum is an advertisement.
- **Share affordances:** one-tap PNG export of the sheet (clean, theme-aware) and a
  "copy as text" monospace table formatted for Discord paste — the community lives there.
- **Caption leaderboards (sortable, class-appropriate):** a Caption Leaders view in the Scores
  tab — season-long per-caption standings, filterable and sortable. Podium sorts across all 8
  captions plus subtotals; **fantasy classes sort by GE / Visual / Music subtotals and total
  only** — sorting derives from the same stored fields as display, so nothing harvestable is
  ever queryable. Caption-leader history feeds the end-of-season caption awards directly.
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

| Sink                                                             | Cost shape                                                               | Effect                                                                                    |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| ~~Class unlock~~                                                 | **None — Podium is always open, always playable (the SoundSport model)** | Available from account creation; no level gate, no CorpsCoin cost, no registration cutoff |
| **Caption staff** (8 slots + Tour Manager + Program Coordinator) | Per-season salaries from Corps Budget — see _The staff economy_ below    | +yield% on mapped rehearsal blocks (capped); ops staff reduce travel/condition costs      |
| **Clinicians** (Rework request)                                  | One-off, 3-day engagement                                                | Temporary large yield boost on one block type; the "my brass is drowning" panic button    |
| **Travel**                                                       | Per-mile per show                                                        | The routing cost (§5.3)                                                                   |
| **Food plan**                                                    | Weekly tier                                                              | Recovery/morale (§5.3)                                                                    |

Earn side reuses existing hooks: show participation (Podium tier ≈ 175, between Open and World),
league wins, season-finish bonuses. Staff persistence between seasons is the long-game attachment
(FMA's staff ladder) with hard caps to avoid the influence-compounding trap (§2.2).

**The staff economy — a labor market, not a purchase ladder (v1.9).** FMA's staff system was an
elongated buy-the-ranks program with a terminal state: once maxed, money had nothing left to do
(the community said so verbatim: "other than staff and comps, there's nothing to buy"). Podium
replaces ownership with **employment** — and an employment market never maxes out:

- **Slots:** eight caption techs (one per caption, each boosting yield in their mapped rehearsal
  blocks), a **Tour Manager** (reduces travel stamina/cost), and a **Program Coordinator**
  (boosts Full Ensemble / GE blocks). Ten seats, never more.
- **Staff are generic — a role at an experience level, never a named person.** The eight caption
  seats plus Tour Manager and Program Coordinator are hired from an always-available catalog at an
  entry tier (Apprentice or Journeyman). Hiring MINTS a staffer owned by your corps with a stable
  id that holds their tenure and history for the rest of their career (Apprentice → Journeyman →
  Veteran → Master → Legend). There are no invented names, no traits, no résumés to read — a
  director decides only what a staffer does and how experienced they are.
- **Salaries, not purchases.** Contracts are per-season, paid from the Corps Budget — funded
  each season from the director's CorpsCoin up to a **division-equal cap**, plus in-class
  earnings, resetting at archival (§14.2.1). Staffing is therefore a fresh allocation decision
  every single season (payroll vs. travel vs. food vs. clinicians), and because the funding cap
  is division-equal, it doubles as a **hard salary cap**: a champion cannot simply outspend the
  field and hoard every Legend.
- **Always available — supply scales with the playerbase.** There is no scarce shared market to
  bid on and no free-agency race: every role is hireable by everyone, every season, so the staffing
  economy grows with the site instead of starving at a fixed pool of ~50 total hires. Scarcity was
  the wrong lever for a growing game — the scarce resource is now the SEASONS it takes to develop
  someone, not a limited supply of people.
- **Earn the higher tiers by retaining.** Only Apprentice and Journeyman are hireable directly.
  Veteran → Master → Legend are reached SOLELY by keeping a staffer season over season (promotion
  at 3 / 8 / 15 / 22 seasons). A Legend is proof you developed and held someone for ~22 seasons,
  never something bought off the shelf. Each retained season ages the instance: their tier and
  boost rise, and their salary escalates with tenure.
- **Contracts lock salary; retention is the default.** Contract length (1–3 seasons) locks the
  salary against the raises tenure brings; once the lock lapses the salary floats to the current
  tenured rate. A staffer is retained automatically each season the Corps Budget can pay them; an
  unaffordable season lapses the contract (released, never a debt). **Success inflates your
  payroll**: your homegrown Master ages into a pricier Legend — a natural dynasty tax and a second
  structural beatability mechanism (§5.13) that produces the era-and-rebuild cycles real corps
  have. You can RELEASE a staffer to free a seat, or RETRAIN one into a new specialty (tenure kept,
  reduced boost for the rest of that season).
- **Retirement cycles the pool.** A 30-season career retires and the seat reopens — the
  decade-scale economy is built into staff _mortality_, so there is no terminal maxed-staff state.
- **Power stays small.** Total staff yield bonus is hard-capped (~+15% across a corps' blocks);
  a full-Legend staff over a solid-Journeyman staff is worth roughly 0.5–1.0 finals points —
  deliberately below the ±2 decision-quality swing, preserving the §5.13 beatability math.
  Harness assertions: budget equality prevents any corps monopolizing Legends; staff bonus never
  exceeds the cap; a max-staff corps with poor rehearsal balance loses to a no-staff corps with
  perfect balance.
- **Storage:** each staffer lives as an instance on the director's own `podium/state` doc
  (server-only) and ages into the next season at re-registration — no shared collection, no
  registry, and no per-season market doc, so there is no hot-doc write contention as the game grows.

### 5.7 Progression, divisions, and season persistence

- **Persists across seasons:** corps identity, trophy case, `seasonHistory`, staff roster, director
  XP/level. **Resets:** captions, condition, challenge levels (new show every season). Exactly
  FMA's persistence split, minus influence.
- **Divisions — World / Open / A, inside Podium (season 2+):** Podium divides into its own three
  DCI-named divisions, competing on the same engine but ranked, cut, and crowned separately:
  - **Naming:** _World Class / Open Class / A Class_ — deliberately the DCI names (and the game's
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

Phase-4 scope, listed because it is _why_ FMA survived abandonment:

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
    Each spring-training day costs Corps Budget (housing + food for a corps that isn't earning), so
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
  nightly processor already skips scoring entirely — there are no events for _any_ class in that
  window. Podium's camp fills what is currently dead air in the player experience, and every
  class hits competition day 1 together.
- In **off-seasons** there is no spring-training period at all (calendar day 1 is scored
  competition day 1), so Podium corps initialize **competition-ready** from the historical day-1
  percentile bands for their challenge profile — which is precisely what those bands describe: a
  real corps at its first show. The paid move-in mechanic simply doesn't exist in off-seasons.
- In both season types, **opening-show timing is elective** anyway: show attendance is already
  "up to 4 per week," not mandatory. A director may skip week-1 shows and pour those days into
  rehearsal — the authentic "we don't open until DeKalb" strategy — trading early recorded scores
  and Budget earnings for a cleaner debut. Late-open vs. early-open is a strategic identity, not a
  rule.
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
  that season, payouts tuned so the average host roughly breaks even and a _good_ host profits —
  hosting is a skill sink, not a faucet. Scores at hosted events are computed identically to any
  other show; hosting confers zero competitive advantage.

### 5.11 Regional anchor days

Because directors pick up to 4 shows a week, two rivals might not share a floor for weeks — a
problem FMA never had, since its events were globally visible. The fix, straight from the real DCI
tour: **all of Podium Class attends the three majors and Championships Week.** The majors are
**hard-coded, branded, and exclusive** — like Championship Week, they are fixed events on fixed
days at fixed sites, never sourced from the historical pool, and **no other event shares their
day** (for any class):

| Major                                      | Site                    | Day   | Status                                                                                  |
| ------------------------------------------ | ----------------------- | ----- | --------------------------------------------------------------------------------------- |
| **marching.art Southwestern Championship** | Dallas, Texas           | 28    | **Implemented** (`scheduleGeneration.js`, this branch)                                  |
| **marching.art Southeastern Championship** | Atlanta, Georgia        | 35    | **Implemented**                                                                         |
| **marching.art Eastern Classic**           | Allentown, Pennsylvania | 41–42 | **Implemented** — one event placed on both days with `multiNight: { nights: [41, 42] }` |
| **marching.art World Championships**       | Prelims/Semis/Finals    | 45–49 | Existing exclusive placement + auto-enrollment                                          |

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
  4). Majors are **travel-subsidized** (no Corps Budget leg; stamina cost still applies, so routing
  _around_ an anchor still matters — Dallas in July is a real heat-index day). For the fantasy
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
class**: _you register for one, you're registered for both_ — the Eastern Classic counts as a
**single show** against the weekly cap (auto-registered for Podium), each corps performs on
exactly **one assigned night**, and attendees are **split evenly per class** across the two
nights:

- **Balanced snake split, published in advance.** After the day-38 nightly run (post-Atlanta
  standings), each class's registrants are distributed across the two nights by a snake draft —
  Podium on current seeding _within each division_, fantasy classes on current class rank
  (seeds 1, 4, 5, 8… one night; 2, 3, 6, 7… the other) — so both nights carry equal strength
  and every class and division appears both nights. The night lineups publish on day 39 — a
  mid-week community moment that mirrors DCI's real lineup announcements and gives the feed two
  days of "who got Friday?" chatter. `selectUserShows` needs the counts-as-one/no-double-select
  validation for `multiNight` events; night assignment happens server-side at the day-41 nightly
  run and persists so day 42 scores the complement.
  _Implemented for the fantasy classes (Phase 6.1, `helpers/easternSplit.js`)_: snake split by
  `totalSeasonScore` with per-season night parity, preview published to the public
  `eastern-classic/{seasonUid}` doc after the day-38 run, final assignment persisted at the
  day-41 run (day 42 scores the stored complement — the v0 alphabetical split recomputed
  nightly, so an enrollment edit between the nights could double- or zero-score a corps), and
  the counts-as-one validation in `selectUserShows`. Podium's own night assignment remains the
  deterministic uid-hash parity (division-seeded snake lands with division seeding, §5.7).
- **One performance, one residency.** Each corps performs on its assigned night only
  (auto-enrolled, no weekly slot, no travel coin). The _other_ Allentown day is a full rehearsal
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
  never accepts on a director's behalf — this is a deliberately _human_ handshake.
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
  regional anchor, to see exactly where you stand against a specific corps. Choosing _whom_ to
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

### 5.13 Reputation — the multi-season climb to Champion Status

The single-season engine alone has a flaw: a perfectly-managed first-season corps could ride the
envelope to a 99 and there would be no dynasty arc. Real DCI doesn't work that way — Carolina
Crown made finals in the 90s, sat 12th in the mid-2000s, broke the top 4 in 2008, and won its
first title in 2013; the Bluecoats took four decades to their 2016 title; Boston slogged from
1940 to elite status in the late 2010s. **Status is earned across seasons, and that climb is the
deepest gameplay loop Podium has.**

**Corps Reputation** is a per-corps value earned **only from competitive results** — finals
placement, division titles, caption awards, majors podiums. Nothing else moves it: not activity,
not CorpsCoin, not donations, not account age. It maps to seven named tiers, and the tier gates
the **ceiling percentile** of the historical band the corps can score into:

| Tier                    | Ceiling (percentile of historical day-band) | Feel at finals                                                |
| ----------------------- | ------------------------------------------- | ------------------------------------------------------------- |
| 1 · Community Corps     | p25                                         | ~76 ceiling — a strong debut (Surf/Genesis/Cascades territory) |
| 2 · Regional Contender  | p43                                         | ~82 — a top Open-class season                                  |
| 3 · National Contender  | p57                                         | ~87 — semifinalist                                             |
| 4 · Finalist            | p66                                         | ~91 — mid-pack Saturday night                                  |
| 5 · Medalist            | p75                                         | ~94.5 — knocking on the medals                                 |
| 6 · Elite               | p93                                         | ~97.5 — Bluecoats/Boston in a strong year                      |
| 7 · **Champion Status** | full envelope                               | the corpus maximum (99.x) — **never 100**                      |

The percentiles read against the **survivorship-corrected** day bands: raw historical data
thins out at championships (day 49 contains only the twelve finalists), so the lower
percentiles of days 45-49 are re-anchored to the full-field trend of days 30-44 by the curve
builder (`correctSurvivorship`). Without the correction the finals floor sat at ~80 and a
debut Community Corps season "maxed" at a finalist-level 91 — impossible against the real
trajectories of Jersey Surf, Genesis, Seattle Cascades, or Pioneer, whose seasons end in the
60s-70s (2026-07 calibration report, ChrisRohn). The committed
`src/scripts/podiumPacingHarness.js` asserts the ladder every run: debut ≈ 76, Finalist ≈ 91,
Elite ≈ 97.9, Champion ≈ 99.3, Champion Status at season ~13, and a flawless Elite beats a
half-absent Champion ~20% of the time.

_(Percentiles as tuned by the Phase 0 harness — `balanceConfig.json` is authoritative; the
tier-6 value is what places the Elite-vs-Champion upset rate at 40%. See
`PODIUM_PHASE0_NOTES.md`.)_

Design rules, each one a lesson from FMA or from the user's brief:

- **Ceiling-only, never fuel.** Reputation never adds points, never accelerates growth, and is
  invisible until a corps presses the top of its band late in the season. Through June and July a
  low-rep corps that rehearses better _routinely_ outscores a high-rep corps that manages badly.
  Reputation decides how high your perfect season can peak — nothing else.
- **Paced like the real climb.** Per-season reputation gain is capped so that a flawless director
  reaches Champion Status in roughly **10–14 seasons** (calibrated in Phase 0 against real
  multi-season climbs in the corpus — Crown's 2004→2013 arc is the reference curve). Strong but
  imperfect play takes ~20. There are no shortcuts.
- **Maintained, not owned.** Reputation decays slowly when a corps performs well below its tier
  or sits out seasons. Dynasties that coast come back to the field; Champion Status is a lease
  with performance clauses, exactly like real reputations.
- **Not FMA influence.** Influence — the most resented stat in FMA — compounded from activity and
  donations, secretly drove division placement, and made catch-up "generational." Reputation is
  earned only by results, does exactly one published thing, decays, and its tier, effect, and
  path-to-next-tier are displayed on every corps page.

**Where FMA's influence went (deliberately not ported).** Influence was FMA's do-everything
compounding stat, and marching.art has already removed its own influence system — Podium does not
reintroduce one. Instead, each of influence's jobs is handled by a separate, non-compounding
mechanic:

| Influence's job in FMA                                                                                             | Podium's answer                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sized the audition point pool (+10 pts per 100 influence over 3,000) — veterans literally started seasons stronger | **The audition pool is flat — identical for every corps, forever.** Auditions shift only the _distribution_ of the day-1 start, never its level (§5.13 setup step 3) |
| Scaled audition stat caps — veterans' ceilings grew with account age                                               | **Reputation tier** gates the ceiling — earned only by results, ceiling-only, decaying, published                                                                    |
| Drove event acceptance and ticket economics — hosts declined low-influence groups                                  | Open enrollment within venue capacity; hosted-event payouts scale with attendance, not attendee pedigree (§5.10)                                                     |
| Secretly weighted division placement                                                                               | Divisions seed from the published Podium-results formula alone (§5.7)                                                                                                |

The pattern: influence bundled _identity, power, and access_ into one number that compounded from
activity. Podium unbundles them — identity is the trophy case, power ceiling is earned reputation,
access is open — and nothing in the game compounds from simply being old.

**Dormancy and comebacks.** A corps whose director doesn't register it for a season is
**dormant**, and the governing invariant comes straight from real DCI: _a corps never returns
from an absence stronger than it left._ Guaranteed by construction — nothing accrues while
dormant, and every dormant season applies a minimum decay:

- **Graduated decay, tuned for marching.art's cadence.** Seasons here run ~7 weeks back-to-back
  (~7 per year), so one skipped season is a normal life event, not a real-world "year off" — the
  first dormant season costs about a third of a tier. Consecutive absences accelerate: two
  seasons ≈ a full tier, three ≈ nearly two, and a long absence (6+) winds a former champion
  most of the way back to Community Corps. The trophy case, records, and history never decay —
  identity is permanent, power is not.
- **Staff scatter.** All staff contracts survive one dormant season (loyalty grace). Each
  additional dormant season, contracts lapse — highest tier first; good staff get poached, which
  is exactly how it goes.
- **Division re-entry, published rule.** After one dormant season a corps seeds normally from its
  decayed seeding score. After two or more it re-enters the bottom active division and climbs —
  the real return-through-Open-Class path — with the §5.7 petition-up always available.
- **Heritage credit — the comeback arc.** Returning below your corps' historical peak, reputation
  gains run at +50% until one tier below that peak; the final tier back is earned at full price.
  Alumni networks and name recognition make the re-climb faster than the first climb — but the
  return point is always strictly lower than the departure point, and the summit is never free.
  Mechanically this makes a comeback an _attractive storyline_ (fast early wins, a visible
  target) instead of pure punishment — and the feed marks it: "The Rohn Regiment returns after
  three seasons."
- **Phase 0 calibration:** mine the corpus for real return-from-hiatus cases and fit the decay
  constants to them (small sample, so constants live in `podium-config/balance` and are
  tunable). Harness assertions: return reputation strictly below departure reputation in every
  simulated career, and heritage credit never overshoots the pre-dormancy peak.
- **Attached to the corps, not the director.** Retiring a corps banks its legacy (Hall, prestige
  plaques, trophy case preserved) and a new corps starts the climb at tier 1. This makes a
  15-season-old corps genuinely precious — FMA's identity-permanence hook, now load-bearing.
  Directors may retire or found corps freely at registration; renaming a corps keeps its
  reputation (a rebrand is still the same organization).

**How the Blue Devils lose (beatability by design).** A Champion-Status corps run well is the
favorite, never a lock. The deterministic upset paths, all skill-expressed:

1. **Ceiling ≠ floor.** The dynasty must still play the season. Missed rehearsal balance, bad
   routing, burnout weeks — every one drops their realized score into the band where an Elite or
   Medalist corps playing perfectly lives.
2. **Tier gaps are small at the top.** Elite's p97 ceiling concedes roughly 0.5–1.2 finals points
   to the full envelope, while decision quality across a season swings ±2 or more. The math makes
   "hungry challenger out-executes complacent champion" not just possible but the _expected_
   upset shape — which is precisely how it happens in real DCI.
3. **Challenge-level asymmetry.** Touching 99 requires running maximum-challenge books, and
   maximum-challenge books are the most punishing to condition mismanagement and the slowest to
   come together. The dynasty carries the riskiest season plan on the field, every season. A
   challenger with a cleaner, earlier-peaking design can take them at San Antonio or Atlanta —
   and if the champion misplays Finals-week peaking, at Indy.
4. **Peak-timing chess.** The rest-vs-clean decisions of days 43–49 create overlapping outcome
   bands between adjacent tiers. Finals night is won in the week before it.
5. **Decay.** A coasting champion's ceiling quietly sinks toward the field.
6. **Information warfare.** Scrimmage reports, anchor-night assignments, routing, and clinician
   timing are equally available to everyone — the challenger's toolkit.

The §9 simulation harness gains a **multi-season mode** and asserts all of it: thousands of
simulated 15-season careers across strategy archetypes; no run ever produces a 100; flawless play
reaches Champion Status in 10–14 seasons; and a perfectly-played Elite challenger beats a
well-but-imperfectly-played Champion in a healthy fraction of finals (tuning target: 30–45%).

**Corps setup stays simple (the FMA flow, four steps).** Registration is: **1)** corps — keep
yours, retire it, or found a new one; **2)** show concept — title, repertoire, theme (existing
`showConcept`); **3)** design — the eight challenge-level sliders plus **Auditions**, a single
screen allocating a fixed pool of audition points across the 8 captions to shift the _starting
distribution_ within the day-1 band (one-tap presets: Balanced / Music-forward / Visual-forward
for directors who don't want to slide); **4)** rehearse. No step is gated by payment.
**Donations never grant anything competitive** — no score, no reputation, no budget, no XP;
supporters get a cosmetic badge and the game's gratitude, nothing else. (FMA sold support packs
with money/influence/XP attached; we deliberately don't.)

---

## 6. UI — What Renders in Zone C

When `activeCorpsClass === 'podiumClass'`, `Dashboard.jsx` Zone C swaps
`ActiveLineupTable` + `LineupSimulatorPanel` for three new components (same footprint, same
`data-tour` region):

1. **`RehearsalPlanner`** _(replaces ActiveLineupTable — the primary interactive surface)_
   Today's day type (rehearsal / show / travel), block allocator with the seven blocks as large
   tap-targets, live yield preview per block given current phase/condition/staff, the
   "Action Complete" result panel, and rest-day / light-day declarations. One-thumb mobile
   operation is a hard requirement — this is the daily habit surface.
2. **`CorpsConditionPanel`** _(compact strip)_
   Stamina + morale meters, food-plan setting, this week's travel route with costs, decay warnings
   ("Percussion: 3 days unrehearsed").
3. **`CaptionTrajectoryPanel`** _(replaces LineupSimulatorPanel — the analyzer analogue)_
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

| Path                                  | Purpose                                                                                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `podium-config/curves`                | Percentile bands, delta bounds, archetype params from the corpus job (§4.1)                                                              |
| `podium-config/venues`                | Venue gazetteer: normalized location string → `{venueId, city, state, lat, lng}` (§5.3); appended-to when live scraping meets a new city |
| `podium-config/balance`               | Tunables: block yields, decay rates, condition coefficients — hot-adjustable without deploys                                             |
| `fantasy_recaps/{seasonUid}/days/{d}` | Existing docs; Podium results appear as entries with `corpsClass: 'podiumClass'`                                                         |
| `game-settings/season`                | Unchanged — Podium reads the same schedule                                                                                               |
| `firestore.rules`                     | Podium fields writable only via functions (all mutations go through callables)                                                           |

Every game-state mutation is server-side (callable-validated) — client never writes caption or
condition values. This is non-negotiable for a competitive class (FMA's alt-account cheating
lesson).

---

## 8. Cloud Functions

### New: `functions/src/callable/podium.js`

| Callable                                                     | Does                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerPodiumCorps`                                        | Extends existing registration; validates challenge levels; initializes caption state from the corpus baselines for the chosen challenge profile                                                                                                                                               |
| `allocateRehearsalBlock`                                     | The daily verb. Validates block budget for the day (server-derived from day type + condition), applies yields (staff/clinician/phase/diminishing-return multipliers), applies immediate state update, returns the itemized result panel. Idempotency: per-`(uid, seasonUid, day, blockIndex)` |
| `setRestDay` / `setFoodPlan` / `hireStaff` / `hireClinician` | Setup verbs; Corps Budget transactions via the Podium ledger (§14.2.1)                                                                                                                                                                                                                        |
| `savePlanTemplate`                                           | Stores the assistant-director weekly plan (§5.2); the nightly processor executes it at ~85% yield on unplayed days                                                                                                                                                                            |
| `proposeJointRehearsal` / `respondJointRehearsal`            | The §5.12 handshake; validates weekly cap, geography tier, repeat-pair decay; on acceptance both corps are flagged for the shared day and the diagnostic is generated at nightly processing                                                                                                   |
| `hostEvent` (all classes)                                    | Creates a §5.10 hosted show in the schedule subcollection: validates date/venue-tier/CorpsCoin, stamps gazetteer venue data; attendance payouts settle in the nightly run                                                                                                                     |

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
`functions/src/callable/lineups.js` `validClasses` (Podium must be _rejected_ by `saveLineup` — it
has no lineup) · `registerCorps.js` (registration lock: 0 weeks, matching SoundSport — always joinable) ·
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
  "spam + absent." This is the tuning loop and the regression suite in one. **Multi-season mode**
  (§5.13): thousands of simulated 15-season careers asserting no 100s ever, Champion Status in
  10–14 flawless seasons, reputation decay pulling coasting dynasties back to the field, and a
  30–45% upset rate for perfectly-played Elite challengers against imperfect Champions.

---

## 10. The Build Plan (v2.0 — authoritative)

Three governing principles, restated as build constraints:

1. **Simple like FMA.** The daily surface is one screen and ≲3 taps. Every system added in any
   phase must surface to the player as _at most one decision_ — if a feature needs a tutorial
   paragraph, it ships with a one-tap default. A public FMA-style guide (short numbered sections)
   ships with the beta, not after it.
2. **Return-worthy.** Every phase must strengthen a comeback loop (nightly recap → morning
   decision; season → next season; dormancy → heritage-credit comeback), never just add content.
3. **Integrated yet separate (the SoundSport doctrine).** Podium shares the schedule, seasons,
   recaps, economy surface, identity, leagues, and UI shell; its scoring, rankings, and
   competitive state never mix with the fantasy classes'. Concretely: `RANKED_CLASSES` is never
   modified; Podium gets its own ranking pass; recap entries are class-tagged and filtered.

**Zero-disruption guarantees (apply to every phase):**

- **Additive-only schema.** No existing Firestore field is renamed, retyped, or removed. Podium
  state is new fields/collections only.
- **Feature-flagged.** `game-settings/features.podiumClass: false` gates the tab, the callables,
  and the nightly stage. Rollback at any point = flip the flag; dormant Podium data is inert.
- **Fantasy pipeline untouched.** The nightly job is restructured into _stages_ (Phase 1), but
  the fantasy stage's inputs, outputs, and timing are byte-identical; the Podium stage runs after
  it, isolated, with its own run-guard lease — a Podium failure can never block fantasy scoring.
- **Cohort rollout.** Flag → admin allowlist → beta cohort → open to everyone. Each widening is
  a config change, not a deploy. (The cohort gate exists only during the beta; at launch Podium
  is permanently open.)
- **Harness before players.** No phase that changes scoring math ships without the simulation
  harness passing its assertions (§9, §5.13, §5.6).

### Phase 0 — Data science & calibration _(no product code; 1–2 wks)_

0.1 `functions/scripts/buildVenueGazetteer.js` — extract/normalize/geocode all distinct
`location` strings → `podium-config/venues` + bundled JSON (§5.3).
0.2 `functions/scripts/buildPodiumCurves.js` — logistic fits, day-indexed percentile bands,
delta distributions, k-means archetypes → `podium-config/curves` + JSON (§4.1). Completed
years only (§14.2.7).
0.3 Calibration notebook: reputation pacing vs real multi-season climbs (Crown 2004→2013 as
reference); dormancy decay vs real hiatus returns; challenge-level archetype mapping.
0.4 Simulation harness (plain Node, no Firebase): single-season strategy archetypes,
multi-season careers, staff-market dynamics. Assertions: envelope containment; balanced-play
dominance; no 100s; Champion Status in 10–14 flawless seasons; 30–45% Elite-upset rate;
return-weaker invariant; staff cap ≤ +15%; no Legend monopoly.
0.5 `podium-config/balance` v1: every tunable (block yields, decay rates, condition
coefficients, travel tiers, heat index, salary curves, rep thresholds, the Corps Budget
starting grant) hot-adjustable without deploys.
0.6 **CC pricing audit** (decision 23): sweep every CorpsCoin price in the game against the
1,000-CC starting anchor, restate each in days-of-normal-play terms, and rebalance where a
price gates something a new player needs.

### Phase 1 — Invisible foundations _(zero behavior change; 2 wks)_

1.1 **Class-capability registry** — single shared module (consumed by `src/` and `functions/`)
declaring per-class `hasLineup / isRanked / hasDivisions / pointCap / usesRehearsal /
    unlockLevel / unlockCost / participationReward`. Migrate the ~9 mirrored constant sites to
read from it. Test: existing four classes behave identically (snapshot tests on validators).
1.2 **Nightly pipeline staging** — split `dailyOffSeasonProcessor` / `processDailyLiveScores`
into ordered stages with per-stage `scoringRunGuard` leases; fantasy stage unchanged; empty
flag-gated Podium stage. Live-season stage gates allow Podium work on calendar days 1–21
(§14.2.3).
1.3 **`seasonClock` day-boundary helpers** — server-validated ET day index for block allocation
(§14.2.4); client mirrors for countdown UI.
1.4 **Firestore rules carve-out** — deny client writes to `corps.*.podium` subtree; Podium
competitive state additionally lives server-side (`.../podium/state` subcollection) with the
profile carrying only display copies (§14.2.5).
1.5 Feature flag plumbing + `podiumClass` registered in the capability registry
(`enabled: false`).

### Phase 2 — The core loop _(internal alpha; 3–4 wks)_

2.1 `registerPodiumCorps`: the 4-step setup — corps (keep/retire/found) → show concept →
design (challenge sliders + one-screen auditions with presets) → done (§5.13).
2.2 Engine: `functions/src/helpers/podium/engine.js` — content/clean state, phase-dependent
yields, diminishing returns, neglect decay, envelope + reputation-ceiling scoring (§4.2,
§5.13). Pure functions, unit-tested against the harness.
2.3 `allocateRehearsalBlock` callable — idempotent per (uid, season, day, blockIndex); returns
the itemized "Action Complete" panel.
2.4 Nightly Podium stage v1: recovery/decay → score performing corps → recap entries
(`corpsClass: 'podiumClass'`) → `computePodiumRankings` → ranks on corps map.
2.5 Zone C UI swap: `RehearsalPlanner` (block allocator, ≤3 taps), `CaptionTrajectoryPanel`
(curves over percentile bands + historical shadows). ControlBar tab, flag-gated. Podium
recap sheet (full 8-caption, division-sectioned, §5.4) added to the Scores tab.
2.6 `selectUserShows`: `multiNight` counts-as-one validation + server-injected major
auto-registrations for Podium (3 free picks in weeks 4/5/6) (§5.11, §14.2.6).
2.7 Exit gate: two full simulated off-seasons on staging with admin accounts; recap/leaderboard/
rivals surfaces render Podium correctly; fantasy regression suite green.

### Phase 3 — Condition & logistics _(2–3 wks)_

3.1 Stamina/morale meters + effects (§5.3); rest days; grind fatigue.
3.2 Travel legs from the gazetteer (tiered), hometown anchoring, weekly route preview in the
show picker; climate heat index.
3.3 Food plans (weekly tier decision).
3.4 Live-season spring training: move-in purchase, all-day blocks, Family Day diagnostic
(§5.9); requires the Phase 1.2 stage gates.
3.5 `CorpsConditionPanel`; assistant-director plan template (85% autoplay) — the
retention-safety valve ships _with_ condition, not after it.
3.6 Exit gate: harness re-run with condition; "rest-optimizer" archetype places between
"balanced" and "spam" as designed.

### Phase 4 — Corps Budget & the staff market _(2–3 wks)_

4.1 Corps Budget ledger: per-season, funded by an optional CorpsCoin commitment at registration
(hard-capped division-equal) + in-class earnings (show payouts, fundraiser blocks); resets
at archival; real money never converts into it (§14.2.1).
4.2 Fundraiser block conversion (§14.1.2).
4.3 Generic always-available hiring catalog (role × entry tier); hiring mints a per-corps staffer
instance on `podium/state`; tiers, salaries, tenure aging.
4.4 Retention at re-registration: staffers age up, tier/salary escalate, contract salary-lock,
release + retrain; higher tiers earned only by retaining (§5.6).
4.5 Clinicians; Tour Manager / Program Coordinator effects.
4.6 Staff retirement at 30 seasons; seat reopens.
4.7 Exit gate: staff-market harness assertions; economy sim shows median corps solvent, careless
corps broke-but-playable.

### Phase 5 — Reputation & the multi-season spine _(2 wks)_

5.1 Reputation state + tier ceilings wired into the engine's clamp (already stubbed in 2.2).
5.2 Season archival: rep gains (placement/awards, per-season cap), decay, dormancy detection,
heritage credit; staff-contract lapse rules (§5.13).
5.3 Corps lifecycle: retire/found/rename flows with rep attachment rules.
5.4 Division seeding: single division below population threshold; seeding-score formula
published on the standings page; promotion/relegation + petition-up (§5.7).
5.5 Exit gate: multi-season harness green (pacing, upsets, dormancy invariant).

### Phase 6 — Shared-calendar features _(all classes; 2–3 wks)_

6.1 Eastern Classic two-night split for **fantasy classes too**: even per-class snake split,
day-39 lineup publication, combined standings view (§5.11).
6.2 Director-hosted events (all classes): `hostEvent` callable, venue tiers, open enrollment,
attendance payouts with alt-farm guards (distinct active corps only), event history pages
(§5.10, §14.1.8).
6.3 Regional-anchor UX for fantasy classes (the majors as marquee days).
6.4 Fan Favorite ballots at majors (reuse `dailyPredictions`); per-show medal counters.
6.5 Podium into `dci-stats`, `gameRecords`, season archives, Hall of Champions (class-filtered).
6.6 Scores-page redesign completed game-wide: shared sheet masthead/typography for the fantasy
classes (condensed columns), PNG/text share affordances, Caption Leaders view with the
class-appropriate caption sets (§5.4 privacy rule).
6.7 Profile résumé for **all classes**: season selector, per-season score tables, show-concept/
repertoire history, hosting history, trophy case on every corps a director fields (§14.3.b).

### Phase 7 — Social & the return loops _(2–3 wks)_

7.1 Joint rehearsals (§5.12): handshake callables, geography gate, scrimmage report, feed items.
7.2 Podium rookie journey (guided first week, reusing `journey.js` pattern).
7.3 Auto power-rankings column via the news pipeline; press-release posts; season feed anchored
to the nightly drop; player-columnist submissions through the existing `newsSubmissions`
pipeline (FMA's Staff Writers program, productized).
7.4 League integration: Podium corps in league matchups (class-filtered scoring).
7.5 Director Rating (lifetime, placements-only, cross-class) in the lifetime leaderboard job.
7.6 The public guide — FMA-style short numbered sections, written from this doc.

### Phase 8 — Beta season → launch _(1 season + 1 week)_

8.1 Beta cohort (allowlist, ~50–100 directors incl. FMA veterans) runs one full 49-day
off-season; weekly balance tuning via `podium-config/balance`; no deploys for tuning.
8.2 Instrument the funnel: D1/D7 return rate, blocks-allocated-per-day, rest-day usage,
show-selection latency — the "simple like FMA" principle is measured, not asserted.
8.3 Post-season: beta recap with the cohort (the FMA-Rework-thread constituency review),
final constants locked.
8.4 General availability at the next season boundary — **no unlock gate**: Podium is always
open, always playable, like SoundSport; launch announcement; live-season support (spring
training) enabled the following live season.

**Sequencing rationale:** 0–1 are risk-free and independently valuable (the registry pays down
existing tech debt). 2 is the minimum lovable product — the daily habit with real scores. 3–5
add depth in strict dependency order (condition needs stages; budget needs condition's costs;
reputation needs archival). 6–7 widen to all classes and the community. Only 6.1/6.2 touch
fantasy-class behavior at all, and both are additive, flag-gated, and land after Podium has
proven the machinery. Total: ~16–20 engineering weeks to beta.

---

## 11. Why This Retains Players (the addiction audit, honestly)

1. **A reason to open the app every single day** that takes two minutes and is a _decision_, not a
   claim button — and whose consequence arrives at a communal nightly moment.
2. **Streak-compatible, punishment-light:** missing a day costs growth (opportunity) and risks
   decay (mild), never a recorded loss. FMA's model, softened at the edges.
3. **Seasons end.** 49 days, a championship, a recap, a trophy — then a fresh sheet with your name
   still on the door. The "one more season" loop is FMA's deepest hook and marching.art already
   runs the calendar for it.
4. **Skill expression with receipts:** the trajectory-vs-percentile view lets a player _see_ they
   out-directed the field, and the deterministic engine means it's true.
5. **Identity accrual:** named staff, trophy shelves, caption-award banners, rivalry history —
   possessions that make quitting feel like abandoning something.
6. **Two-game texture:** fantasy classes are _drafting_ games (evaluation skill); Podium is a
   _management_ game (planning skill). Existing players get a second, orthogonal reason to log in;
   the two share one schedule, one economy, one identity, one nightly moment.

---

## 12. Decisions & Open Questions

**Resolved in v1.1:**

1. **Guard Sectionals is a canonical seventh block** (§5.2) — CG primary, VA/GE2 secondary.
2. **Live season ships**, with spring training as a purchasable, block-rich install camp ending in
   the Family Day diagnostic exhibition (§5.9).
3. **No evening recap reveal.** An 8 PM ET reveal would carve a dead no-rehearse window between
   reveal and the 02:00 processing run. Scores land in the existing nightly job and the recap is
   waiting at breakfast — the communal moment is the _morning_ Director's Sheet, and the daily
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

**Resolved in v1.7:**

13. **Auditions are in, and simple** (§5.13): one screen inside a four-step FMA-style setup
    (corps → show → design/auditions → rehearse), with one-tap presets. Resolves gap §14.1.1.
14. **Donations never grant anything competitive** — no score, reputation, budget, or XP;
    cosmetic supporter badge only. (In-game logistics — travel/food/staff — remain paid from the
    per-season, results-earned Corps Budget of §14.2.1, which no real money can touch.)
15. **Reputation and Champion Status** (§5.13): seven results-earned tiers gating the ceiling
    percentile of the historical band; ceiling-only, decaying, fully published; flawless play
    reaches Champion Status in 10–14 seasons; no corps ever scores 100; dynasty beatability is a
    tuned, harness-asserted property (30–45% upset target).
16. **No influence stat, ever** (§5.13): marching.art already deleted its influence system and
    Podium does not reintroduce one. Influence's FMA roles are unbundled — flat audition pool
    (distribution-only), reputation for the earned ceiling, open enrollment for access,
    published formulas for divisions. Nothing compounds from account age.
17. **Dormancy** (§5.13): a corps never returns from an absence stronger than it left —
    graduated reputation decay per dormant season (tuned to the ~7-week season cadence), staff
    contracts lapse after the one-season loyalty grace, 2+ season absences re-enter the bottom
    division, and heritage credit (+50% re-earn rate up to one tier below the old peak) turns
    comebacks into a storyline instead of a pure penalty.

**Resolved in v1.9.1:**

19. **Podium is drum corps only — one corps per director.** FMA ran four parallel circuits
    (Drum Corps, Marching Band, Color Guard, Drumline, each with its own caption set); Podium
    deliberately does not. A director fields exactly **one drum corps** in Podium Class, scored
    on the 8 DCI captions. No Marching Band, Guard, or Drumline circuits exist or are planned —
    the multi-group "portfolio" itch is already served by running Podium alongside the four
    fantasy classes. Every system in this doc (auditions, blocks, staff market, reputation,
    divisions) assumes and requires the single-corps model.
20. **Podium is always open, always playable — the SoundSport model.** No level gate, no
    CorpsCoin unlock, no registration cutoff (0-week lock). Anyone can found a corps on any day
    of any season; mid-season joiners get the §9 catch-up baseline and the rookie journey.
    Supersedes the earlier Level-8 / 4,000-CorpsCoin unlock. Rationale: the climb to Champion
    Status is the gate — entry never should be, and an always-open Podium is the game's best
    front door for brand-new players.

**Resolved in v2.2:**

21. **Sweep-item placements** (§5.4, §14.3): the recap sheet lives in the Scores tab and the
    Scores page is redesigned to be screenshot-worthy; the permanent public résumé integrates
    into user profiles for **all classes**; player columns ride the already-integrated dashboard
    `newsSubmissions` pipeline; caption leaderboards are sortable in the Scores tab under the
    hard privacy rule — Podium shows all 8 captions, **World/Open/A show condensed GE/VIS/MUS
    only** (anti-lineup-harvesting, enforced by the recap data shape).
22. **Rehearsal block swap** (§5.2): **Stretching / Physical Warmup** replaces Front Ensemble as
    the seventh block — near-zero caption yield, primary effect on condition (cheaper remaining
    blocks, slower grind fatigue, burnout resistance). Front ensemble training folds into
    **Percussion Sectionals**, which covers the full percussion program (battery + front).

**Resolved in v2.3:**

23. **The onboarding economy: 1,000 CC is the anchor, and everything prices against it.**
    Guaranteeing a new user can play is managed on three layers:
    - **The starting grant.** Every new profile is created with **1,000 CorpsCoin** (already in
      code: `users.js` default fields, with a backfill for legacy profiles). The first-season
      journey drips **+425 CC** across its steps, and show participation (50–200 CC/show),
      daily login, and league play keep the faucet running. A day-one player can immediately
      unlock A Class (1,000) or bank toward Open (2,500) — SoundSport and Podium cost nothing.
    - **Podium is fully playable at zero CC — the free floor.** The complete core loop costs
      nothing: rehearsal blocks are free, rest days are free, gas-station food is free, show
      attendance always happens (an unaffordable travel leg auto-downgrades — the corps still
      arrives, at a higher stamina cost; the long bus ride on fumes), and the majors are
      travel-subsidized anyway. A near-0-CC director rehearses, performs, scores, and climbs
      the reputation ladder from day one — they simply forgo the _condition-management edge_
      that money buys (better food, camp days, staff, clinicians, comfortable routing), which
      is bounded by the funding cap and by condition's ±-modifier limits. Money in Podium buys
      margin, never access.
    - **The pricing audit.** All CC prices game-wide (class unlocks, cosmetics, prestige sinks,
      hosting rentals, event trophies) get one calibration pass expressed against the anchor:
      each price is stated in _days of normal play_ (e.g., "Open Class ≈ 2 weeks of casual
      play"), tuned via `economyStatsJob` data, and recorded in `podium-config/balance` so
      re-tuning never needs a deploy. The rule of thumb: nothing a player _needs_ costs CC;
      everything CC buys is identity, access to more sandboxes, prestige — or Podium _margin_.

**Resolved in v2.5:**

25. **The unicorn cap is 99.70**: the total-score hard cap (`scoring.totalCap` in
    `balanceConfig.json`) sits just above DCI's real-world 99.65 so surpassing history is
    achievable exactly once-in-a-generation — Champion Status + challenge 8 + near-perfect
    management + favorable variance required.

**Resolved in v2.4:**

24. **One currency; CC is spendable in Podium; the free floor is guaranteed.** A new player's
    1,000 CC can buy A Class **or** fund their first Podium tour — that either/or is the
    intended day-one decision. The Corps Budget survives as the per-season operating _ledger_,
    funded by an optional CC commitment at registration (**hard-capped at a division-equal
    maximum** — the anti-stockpile guard: a veteran's 50k wallet fills the cap effortlessly but
    never exceeds what a solvent rookie can field) plus in-class earnings; it resets at
    archival. **Near-0-CC players always play**: rehearsal, rest, baseline food, and show
    attendance are free (unaffordable travel legs auto-downgrade to a stamina cost instead of
    blocking); money buys the condition-management edge — food tiers, camp days, staff,
    clinicians — never access, never caption points. Supersedes the dual-currency
    recommendation of §14.2.1 with the simpler capped-single-currency model.

25. **Survivorship-corrected calibration + the DCI-shaped tier ladder** (2026-07 pre-launch
    calibration report, ChrisRohn): the raw championship-week bands measured only the corps
    still competing (day 49 = the twelve finalists), inflating the finals floor to ~80 and
    letting a debut Community Corps "max" at 91 — impossible against the real trajectories of
    Jersey Surf, Genesis, Seattle Cascades, or Pioneer. Fixed at the source: the curve builder
    re-anchors p5/p25/p50 of days 45-49 to the full-field trend of days 30-44
    (`correctSurvivorship`, applied to the committed curveData), and the tier ceilings were
    retuned against the repaired band to the DCI shape — debut ≈ 76, Regional ≈ 82,
    Semifinalist ≈ 87, Finalist ≈ 91, Medalist ≈ 94.5, Elite ≈ 97.9, Champion ≈ 99.3 (§5.13
    table). The pacing harness (`src/scripts/podiumPacingHarness.js`) is now COMMITTED and
    asserts the ladder, the ~13-season climb, the no-100s cap, and the upset window on every
    run. The same pass wired the long-promised runtime tuning path: `podium-config/balance`
    overrides now actually merge over the committed defaults at runtime
    (`store.applyBalanceOverrides`), so beta re-tuning needs a config write, not a deploy.

**Resolved in v1.9:**

18. **Staff is a labor market, not a purchase ladder** (§5.6): generated persons with careers,
    per-season salaries from the division-equal Corps Budget (a built-in salary cap),
    deterministic free agency during registration week, develop-vs-poach dynamics with a
    success-inflates-payroll dynasty tax, staff aging and retirement cycling the pool forever,
    retired Legends becoming clinicians and trophy namesakes, and a hard +15% total yield cap
    keeping staff worth less than decision quality. Supersedes the v1 bronze/silver/gold
    retainer-tier sketch; there is no terminal "maxed staff" state, ever.

**Resolved in v3.0 (July 2026 live-launch decision sheet, ChrisRohn):**

26. **Three divisions — the A → Open → World climb** (§5.7 final form): every corps starts in
    A Class; at each season boundary the veteran pool is assessed against PUBLISHED percentile
    cutoffs (population-balanced thirds; Open forms at 6+ corps, World at 12+). Promotion is one
    division per season, earned by finishing at/above the next division's cutoff. Demotion is
    slow like old DCI: one grace season below your cutoff, a one-division drop after two straight.
    One missed season holds the seat; two or more re-enter at A Class. Each division crowns its
    own Finals hardware; the Hall of Champions shows the top active division's podium. The
    Eastern Classic night snake is division-seeded from Day-38 standings (published Day 39;
    uid-parity fallback until then). Championship Week is Indianapolis: A/Open run Prelims →
    Class Finals (days 47-48), World runs Prelims → Semis → Finals (47-49). The commitment cap
    is division-equal for real now: 2,500 / 4,000 / 6,000 (see 32).
27. **Hosting venue ladder replaces show sponsorship** (supersedes the shop's sponsorship
    purchase; resolves old open item 3): directors don't brand someone else's show — they RUN
    one. High School Stadium (150 CC rental, 25 CC per attending corps) is day-one attainable;
    2 successful HS events unlock the College Bowl (400/35), 3 successful College Bowls unlock
    the NFL Stadium (900/50); success = drawing the tier's minimum field, tracked on the profile
    hosting resume (server-written, rules-guarded). A well-drawn show profits, so hosting funds
    the climb and the corps. Podium corps routed to a hosted venue count toward attendance.
28. **Staff careers** (evolves decision 18): staff are persistent people in a career registry —
    tenure floors their tier (journeyman yr 3 → legend yr 22), salaries escalate 6%/season (a
    year-25 legend costs ~800/season against the capped +15% boost), and careers end in
    retirement at season 30 with rookies restocking every specialty. Contracts run 1-3 seasons
    at the salary frozen at signing; renewals charge each new season's budget and lapse quietly
    if unaffordable. Mid-season transfer market: post a contract; the buyer pays remaining
    pro-rata salary + 25% buyout premium (a sink — no player-to-player CC surface), the seller
    recoups the remainder. Retraining moves a person to a new specialty for life (half boost for
    the rest of that season). The 3-day clinician stays as-is.
29. **Historical shadows ship as a CAST, not just Crown**: 8 committed real season arcs from the
    2000-2012 corpus (Crown '12, Bluecoats '10, Boston '02, Blue Stars '10, Mandarins '08,
    Cascades '05, Surf '12, Pioneer '07 — best season for the elite cast, median season for the
    mid/community cast, which also filters Div II sheet artifacts). Rendered as muted ghost
    lines under the corps' own score line (state.scoreHistory) in the Podium zone.
30. **Fan Favorite is a two-level ballot** (resolves gap §14.1.5): prelims at each major (3-day
    window, one vote per signed-in user — fans included — for a Podium corps that performed),
    top 3 per major advance; the finals ballot runs Championship Week; the winner is crowned at
    archival (season-record banner + profile trophy). Ballots private, results public, cosmetic
    forever.
31. **The Podium Report replaces one DCI article** (resolves 7.3's remainder): on Podium week
    boundaries the deterministic power-rankings column runs as news Article 3 in place of the
    DCI caption deep-dive — composed directly from the column doc, never LLM-written, so player
    corps names and ranks cannot be hallucinated. The recap sheet gains a Discord-ready
    share/copy affordance.
32. **The commitment cap was never meant to be the starting grant** (amends decision 24's
    number, keeps its principle): 1,000 CC is what a season comfortably COSTS, not the ceiling.
    Caps are 2,500 (A) / 4,000 (Open) / 6,000 (World) — division-equal (a veteran's stockpile
    fills the cap, never exceeds what a solvent rookie's division peer can field), with headroom
    for World staff payrolls.
33. **Twelve clicks a day**: rehearsal runs 12 blocks/day (20 spring training, 4 show days) with
    per-block yield and stamina at exactly ¼ the old values and the repeat ladder in 4-click
    groups — balance-identical to the 3-block day, four times the FMA mouse-mashing. The pacing
    harness models absence per-day with assistant coverage (upset window 40%).
34. **Records/leaderboard parity** (resolves gap §14.1.6's core): podiumClass joins the all-time
    Records Book (nightly + season-best + full rebuild over podium recaps) and the recap sheet
    is division-filterable. `dci-stats` (real-DCI reference stats) deliberately does NOT ingest
    game results — the Records Book and season archives are the game's stats home.
35. **Director skill tree: dropped.** Gap §14.1.4's sidegrades stay unbuilt by decision — the
    identity itch is served by staff careers, divisions, and reputation; nothing compounds from
    account age.
36. **Funnel instrumentation ships with the beta, not after** (Phase 8.2 pulled forward):
    nightly podium-metrics docs (D1/D7 cohort return, blocks per active corps, rest-day usage,
    week-ahead pick coverage) surfaced in the Admin panel.
37. **Full-archive curve rebuilds are a runtime job**: admin `rebuildPodiumCurves` rebuilds the
    envelope from the complete Firestore archive (2000-2026, completed years only, survivorship
    correction built in) into `podium-config/curves`, which the engine swaps in at runtime with
    shape validation — committed curveData is the permanent fallback. All 11 gazetteer centroid
    placeholders hand-corrected (incl. wrong-state source typos).

**Still open:**

1. **Point-cap semantics** — largely resolved by the class-capability registry
   (`pointCap: null`, `hasLineup: false` keep Podium out of every lineup path); a formal audit
   of Lineup Analyzer efficiency math and trade windows remains a nice-to-have.
2. ~~**Name**~~ — **Resolved: Podium Class is the official name.**
3. ~~**Hosted-event pricing curve**~~ — **Resolved by decision 27** (venue ladder economics);
   watch `economyStatsJob` through the beta for inflation drift.

---

_§13 (round-two backlog) was promoted into the body in v1.2 — see §12 for the mapping._

---

## 14. Gap & Conflict Register (v1.6 audit)

A deliberate pass over everything the FMA research surfaced vs. what §1–§11 commit to, and over
every place Podium's philosophy grinds against the existing codebase. Gaps are candidate design
additions; conflicts are things that **must** be resolved before Phase 1 code.

### 14.1 Gaps — FMA elements not yet in the design

1. ~~**Auditions (the missing pre-season ritual).**~~ **Resolved in v1.7** — see §5.13: a single
   audition screen (fixed point pool across the 8 captions, one-tap presets) inside the four-step
   setup flow. Shifts the day-1 starting _distribution_ within the historical band; no power
   creep, no convolution.
2. **Campaigns — the rehearse-vs-fundraise tradeoff.** FMA's passive campaigns (energy → money
   or influence) made income an _opportunity cost of rehearsal_. Our economy earns passively
   (participation rewards). Proposal: any rehearsal block may be converted to a **Fundraiser**
   (Corps Budget instead of caption growth) — the guns-vs-butter choice, one line in the
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
   retention engine — and richer than first noted: 12 filterable metrics including per-caption
   leaderboards across all 140 seasons. Podium results must flow into `dci-stats`, the records
   book (`gameRecords.js`), and season archives from day one — per-division and **per-caption
   filterable leaderboards** included. Currently unspecced.
7. **Rookie onboarding.** The existing `journey.js` first-season quest covers fantasy; Podium's
   deeper loop needs its own guided first week (set challenge levels → first rehearsal → read the
   trajectory panel → first show). FMA was brutal to newcomers; we shouldn't be.
8. **Hosted-event alt-farming guard.** FMA's endgame was alt-account cheating. Hosted-event
   payouts scale with attendance — attendance must count only _distinct, active_ corps (activity
   threshold: scored ≥1 show that season), with per-host and per-day caps, or alts farm payouts.

### 14.2 Conflicts — where Podium grinds against existing code/philosophy

1. **[LOAD-BEARING] Money touching score breaks the site's core covenant.**
   `scoring.js` states the existing invariant: _competitive score comes ONLY from historical
   data — show concepts, coins, streaks never modify it._ Podium deliberately breaks this inside
   its own class: CorpsCoin buys staff, clinicians, camp days, food, travel — all of which shape
   score. Because CorpsCoin is a **shared cross-class wallet**, a veteran with a 50k stockpile
   from years of fantasy play starts Podium with a purchased advantage — exactly FMA's influence
   compounding, reintroduced through the wallet. **RESOLVED (v2.4) — single currency with a
   division-equal cap.** CorpsCoin _is_ spendable in Podium (a new player's 1,000 CC can buy
   A Class _or_ fund their first Podium tour — that choice is the intended day-one decision).
   The **Corps Budget** survives as the per-season operating _ledger_, funded two ways: an
   optional CorpsCoin commitment made at registration, **hard-capped at a division-equal
   maximum**, plus in-class earnings (show payouts, fundraiser blocks, hosting). It resets at
   archival; commitments are non-refundable (the tour spends them). The cap is the anti-stockpile
   guard: a veteran's 50k wallet can fill the cap effortlessly, but never exceed what any
   solvent rookie can also field — earned in-game wealth buys convenience, not headroom. Real
   money never converts into CC or Budget (decision 14), so the no-pay-for-score covenant holds
   where it matters.
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
   early-returns on calendar days 1–21 ("No scoring today"). Podium needs those days _processed_
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
7. **Live-season envelope contamination.** The live scraper writes the _current_ year into
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

### 14.3 Final sweep (v2.1) — second FMA pass, adopted and confirmed

A closing sweep of fantasymarchingarts.com surfaced a short list of genuinely new items.
**Adopted, with placements decided:** (a) the **recap sheet** lives in the **Scores tab** under
Podium Class, and the Scores page is redesigned to be screenshot-worthy (full spec in §5.4);
(b) the **permanent public résumé integrates into user profiles — for ALL classes**: each of a
director's corps (fantasy and Podium alike) gets the FMA-grade archive treatment on the profile
page — season selector over every season played, per-season score tables, show
concepts/repertoire history, hosting history, trophy case. The reverence is game-wide, not
Podium-only; (c) **player-columnist submissions are already integrated into the dashboard** (the
existing `newsSubmissions` pipeline) — Phase 7.3 only wires the Podium column into it, no new
system; (d) **per-caption sortable leaderboards** live in the Scores tab with the hard privacy
rule: Podium displays and sorts all 8 captions; **World/Open/A display and sort condensed
captions only (GE/VIS/MUS)** to prevent lineup harvesting — enforced by the recap data shape,
which stores only the condensed trio for fantasy classes. **Confirmed, no action needed:** FMA has no
penalty/missed-show mechanics (validates elective attendance); support packs are mildly
pay-to-progress (validates decision 14's hard no); the community hand-runs "schedule filler"
event networks because event supply fails without coordination (our generated schedule makes
hosted events additive, never load-bearing); uniform/artwork boards signal identity demand
already served by `uniformDesign` + avatar generation; "Masters of FMA" invitationals suggest a
future Champions Invitational hosted event, noted for post-launch. Also noted: FMA's forums are
now visibly spam-overrun (July 2026) — moderation-by-default remains a launch requirement, not a
nice-to-have.

---

_Sources: full crawl of fantasymarchingarts.com (guide sections 1–17, stats archive seasons 1–140,
player directory, forums incl. FMA Rework viewtopic/4475, division-assignment threads, World
Championship proposals, Suggestions board) and a full architectural survey of this repository
(dashboard, class system, scoring pipeline, schedule system, economy, and the unbuilt Staff/
Equipment systems planned in `project_plan.txt`)._
