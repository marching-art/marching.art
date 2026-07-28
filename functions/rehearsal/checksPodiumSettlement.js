/**
 * What the boundary SETTLED: the money it moved, the divisions it decided, the
 * ballot it counted, and what a director inherits when they come back.
 *
 * Split from checksPodium.js, which asserts that the season ran and that the
 * archival sweep produced a record. These are the four things that record then
 * has to be right about — and the first of them, the Corps Budget refund, is
 * the only part of Podium's season boundary that moves real CorpsCoin.
 */

const { pass, fail, warn } = require("./finding");
const podiumWorld = require("./podiumWorld");
const { rowsFor, seasonReportFor } = require("./checksPodiumRead");

const REFUND_TYPE = "podium_budget_refund";

function checkPodiumMoney(world, played, cast) {
  const findings = [];
  const seasonUid = played.rollover.oldSeasonUid;

  // The line items must reconcile against the aggregate the ledger kept:
  // committed + earned - spent === refunded is the promise the report makes to
  // the director, in the panel they read at re-registration.
  const unbalanced = [];
  for (const { director, career } of cast.values()) {
    const report = seasonReportFor(career, seasonUid);
    if (!report) continue;
    const expected = report.committed + report.earned - report.spent;
    if (Math.abs(expected - report.refunded) > 0.001) {
      unbalanced.push(
        `${director.uid}: ${report.committed} + ${report.earned} - ${report.spent} = ${expected}, ` +
          `refunded ${report.refunded}`
      );
    }
  }
  findings.push(
    unbalanced.length === 0
      ? pass(
          "podiumMoney",
          "every season report reconciles",
          "committed + earned - spent = refunded, for every corps"
        )
      : fail("podiumMoney", "every season report reconciles", unbalanced.join("; "))
  );

  // The wallet against its own ledger. Every CorpsCoin movement in the game
  // writes a history row, so the balance is reconstructible; if it is not, a
  // director has been paid (or charged) by something that left no receipt.
  const startingCoin = world.startingCoin;
  const drifted = [];
  for (const { director, profile, history } of cast.values()) {
    if (!profile) continue;
    const ledger = history.reduce((sum, entry) => sum + (entry.amount || 0), 0);
    const expected = startingCoin + ledger;
    if (Math.abs((profile.corpsCoin || 0) - expected) > 0.001) {
      drifted.push(
        `${director.uid}: wallet ${profile.corpsCoin}, ledger says ${expected} ` +
          `(${history.length} entries totalling ${ledger})`
      );
    }
  }
  findings.push(
    drifted.length === 0
      ? pass(
          "podiumMoney",
          "every wallet matches its own coin history",
          `${cast.size} directors reconciled against ${startingCoin} CC opening balances`
        )
      : fail("podiumMoney", "every wallet matches its own coin history", drifted.join("; "))
  );

  // The refund is paid ONCE. Both the nightly sweep and registration's lazy
  // self-archival settle the same money, and `pd_early` deliberately sits
  // between them: it re-registered before the sweep ran.
  const doublePaid = [];
  const missing = [];
  for (const { director, career, history } of cast.values()) {
    const rows = history.filter((e) => e.type === REFUND_TYPE && e.seasonUid === seasonUid);
    const report = seasonReportFor(career, seasonUid);
    const owed = report ? report.refunded : 0;
    if (rows.length > 1) {
      doublePaid.push(
        `${director.uid} was refunded ${rows.length} times ` +
          `(${rows.map((r) => r.amount).join(" + ")} CC)`
      );
    } else if (owed > 0 && rows.length === 0) {
      missing.push(`${director.uid} is owed ${owed} CC and was never paid`);
    } else if (rows.length === 1 && Math.abs(rows[0].amount - owed) > 0.001) {
      doublePaid.push(`${director.uid} was refunded ${rows[0].amount} CC against a report of ${owed}`);
    }
  }
  findings.push(
    doublePaid.length === 0 && missing.length === 0
      ? pass(
          "podiumMoney",
          "the Corps Budget refund is paid exactly once",
          "including pd_early, who re-registered before the sweep swept it"
        )
      : fail(
          "podiumMoney",
          "the Corps Budget refund is paid exactly once",
          [...doublePaid, ...missing].join("; ")
        )
  );

  // The free floor is structural: an unaffordable charge degrades the corps,
  // it never overdraws the ledger.
  const overdrawn = [];
  for (const { director, career } of cast.values()) {
    const report = seasonReportFor(career, seasonUid);
    if (!report) continue;
    if (report.refunded < 0) overdrawn.push(`${director.uid}: refund ${report.refunded}`);
  }
  const broke = cast.get("pd_broke");
  const brokeReport = seasonReportFor(broke.career, seasonUid);
  findings.push(
    overdrawn.length === 0 && brokeReport && brokeReport.committed === 0
      ? pass(
          "podiumMoney",
          "a corps with no budget never goes negative",
          `pd_broke committed 0, earned ${brokeReport.earned}, spent ${brokeReport.spent}, ` +
            `refunded ${brokeReport.refunded}`
        )
      : fail(
          "podiumMoney",
          "a corps with no budget never goes negative",
          overdrawn.length > 0
            ? overdrawn.join("; ")
            : `pd_broke has no season report for ${seasonUid}`
        )
  );

  return findings;
}

// ---------------------------------------------------------------------------
// P4. Divisions: next season's seats
// ---------------------------------------------------------------------------

async function checkPodiumDivisions(db, played, cast) {
  const findings = [];
  const seasonUid = played.rollover.oldSeasonUid;
  const archive = (await db.doc(`podium-recaps/${seasonUid}`).get()).data() || {};
  const published = archive.divisions || {};
  const cutoffs = published.cutoffs || {};

  // With 14 scored corps the pool clears both gates (minPoolForOpen 6,
  // minPoolForWorld 12), so both cutoffs must be published — they are the
  // promise that promotion is a formula, not a hand-picked list.
  findings.push(
    cutoffs.openClass != null && cutoffs.worldClass != null
      ? pass(
          "podiumDivisions",
          "both cutoffs were published with the archive",
          `Open ${cutoffs.openClass.toFixed(2)}, World ${cutoffs.worldClass.toFixed(2)}`
        )
      : fail(
          "podiumDivisions",
          "both cutoffs were published with the archive",
          `cutoffs: ${JSON.stringify(cutoffs)} — a season that publishes no cutoff cannot explain ` +
            "anyone's promotion"
        )
  );

  // Nobody skips a division on the way up: everyone started in A Class, so
  // every seat must be A or Open, never World.
  const skipped = [];
  for (const { director, career } of cast.values()) {
    if (director.uid === podiumWorld.PODIUM_VETERAN.uid) continue;
    if (!career) continue;
    if (career.division === "worldClass") {
      skipped.push(`${director.uid} jumped straight to World Class from A Class`);
    }
  }
  const seated = [...cast.values()].filter(
    (c) => c.director.uid !== podiumWorld.PODIUM_VETERAN.uid && c.career && c.career.division
  );
  findings.push(
    skipped.length === 0 && seated.length === podiumWorld.PODIUM_DIRECTORS.length
      ? pass(
          "podiumDivisions",
          "every corps was re-seated, one division at most",
          `${seated.length} seats: ${JSON.stringify(published.nextSeasonCounts || {})}`
        )
      : fail(
          "podiumDivisions",
          "every corps was re-seated, one division at most",
          skipped.length > 0
            ? skipped.join("; ")
            : `${seated.length} of ${podiumWorld.PODIUM_DIRECTORS.length} corps carry a division seat`
        )
  );

  // The rollover-night race: pd_early re-registered into the new season BEFORE
  // the sweep assessed the divisions, so the sweep has to re-stamp its live
  // state and profile with the seat it just earned. Without that, a director
  // who came back early plays a whole season in last season's division.
  const early = cast.get("pd_early");
  const seat = early.career && early.career.division;
  const liveSeat = early.state && early.state.division;
  const profileSeat = early.profile?.corps?.podiumClass?.division;
  findings.push(
    seat && liveSeat === seat && profileSeat === seat
      ? pass(
          "podiumDivisions",
          "a corps that re-registered early is re-seated by the sweep",
          `pd_early plays next season in ${seat}`
        )
      : fail(
          "podiumDivisions",
          "a corps that re-registered early is re-seated by the sweep",
          `pd_early: career seat ${seat}, live state ${liveSeat}, profile ${profileSeat} — the ` +
            "director registered before the sweep and is fielding a corps in the wrong division"
        )
  );

  return findings;
}

// ---------------------------------------------------------------------------
// P5. The Fan Favorite ballot
// ---------------------------------------------------------------------------

async function checkPodiumFanFavorite(db, played, cast, recaps) {
  const findings = [];
  const seasonUid = played.rollover.oldSeasonUid;
  const fan = (await db.doc(`podium-fan/${seasonUid}`).get()).data() || null;

  // A ballot must never be open on a day it has no field to offer. Candidates
  // come from the major's recap days, which are written by the run that scores
  // each night — so a window opening on the show day itself can only reject
  // every vote cast in it, and the Eastern Classic (one major, two nights)
  // would spend a whole day offering only the corps seeded into night 1.
  const fanFavorite = require("../src/helpers/podium/fanFavorite");
  const cfg = require("../src/helpers/podium/store").balance;
  const emptyWindows = [];
  const partialWindows = [];
  for (const major of fanFavorite.MAJORS) {
    const nights = major === 41 ? [41, 42] : [major];
    const field = new Set(nights.flatMap((night) => rowsFor(recaps.get(night)).map((r) => r.uid)));
    for (let day = 1; day <= 49; day++) {
      if (fanFavorite.openPrelimsMajor(day, cfg) !== major) continue;
      // Recaps exist for every night strictly before the active day.
      const votable = new Set(
        nights.filter((night) => night < day).flatMap((night) => rowsFor(recaps.get(night)).map((r) => r.uid))
      );
      if (votable.size === 0) emptyWindows.push(`major ${major} is open on day ${day} with no field`);
      else if (votable.size < field.size) {
        partialWindows.push(
          `major ${major} is open on day ${day} with ${votable.size} of ${field.size} corps votable`
        );
      }
    }
  }
  findings.push(
    emptyWindows.length === 0 && partialWindows.length === 0
      ? pass(
          "podiumFan",
          "a ballot is only open when its whole field is votable",
          "every prelims window opens the morning after its major's last night"
        )
      : fail(
          "podiumFan",
          "a ballot is only open when its whole field is votable",
          [...emptyWindows, ...partialWindows].join("; ") +
            " — candidatesForMajor reads the recap days, so a window that opens before they are " +
            "written offers a partial field or none at all"
        )
  );

  const rejected = played.podium.rejectedVotes || [];
  findings.push(
    rejected.length === 0
      ? pass("podiumFan", "every ballot was accepted", `${podiumWorld.FINALS_VOTES.length} finals votes`)
      : fail(
          "podiumFan",
          "every ballot was accepted",
          rejected.map((r) => `day ${r.day} ${r.voter}->${r.corpsUid}: ${r.message}`).join("; ")
        )
  );

  if (!fan) {
    findings.push(
      fail("podiumFan", "the ballot produced a winner", `podium-fan/${seasonUid} does not exist`)
    );
    return findings;
  }

  const finalists = fan.finalists || [];
  findings.push(
    finalists.length > 0
      ? pass("podiumFan", "finalists published before championship week", `${finalists.length} finalists`)
      : fail(
          "podiumFan",
          "finalists published before championship week",
          "no finalists were published on day 44, so the finals ballot had nobody to elect"
        )
  );

  // The finals round has to decide it. The seeded ballots put pd_ace ahead in
  // every prelim and elect pd_fan in the finals — if the crowned corps is the
  // prelims leader, the finals ballot was never counted.
  const winner = fan.winner;
  findings.push(
    winner && winner.uid === podiumWorld.EXPECTED_FAN_WINNER
      ? pass(
          "podiumFan",
          "the finals ballot decides the Fan Favorite",
          `${winner.corpsName} (${winner.uid}) with ${winner.finalsVotes} finals votes, over the ` +
            `prelims leader ${podiumWorld.EXPECTED_PRELIMS_LEADER}`
        )
      : fail(
          "podiumFan",
          "the finals ballot decides the Fan Favorite",
          winner
            ? `crowned ${winner.uid} (${winner.finalsVotes} finals votes); the finals ballot elected ` +
              `${podiumWorld.EXPECTED_FAN_WINNER}`
            : "no winner was crowned at archival"
        )
  );

  const archive = (await db.doc(`podium-recaps/${seasonUid}`).get()).data() || {};
  findings.push(
    archive.fanFavorite && winner && archive.fanFavorite.uid === winner.uid
      ? pass("podiumFan", "the season record names the Fan Favorite")
      : fail(
          "podiumFan",
          "the season record names the Fan Favorite",
          `podium-recaps/${seasonUid}.fanFavorite is ${JSON.stringify(archive.fanFavorite || null)}`
        )
  );

  const trophies = winner
    ? (cast.get(winner.uid)?.profile?.trophies?.fanFavorites || []).filter(
        (t) => t.seasonName === seasonUid
      )
    : [];
  findings.push(
    trophies.length === 1
      ? pass("podiumFan", "the Fan Favorite banked its trophy")
      : fail(
          "podiumFan",
          "the Fan Favorite banked its trophy",
          `the winner holds ${trophies.length} Fan Favorite trophies for this season`
        )
  );

  return findings;
}

// ---------------------------------------------------------------------------
// P6. Coming back: what a career is worth next season
// ---------------------------------------------------------------------------

function checkPodiumReturn(played, cast) {
  const findings = [];
  const seasonUid = played.rollover.oldSeasonUid;
  const { beforeSweep, afterSweep } = played.podium;

  // A director who comes back after the sweep is owed nothing — the sweep
  // already paid them. Registration must say so rather than paying again.
  const doubleClaim = Object.values(afterSweep).filter((r) => (r.budgetRefund || 0) > 0);
  findings.push(
    doubleClaim.length === 0
      ? pass(
          "podiumReturn",
          "re-registering after the sweep claims no second refund",
          `${Object.keys(afterSweep).length} directors returned owed nothing`
        )
      : fail(
          "podiumReturn",
          "re-registering after the sweep claims no second refund",
          doubleClaim.map((r) => `${r.uid} was handed ${r.budgetRefund} CC a second time`).join("; ")
        )
  );

  // The other side of the race: registering BEFORE the sweep is where the
  // refund is supposed to come from.
  findings.push(
    (beforeSweep.pd_early.budgetRefund || 0) > 0
      ? pass(
          "podiumReturn",
          "re-registering before the sweep settles last season",
          `pd_early was refunded ${beforeSweep.pd_early.budgetRefund} CC at registration`
        )
      : warn(
          "podiumReturn",
          "re-registering before the sweep settles last season",
          "pd_early was refunded nothing at registration — either it spent its whole budget, or " +
            "the lazy self-archival path did not run"
        )
  );

  // Reputation is the point of a career: it has to survive the boundary.
  const ace = cast.get("pd_ace");
  findings.push(
    ace.state && ace.state.reputation === ace.career.reputation && ace.state.repTier >= 1
      ? pass(
          "podiumReturn",
          "reputation carries into the new season",
          `pd_ace returns at reputation ${ace.career.reputation}, tier ${ace.state.repTier}`
        )
      : fail(
          "podiumReturn",
          "reputation carries into the new season",
          `pd_ace's career holds ${ace.career?.reputation} but its new corps starts at ` +
            `${ace.state?.reputation}`
        )
  );

  // Founding fresh retires the lineage: the old career is banked, not deleted,
  // and the new one starts from nothing.
  const fresh = cast.get("pd_fresh");
  const retired = (fresh.career?.retiredCareers || [])[0];
  const retiredSeason = retired && (retired.history || []).some((h) => h && h.seasonUid === seasonUid);
  findings.push(
    fresh.career?.reputation === 0 && fresh.career?.seasonsPlayed === 0 && retiredSeason
      ? pass(
          "podiumReturn",
          "founding a new corps retires the old career",
          `pd_fresh restarts from nothing; the retired lineage keeps ${retired.seasonsPlayed} ` +
            `season(s) including the one just played`
        )
      : fail(
          "podiumReturn",
          "founding a new corps retires the old career",
          `pd_fresh: reputation ${fresh.career?.reputation}, ` +
            `${fresh.career?.seasonsPlayed} seasons on the new lineage, ` +
            `${(fresh.career?.retiredCareers || []).length} retired career(s)` +
            (retiredSeason ? "" : "; the retired lineage does not hold the season just played")
        )
  );

  // Dormancy: a corps never returns stronger than it left. pd_vet held a
  // worldClass seat at reputation 62 two season indices ago; two missed
  // seasons decay it by 14 (5 + 9), which drops it below the tier-5 gate World
  // re-entry needs.
  const vet = cast.get(podiumWorld.PODIUM_VETERAN.uid);
  const before = podiumWorld.PODIUM_VETERAN.career.reputation;
  const expectedRep = before - 14;
  const registration = afterSweep.pd_vet;
  findings.push(
    vet.career?.reputation === expectedRep && registration.division === "openClass"
      ? pass(
          "podiumReturn",
          "a dormant corps returns weaker, one division lower",
          `pd_vet: reputation ${before} -> ${vet.career.reputation}, worldClass -> ` +
            `${registration.division}`
        )
      : fail(
          "podiumReturn",
          "a dormant corps returns weaker, one division lower",
          `pd_vet came back at reputation ${vet.career?.reputation} (expected ${expectedRep}) in ` +
            `${registration.division} (expected openClass, down from worldClass)`
        )
  );

  return findings;
}


module.exports = {
  checkPodiumMoney,
  checkPodiumDivisions,
  checkPodiumFanFavorite,
  checkPodiumReturn,
};
