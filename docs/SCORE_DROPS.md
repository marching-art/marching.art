# Score-Drop Timing

When (and why) each night's fantasy and Podium scores publish, and how to
operate the timezone-aware pipeline. Source-of-truth files:

- Drop-time ladder: `functions/src/helpers/scoreDropTime.js`
- Nightly planner: `functions/src/helpers/dropPlanner.js`
- Dispatcher + Podium job: `functions/src/scheduled/dropDispatcher.js`
- Venue timezones: `functions/src/helpers/podium/venueGazetteer.json`
  (stamped in place by `functions/src/scripts/venueTimezones.js`; consumed via
  `timezoneFor()` in `functions/src/helpers/podium/venues.js`)

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
- **Only real DCI shows drive timing.** The ladder exists to wait for scores
  announced at an actual venue, so player-hosted events are skipped when
  computing zones and announced times — they're virtual, scored by
  marching.art with nothing to wait for, and a hosted show in Denver must
  never push an Eastern night from 11 PM to 1 AM. The all-virtual off-season
  is the same rule at its limit: a flat 9 PM ET, no ladder.

Two predicates, each erring in the direction that's safe for its use
(`helpers/dropPlanner.js`):

| Predicate       | Used for                          | Unmarked show is…                                |
| --------------- | --------------------------------- | ------------------------------------------------ |
| `isVirtualShow` | zones, announced times, drop time | **real** — waiting too long beats dropping early |
| `owesDciRecap`  | `expectedShowCount`               | **not owed** — also requires a scraped `date`    |

Hosted events are marked `eventTier: "hosted"` + `hostUid` by `addShowToDay`.
Shows created before it persisted those carry neither, which is why timing
keeps them and the owed count (which requires `date`) drops them.

## 2. The once-per-night scrape

`scoreDropDispatcher` gate-ticks every 15 min, 8 PM–2:45 AM ET. Ticks read
Firestore only (season doc, schedules doc, tonight's `drop_plans` doc) and
exit unless an instant has arrived — so scraper-API credits stay at **one
scrape pass per night**:

- Scrape fires at the westernmost show's real "Scores Announced" time
  (enriched `scoresAt`) + 10 min, floored at drop − 15 min, clamped ≤ 2:45 AM.
- Scoring waits for the scrape, but is force-released by exhausted retries, a
  dark day, or the 2:45 AM clamp — a night is never orphaned; the strategy
  falls back to regression and the watchdog reports the scrape.

Tonight's plan is persisted to **`drop_plans/{showDateET}`** (public,
backend-written): drop/scrape instants, zones, mode, attempt counts. This is
the audit trail and the client's countdown target.

### Waiting for DCI

The announced "Scores Announced" time is when scores are read in the stadium;
the recap reaches dci.org some time after. Retries are therefore budgeted by
what an attempt **costs**, because the cheap failure is the common one:

| Attempt                                              | Cost        | Budget                    |
| ---------------------------------------------------- | ----------- | ------------------------- |
| Probe — fetched `/scores`, nothing new to pull       | 1 request   | `MAX_LISTING_PROBES` (16) |
| Scrape — fetched tonight's recap pages, still failed | 1 per event | `MAX_SCRAPE_ATTEMPTS` (3) |

A dark day before championship week gets one of each. The dispatcher charges
every attempt to the recap budget optimistically (a scrape that hangs to the
function timeout must stay charged) and refunds it to the probe counter when
the result reports `fetchedRecaps: false`. 16 probes covers the whole window
at the 15-minute cadence, so in practice the clamp bounds the night and the
budget is a runaway guard.

### Accounting for every scheduled show

A night's scores are only fully real once **every DCI show on the schedule for
that day** has a recap archived. The dispatcher holds the drop until then:

- **What's owed** — `plan.expectedShowCount`, the day's `competitions[]`
  entries that came from the DCI scrape (`owesDciRecap`), or dci.org's own
  listing count if that's higher (a show added since the last schedule
  refresh).
- **What's in hand** — `drop_plans/{date}.scrapedRecapUrls`, the recaps
  actually archived tonight. Counting archived rather than listed events covers
  both a night DCI is still posting and a listed recap that failed to scrape.
- **Cost of re-checking** — the archived URLs are passed back to the scraper as
  a skip list, so a re-check fetches the listing and only genuinely new events.
  A tick with nothing new is a probe, not a recap attempt.
- **When it gives up** — `legacyScoringInstant` (2 AM ET, the old scoring hour)
  plus one tick. The 2:00 AM tick takes a final scrape and the 2:15 tick scores
  with whatever arrived. Anything still missing is a manual
  "Scrape DCI Scores Now" in the morning.

`lastScrapedDate` is stamped only when every recap a run pulled produced rows;
a partial run leaves it unstamped and writes `scrape_runs` status `partial`,
which the 4:30 AM watchdog reads as unhealthy. Any night that scores short is
stamped `usedRegressionFallback` with `recapsArchived` / `recapsOwed`.

### What the client shows

`useDropPlan` (`src/hooks/useSeasonClock.js`) keeps the plan authoritative
**past** its own drop instant, because the drop instant is when scoring may
first run, not proof it did. Three states:

- drop ahead → countdown to `dropInstant` (exact).
- drop passed, no `scoredAt`, before `scrapeRetryUntil` → `scoresPending`;
  surfaces show "Scores processing", never a countdown.
- `scoredAt` set → tonight is done, and the next estimate is taken from
  `scrapeRetryUntil` so the countdown targets **tomorrow** night.

Rolling the countdown forward on a pending drop is what made the chip promise
11 PM and then jump to "3 hours" the moment 11 PM arrived.

## 3. Kill switch / rollout

`game-settings/features.dropScheduling` (missing = **OFF**):

- **OFF — shadow mode.** Dispatcher persists plans but takes no action for
  live-season nights; the legacy 1:30 AM scrape + 2:00 AM scorers run as
  always. Verify a few nights of `drop_plans` docs against reality before
  flipping.
- **ON — active.** Dispatcher scrapes/scores at the planned instants;
  legacy jobs stand down (they check the flag). Podium runs at 9 PM ET.

**Off-season is exempt from the flag.** Off-season drops are synthetic — no
dci.org scrape and no timezone ladder, just a flat 9 PM ET drop — so they carry
none of the live-season scrape risk the switch guards. The dispatcher therefore
scores off-season nights at 9 PM ET **regardless of `dropScheduling`**, and
persists their plan with `mode: "active"`. (Gating them made shadow mode publish
a 9 PM plan the client counted down to — and showed "Scores processing" past —
while the legacy 2 AM job did the actual scoring, so the drop was announced at
9 PM and nothing landed until 2 AM.) The legacy 2 AM off-season job still runs
as an idempotent fallback: the shared `{seasonUid}_day{N}` lease makes it a
no-op once the 9 PM run has scored the day.

**Flip the flag during the daytime gap** (after ~5 AM ET, before ~8 PM ET):
the handoff is then clean — the last legacy run scored yesterday, the first
dispatcher night scores today. Both paths share the same
`{seasonUid}_day{N}` scoring lease, so even a mid-night flip cannot
double-score; at worst one night publishes on the legacy clock.

## 4. Day selection (the one-off-by-one trap)

The dispatcher's day comes from the planner's **3-hour show-day reset**
(11 PM–2:45 AM all belong to the show's calendar date), exported as
`showCalendarDay()` and passed **explicitly** into the scorers. `gameDay.js`'s
2 AM reset — still used for week math and pushes — is one day behind at every
pre-2AM drop time (`dropDispatcher.test.js` documents this). Never derive
the scored day from `gameDay.js` inside the drop pipeline.

Every scoring entry point resolves the day to whichever pipeline owns the
night (flag on → show date; flag off → legacy 2 AM reset):

| Path                                                                                        | Day source                                                                                                        |
| ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `scoreDropDispatcher` (fantasy, both season types)                                          | `planDrop().competitionDay`                                                                                       |
| `podiumNightly` (9 PM ET)                                                                   | `showCalendarDay()`                                                                                               |
| Admin `processLiveSeasonScores` / `processAndArchiveOffSeasonScores` / `processPodiumStage` | `getManualRunCalendarDay()` (flag-aware) — a 10 PM manual run targets **tonight**, not the 2 AM-reset "yesterday" |
| Legacy 2 AM jobs (flag off)                                                                 | unchanged `gameDay.js` derivation                                                                                 |

**Podium's interactive day rolls at 9 PM too** (flag on): the nightly stage
ends each corps' day and advances `state.today` to tomorrow, so
`podiumContext` uses `getActivePodiumCalendarDay` — after 9 PM ET, rehearsal
verbs act on the NEXT day. Leaving the 2 AM boundary in place would let a
9:30 PM verb rebuild the already-processed day with a fresh block allotment
whose spends were then silently discarded (`gameDay.test.js` pins the
boundary). Flag off, the 2 AM boundary applies everywhere, unchanged.

## 5. Watchdog & diagnostics

- `scoringWatchdog` (4:30 AM ET) accepts a completed scrape under either
  key: the legacy morning-after date or the dispatcher's show date.
- Planner warnings surface in dispatcher logs: stale `schedules` doc (no
  scheduled shows on a day ≤ 44), gazetteer-vs-enrichment timezone
  mismatches, ignored bogus `scoresAt` values.
- Venue timezone regressions surface at gazetteer rebuild time
  (`tzSource: "needs-review"` + `TZ REVIEW` build warnings).
