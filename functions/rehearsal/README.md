# Championship-week dress rehearsal

Plays a whole 49-day season against the Firestore emulator through the **real**
nightly pipeline, rolls it over into the next season, and then checks the things
that happen once a year and cannot be un-happened.

```bash
npm run rehearse          # the full season + rollover, ~180 checks
npm run rehearse:scale    # archival-batch probe at league/member scale
```

Both need `firestore-tests`' dependencies installed (`npm --prefix
firestore-tests ci`) — that is where the repo keeps `firebase-tools` — and
`functions`' (`npm --prefix functions ci`). A run takes about two minutes.

## Why this exists

Championship week is the largest block of code in the game that executes
**once per season**. The finals bracket, the league champion selector, the
consolation race, the prize-pool payout, the achievement mint, and the whole
season rollover each get one attempt a year, in front of the largest audience
the game ever has, with no way to take back a wrong result. Unit tests cover the
pieces; nothing exercised the sequence end to end against a real Firestore.

## What is real and what is not

**Real:** the live-season nightly scorer (`processAndScoreLiveSeasonDayLogic`),
the daily matchup generator, the Monday recap and rivalry jobs, weekly
settlement, championship auto-enrollment and advancement, the Eastern Classic
two-night split, `archiveSeasonResultsLogic`, `resetLeaguesForNewSeason`,
`archiveAndResetProfiles`, and `startNewOffSeason`. Leagues are created and
joined through the `createLeague` / `joinLeague` / `setLeagueScoringFormat`
callables, so entry fees are really debited and prize pools are real escrow.

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

Podium and the timezone-aware drop dispatcher are switched **off** for the run.
They have their own season-boundary work (division promotion, career archival,
the Fan Favorite crowning) which this harness does not yet cover — see
"Not covered yet" below.

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

Add it to the right group in `checks.js` and return `pass`/`fail`/`warn` with a
detail string that says what a player would lose. Prefer checks that would have
caught a bug the audits already found — those are the paths with a demonstrated
ability to break. If a check needs a new kind of director or league, add it to
`world.js` with a one-line note on what edge it exists for.

## Not covered yet

- **Podium's season boundary** — division promotion/demotion, career archival,
  the Fan Favorite finals ballot and crowning, and the parallel Indianapolis
  bracket. This is the largest gap and the obvious next extension.
- **Discord announcements** — the webhooks are unset, so those stages no-op.
- **Firestore rules** — the harness runs with admin credentials, as the nightly
  jobs do. Rules have their own suite in `firestore-tests/`.
- **Real Firestore request limits** — the emulator enforces neither the request
  size limit nor any per-batch write cap (verified during development: it
  accepted a 5,000-write batch and a 12 MiB one). The scale probe therefore
  reports the *shape* of the archival batch, not a verdict on whether production
  would accept it.
