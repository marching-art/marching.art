# Podium Class — Phase 0 Notes (Calibration & Audit)

Companion to `PODIUM_CLASS_DESIGN.md` §10 Phase 0. Everything here is reproducible:
each artifact lists its generator script and the harness verifies the constants.

## Deliverables

| Item                   | Artifact                                                                                         | Generator / verifier                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| 0.1 Venue gazetteer    | `functions/src/helpers/podium/venueGazetteer.json` (412 venues)                                  | `functions/src/scripts/buildVenueGazetteer.js`                   |
| 0.2 Calibration corpus | `functions/src/helpers/podium/curveData.json` (bands, deltas, archetypes)                        | `functions/src/scripts/buildPodiumCurves.js`                     |
| 0.4 Engine + harness   | `functions/src/helpers/podium/engine.js` (pure functions)                                        | `functions/src/scripts/podiumSim.js` — **all 8 assertions pass** |
| 0.5 Tunables           | `functions/src/helpers/podium/balanceConfig.json` (deploy-time seed for `podium-config/balance`) | harness                                                          |
| 0.6 CC pricing audit   | §4 below                                                                                         | —                                                                |

## 1. What the corpus says (13 completed years, 802 corps-seasons)

- **Day-49 TOTAL band: p50 89.75 / p95 97.685 / max 99.117.** The "no corps ever
  scores 100" rule is not a design invention — it is the corpus maximum. (Adding
  the live-scraped years will raise the max toward ~99.65; the engine reads the
  band, so no constant changes.) The hard total cap is **99.70** (`scoring.totalCap`)
  — just above DCI's real all-time 99.65, reachable only by a Champion-tier,
  max-challenge, near-perfect unicorn season once the full corpus is loaded.
- **Day-1 TOTAL band: p50 64.8 / p95 78.5 / max 81.4** — a strong opener is
  high-70s, exactly the design's §4.3 guess.
- **Growth is logistic.** ~615 clean fits per caption (rmse < 1.5). The k-means
  archetypes per caption split into exactly the shapes §5.1 predicted: a
  low-ceiling early-installer (e.g. brass L≈14.8, inflection ~day 15), broad
  steady-climber clusters (L≈19.3, k≈0.04), and a later-inflecting top cluster.
- **Captions genuinely decline.** Day-over-day delta rates have heavy negative
  tails (TOTAL late-season p5 = −2.15/day) — the neglect-decay mechanic is
  corpus-grounded, not punitive flavor.

## 2. The attainment insight (engine architecture note)

Two structural findings from harness iteration, recorded so nobody re-learns them:

1. **Attainment cannot multiply the curve.** The historical band is narrow at the
   top (p50→p97 ≈ 8% per caption), so any multiplicative execution discount
   (content × clean) drops every corps below the band floor and the clamp
   flattens all strategies to identical scores. The engine instead **realizes
   the gap**: `raw = floor + (curve − floor) × realized`, where `floor` is the
   day's p5 ("a corps that showed up") and `curve` is the challenge-selected
   archetype normalized to hit its ceiling exactly at day 49.
2. **Optimal attainment is ~0.58, structurally.** With seven block types,
   3 blocks/day, and eight captions, even flawless weakest-caption targeting
   tops out near content 0.62 / clean 0.55 across the corps. `attainmentFullRealization
= 0.58` normalizes that observed optimum to "fully realized." Raising raw
   gains instead would just shift the plateau; this constant is the honest knob.

## 3. Tuned constants and what fixed what

| Constant                             | Value                                | Why                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `scoring.attainmentFullRealization`  | 0.58                                 | Observed flawless-play plateau (see §2.2)                                                                                                                                            |
| `scoring.repCeilingPercentileByTier` | 55/65/75/82/88/93/100                | Tier 6 at p93 puts the Elite-vs-Champion upset rate at 40% (30–45% window); evenly-spaced ladder above tier 3                                                                        |
| `reputation.gainWindow`              | 8                                    | Season gain = finals percentile reach into the 8-point window under your tier ceiling; flawless ≈ 8–9/season → Champion at season 10; casual (challenge-5 balanced) stalls at tier 4 |
| `condition.yieldByStamina`           | 1.0 / 0.85 / 0.55 at ≥50 / ≥30 / <30 | Makes rest days strategy, not lost time — before this, the never-resting grinder beat the rest-managed corps                                                                         |
| `condition.overnight/rest recovery`  | 18 / 45                              | Sustainable rhythm: ~1–2 strategic rest days/week for an all-in corps                                                                                                                |
| `rehearsal.primaryGain`              | 0.10                                 | Content ~0.6+ by finals under rotation — paces the install arc against the band                                                                                                      |

**Harness results (`node functions/src/scripts/podiumSim.js`, exit 0):**
envelope containment 0 violations; max total ever 98.5; flawless 98.4 > balanced
93.0 > spam 87.5 / absent 90.4 at tier 7; tier-1 flawless (91.0) beats tier-7
absent (90.4) — reputation is ceiling-only; Champion Status at season 10
(flawless) vs tier 4 after 20 seasons (casual); dormancy return-weaker invariant
holds at every tested (reputation × absence) pair; upset rate 40/100.

The §5.13 tier table in the design doc is updated to these percentiles;
`balanceConfig.json` is authoritative from here on.

## 4. CC pricing audit (Phase 0.6, decision 23)

Earn-rate model for "days of normal play": a casual player fielding SoundSport +
A Class attending 4 shows/week earns ≈ 600 CC/week from participation
(50 + 100 per show day) plus journey/league/season bonuses ≈ **~100 CC/day**.

| Price point                           | CC                            | ≈ days of normal play   | Verdict                                                                                                        |
| ------------------------------------- | ----------------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Starting grant                        | 1,000                         | day 0                   | Anchor. Buys A Class **or** funds a first Podium tour (decision 24)                                            |
| Journey drip                          | +425                          | first season            | Healthy                                                                                                        |
| A Class unlock                        | 1,000                         | 0 (grant covers)        | Intended: immediate                                                                                            |
| Open Class unlock                     | 2,500                         | ~2.5 weeks              | Good mid-season target                                                                                         |
| World Class unlock                    | 5,000                         | ~5–7 weeks ≈ 1 season   | Good season-goal                                                                                               |
| Shop titles                           | 1,000–10,000                  | 1.5 days – 3 months     | Fine; top shelf is identity flex                                                                               |
| Frames / themes                       | 750–7,500                     | ~1 day – 2 months       | Fine                                                                                                           |
| Prestige plaques                      | 2,500 / 7,500 / 15,000        | 3.5 wks / 2.5 mo / 5 mo | Correctly endgame; 15k gold plaque is the long burn                                                            |
| Hall banner                           | 10,000                        | ~3.5 months             | Fine                                                                                                           |
| **Podium budget commitment cap**      | 400 / 700 / 1,000 by division | ≤ the starting grant    | A rookie can fully fund an A-division tour on day one; the World cap equals the grant — the intended either/or |
| Podium show payout / fundraiser block | 30 / 12 (Budget)              | in-class flow           | Needs beta data; sized so an active season roughly re-earns a mid-tier commitment                              |

**Verdict: no repricing required.** The existing ladder is coherent against the
1,000-CC anchor and the rule of thumb holds — nothing a player _needs_ costs CC.
Two watch items for beta: (a) Podium in-class earn rates (showPayout,
fundraiserBlockYield) are guesses until real allocation data exists; (b) if
hosted-event payouts (Phase 6) push effective earn rates past ~150 CC/day, the
cosmetic shelf should stretch upward rather than the unlocks.

## 5. Open items rolling into Phase 1

- Hand-review the 11 `source: "centroid"` gazetteer rows (data errors like
  "Sioux Falls, Iowa" and sub-1,000-pop townships) — 5-minute fix-list in
  `venueGazetteer.json`.
- Re-run `buildPodiumCurves.js --firestore` against the full collection
  (live-scraped years included) before beta; re-run the harness after.
- Reputation pacing used simulated seasons; validate the 10–14 target against
  Crown's 2004→2013 arc numerically once the full corpus is loaded (the
  archive here ends in 2012).
- The harness's strategy set is v1 — add a mid-season-joiner archetype and a
  dormancy/comeback career case when Phase 5 lands heritage credit.
