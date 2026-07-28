# Championship-week dress rehearsal

Plays a whole 70-day live season against the Firestore emulator through the
**real** nightly pipeline, rolls it over into the next season, settles it, and
then checks the things that happen once a year and cannot be un-happened.

```bash
npm run rehearse          # the full season + rollover + settlement, ~225 checks
npm run rehearse:scale    # archival-batch probe at league/member scale
```

Both need `firestore-tests`' dependencies installed (`npm --prefix
firestore-tests ci`) — that is where the repo keeps `firebase-tools` — and
`functions`' (`npm --prefix functions ci`). A run takes about two minutes.

## Why this exists

Championship week is the largest block of code in the game that executes
**once per season**. The finals bracket, the league champion selector, the
consolation race, the prize-pool payout, the achievement mint, the whole season
rollover, and Podium's entire season boundary each get one attempt a year, in
front of the largest audience the game ever has, with no way to take back a
wrong result. Unit tests cover the pieces; nothing exercised the sequence end to
end against a real Firestore.

Podium raises the stakes again: it launched mid-live-season 2026, so the
rollover after championship week is the **first time `archivePodiumSeason` will
ever run**. It archives careers, decides next season's divisions, freezes the
final standings, crowns a champion and a Fan Favorite, mints trophies, and
sweeps every corps' unspent Corps Budget back to its CorpsCoin wallet — the
only part of the boundary that moves money.

## What is real and what is not

**Real:** the live-season nightly scorer (`processAndScoreLiveSeasonDayLogic`),
the nightly Podium stage (`runPodiumStage`, called exactly where
`scheduled/dailyProcessors.js` calls it), the daily matchup generator, the
Monday recap and rivalry jobs, weekly settlement, championship auto-enrollment
and advancement, the Eastern Classic two-night split,
`archiveSeasonResultsLogic`, `resetLeaguesForNewSeason`,
`archiveAndResetProfiles`, `startNewOffSeason`, and `archivePodiumSeason`.
Leagues are created and joined through the `createLeague` / `joinLeague` /
`setLeagueScoringFormat` callables, so entry fees are really debited and prize
pools are real escrow. Podium corps are registered through
`registerPodiumCorps`, planned through `setPodiumPlanTemplate` and voted on
through `castFanFavoriteVote`, so budget commitments are really debited and the
Fan Favorite is decided by ballots the server accepted.

## The shape of a run

A live season is 70 calendar days, not 49. The first 21 are spring training,
which the fantasy scorer skips and the Podium stage does **not** — camp
economics, recovery and assistant-director autoplay all happen there, and they
are most of what a corps' budget has spent by opening night.

The season does not end at day 49 either. Podium's careers, divisions,
champion, Fan Favorite and budget refunds are settled by the first nightly stage
of the NEXT season — a night *after* directors can already have re-registered.
So the run keeps playing past the rollover, and deliberately puts a director on
each side of that race:

1. `pd_early` re-registers first, and is refunded by registration's own lazy
   self-archival.
2. The archival night runs and sweeps everybody else.
3. The rest re-register afterwards, and must be told they are owed nothing.

Both paths settle the same money. Both are written to be once-only. The
rehearsal is how you find out whether they are.

**Not real:** three things, all deliberate and all documented at their call
sites.

1. **The clock** (`clock.js`). Rather than fake timers, the season's start date
   is re-pinned before each day so that the day just completed is the day we
   want scored. Every date derivation then runs its real code against a real
   clock; only the season's origin moves.
2. **The corpus** (`world.js`). `historical_scores/2025` is synthetic, shaped
   exactly as `helpers/scoringMath.js` reads it, deterministic under `--seed`.
3. **Pub/Sub** (`stubs.js`). The news-generation publish is stubbed because its
   auth client rejects an internal promise that nothing awaits, which takes the
   whole process down in an environment without credentials. It writes no game
   state.

The timezone-aware drop dispatcher is switched **off**, so the legacy 2 AM
ordering applies and every day is settled by the same call the schedulers make.

## Reading a run

Findings come back as `ok` / `FAIL` / `warn`.

- **FAIL** — something the season would get wrong. Failures print again at the
  bottom under "What breaks on finals night".
- **warn** — something real that is a judgement call, not a defect the harness
  can rule on. These print under "Calls for the team".

The checks deliberately never assert an exact score: `helpers/scoringMath.js`
adds a ±0.25 jitter to every regressed caption, so a check pinned to a number
would be flaky by construction. They assert orderings, memberships, counts and
conservation instead.

## Adding a check

Add it to the right group in `checks.js` (fantasy and leagues) or
`checksPodium.js` and return `pass`/`fail`/`warn` with a detail string that says
what a player would lose. Prefer checks that would have caught a bug the audits
already found — those are the paths with a demonstrated ability to break. If a
check needs a new kind of director or league, add it to `world.js` (or
`podiumWorld.js`) with a one-line note on what edge it exists for.

Seed the state under test in exactly the shape production writes it. The first
Podium run turned up a case in point: the seeded Eastern Classic carried
`multiNight: {nights: 2}` where `generateOffSeasonSchedule` writes
`{nights: [41, 42]}`, and because `easternSplit.js` gates on
`Array.isArray(multiNight.nights)`, every run had been resolving the split
through the legacy uid-parity fallback. The check passed the whole time — on
code production does not run.

## Not covered yet

- **Multi-season Podium careers** — the run crosses one boundary, so reputation
  compounding, division promotion into World Class (nobody skips a division, so
  it takes two seasons to reach), and staff aging across several re-registrations
  are only covered as far as one rollover reaches. `pd_vet` covers dormancy by
  starting with a career two season-indices old.
- **Podium hosted events and joint rehearsals** — the callables exist and the
  nightly payout runs, but no corps in the cast hosts or scrimmages.
- **Discord announcements** — the webhooks are unset, so those stages no-op.
- **Firestore rules** — the harness runs with admin credentials, as the nightly
  jobs do. Rules have their own suite in `firestore-tests/`.
- **Real Firestore request limits** — the emulator enforces neither the request
  size limit nor any per-batch write cap (verified during development: it
  accepted a 5,000-write batch and a 12 MiB one). The scale probe therefore
  reports the *shape* of the archival batch, not a verdict on whether production
  would accept it.
