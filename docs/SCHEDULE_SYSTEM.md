# Schedule System

How each season's 49-day competition calendar is built, stored, enriched with a
realistic running order, and consumed by the client. Consolidates schedule
generation, the heritage running-order model and its calibration, and the
operator runbook.

Source-of-truth files:

- Generation: `functions/src/helpers/scheduleGeneration.js`
- Season rollover / pipeline: `functions/src/helpers/season.js` (`startNewOffSeason`)
- Storage writer: `functions/src/helpers/seasonSchedule.js` (`writeScheduleToCollection`)
- Running-order model: `functions/src/helpers/scheduleModel.js`
- Heritage enrichment: `functions/src/helpers/offSeasonHeritage.js`

---

## 1. Source data

**Collection: `historical_scores/{year}`.** Each year document holds an array of
events; each event carries an `offSeasonDay` (1–49) that maps a real historical
show onto a day of the game's 49-day calendar, plus the per-corps caption scores.
`offSeasonDay` is what lets different source years produce a consistent schedule
shape with realistic show timing and championship placement.

Historical data is populated by the importers under `functions/pressboxImporter/`
(scores/rankings) and `functions/dciArchiveImporter/` (event names) — see
[`INTEGRATIONS.md`](INTEGRATIONS.md).

---

## 2. Generation

`generateOffSeasonSchedule()` (`scheduleGeneration.js`) builds the calendar:

1. Read `historical_scores`, group events by `offSeasonDay`.
2. Place the mandatory majors and championships on fixed days (all branded
   **marching.art**, not "DCI"):
   - Day 28 — Southwestern Championship
   - Day 35 — Southeastern Championship
   - Days 41–42 — Eastern Classic (multi-night)
   - Day 45 — Open & A Class Prelims
   - Day 46 — Open & A Class Finals
   - Day 47 — World Championship Prelims
   - Day 48 — World Championship Semifinals
   - Day 49 — World Championship Finals + the SoundSport Championship
     Championship auto-enrollment/advancement rules are in [`GAMEPLAY.md`](GAMEPLAY.md).
3. Fill the remaining days with shows, avoiding duplicate event names/locations.

The larger season pipeline (`startNewOffSeason` in `season.js`): build a
25-corps pool → `computeResultDaysForPool` → `generateOffSeasonSchedule` →
`enrichOffSeasonSchedule` (heritage layer, gated — see §4) →
`writeScheduleToCollection`.

---

## 3. Storage & consumption

### Where the schedule lives

The generated schedule is written to a **dedicated top-level document
`schedules/{seasonId}`** as a **`competitions[]` array** (via
`writeScheduleToCollection`). Each competition record is flat:

```javascript
{
  (id,
    name,
    location,
    date,
    day, // 1–49
    week, // ceil(day / 7)
    type, // e.g. "championship" for marquee events
    allowedClasses, // which classes may register
    mandatory); // true for auto-enrolled championship events
}
```

`game-settings/season` holds only the season header —
`{ name, status, seasonUid, currentPointCap, dataDocId, schedule: { startDate, endDate } }`
— **not** the events. The client reads `schedules/{seasonId}.competitions` (via
`src/store/scheduleStore.ts`); caption-window math reads it in
`captionWindows.js`.

### Frontend selection

`src/components/SeasonSetupWizard/ShowSelectionStep.jsx` presents the current
week's competitions and lets a director register (up to 4 shows/week; 7 in the
final week). Championship events (`type: "championship"` / `mandatory`) are
filtered out — they use automatic enrollment. Selections save to the user's
corps under `selectedShows.week{N}` (`selectUserShows` in `lineups.js`).

---

## 4. Heritage running-order model

On top of the base schedule, the **heritage layer** synthesizes a realistic
per-show running order and performance clock (gate times, corps intervals,
intermission, score-announcement time) so a show feels like a real event.

- Enrichment: `enrichOffSeasonSchedule` (`offSeasonHeritage.js`), which derives
  each show's running order from `deriveRunningOrder(field, opts)` in
  `scheduleModel.js`.
- Supporting helpers: `historicalSchedules.js`, `learnedSchedules.js`,
  `pickResultDays.js`, `scheduleCoverage.js`; client rendering in
  `src/components/Schedule/RunningOrder.jsx` and `src/utils/pickHighlights.js`.
- **Kill switch:** the layer is gated by `game-settings/config.heritageSchedulesEnabled`
  (`isHeritageSchedulesEnabled`). Disabled → the base schedule is written as-is.

### Model constants & calibration

The timing model is empirically calibrated (`scheduleModel.js`,
`MODEL_VERSION = "2026.07"`):

| Constant                   | Value | Meaning                                     |
| -------------------------- | ----- | ------------------------------------------- |
| `defaultStartLocalMinutes` | 1150  | 7:10 PM local first-corps start             |
| `gatesOffsetMin`           | 80    | Gates open before start                     |
| `scoresOffsetMin`          | 23    | Scores announced after last corps           |
| `intervalMin`              | 17    | Minutes between corps                       |
| `intermissionMin`          | 34    | Intermission length                         |
| `intermissionPosition`     | 0.43  | Fractional point in the field for the break |

The empirical basis for these values is derived from the historical corpus; if
you re-derive them, bump `MODEL_VERSION`.

---

## 5. Operator runbook

Bringing up / refreshing the schedule:

- **Season rollover** runs `startNewOffSeason` automatically
  (`scheduled/seasonScheduler.js`); it regenerates and writes
  `schedules/{seasonId}`.
- **Heritage enrichment** is toggled by `game-settings/config.heritageSchedulesEnabled`.
- **Historical data** must be present in `historical_scores` (populated by the
  importers) for generation to have shows to place. Missing/malformed data with
  no `offSeasonDay` is the usual cause of "no shows this week."
- **Venue data** for the running-order model is refreshed by the
  `refresh-venue-gazetteer.yml` workflow.

Verification: confirm `historical_scores` has data with `offSeasonDay`; confirm
`schedules/{seasonId}.competitions` is populated; confirm week filtering in
`ShowSelectionStep` shows days `(week-1)*7+1 … week*7`.
