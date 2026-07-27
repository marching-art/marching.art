/**
 * What the rehearsal asserts about how the season RAN — that every day scored,
 * that championship week advanced the fields it advertises, and that the corps
 * who should not have been scored were not. What the season LEAVES BEHIND
 * (champions, payouts, the rollover) lives in checksLeagues.js; this module
 * also runs the whole set, in the order the report prints them.
 *
 * Two rules the checks follow:
 *
 *  1. Never assert an exact score. helpers/scoringMath.js adds a deliberate
 *     ±0.25 jitter to every regressed caption, so any check pinned to a number
 *     would be flaky by construction. Assert orderings, memberships, counts and
 *     conservation instead — all of which the jitter cannot move.
 *  2. Prefer a check that would have caught a bug the audits already found.
 *     Those are the paths with a demonstrated ability to break.
 */

const { paths } = require("../src/helpers/paths");
const { pass, fail, warn, readRecaps, resultsFor, resultsForShow } = require("./finding");
const {
  checkChampions,
  checkPayouts,
  checkRollover,
  checkProfiles,
  checkIdempotency,
} = require("./checksLeagues");

// ---------------------------------------------------------------------------
// A. The season ran at all
// ---------------------------------------------------------------------------

function checkSeasonRan(world, played, recaps) {
  const findings = [];

  const notProcessed = played.days.filter((d) => d.status !== "processed");
  findings.push(
    notProcessed.length === 0
      ? pass("season", "every day 1-49 processed", "49/49")
      : fail(
          "season",
          "every day 1-49 processed",
          `${notProcessed.length} day(s) did not process: ` +
            notProcessed.map((d) => `${d.day}:${d.status}`).join(", ")
        )
  );

  // Days with shows must have produced a recap. Dark days legitimately do not.
  const scheduledDays = world.schedule.filter((d) => d.shows.length > 0).map((d) => d.offSeasonDay);
  const missing = scheduledDays.filter((day) => !recaps.has(day));
  findings.push(
    missing.length === 0
      ? pass("season", "every show day wrote a recap", `${scheduledDays.length} days`)
      : fail("season", "every show day wrote a recap", `missing recaps for days ${missing.join(", ")}`)
  );

  return findings;
}

// ---------------------------------------------------------------------------
// B. Championship week — the bracket that runs once a year
// ---------------------------------------------------------------------------

function checkChampionshipWeek(world, recaps) {
  const findings = [];
  const uidsIn = (day, eventName) =>
    new Set(resultsForShow(recaps.get(day), eventName).map((r) => `${r.uid}_${r.corpsClass}`));

  // Day 45: Open and A only.
  const day45 = resultsForShow(recaps.get(45), "Open and A Class Prelims");
  const badClasses45 = day45.filter((r) => !["openClass", "aClass"].includes(r.corpsClass));
  findings.push(
    day45.length > 0 && badClasses45.length === 0
      ? pass("championship", "day 45 prelims are Open/A only", `${day45.length} entries`)
      : fail(
          "championship",
          "day 45 prelims are Open/A only",
          day45.length === 0
            ? "no results at all on day 45"
            : `${badClasses45.length} entries from other classes`
        )
  );

  // Day 46: the field must be the advertised top 8 Open + top 4 A from day 45.
  const day46 = resultsForShow(recaps.get(46), "Open and A Class Finals");
  const expected46 = new Set();
  for (const [corpsClass, cut] of [
    ["openClass", 8],
    ["aClass", 4],
  ]) {
    day45
      .filter((r) => r.corpsClass === corpsClass)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, cut)
      .forEach((r) => expected46.add(`${r.uid}_${r.corpsClass}`));
  }
  const actual46 = uidsIn(46, "Open and A Class Finals");
  const extra46 = [...actual46].filter((key) => !expected46.has(key));
  findings.push(
    day46.length > 0 && extra46.length === 0
      ? pass("championship", "day 46 field advanced from day 45", `${actual46.size} advanced`)
      : fail(
          "championship",
          "day 46 field advanced from day 45",
          day46.length === 0
            ? "nobody competed at Open/A Finals"
            : `${extra46.length} corps in the field that did not earn it: ${extra46.join(", ")}`
        )
  );

  // Day 48: top 25 of day 47. Day 49: top 12 of day 48.
  for (const [day, event, sourceDay, sourceEvent, cut] of [
    [48, "marching.art World Championship Semifinals", 47, "marching.art World Championship Prelims", 25],
    [49, "marching.art World Championship Finals", 48, "marching.art World Championship Semifinals", 12],
  ]) {
    const source = resultsForShow(recaps.get(sourceDay), sourceEvent);
    const expected = new Set(
      source
        .slice()
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, cut)
        .map((r) => `${r.uid}_${r.corpsClass}`)
    );
    const actual = uidsIn(day, event);
    const extra = [...actual].filter((key) => !expected.has(key));
    findings.push(
      actual.size > 0 && extra.length === 0
        ? pass("championship", `day ${day} field advanced from day ${sourceDay}`, `${actual.size} of a ${cut} cut`)
        : fail(
            "championship",
            `day ${day} field advanced from day ${sourceDay}`,
            actual.size === 0
              ? `nobody competed on day ${day}`
              : `${extra.length} corps advanced without earning it: ${extra.join(", ")}`
          )
    );
  }

  // SoundSport runs its own day-49 show and must not be in the World finals.
  const soundSportInFinals = resultsForShow(
    recaps.get(49),
    "marching.art World Championship Finals"
  ).filter((r) => r.corpsClass === "soundSport");
  findings.push(
    soundSportInFinals.length === 0
      ? pass("championship", "SoundSport stays out of the World finals")
      : fail(
          "championship",
          "SoundSport stays out of the World finals",
          `${soundSportInFinals.length} SoundSport corps in the finals recap`
        )
  );

  // The Eastern Classic two-night split: a corps performs on exactly one night.
  const night1 = new Set(
    resultsForShow(recaps.get(41), "marching.art Eastern Classic").map((r) => `${r.uid}_${r.corpsClass}`)
  );
  const night2 = new Set(
    resultsForShow(recaps.get(42), "marching.art Eastern Classic").map((r) => `${r.uid}_${r.corpsClass}`)
  );
  const both = [...night1].filter((key) => night2.has(key));
  findings.push(
    night1.size > 0 && night2.size > 0 && both.length === 0
      ? pass(
          "championship",
          "Eastern Classic nights are a clean split",
          `${night1.size} + ${night2.size}, no overlap`
        )
      : fail(
          "championship",
          "Eastern Classic nights are a clean split",
          both.length > 0
            ? `${both.length} corps performed on BOTH nights: ${both.join(", ")}`
            : `night 1 had ${night1.size} corps, night 2 had ${night2.size}`
        )
  );

  return findings;
}

// ---------------------------------------------------------------------------
// C. Who must never be scored, and who must forfeit
// ---------------------------------------------------------------------------

function checkScoringGates(world, recaps) {
  const findings = [];
  const allResults = [...recaps.values()].flatMap(resultsFor);

  const incompleteAppearances = allResults.filter((r) => r.uid === "dq_lineup");
  findings.push(
    incompleteAppearances.length === 0
      ? pass("gates", "an unfinished lineup is never scored", "dq_lineup absent from all 49 recaps")
      : fail(
          "gates",
          "an unfinished lineup is never scored",
          `dq_lineup appears in ${incompleteAppearances.length} show result(s)`
        )
  );

  // Championship shows carry `mandatory: true` and auto-enroll their eligible
  // classes, so a director who selected nothing for week 7 is still in the
  // bracket. That is the design, and it is worth pinning: the alternative —
  // discovering on finals night that half the field forgot to pick — is the
  // single most expensive way to learn which way this goes.
  const championshipDays = [45, 46, 47, 48, 49];
  const noPicksShows = championshipDays
    .flatMap((day) => resultsFor(recaps.get(day)))
    .filter((r) => r.uid === "d_nopicks");
  findings.push(
    noPicksShows.length > 0
      ? pass(
          "gates",
          "championship week auto-enrolls, picks or no picks",
          `d_nopicks selected nothing for week 7 and was scored in ${noPicksShows.length} show(s)`
        )
      : fail(
          "gates",
          "championship week auto-enrolls, picks or no picks",
          "d_nopicks selected no week-7 shows and was never scored — a director who misses the " +
            "picking deadline is silently dropped from the championship"
        )
  );

  // A regular week is the opposite: sitting it out is a forfeit, and must score
  // zero rather than carrying an earlier week's number forward.
  const week6Days = [36, 37, 38, 39, 40, 41, 42];
  const absentWeek6 = week6Days
    .flatMap((day) => resultsFor(recaps.get(day)))
    .filter((r) => r.uid === "d_absent");
  findings.push(
    absentWeek6.length === 0
      ? pass("gates", "sitting out a regular week scores nothing", "d_absent has no week-6 results")
      : fail(
          "gates",
          "sitting out a regular week scores nothing",
          `d_absent selected no week-6 shows but was scored in ${absentWeek6.length} of them`
        )
  );

  return findings;
}

// ---------------------------------------------------------------------------
// I. Will it survive the real player base?
// ---------------------------------------------------------------------------

async function checkArchivalScale(db, world, played) {
  const seasonUid = played.rollover.oldSeasonUid;

  // archiveSeasonResultsLogic commits ONE un-chunked db.batch() across every
  // league in the game, as the very last thing it does. Per crowned league that
  // is the champions[] update, the winner's profile update, two coin-history
  // entries, the league payout update, an activity entry, and one notification
  // PER MEMBER — so it grows with the player base, not with the league count.
  //
  // The comments around it (helpers/leagueSeasonReset.js, and the ChunkedWriter
  // rationale in helpers/scoring.js) describe the danger as Firestore's
  // "500-op ceiling". That limit is no longer in Firestore's published quotas:
  // as of July 2026 the documented ceilings are a 10 MiB maximum API request
  // size and 500 field transformations on a SINGLE document. There is no
  // documented cap on the number of writes in a batched commit.
  //
  // The emulator confirms nothing either way here — it accepted both a
  // 5,000-write batch and a 12 MiB one during this harness's development — so
  // this check does not claim a verdict it cannot reach. It measures the shape
  // of the real batch and extrapolates against the documented 10 MiB limit,
  // which is the number that actually applies.
  let ops = 0;
  let crowned = 0;
  let members = 0;
  for (const seed of world.leagues) {
    const league = (await db.doc(paths.league(seed.leagueId)).get()).data();
    if (!(league.champions || []).some((c) => c.seasonId === seasonUid)) continue;
    crowned += 1;
    members += seed.members.length;
    ops += 6 + seed.members.length;
  }

  if (crowned === 0) {
    return [warn("scale", "archival batch size", "no league was crowned, so there is nothing to measure")];
  }

  // Bytes actually written, measured rather than guessed: the notifications are
  // the bulk of the batch and the only part that scales with membership.
  let notificationBytes = 0;
  let notificationCount = 0;
  for (const seed of world.leagues) {
    for (const member of seed.members) {
      const snapshot = await db
        .collection(paths.userNotifications(member))
        .where("type", "==", "new_champion")
        .get();
      for (const doc of snapshot.docs) {
        notificationBytes += Buffer.byteLength(JSON.stringify(doc.data()));
        notificationCount += 1;
      }
    }
  }
  const bytesPerNotification = notificationCount > 0 ? notificationBytes / notificationCount : 0;
  // The non-notification writes are small and fixed; the notification rate is
  // what decides how far this scales.
  const memberSlotsToLimit =
    bytesPerNotification > 0 ? Math.floor((10 * 1024 * 1024) / bytesPerNotification) : Infinity;

  return [
    warn(
      "scale",
      "season archival commits one un-chunked batch",
      `measured: ${ops} operations for ${crowned} crowned league(s) across ${members} memberships, ` +
        `${notificationCount} champion notifications averaging ${Math.round(bytesPerNotification)} ` +
        "bytes. Against the documented 10 MiB request limit that leaves room for roughly " +
        `${memberSlotsToLimit.toLocaleString()} league memberships in one commit, so the game is a ` +
        "long way from the real ceiling and needs no change before finals night. Two things are " +
        "still worth knowing: the surrounding comments cite a 500-op batch limit that Firestore " +
        "no longer publishes (the current quotas are 10 MiB per request and 500 field " +
        "transformations per single document), and the emulator enforces neither limit, so no " +
        "rehearsal can prove this one — only production can"
    ),
  ];
}

/**
 * Run everything.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} world
 * @param {Object} played
 */

async function runChecks(db, world, played) {
  const recaps = await readRecaps(db, played.rollover.oldSeasonUid);
  const findings = [];
  findings.push(...checkSeasonRan(world, played, recaps));
  findings.push(...checkChampionshipWeek(world, recaps));
  findings.push(...checkScoringGates(world, recaps));
  findings.push(...(await checkChampions(db, world, played)));
  findings.push(...(await checkPayouts(db, world, played)));
  findings.push(...(await checkRollover(db, world, played)));
  findings.push(...(await checkProfiles(db, world, played)));
  findings.push(...(await checkArchivalScale(db, world, played)));
  // Last: it re-runs the rollover, which mutates the state every other check
  // reads.
  findings.push(...(await checkIdempotency(db, world, played)));
  return findings;
}

module.exports = { runChecks };
