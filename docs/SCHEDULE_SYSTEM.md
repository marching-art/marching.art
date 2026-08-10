# Schedule System

How each season's 49-day competition calendar is built, stored, enriched with a
realistic running order, and consumed by the client. Consolidates schedule
generation, the heritage running-order model and its calibration, and the
operator runbook.

Source-of-truth files:

- Generation: `functions/src/helpers/scheduleGeneration.js`
- Season rollover / pipeline: `functions/src/helpers/season.js` (`startNewOffSeason`)
- Storage writer: `functions/src/helpers/seasonSchedule.js` (`writeScheduleToCollection`)
- Location standardization: `functions/src/helpers/locationFormat.js` (`standardizeLocation`)
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

Location de-dup compares the raw `location` string, so every location is first
standardized to `City, ST` (two-letter state/province code) via
`standardizeLocation` (`functions/src/helpers/locationFormat.js`). The historical
archive spells regions out ("Rockford, Illinois", sometimes period-separated —
"Allentown. Pennsylvania") while the live scrape uses codes ("Rockford, IL");
without this, the two spellings read as different venues and the same city lands
on two days. Standardization is applied wherever a location enters the schedule
(off-season generation, live generation/refresh) and at every write choke point
in `seasonSchedule.js`, so `competitions[].location` is always the code form.

The larger season pipeline (`startNewOffSeason` in `season.js`): build a
25-corps pool → `computeResultDaysForPool` → `generateOffSeasonSchedule` →
`enrichOffSeasonSchedule` (heritage layer, gated — see §4) →
`writeScheduleToCollection`.

### Live seasons

A live season's calendar is the REAL DCI tour, scraped from dci.org's events
list (`functions-scraper/index.js`) and mapped onto competition days by date:
`generateLiveSeasonSchedule` at season start, then `mergeScheduleRefresh`
(additive, never destructive) on every refresh as more events are posted.
Names are branded at ingest (`brandEventName`: "DCI X" → "marching.art X") and
the branded majors are tagged `eventTier: "regional"` by name match
(`regionalTierForEventName`).

**Multi-night events.** DCI runs the Eastern Classic as two consecutive nights
in Allentown listed under one name, so identity is `(name, date)` — never name
alone — at every step of ingest. A name-only de-dup in the scraper silently
dropped night two for the whole season: it was never on the schedule, never
registerable, and never scored, while the two-night split
(`helpers/easternSplit.js`) still assigned half the field to it. Once both
nights are on the schedule, `applyMultiNightMajors` (`seasonSchedule.js`)
derives the `multiNight: { nights: [...] }` metadata that the off-season
generator's `placeMajor` sets directly — one registration covers every night,
and the field is split across them.

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
