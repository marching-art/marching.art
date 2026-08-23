# Event Schedules, Performance Slots & Encores (design)

How every show on the calendar becomes a **live, personal** experience: a
complete running order (gate time → performers → intermission → scores read)
built from the directors who actually registered, so a director can watch
**their own corps take the field in real time**. Covers the slotting rule, the
per-event fantasy/podium split, and the encore.

> **Status: design.** This is the agreed target design, not yet built. It
> deliberately reuses the running-order engine, the attendance index, and the
> live UI that already exist — see [`SCHEDULE_SYSTEM.md`](SCHEDULE_SYSTEM.md),
> [`SCORE_DROPS.md`](SCORE_DROPS.md), and [`PODIUM.md`](PODIUM.md).

Related source-of-truth files this design builds on:

- Running-order engine: `functions/src/helpers/scheduleModel.js` (`deriveRunningOrder`)
- Enrichment hook: `functions/src/helpers/offSeasonHeritage.js` (`enrichOffSeasonSchedule`)
- Attendance index: `functions/src/helpers/showRegistrations.js`
- Live UI: `src/components/Schedule/RunningOrder.jsx`, `src/utils/scheduleUtils.js` (`getRunningOrderStatus`)
- Hosted shows: `functions/src/callable/podiumHost.js`, `functions/src/helpers/podium/hostedEvents.js`
- Venue geo: `functions/src/helpers/podium/venueGazetteer.json`, `functions/src/helpers/locationFormat.js`

---

## 1. Goals

The north star: **a director always knows when THEIR corps is performing, right
now.** Everything below serves that.

1. Every show has a complete, believable schedule — gates open, a running order
   with per-corps performance times, one intermission, and a "scores read" time
   (9:00 PM ET in the off-season).
2. The running order is the **real field** — the directors who registered — not a
   historical stand-in. When a director looks at a show, they see their corps in
   the order, at a real time, with a live "On Field" marker.
3. Each event carries **two running orders** — a fantasy schedule and a podium
   schedule — sharing one venue, date, and encore.
4. A closest-to-home corps gets a cosmetic **encore** after scores read.
5. It all scales with a growing or fluctuating user base and stays cheap.

### The one reframe

Do **not** cap who may compete. **Scoring is unbounded** — every registered corps
is scored every night, exactly as today. The running order is a *presentation
layer* over that single nightly score. So the only thing we ever bound is how the
field is *displayed as a timed order*, never who is allowed in. This dissolves the
"how many corps fit in a show" worry: the answer is "all of them compete; the
schedule just paces them across the evening."

---

## 2. One event, two schedules

An event is one venue on one day. It hosts **two independent running-order
schedules**:

| Schedule    | Field (who's in it)                                  | Slotting metric            | Scores read                    |
| ----------- | ---------------------------------------------------- | -------------------------- | ------------------------------ |
| **Fantasy** | Fantasy registrants (the `show_registrations` index) | Recent fantasy performance | Fantasy ladder (off-season 9 PM ET; live per `drop_plans`) |
| **Podium**  | Podium registrants (`collectPodiumRegistrations`)    | Recent Podium performance  | Podium's flat 9 PM ET year-round |

They differ **only** in field, metric, and drop time. Everything else (the
engine, the UI, the encore) is shared. In the UI this is one event card with a
**Fantasy / Podium** toggle, each side rendering its own `RunningOrder` against
its own clock. `showRegistrations.js` already folds Podium picks into the
attendance index, so both fields come from machinery that exists.

---

## 3. The field: real corps only

The running order is exactly the corps that registered for that show — no
historical "stage cast" padding. Consequences we accept and design for:

- **Thin/empty shows are shown honestly.** A show with two registrants renders as
  "2 corps competing tonight," not a padded card. We do **not** borrow historical
  corps to fill regular shows.
- **The heritage engine stays** for what it's uniquely good at: synthesizing the
  Championship-week running orders (days 45–49) from the season pool
  (`buildChampionshipLineup`). We keep that path; we just stop using historical
  corps as filler in regular shows.

---

## 4. Fit-to-window slotting

### Why not heats / a hard featured cap

Real DCI "heats" (prelims + finals) are **two scored rounds**. The game posts
**one score per day**, so heats don't map. A hard "top-12 get a time, the rest
are a list" featured cap fails the north star a different way: most directors
would never get the "my corps is on the field right now" moment, which is the
whole point.

### The rule

Every registered corps gets a real, timed slot, and the whole field still
finishes by the single nightly drop:

1. **Anchor the end.** The *last* performer's "scores read" lands on the show's
   drop time (9 PM ET off-season; the ladder instant live).
2. **Fit the field to a bounded evening window.** With `N` corps and a window `W`
   (first performer → last performer), the interval is
   `interval = clamp(W / (N − 1), minInterval, 17 min)`.
   - Small field → the calibrated real spacing (17 min) — feels like a real regional.
   - Larger field → spacing tightens automatically so everyone still fits before the drop.
3. **Order worst → best by recent performance** — the existing
   `deriveRunningOrder` rule (headliner performs last). Intermission still lands
   ~43% through the field for fields past the minimum size.

There is still exactly **one score**, dropped once. The schedule is pure
presentation on top of it — no rounds to reconcile — and **every** director gets a
timed slot and a live On-Field marker, not just the top of the field.

`deriveRunningOrder(field, opts)` already accepts `opts.startLocalMinutes` and
`opts.constants`, so this is a small extension: derive `interval` (and the
back-computed start) from `N` and `W`, pass them through as constants. The engine
otherwise stays as-is.

### The slotting metric

- **Metric:** the corps' most-recent scored total, or a rolling mean of the last
  2–3 scored nights, read once per night from `fantasy_standings` (Podium: its own
  standings). One read per night, a pure sort per event — no per-view cost.
- **Cold start** (day 1, no history): fall back to lineup point-cost within class,
  then class order, then a stable hash of the corps name. Never blocks.

### Overflow safety valve

Fit-to-window handles any realistic field (with one show per city, ~4 shows/week
per corps, plus hosted shows spreading turnout, per-show fields should sit in the
tens). Only if a single show draws a pathological crowd — enough that even
`minInterval` can't fit them in `W` — do the lowest-recent-performers spill into
an "also competing tonight" list (still scored, no individual time). This is a
guard, not the normal path.

---

## 5. Encore (cosmetic)

After "scores read," one corps gets a ceremonial **encore** slot. It is **purely
cosmetic** — the joy is a director seeing *their* corps named as the encore. It
never scores, never affects standings, and carries no reward.

### Rules

- **Default assignment:** the encore goes to the registered corps whose home is
  **closest to the venue** and that **hasn't encored yet this season**.
- **Cap: one encore per corps per season, absolute.** Consumed by whichever
  encore comes first *chronologically*.
- **Host default:** at a director's own hosted show, their corps is the default
  encore (home-field). Because you host once per season, that's naturally their
  one — *unless* they already spent it earlier (see the edge case).
- **Unresolvable home:** a corps whose location doesn't geocode is simply skipped
  for proximity. The host default still works regardless of geocoding.

### The host-after-encore edge case

A corps can encore at an early-season proximity show and *then* decide to host.
Since the cap is absolute and already spent, **that corps is ineligible for the
encore at its own hosted show**, and the encore falls to the next-closest
eligible corps there. The rule stays one unified season cap — hosting doesn't add
a second encore.

### Optional: decline / bank

Because proximity encores are auto-assigned, a director could burn their one
encore incidentally and lose the marquee host-encore they paid to set up. To keep
agency, a director may **decline** an offered proximity encore to bank it for
later (e.g. a planned hosted show). Optional; the default is auto-assign.

---

## 6. Proximity prerequisite

Corps `location` is free text today (director-typed, ≤50 chars;
`registerCorps.js`). Proximity needs coordinates:

- At registration/rename, run `location` through
  `standardizeLocation` (`locationFormat.js`) → gazetteer lookup
  (`venueGazetteer.json`, 687 venues with lat/lng) and **cache lat/lng on the
  corps**. Unresolved → no proximity (graceful; host-encore still applies).
- Venue coordinates come from the same gazetteer, so the encore is a
  haversine over two cached points — cheap, no per-view geocoding.
- Bonus: the resolved city/region improves venue display everywhere.

---

## 7. The "RIGHT NOW" live layer

Most of this exists — `RunningOrder.jsx` already ticks every 60s, marks
**On Field** / **Up Next** (`getRunningOrderStatus`), and highlights a director's
own row. On top of the stored lineup, add:

- A dashboard chip: *"🎺 Blue Devils takes the field in 4 min — Allentown, World Class."*
- An optional FCM push at slot time (the push path exists — see
  `scheduled/pushNotifications.js`).
- The encore banner: *"Your corps performs the encore tonight."*

All of it is pure client-side time math over the materialized lineup — **zero**
backend cost during the show.

---

## 8. Data-model deltas

Per event (both schedules materialized once, at drop time):

```javascript
// on each competition, per schedule type ("fantasy" | "podium")
schedule: {
  window: { firstLocalMinutes, lastLocalMinutes },
  intervalMin,                 // derived: clamp(W/(N-1), min, 17)
  gatesAt, startsAt, scoresAt, // ISO instants (venue tz)
  timezone,
  lineup: [ { order, uid, corpsClass, corpsName, performanceTime, performsAt } ],
  overflow: [ { uid, corpsClass, corpsName } ],  // safety-valve only; usually []
  encore: { uid, corpsClass, corpsName } | null,
}
```

Per corps:

```javascript
homeGeo: { lat, lng, venueId } | null,   // cached at registration
```

Per season (encore cap bookkeeping), on the profile or a small season doc:

```javascript
encoreUsed: { [seasonUid]: true },       // absolute 1/corps/season
```

---

## 9. Materialization & cost

- **Materialize once at drop time**, in the same hook `enrichOffSeasonSchedule`
  already occupies — read the day's registrations from `show_registrations`, read
  standings once for the metric, run `deriveRunningOrder` per (event, schedule
  type), write the lineups + times + encore onto the event. Live season: the same
  step keyed off the ladder instant.
- **Clients never recompute.** The live markers are time math on stored data.
- **Encore** is decided in the same pass (nearest eligible by cached geo), so no
  extra reads at view time.

This keeps the whole feature at roughly one standings read + one registrations
read per night, matching the cost profile of the existing nightly jobs.

---

## 10. Phased build order

1. **Fit-to-window in the engine.** Extend `deriveRunningOrder` to derive the
   interval/start from field size + window; unit tests for small/large fields and
   the `minInterval` clamp. (Pure, no data changes.)
2. **Real fantasy field → running order.** Materialize the fantasy schedule from
   `show_registrations` in the enrichment hook; point `RunningOrder.jsx` at it;
   render thin/empty shows honestly.
3. **Live personal layer.** Dashboard "takes the field" chip + On-Field for the
   director's own corps; optional FCM push.
4. **Podium schedule.** Second running order from `collectPodiumRegistrations`;
   Fantasy/Podium toggle on the event card.
5. **Proximity plumbing.** Geocode + cache `homeGeo` at registration/rename;
   backfill existing corps once.
6. **Encore.** Nearest-eligible assignment + host default + absolute season cap +
   the host-after-encore edge case; encore banner. Decline/bank last.

---

## 11. Open questions / future

- **Window `W` and `minInterval` values** — calibrate against expected turnout so
  a normal night keeps ~17-min spacing and only true crowds compress.
- **Overflow threshold** — the field size at which the safety-valve list kicks in;
  likely never hit in practice, but pick a number.
- **Metric smoothing** — most-recent vs. a 2–3 night mean; the mean is steadier
  early-season, the latest score is more "live."
- **Decline/bank UX** — how a director is offered the choice without nagging.
