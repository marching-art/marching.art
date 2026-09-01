/**
 * Weekly league recaps and rivalry detection.
 *
 * Extracted from scheduled/leagueAutomation.js so the nightly scoring run can
 * generate a week's recap IMMEDIATELY AFTER that week's matchups resolve.
 *
 * The ordering was the bug. Recaps ran on their own cron at Sunday 22:00 ET
 * while matchups resolve inside the nightly run, which scores the completed
 * game day after the 2 AM ET boundary. The recap generator skips any matchup
 * that is not `completed` with `scores`, so at 22:00 on Sunday it was reading a
 * week that had not been resolved yet and writing a recap with an empty
 * `highlights[]` and null stats — every week, for every league. The cron that
 * remains is a backstop, and it now runs after the night it summarizes.
 */

const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { paths } = require("./paths");
const { processAllInPages } = require("./firestorePaging");
const { buildMatchupResultPushes } = require("./matchupResults");
const { sendPushNotification, PUSH_TYPES } = require("./pushService");
const { MATCHUP_CLASSES: CORPS_CLASSES } = require("./classRegistry");
const { captionsWonBy, CAPTION_CATEGORIES } = require("./captionWars");

/**
 * Detect rivalries from a league's matchup history.
 *
 * Only pairs that actually played get a record (the original O(n²)
 * initialization over every possible pair is long gone).
 */
function detectRivalries(matchupHistory) {
  const h2hRecords = {};

  for (const weekData of Object.values(matchupHistory)) {
    for (const corpsClass of CORPS_CLASSES) {
      const matchups = weekData[`${corpsClass}Matchups`] || [];
      for (const matchup of matchups) {
        if (!matchup.pair || !matchup.pair[0] || !matchup.pair[1]) continue;
        if (!matchup.completed) continue;

        // Copy before sorting. `matchup.pair.sort()` sorted the stored array
        // IN PLACE and the attribution below then read matchup.pair[0]/[1]
        // expecting the original order — it produced the right answer only by
        // coincidence, and any reordering of these branches would have
        // silently corrupted head-to-head records.
        const [home, away] = matchup.pair;
        const [p1, p2] = [home, away].slice().sort();
        const key = `${p1}_${p2}`;

        if (!h2hRecords[key]) {
          h2hRecords[key] = {
            player1: p1,
            player2: p2,
            p1Wins: 0,
            p2Wins: 0,
            ties: 0,
            totalMatches: 0,
            closeMatches: 0,
            lastMatchWeek: 0,
          };
        }

        const record = h2hRecords[key];
        record.totalMatches++;
        record.lastMatchWeek = Math.max(record.lastMatchWeek, weekData.week || 0);

        if (matchup.winner === p1) record.p1Wins++;
        else if (matchup.winner === p2) record.p2Wins++;
        else record.ties++;

        // Cross-class matchups are decided on class percentiles, so their raw
        // points margin says nothing about how close the week was.
        if (matchup.scores && !matchup.crossClass) {
          const margin = Math.abs((matchup.scores[home] || 0) - (matchup.scores[away] || 0));
          if (margin < 5) record.closeMatches++;
        }
      }
    }
  }

  const rivalries = [];
  for (const record of Object.values(h2hRecords)) {
    if (record.totalMatches >= 3) {
      const winDiff = Math.abs(record.p1Wins - record.p2Wins);
      const isCloseRecord = winDiff <= 2;
      const hasCloseGames = record.closeMatches >= 2;

      if (isCloseRecord || hasCloseGames) {
        rivalries.push({
          ...record,
          rivalryScore: record.totalMatches + record.closeMatches * 2 - winDiff,
          intensity:
            record.closeMatches >= 3
              ? "intense"
              : record.totalMatches >= 5
                ? "established"
                : "emerging",
        });
      }
    }
  }

  return rivalries.sort((a, b) => b.rivalryScore - a.rivalryScore);
}

/** Build one league's weekly recap from its resolved matchup document. */
function generateWeeklyRecap(weekMatchups, standings, memberProfiles) {
  const recap = {
    highlights: [],
    stats: {
      totalMatchups: 0,
      totalByes: 0,
      biggestUpset: null,
      closestMatch: null,
      highestScorer: null,
      playerOfWeek: null,
      // Caption Wars only. Null on a league resolving on totals, so the recap
      // card can tell "no sweeps this week" from "this league does not have
      // sweeps".
      captions: null,
    },
  };

  // Sweeps and 2-1s, on a league running Caption Wars. Under this format the
  // close game is the 2-1, not the narrow points margin — a director can lose
  // by a tenth and still be swept 3-0.
  const sweeps = [];
  let thrillers = 0;
  let captionMatchups = 0;

  let closestMargin = Infinity;
  let biggestUpsetMargin = 0;
  let highestScore = 0;

  for (const corpsClass of CORPS_CLASSES) {
    const matchups = weekMatchups[`${corpsClass}Matchups`] || [];

    for (const matchup of matchups) {
      if (matchup.isBye) {
        recap.stats.totalByes++;
        continue;
      }

      recap.stats.totalMatchups++;

      if (!matchup.completed || !matchup.scores) continue;

      const [p1, p2] = matchup.pair;
      const score1 = matchup.scores[p1] || 0;
      const score2 = matchup.scores[p2] || 0;
      const margin = Math.abs(score1 - score2);

      // A cross-class points margin is not a closeness measure — those weeks
      // are decided on each side's class percentile, not the raw totals.
      if (!matchup.crossClass && margin < closestMargin && margin > 0) {
        closestMargin = margin;
        recap.stats.closestMatch = {
          player1: memberProfiles[p1]?.displayName || p1,
          player2: memberProfiles[p2]?.displayName || p2,
          score1,
          score2,
          margin,
          corpsClass,
        };
      }

      // Only a DECIDED matchup contains an upset. A tie stores winner: "tie",
      // which is not a uid: the old branch read it as "not p1" and therefore
      // treated p2 as the winner, naming p2's rank as the winning rank and p1
      // as the loser. With no profile under the key "tie" the fallback printed
      // the string itself, and a drawn week between the top seed and an
      // also-ran published "Upset Alert! tie (ranked #8) defeated Alice
      // (ranked #1)!". Anything that is not one of the two directors is not a
      // result this block can describe.
      const winner = matchup.winner;
      if (winner === p1 || winner === p2) {
        const loser = winner === p1 ? p2 : p1;
        const rank1 = standings[p1]?.rank || 999;
        const rank2 = standings[p2]?.rank || 999;
        const winnerRank = winner === p1 ? rank1 : rank2;
        const loserRank = winner === p1 ? rank2 : rank1;

        if (winnerRank > loserRank + 2) {
          const upsetMagnitude = winnerRank - loserRank;
          if (upsetMagnitude > biggestUpsetMargin) {
            biggestUpsetMargin = upsetMagnitude;
            recap.stats.biggestUpset = {
              winner: memberProfiles[winner]?.displayName || winner,
              loser: memberProfiles[loser]?.displayName || loser,
              winnerRank,
              loserRank,
              magnitude: upsetMagnitude,
              corpsClass,
            };
          }
        }
      }

      if (matchup.captions) {
        captionMatchups++;
        for (const uid of [p1, p2]) {
          const { won, lost } = captionsWonBy(matchup.captions, uid);
          if (won === CAPTION_CATEGORIES.length) {
            sweeps.push({
              player: memberProfiles[uid]?.displayName || uid,
              playerId: uid,
              corpsClass,
            });
          } else if (won === 2 && lost === 1) {
            thrillers++;
          }
        }
      }

      const maxScore = Math.max(score1, score2);
      if (maxScore > highestScore) {
        highestScore = maxScore;
        const scorer = score1 > score2 ? p1 : p2;
        recap.stats.highestScorer = {
          player: memberProfiles[scorer]?.displayName || scorer,
          playerId: scorer,
          score: maxScore,
          corpsClass,
        };
      }
    }
  }

  if (captionMatchups > 0) {
    recap.stats.captions = { matchups: captionMatchups, sweeps, thrillers };
  }

  if (sweeps.length > 0) {
    const names = sweeps.map((s) => s.player);
    recap.highlights.push({
      type: "caption_sweep",
      text:
        names.length === 1
          ? `${names[0]} swept all three captions this week.`
          : `${names.length} directors swept all three captions: ${names.join(", ")}.`,
    });
  }

  if (recap.stats.biggestUpset) {
    recap.highlights.push({
      type: "upset",
      text: `Upset Alert! ${recap.stats.biggestUpset.winner} (ranked #${recap.stats.biggestUpset.winnerRank}) defeated ${recap.stats.biggestUpset.loser} (ranked #${recap.stats.biggestUpset.loserRank})!`,
    });
  }

  if (recap.stats.closestMatch && recap.stats.closestMatch.margin < 3) {
    recap.highlights.push({
      type: "close_game",
      text: `Nail-biter! ${recap.stats.closestMatch.player1} edged out ${recap.stats.closestMatch.player2} by just ${recap.stats.closestMatch.margin.toFixed(1)} points!`,
    });
  }

  if (recap.stats.highestScorer) {
    recap.highlights.push({
      type: "top_scorer",
      text: `${recap.stats.highestScorer.player} dominated with ${recap.stats.highestScorer.score.toFixed(1)} points this week!`,
    });
  }

  return recap;
}

/**
 * Generate (and push) the recap for `week` across every league.
 *
 * Called from the nightly run right after processWeeklyMatchups, and from the
 * backstop cron. Safe to re-run: the recap document is a full overwrite, and
 * result pushes are preference-gated and isolated so a push failure can never
 * fail recap generation.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {number} week
 * @returns {Promise<number>} recaps generated
 */
async function generateLeagueRecapsForWeek(db, week) {
  if (!week || week < 1) return 0;

  const results = await processAllInPages(db.collection(paths.leagues()), 500, async (leagueDoc) => {
    try {
      const leagueId = leagueDoc.id;
      const league = leagueDoc.data();
      const members = league.members || [];

      const matchupDoc = await db.doc(paths.leagueMatchupWeek(leagueId, week)).get();
      if (!matchupDoc.exists) return { skipped: true };

      const matchupData = matchupDoc.data();

      const [standingsDoc, profileDocs, matchupHistorySnapshot] = await Promise.all([
        db.doc(paths.leagueStandings(leagueId)).get(),
        members.length > 0
          ? db.getAll(...members.map((uid) => db.doc(paths.userProfile(uid))), {
              fieldMask: ["displayName"],
            })
          : Promise.resolve([]),
        db.collection(paths.leagueMatchups(leagueId)).get(),
      ]);

      const standingsData = standingsDoc.exists ? standingsDoc.data()?.standings || [] : [];
      const standings = {};
      standingsData.forEach((s, idx) => {
        standings[s.uid] = { ...s, rank: idx + 1 };
      });

      const memberProfiles = {};
      profileDocs.forEach((doc, idx) => {
        if (doc.exists) memberProfiles[members[idx]] = doc.data();
      });

      const recap = generateWeeklyRecap(matchupData, standings, memberProfiles);
      recap.week = week;
      recap.generatedAt = admin.firestore.FieldValue.serverTimestamp();

      const matchupHistory = {};
      matchupHistorySnapshot.forEach((doc) => {
        matchupHistory[doc.id] = {
          ...doc.data(),
          week: parseInt(doc.id.replace("week-", "")),
        };
      });

      const rivalries = detectRivalries(matchupHistory);
      recap.rivalries = rivalries.slice(0, 5);

      await db.doc(paths.leagueWeekRecap(leagueId, week)).set(recap);

      try {
        const resultPushes = buildMatchupResultPushes({
          leagueName: league.name,
          week,
          matchupData,
          memberProfiles,
        });
        const pushResults = await Promise.allSettled(
          resultPushes.map((push) =>
            sendPushNotification(
              push.uid,
              { title: push.title, body: push.body, url: push.url },
              PUSH_TYPES.MATCHUP_RESULT,
              push.data
            )
          )
        );
        const sent = pushResults.filter((r) => r.status === "fulfilled" && r.value === true).length;
        if (resultPushes.length > 0) {
          logger.info(
            `Matchup result pushes for league ${leagueId}: sent ${sent}/${resultPushes.length}`
          );
        }
      } catch (pushError) {
        logger.error(`Matchup result pushes failed for league ${leagueId}:`, pushError);
      }

      return { generated: 1, highlights: recap.highlights.length };
    } catch (leagueError) {
      logger.error(`Error generating recap for league ${leagueDoc.id}:`, leagueError);
      return { skipped: true };
    }
  });

  const generated = results.filter((r) => r.generated).length;
  logger.info(`Week ${week} league recaps: ${generated} generated.`);
  return generated;
}

module.exports = {
  detectRivalries,
  generateWeeklyRecap,
  generateLeagueRecapsForWeek,
};
