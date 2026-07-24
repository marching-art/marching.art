# Score-Drop Timing

When (and why) each night's fantasy and Podium scores publish, and how to
operate the timezone-aware pipeline. Source-of-truth files:

- Drop-time ladder: `functions/src/helpers/scoreDropTime.js`
- Nightly planner: `functions/src/helpers/dropPlanner.js`
- Dispatcher + Podium job: `functions/src/scheduled/dropDispatcher.js`
- Venue timezones: `functions/src/helpers/podium/venueGazetteer.json`
  (stamped by `src/scripts/venueTimezones.js`; consumed via
  `timezoneFor()` in `helpers/podium/venues.js`)

---

## 1. The drop rule

Mirrors how real DCI scores become known: a show's scores post ~11 PM local,
and a day's slate is only complete once the furthest-WEST show has posted.

| Westernmost show of the day                        | Drop (ET, DST-tracking)   |
| -------------------------------------------------- | ------------------------- |
| Eastern                                            | 11:00 PM                  |
| Central                                            | 12:00 AM                  |
| Mountain                                           | 1:00 AM                   |
| Pacific                                            | 2:00 AM                   |
| World Championship week (days 47–49, Indianapolis) | 12:00 AM (publishes late) |

- **Off-season**: fixed **9:00 PM ET** (synthetic scores, nothing to wait for).
- **Podium Class**: **9:00 PM ET year-round** (`podiumNightly`), independent
  of the fantasy ladder.
- All times are wall-clock in IANA zones, so DST is automatic. Zones come
  from each show's location via the coordinate-geocoded gazetteer (El Paso →
  Mountain, Arizona → no-DST, etc.); unknown venues assume Pacific so scores
  never drop early.

## 2. The once-per-night scrape

`scoreDropDispatcher` gate-ticks every 15 min, 8 PM–2:45 AM ET. Ticks read
Firestore only (season doc, schedules doc, tonight's `drop_plans` doc) and
exit unless an instant has arrived — so scraper-API credits stay at **one
scrape pass per night**:

- Scrape fires at the westernmost show's real "Scores Announced" time
  (enriched `scoresAt`) + 10 min, floored at drop − 15 min, clamped ≤ 2:45 AM.
- A failed/zero-row attempt retries on later ticks (max 3 attempts total).
- Scoring waits for the scrape, but is force-released by an exhausted retry
  budget, a dark day, or the 2:45 AM clamp — a night is never orphaned; the
  strategy falls back to regression and the watchdog reports the scrape.

Tonight's plan is persisted to **`drop_plans/{showDateET}`** (public,
backend-written): drop/scrape instants, zones, mode, attempt counts. This is
the audit trail and the client's countdown target.

## 3. Kill switch / rollout

`game-settings/features.dropScheduling` (missing = **OFF**):

- **OFF — shadow mode.** Dispatcher persists plans but takes no action;
  legacy 1:30 AM scrape + 2:00 AM scorers run as always. Verify a few nights
  of `drop_plans` docs against reality before flipping.
- **ON — active.** Dispatcher scrapes/scores at the planned instants;
  legacy jobs stand down (they check the flag). Podium runs at 9 PM ET.

**Flip the flag during the daytime gap** (after ~5 AM ET, before ~8 PM ET):
the handoff is then clean — the last legacy run scored yesterday, the first
dispatcher night scores today. Both paths share the same
`{seasonUid}_day{N}` scoring lease, so even a mid-night flip cannot
double-score; at worst one night publishes on the legacy clock.

## 4. Day selection (the one-off-by-one trap)

The dispatcher's day comes from the planner's **3-hour show-day reset**
(11 PM–2:45 AM all belong to the show's calendar date) and is passed
**explicitly** into the scorers. `gameDay.js`'s 2 AM reset — still used for
week math, pushes, and interactive verbs — is one day behind at every
pre-2AM drop time (`dropDispatcher.test.js` documents this). Never derive
the scored day from `gameDay.js` inside the drop pipeline.

## 5. Watchdog & diagnostics

- `scoringWatchdog` (4:30 AM ET) accepts a completed scrape under either
  key: the legacy morning-after date or the dispatcher's show date.
- Planner warnings surface in dispatcher logs: stale `schedules` doc (no
  scheduled shows on a day ≤ 44), gazetteer-vs-enrichment timezone
  mismatches, ignored bogus `scoresAt` values.
- Venue timezone regressions surface at gazetteer rebuild time
  (`tzSource: "needs-review"` + `TZ REVIEW` build warnings).
