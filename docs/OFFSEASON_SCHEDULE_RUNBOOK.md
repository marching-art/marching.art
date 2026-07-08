# Off-Season Heritage Schedule — Go-Live Runbook

How the off-season schedule feature is built, and the exact steps to bring it up
cleanly for the August cutover. It gives every off-season show a running order +
performance clock (real for 2019+, synthesized for older years and championships),
and highlights a director's picks in that order.

## The pipeline (what feeds what)

```
dci.org
  ├─ /scores/…  ──(deep scrape, 2013+)──▶ historical_scores/{year}
  └─ /events/…  ──(schedule scrape, 2019+)──▶ historical_schedules/{year}  [source: scraped]
                                                     ▲
historical_scores/{year} ──(learned build)───────────┘  [source: learned]  (2000-2018 + gaps)
                              (scheduleModel: reverse-standings order + fitted times)

startNewOffSeason:
  build 25-corps pool ─▶ computeResultDaysForPool ─▶ dci-data/{season}.corpsValues[].resultDays
  generateOffSeasonSchedule ─▶ enrichOffSeasonSchedule (gated by feature flag)
     • regular days  ← historical_schedules (scraped ≻ learned), times rebased to off-season date
     • championships ← 25-corps pool ordered by day-N regression total
  writeScheduleToCollection ─▶ schedules/{season}.competitions[]  (live-season shape)

client:
  RunningOrder + NextPerformancePanel render the order; buildShowHighlights resolves
  full/dim highlights from resultDays.
```

## Go-live sequence (run in order)

1. **Finish the live 2026 scrape** — scores *and* schedules. The nightly job
   already archives both; confirm `historical_schedules/2026` is populated.
2. **Schedule backfill (2019+ real):** admin → Live Scores tab → **Start Schedule
   Scrape (All Years)**. Wait for the `dci-event-topic` workers to drain (watch
   logs for `[EventWorker]`).
3. **Learned build (older years):** admin → **Build Learned Schedules (All Years)**.
   Idempotent; scraped rows are never overwritten. This also seeds any 2019+ gaps.
4. **Verify:** admin → **Check Coverage** (Schedule Coverage card). Confirm:
   - `Missing` is ~0 (every expected event has a running order).
   - `All-Age Leak` is 0 and every year's `Finals` reads `ok`.
   - `Pool corps with no matching results` is empty (else fix `CORPS_NAME_MAP`
     in `functions/pressboxImporter/config.js` and re-run the learned build).
5. **Start the off-season:** `startNewOffSeason`. It computes pool `resultDays`,
   generates the schedule, and enriches it (if the flag is on). Spot-check the
   Dashboard "Next Performance" panel and the Schedule page for running orders
   and pick highlights.

## Rollback (kill switch)

If enrichment misbehaves, disable it — new off-seasons fall back to the
names-only schedule (exactly today's behavior). No data is deleted.

- Admin → Schedule Coverage card → **Disable (Rollback)**, or
- set `game-settings/config.heritageSchedulesEnabled = false` directly.

Re-enable with **Enable Heritage**. The flag only affects `startNewOffSeason`;
already-generated schedules are unaffected (regenerate to apply a change).

## Graceful degradation (already built in)

- A show with no heritage match keeps its base fields; `RunningOrder` renders
  nothing for an empty lineup, and `NextPerformancePanel` is inert with no timing.
- Pre-2019 shows get a *plausible* clock (end-anchored by field size), not their
  historical time-of-day — intentional; 2019+ always use the real scraped times.
- When a pool corps has no `resultDays` (e.g. live season), highlights degrade to
  full — the simple "your pick is performing" star.

## Emulator dry run (optional, before touching prod)

The orchestration is covered offline by `offSeasonHeritage.test.js`
(`enrichOffSeasonSchedule` dry run) and `scheduleCoverage.test.js`. For a full
end-to-end pass against real data:

```
cd functions && npm run serve      # firebase emulators (functions + firestore)
# seed historical_scores / historical_schedules into the emulator, then invoke
# startNewOffSeason and inspect schedules/{season}.competitions[].
```

## Key files

| Concern | File |
|---|---|
| Timing/order model (calibrated) | `functions/src/helpers/scheduleModel.js` |
| Archive merge + precedence | `functions/src/helpers/historicalSchedules.js` |
| Learned build | `functions/src/helpers/learnedSchedules.js` |
| Off-season enrichment + flag | `functions/src/helpers/offSeasonHeritage.js` |
| Pool result-day index | `functions/src/helpers/pickResultDays.js` |
| Coverage audit | `functions/src/helpers/scheduleCoverage.js` |
| Highlight (client) | `src/utils/pickHighlights.js`, `src/components/Schedule/RunningOrder.jsx` |
| Calibration report | `docs/SCHEDULE_MODEL_CALIBRATION.md` |

## Coverage ceilings (expected, not bugs)

- Schedules exist only from **2019** on dci.org; older years are always `learned`.
- Scores exist from **2013** (2000-2012 via pressbox). 2013-2018 get learned
  running orders; 2000-2012 too, minus placeholder-named events.
