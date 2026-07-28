/**
 * What the rehearsal asserts about Podium — and above all about its SEASON
 * BOUNDARY, the block of code that has never run anywhere.
 *
 * Podium launched mid-live-season 2026. Everything in `archivePodiumSeason` —
 * career archival, reputation, the division re-seat, the frozen final
 * standings, the champion's trophies, the Hall of Champions merge, the Fan
 * Favorite crowning, and the Corps Budget refund that moves real CorpsCoin —
 * gets its first ever execution the night after championship week, once, with
 * no way to take a wrong result back.
 *
 * This module covers whether the season RAN and whether the boundary produced
 * a record. What that record then has to be right about — the money it moved,
 * the divisions it decided, the ballot it counted, what a returning director
 * inherits — is checksPodiumSettlement.js. Both share the readers in
 * checksPodiumRead.js; this module also runs the whole set.
 *
 * The checks follow the same two rules as checks.js: never assert an exact
 * score (the engine's form model is seeded per corps and the harness must not
 * pin numbers it does not own), and prefer assertions about money,
 * memberships, orderings and conservation — the things a wrong archival would
 * actually cost a director.
 */

const { paths } = require("../src/helpers/paths");
const { pass, fail, warn } = require("./finding");
const podiumWorld = require("./podiumWorld");
const { readPodiumRecaps, rowsFor, readCast, archivedSeasonRow, topN } = require("./checksPodiumRead");
const {
  checkPodiumMoney,
  checkPodiumDivisions,
  checkPodiumFanFavorite,
  checkPodiumReturn,
} = require("./checksPodiumSettlement");

// ---------------------------------------------------------------------------
// P1. The Podium season ran at all
// ---------------------------------------------------------------------------

function checkPodiumSeasonRan(world, played, recaps) {
  const findings = [];
  const { springNights, nights } = played.podium;

  const badSpring = springNights.filter((n) => n.status !== "completed");
  findings.push(
    badSpring.length === 0
      ? pass(
          "podiumSeason",
          "every spring-training night processed",
          `${springNights.length}/${world.springTrainingDays} camp days`
        )
      : fail(
          "podiumSeason",
          "every spring-training night processed",
          `${badSpring.length} camp night(s) did not complete: ` +
            badSpring.map((n) => `${n.calendarDay}:${n.status}${n.error ? ` (${n.error})` : ""}`).join(", ")
        )
  );

  const badNights = nights.filter((n) => n.status !== "completed");
  findings.push(
    badNights.length === 0
      ? pass("podiumSeason", "every competition night 1-49 processed", "49/49")
      : fail(
          "podiumSeason",
          "every competition night 1-49 processed",
          `${badNights.length} night(s) did not complete: ` +
            badNights.map((n) => `${n.day}:${n.status}${n.error ? ` (${n.error})` : ""}`).join(", ")
        )
  );

  // Every registered corps must be on the season roster: the roster is what
  // the nightly processor iterates, so a corps missing from it is a director
  // who paid a commitment and is never scored again.
  const expected = podiumWorld.PODIUM_DIRECTORS.length;
  findings.push(
    played.podium.rosterSize === expected
      ? pass("podiumSeason", "every registered corps is on the roster", `${expected} corps`)
      : fail(
          "podiumSeason",
          "every registered corps is on the roster",
          `${expected} corps registered but the roster holds ${played.podium.rosterSize}`
        )
  );

  // The Eastern Classic is one event over two nights: a corps performs once.
  const night1 = new Set(rowsFor(recaps.get(41)).map((r) => r.uid));
  const night2 = new Set(rowsFor(recaps.get(42)).map((r) => r.uid));
  const both = [...night1].filter((uid) => night2.has(uid));
  findings.push(
    night1.size > 0 && night2.size > 0 && both.length === 0
      ? pass(
          "podiumSeason",
          "Eastern Classic nights are a clean split",
          `${night1.size} + ${night2.size}, no overlap`
        )
      : fail(
          "podiumSeason",
          "Eastern Classic nights are a clean split",
          both.length > 0
            ? `${both.length} corps performed on BOTH nights: ${both.join(", ")}`
            : `night 1 had ${night1.size} corps, night 2 had ${night2.size}`
        )
  );

  // Championship week runs the fantasy bracket in parallel, on the Podium
  // board. Day 46 cuts each division on its own prelims standing; day 49 cuts
  // the whole field. Nobody may march a round they did not earn.
  for (const [day, priorDay, cut, label] of [
    [46, 45, 4, "top 4 A Class of day 45"],
    [49, 48, 12, "top 12 of day 48"],
  ]) {
    const prior = rowsFor(recaps.get(priorDay));
    const expectedField =
      day === 46
        ? topN(prior.filter((r) => (r.division || "aClass") === "aClass"), cut)
        : topN(prior, cut);
    const actual = new Set(rowsFor(recaps.get(day)).map((r) => r.uid));
    const unearned = [...actual].filter((uid) => !expectedField.has(uid));
    findings.push(
      actual.size > 0 && unearned.length === 0
        ? pass(
            "podiumSeason",
            `day ${day} field advanced from day ${priorDay}`,
            `${actual.size} of the ${label}`
          )
        : fail(
            "podiumSeason",
            `day ${day} field advanced from day ${priorDay}`,
            actual.size === 0
              ? `nobody competed on day ${day}`
              : `${unearned.length} corps advanced without earning it: ${unearned.join(", ")}`
          )
    );
  }

  // A corps is scored on its auto days (the two majors, its assigned Eastern
  // night, championship week) and on nothing else — nobody in this cast
  // self-selects a show, so any other scored day is a corps being marched
  // somewhere it never registered for.
  const allowed = new Set([28, 35, 41, 42, 45, 46, 47, 48, 49]);
  const strayDays = [...recaps.keys()].filter((day) => !allowed.has(day));
  findings.push(
    strayDays.length === 0
      ? pass(
          "podiumSeason",
          "corps are scored only on days they attend",
          `${recaps.size} scored days, all majors or championship week`
        )
      : fail(
          "podiumSeason",
          "corps are scored only on days they attend",
          `recap days nobody registered for: ${strayDays.join(", ")}`
        )
  );

  return findings;
}

// ---------------------------------------------------------------------------
// P2. The boundary: careers, standings, hardware
// ---------------------------------------------------------------------------

async function checkPodiumBoundary(db, world, played, recaps, cast) {
  const findings = [];
  const seasonUid = played.rollover.oldSeasonUid;
  const archive = (await db.doc(`podium-recaps/${seasonUid}`).get()).data() || null;

  findings.push(
    played.podium.archivalNight && played.podium.archivalNight.status === "completed"
      ? pass("podiumBoundary", "the archival night ran", JSON.stringify(played.podium.archivalNight))
      : fail(
          "podiumBoundary",
          "the archival night ran",
          `the first night of the new season reported ${JSON.stringify(played.podium.archivalNight)} — ` +
            "no career, division, champion or refund was settled"
        )
    );

  if (!archive) {
    findings.push(
      fail(
        "podiumBoundary",
        "the season archive was written",
        `podium-recaps/${seasonUid} does not exist: the season left no permanent record, so the ` +
          "Scores archive, profile résumés and Hall of Champions have nothing to read"
      )
    );
    return findings;
  }
  findings.push(pass("podiumBoundary", "the season archive was written", `podium-recaps/${seasonUid}`));

  // Every corps that finished the season must be banked into its career, or
  // the season it played is simply gone.
  const banked = [...cast.values()].filter((c) => archivedSeasonRow(c.career, seasonUid));
  const unbanked = [...cast.values()].filter(
    (c) =>
      c.director.uid !== podiumWorld.PODIUM_VETERAN.uid && !archivedSeasonRow(c.career, seasonUid)
  );
  findings.push(
    unbanked.length === 0
      ? pass("podiumBoundary", "every corps was archived into its career", `${banked.length} careers`)
      : fail(
          "podiumBoundary",
          "every corps was archived into its career",
          `${unbanked.length} corps never reached a career: ${unbanked.map((c) => c.director.uid).join(", ")}`
        )
  );

  // Reputation is earned, never handed out: nobody may finish a season with a
  // reputation above their own historical peak, and a first season can only
  // climb from zero.
  const badRep = [...cast.values()].filter(
    (c) => c.career && (c.career.reputation < 0 || c.career.reputation > (c.career.historicalPeak || 0))
  );
  findings.push(
    badRep.length === 0
      ? pass("podiumBoundary", "reputation never exceeds its own peak")
      : fail(
          "podiumBoundary",
          "reputation never exceeds its own peak",
          badRep
            .map((c) => `${c.director.uid}: rep ${c.career.reputation} > peak ${c.career.historicalPeak}`)
            .join("; ")
        )
  );

  // A corps that registered and never performed is the `pct == null` branch:
  // it banks the season, but gains and loses nothing.
  const late = cast.get("pd_late");
  const lateRow = archivedSeasonRow(late.career, seasonUid);
  findings.push(
    late.career?.lastSeasonUid === seasonUid &&
      lateRow &&
      lateRow.percentile == null &&
      lateRow.reputationBefore === lateRow.reputationAfter
      ? pass(
          "podiumBoundary",
          "registering without performing gains nothing",
          "pd_late banked the season at reputation 0"
        )
      : fail(
          "podiumBoundary",
          "registering without performing gains nothing",
          `pd_late archived as ${JSON.stringify(lateRow)} (career ${JSON.stringify(late.career?.lastSeasonUid)})`
        )
  );

  // The frozen final standings are the season's permanent result.
  const standings = archive.finalStandings || [];
  // Who actually performed, straight from the recaps — the record of what
  // happened, rather than any career doc a later re-registration may have
  // rewritten.
  const scoredCorps = new Set([...recaps.values()].flatMap((recap) => rowsFor(recap).map((r) => r.uid)));
  const placesOk = standings.every((entry, index) => entry.place === index + 1);
  const orderOk = standings.every(
    (entry, index) => index === 0 || standings[index - 1].lastTotal >= entry.lastTotal
  );
  const hasUnscored = standings.some((entry) => entry.lastTotal == null);
  findings.push(
    standings.length === scoredCorps.size && placesOk && orderOk && !hasUnscored
      ? pass(
          "podiumBoundary",
          "final standings are complete and ordered",
          `${standings.length} corps, places 1-${standings.length}`
        )
      : fail(
          "podiumBoundary",
          "final standings are complete and ordered",
          `${standings.length} in the standings against ${scoredCorps.size} scored corps` +
            (placesOk ? "" : "; places are not 1..N") +
            (orderOk ? "" : "; not sorted by score") +
            (hasUnscored ? "; an unscored corps is in the standings" : "")
        )
  );

  // The season champion vs the corps that actually won Finals night. The
  // archive ranks on each corps' LATEST total, which for a corps cut at day 48
  // is its day-48 score — so the two can disagree. Reported rather than
  // failed: which one is "the champion" is the team's call, not the harness's.
  const finalsWinner = [...rowsFor(recaps.get(49))].sort((a, b) => b.totalScore - a.totalScore)[0];
  const champion = archive.champion;
  if (champion && finalsWinner) {
    findings.push(
      champion.uid === finalsWinner.uid
        ? pass(
            "podiumBoundary",
            "the season champion won Finals night",
            `${champion.corpsName} (${champion.uid})`
          )
        : warn(
            "podiumBoundary",
            "the season champion is not the Finals winner",
            `the archive crowns ${champion.corpsName} (${champion.uid}, last total ` +
              `${champion.lastTotal}) but ${finalsWinner.corpsName} (${finalsWinner.uid}) won the ` +
              `day-49 Finals with ${finalsWinner.totalScore}. buildFinalStandings ranks on each ` +
              "corps' most recent score, and a corps cut at Semifinals carries its day-48 number " +
              "into the comparison. Decide whether the season title should be the Finals result"
          )
    );
  }

  // Hardware: the top three bank a Finals medal, once.
  const metals = ["gold", "silver", "bronze"];
  const medalIssues = [];
  for (const [index, metal] of metals.entries()) {
    const entry = standings[index];
    if (!entry) continue;
    const trophies = (cast.get(entry.uid)?.profile?.trophies?.championships || []).filter(
      (t) => t.corpsClass === "podiumClass" && t.seasonName === seasonUid
    );
    if (trophies.length !== 1) {
      medalIssues.push(`${entry.uid} holds ${trophies.length} podium trophies for this season`);
    } else if (trophies[0].metal !== metal) {
      medalIssues.push(`${entry.uid} placed ${index + 1} but holds ${trophies[0].metal}`);
    }
  }
  findings.push(
    medalIssues.length === 0
      ? pass("podiumBoundary", "the podium banked gold, silver and bronze", "one trophy each")
      : fail("podiumBoundary", "the podium banked gold, silver and bronze", medalIssues.join("; "))
  );

  // The Hall of Champions merge — the same doc the fantasy finals write.
  const hall = (await db.doc(`season_champions/${seasonUid}`).get()).data() || {};
  const podiumHall = (hall.classes && hall.classes.podiumClass) || [];
  const unnamed = podiumHall.filter((c) => !c.username || c.username === "Unknown");
  findings.push(
    podiumHall.length > 0 && unnamed.length === 0
      ? pass(
          "podiumBoundary",
          "Podium reached the Hall of Champions",
          `${podiumHall.length} medalists, all named`
        )
      : fail(
          "podiumBoundary",
          "Podium reached the Hall of Champions",
          podiumHall.length === 0
            ? `season_champions/${seasonUid} has no podiumClass entry`
            : `${unnamed.length} medalist(s) archived without a director name`
        )
  );

  // Records book parity: the season's best Podium total is an all-time mark.
  const records = (await db.doc("game-records/records").get()).data() || {};
  const podiumRecord = records.classes && records.classes.podiumClass;
  findings.push(
    podiumRecord && podiumRecord.bestSeason && podiumRecord.bestSeason.value > 0
      ? pass(
          "podiumBoundary",
          "the season-best mark reached the records book",
          `${podiumRecord.bestSeason.corpsName} ${podiumRecord.bestSeason.value}`
        )
      : fail(
          "podiumBoundary",
          "the season-best mark reached the records book",
          "game-records/records has no podiumClass season best"
        )
  );

  // The profile résumé: the row a director's career page renders for this
  // season. appendProfileSeasonHistory writes it with the Podium result
  // (final score, medals, show concept) and skips when a row already exists.
  const resumeIssues = [];
  for (const entry of standings.slice(0, 5)) {
    const rows = (cast.get(entry.uid)?.profile?.corps?.podiumClass?.seasonHistory || []).filter(
      (row) => row.seasonId === seasonUid
    );
    if (rows.length !== 1) {
      resumeIssues.push(`${entry.uid} has ${rows.length} résumé rows for the season`);
      continue;
    }
    if (rows[0].finalScore == null) {
      resumeIssues.push(
        `${entry.uid}'s row carries no finalScore (${JSON.stringify(Object.keys(rows[0]))})`
      );
    }
  }
  findings.push(
    resumeIssues.length === 0
      ? pass("podiumBoundary", "the profile résumé carries the Podium season", "top 5 checked")
      : fail(
          "podiumBoundary",
          "the profile résumé carries the Podium season",
          `${resumeIssues.join("; ")}. The season-rollover profile sweep (helpers/season.js ` +
            "archiveAndResetProfiles) pushes a fantasy-shaped row for every corps class it finds, " +
            "including podiumClass, and it runs BEFORE the Podium archival night. " +
            "appendProfileSeasonHistory then finds a row for the season already there and returns " +
            "early, so the Podium row — final score, medals, show concept — is never written"
        )
  );

  return findings;
}

// ---------------------------------------------------------------------------
// P7. Doing the sweep twice
// ---------------------------------------------------------------------------

/**
 * Re-run `archivePodiumSeason` against the season it already swept.
 *
 * The nightly lease means production normally calls it once, but a lease that
 * expires mid-run, a manual admin re-run, or a retried stage all reach it a
 * second time — and its own docstring promises idempotence. The expensive half
 * of that promise is the refund: a second sweep that re-pays every corps mints
 * CorpsCoin out of nothing. Runs last, because it mutates what every other
 * check reads.
 */
async function checkPodiumSweepTwice(db, played, cast) {
  const findings = [];
  const seasonUid = played.rollover.oldSeasonUid;
  const career = require("../src/helpers/podium/career");

  const archiveBefore = (await db.doc(`podium-recaps/${seasonUid}`).get()).data() || {};
  const walletsBefore = new Map(
    [...cast.values()].map((c) => [c.director.uid, c.profile ? c.profile.corpsCoin || 0 : 0])
  );

  let archivedAgain = null;
  try {
    archivedAgain = await career.archivePodiumSeason(db, {
      seasonUid,
      index: played.podium.seasonIndex,
    });
  } catch (error) {
    return [
      fail(
        "podiumBoundary",
        "sweeping the season twice is harmless",
        `the second sweep threw: ${error.message}`
      ),
    ];
  }

  const paidTwice = [];
  const changedRep = [];
  for (const uid of walletsBefore.keys()) {
    const [profile, careerDoc] = await Promise.all([
      db.doc(paths.userProfile(uid)).get(),
      db.doc(paths.userPodiumCareer(uid)).get(),
    ]);
    const after = profile.exists ? profile.data().corpsCoin || 0 : 0;
    if (after !== walletsBefore.get(uid)) {
      paidTwice.push(`${uid}: ${walletsBefore.get(uid)} -> ${after} CC`);
    }
    const before = cast.get(uid).career;
    const now = careerDoc.exists ? careerDoc.data() : null;
    if (before && now && before.reputation !== now.reputation) {
      changedRep.push(`${uid}: reputation ${before.reputation} -> ${now.reputation}`);
    }
  }

  findings.push(
    paidTwice.length === 0
      ? pass(
          "podiumBoundary",
          "sweeping the season twice pays nobody twice",
          `${archivedAgain} careers re-archived, every wallet unchanged`
        )
      : fail(
          "podiumBoundary",
          "sweeping the season twice pays nobody twice",
          `a second sweep minted CorpsCoin from nothing: ${paidTwice.join("; ")}`
        )
  );

  findings.push(
    changedRep.length === 0
      ? pass("podiumBoundary", "sweeping the season twice re-scores nobody")
      : fail("podiumBoundary", "sweeping the season twice re-scores nobody", changedRep.join("; "))
  );

  const archiveAfter = (await db.doc(`podium-recaps/${seasonUid}`).get()).data() || {};
  const before = archiveBefore.finalStandings || [];
  const after = archiveAfter.finalStandings || [];
  const afterByUid = new Map(after.map((entry) => [entry.uid, entry]));

  const dropped = before.filter((entry) => !afterByUid.has(entry.uid)).map((entry) => entry.uid);
  const rewritten = [];
  for (const entry of before) {
    const now = afterByUid.get(entry.uid);
    if (!now) continue;
    const changes = [];
    if (JSON.stringify(entry.medals || {}) !== JSON.stringify(now.medals || {})) {
      changes.push(`medals ${JSON.stringify(entry.medals || {})} -> ${JSON.stringify(now.medals || {})}`);
    }
    if (entry.division !== now.division) changes.push(`division ${entry.division} -> ${now.division}`);
    if (entry.place !== now.place) changes.push(`place ${entry.place} -> ${now.place}`);
    if (changes.length > 0) rewritten.push(`${entry.uid}: ${changes.join(", ")}`);
  }

  findings.push(
    dropped.length === 0 && rewritten.length === 0
      ? pass(
          "podiumBoundary",
          "sweeping the season twice rewrites the same result",
          `${after.length} corps, unchanged`
        )
      : fail(
          "podiumBoundary",
          "sweeping the season twice rewrites the same result",
          `the frozen season record was rebuilt from degraded data: ` +
            (dropped.length > 0
              ? `${dropped.length} corps vanished from the standings entirely (${dropped.join(", ")}); `
              : "") +
            (rewritten.length > 0 ? `${rewritten.length} rewritten — ${rewritten.slice(0, 4).join("; ")}. ` : "") +
            "A corps whose director has already re-registered no longer has a state doc for the " +
            "finished season, so archivePodiumSeason recovers it from career.history — which " +
            "carries no medals and whose `division` is now NEXT season's seat. A corps whose " +
            "director founded a fresh corps has no career.history row at all (freshStart banks it " +
            "into retiredCareers) and is dropped. The sweep re-runs whenever its first attempt " +
            "fails, which is a night later, by which time directors have re-registered"
        )
  );

  return findings;
}

// ---------------------------------------------------------------------------

async function runPodiumChecks(db, world, played) {
  const seasonUid = played.rollover.oldSeasonUid;
  const recaps = await readPodiumRecaps(db, seasonUid);
  const cast = await readCast(db, seasonUid);

  // Facts the checks need that only Firestore can answer.
  const roster = await db.collection(`podium-season/${seasonUid}/corps`).get();
  played.podium.rosterSize = roster.size;
  const seasons = (await db.doc("podium-config/podiumSeasons").get()).data() || {};
  played.podium.seasonIndex = Object.values(seasons.history || {}).find(
    (entry) => entry && entry.seasonUid === seasonUid
  )?.index;

  const findings = [];
  findings.push(...checkPodiumSeasonRan(world, played, recaps));
  findings.push(...(await checkPodiumBoundary(db, world, played, recaps, cast)));
  findings.push(...checkPodiumMoney(world, played, cast));
  findings.push(...(await checkPodiumDivisions(db, played, cast)));
  findings.push(...(await checkPodiumFanFavorite(db, played, cast, recaps)));
  findings.push(...checkPodiumReturn(played, cast));
  // Last: it re-runs the sweep, which mutates what everything above reads.
  findings.push(...(await checkPodiumSweepTwice(db, played, cast)));
  return findings;
}

module.exports = { runPodiumChecks };
