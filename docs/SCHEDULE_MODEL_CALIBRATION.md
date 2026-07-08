# Learned Schedule Model — Calibration Report (Step 1)

_Calibration date: 2026-07 · model version `2026.07`_

The off-season schedule feature shows a DCI-style running order + performance
clock for every archived show. For 2019+ we have the real scraped schedule
(`historical_schedules`); for pre-2019 (and the pool-driven championship stages)
we **synthesize** one from the event's field of `(corps, score)`. This report
records the empirical basis for that synthesis so it's auditable, not guessed.

## Method

`functions/src/scripts/calibrateSchedule.js` samples real dci.org data across
2019–2026. For each sampled event it fetches:

- the `/events/` detail page → running order + performance times
  (parsed by `helpers/eventDetails`), and
- the matching `/scores/recap/` page → each corps' final total,

joins them by normalized corps name, and measures (1) how well performance order
tracks reverse standings and (2) the timing constants. Re-run any time with
`node src/scripts/calibrateSchedule.js [perYear]`.

Sample used for this report: **24 events** across 2019, 2022, 2023, 2024, 2025,
2026 (2021 excluded itself — the COVID "Celebration" events lacked comparable
recaps). Field sizes ranged from small regionals to the Open Class World
Championship.

## Finding 1 — performance order tracks reverse standings (the core assumption)

Spearman rank correlation between performance order and final score, per event:

| statistic | value |
|---|---|
| median rho | **0.917** |
| min rho | 0.600 |
| max rho | 1.000 |
| events with rho ≥ 0.8 | 17 / 24 |
| events with rho ≥ 0.6 | **24 / 24** |

Positive rho = later performers score higher = worst-to-best order. Every event
cleared 0.6 and the median was 0.92, so **sorting a field worst-to-best by score
reproduces the real running order closely.** The residual is expected: real order
is seeded by the _prior_ round (prelims/last regional), not that night's score,
so score-adjacent pairs occasionally swap. Example (2019 DCI Arkansas, rho 0.976)
— only the 7/8 and 9/10 pairs invert:

```
real order                        reverse-score order
7. Boston Crusaders (89.85)       7. The Cavaliers (88.575)
8. The Cavaliers (88.575)         8. Boston Crusaders (89.85)
9. Bluecoats (92.05)              9. Santa Clara Vanguard (91.25)
10. Santa Clara Vanguard (91.25)  10. Bluecoats (92.05)
```

Class blocking (Open/A perform before World) falls out for free: lower-class
corps score lower, so a pure score sort already tiers them.

## Finding 2 — timing constants (medians)

| constant | fitted median | used in model |
|---|---|---|
| first performer, local start | 19.17 h (~7:10 PM) | `defaultStartLocalMinutes = 1150` |
| gates open before first performer | 80 min | `gatesOffsetMin = 80` |
| scores announced after last performer | 23 min | `scoresOffsetMin = 23` |
| interval between performers | 17.0 min | `intervalMin = 17` |
| intermission gap | 34 min | `intermissionMin = 34` |
| intermission position | 0.43 of field | `intermissionPosition = 0.43` |

Large fields would run past midnight from a fixed 7:10 PM start, so the model
**end-anchors**: it targets the last performer at ~10:30 PM and pulls the start
earlier as needed (floored at 10:00 AM). A 10-corps regional keeps the 7:10 PM
start; a 25-corps championship starts ~3:08 PM and still ends ~10:30 PM.

## Model

`functions/src/helpers/scheduleModel.js` — `deriveRunningOrder(field, opts)`:
sorts worst-to-best by score (corps-name tiebreak → deterministic), spaces by
`intervalMin` with one intermission after `intermissionPosition` of the field,
end-anchors the start, and returns local wall-clock times + gates/scores offsets.
Output is local minutes + `"H:MM AM/PM"`; absolute `performsAt` instants are the
caller's job (Step 3 rebasing needs the event date + venue timezone).

`MODEL_VERSION` (`2026.07`) is stamped on learned rows so they can be
distinguished from scraped rows and rebuilt when the constants change.

## Validation

`scheduleModel.test.js` back-tests the model against the real 2019 DCI Arkansas
field (asserts Spearman ≥ 0.9 vs the true order) plus deterministic unit tests
for interval spacing, intermission placement, gates/scores offsets, end-anchoring,
and clock formatting.

## Limitations / future refinement

- Interval is a single median (17 min); real intervals differ slightly by class
  and by field size. Good enough for v1; can be split by class if class labels
  are added to the archive.
- Start time is end-anchored from field size, not from the real event's actual
  slot (afternoon regional vs evening finals). Pre-2019 events therefore get a
  _plausible_ clock, not their historical one — which is the intent (heritage
  flavor), and 2019+ always uses the real scraped times instead.
- 2021 (COVID "Celebration") is a structural outlier and is not a calibration
  input.
