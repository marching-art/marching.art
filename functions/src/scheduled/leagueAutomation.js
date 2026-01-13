/**
 * League Automation System
 *
 * Automated weekly matchup generation, rivalry detection, and recap creation
 * for scaling leagues with hundreds of active ensembles.
 *
 * Schedule:
 * - Sunday 11:59 PM ET: Generate next week's matchups for ALL leagues
 * - Monday 8:00 AM ET: Push notifications sent to users (weeklyMatchupPushJob)
 * - Sunday 10:00 PM ET: Generate weekly recaps for completed week
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb, dataNamespaceParam } = require("../config");

// Corps class configuration
const CORPS_CLASSES = ['worldClass', 'openClass', 'aClass', 'soundSport'];

/**
 * Calculate current week number from season start date
 */
async function getCurrentWeek(db) {
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) return 1;

  const season = seasonDoc.data();
  const startDate = season.schedule?.startDate?.toDate();
  if (!startDate) return 1;

  const now = new Date();
  const diffInDays = Math.floor((now - startDate) / (1000 * 60 * 60 * 24));
  return Math.max(1, Math.ceil((diffInDays + 1) / 7));
}

/**
 * Smart pairing algorithm - pairs players by similar standings
 * This keeps matchups competitive throughout the season
 */
function smartPairMembers(members, standings) {
  if (members.length < 2) {
    return members.length === 1
      ? [{ pair: [members[0], null], winner: members[0], completed: true, isBye: true }]
      : [];
  }

  // Sort members by their standings (wins, then points)
  const sortedMembers = [...members].sort((a, b) => {
    const statsA = standings[a] || { wins: 0, totalPoints: 0 };
    const statsB = standings[b] || { wins: 0, totalPoints: 0 };

    // Primary: wins descending
    if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
    // Secondary: total points descending
    return statsB.totalPoints - statsA.totalPoints;
  });

  const matchups = [];
  const paired = new Set();

  // Pair adjacent players in standings (1v2, 3v4, etc.)
  // This ensures similar-skill matchups
  for (let i = 0; i < sortedMembers.length - 1; i += 2) {
    const player1 = sortedMembers[i];
    const player2 = sortedMembers[i + 1];

    if (!paired.has(player1) && !paired.has(player2)) {
      // Randomize home/away to keep it fair over season
      const isReversed = Math.random() > 0.5;
      matchups.push({
        pair: isReversed ? [player2, player1] : [player1, player2],
        winner: null,
        scores: null,
        completed: false,
        isBye: false
      });
      paired.add(player1);
      paired.add(player2);
    }
  }

  // Handle odd player - gets a bye
  for (const member of sortedMembers) {
    if (!paired.has(member)) {
      matchups.push({
        pair: [member, null],
        winner: member,
        scores: null,
        completed: true,
        isBye: true
      });
    }
  }

  return matchups;
}

/**
 * Detect rivalries based on matchup history
 * Returns rivalry data for players who have faced each other multiple times
 */
function detectRivalries(matchupHistory, memberIds) {
  const h2hRecords = {};

  // Initialize records for all pairs
  for (const id1 of memberIds) {
    for (const id2 of memberIds) {
      if (id1 < id2) {
        const key = `${id1}_${id2}`;
        h2hRecords[key] = {
          player1: id1,
          player2: id2,
          p1Wins: 0,
          p2Wins: 0,
          ties: 0,
          totalMatches: 0,
          closeMatches: 0, // Decided by < 2 battle points
          lastMatchWeek: 0
        };
      }
    }
  }

  // Process matchup history
  for (const weekData of Object.values(matchupHistory)) {
    for (const corpsClass of CORPS_CLASSES) {
      const matchups = weekData[`${corpsClass}Matchups`] || [];
      for (const matchup of matchups) {
        if (!matchup.pair || !matchup.pair[0] || !matchup.pair[1]) continue;
        if (!matchup.completed) continue;

        const [p1, p2] = matchup.pair.sort();
        const key = `${p1}_${p2}`;

        if (!h2hRecords[key]) continue;

        h2hRecords[key].totalMatches++;
        h2hRecords[key].lastMatchWeek = Math.max(h2hRecords[key].lastMatchWeek, weekData.week || 0);

        if (matchup.winner === matchup.pair[0]) {
          if (matchup.pair[0] === p1) h2hRecords[key].p1Wins++;
          else h2hRecords[key].p2Wins++;
        } else if (matchup.winner === matchup.pair[1]) {
          if (matchup.pair[1] === p1) h2hRecords[key].p1Wins++;
          else h2hRecords[key].p2Wins++;
        } else {
          h2hRecords[key].ties++;
        }

        // Track close matches (determined by score margin)
        if (matchup.scores) {
          const score1 = matchup.scores[matchup.pair[0]] || 0;
          const score2 = matchup.scores[matchup.pair[1]] || 0;
          const margin = Math.abs(score1 - score2);
          if (margin < 5) h2hRecords[key].closeMatches++;
        }
      }
    }
  }

  // Identify rivalries: 3+ matches with close record or multiple close games
  const rivalries = [];
  for (const [key, record] of Object.entries(h2hRecords)) {
    if (record.totalMatches >= 3) {
      const winDiff = Math.abs(record.p1Wins - record.p2Wins);
      const isCloseRecord = winDiff <= 2;
      const hasCloseGames = record.closeMatches >= 2;

      if (isCloseRecord || hasCloseGames) {
        rivalries.push({
          ...record,
          rivalryScore: record.totalMatches + record.closeMatches * 2 - winDiff,
          intensity: record.closeMatches >= 3 ? 'intense' : record.totalMatches >= 5 ? 'established' : 'emerging'
        });
      }
    }
  }

  return rivalries.sort((a, b) => b.rivalryScore - a.rivalryScore);
}

/**
 * Generate weekly recap for a league
 */
function generateWeeklyRecap(weekMatchups, standings, memberProfiles) {
  const recap = {
    highlights: [],
    stats: {
      totalMatchups: 0,
      totalByes: 0,
      biggestUpset: null,
      closestMatch: null,
      highestScorer: null,
      playerOfWeek: null
    }
  };

  let closestMargin = Infinity;
  let biggestUpsetMargin = 0;
  let highestScore = 0;
  let mostWins = 0;

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

      // Track closest match
      if (margin < closestMargin && margin > 0) {
        closestMargin = margin;
        recap.stats.closestMatch = {
          player1: memberProfiles[p1]?.displayName || p1,
          player2: memberProfiles[p2]?.displayName || p2,
          score1,
          score2,
          margin,
          corpsClass
        };
      }

      // Track upset (lower-ranked player beating higher-ranked)
      const rank1 = standings[p1]?.rank || 999;
      const rank2 = standings[p2]?.rank || 999;
      const winner = matchup.winner;
      const loser = winner === p1 ? p2 : p1;
      const winnerRank = winner === p1 ? rank1 : rank2;
      const loserRank = winner === p1 ? rank2 : rank1;

      if (winnerRank > loserRank + 2) { // At least 3 rank difference
        const upsetMagnitude = winnerRank - loserRank;
        if (upsetMagnitude > biggestUpsetMargin) {
          biggestUpsetMargin = upsetMagnitude;
          recap.stats.biggestUpset = {
            winner: memberProfiles[winner]?.displayName || winner,
            loser: memberProfiles[loser]?.displayName || loser,
            winnerRank,
            loserRank,
            magnitude: upsetMagnitude,
            corpsClass
          };
        }
      }

      // Track highest scorer
      const maxScore = Math.max(score1, score2);
      if (maxScore > highestScore) {
        highestScore = maxScore;
        const scorer = score1 > score2 ? p1 : p2;
        recap.stats.highestScorer = {
          player: memberProfiles[scorer]?.displayName || scorer,
          playerId: scorer,
          score: maxScore,
          corpsClass
        };
      }
    }
  }

  // Generate highlight sentences
  if (recap.stats.biggestUpset) {
    recap.highlights.push({
      type: 'upset',
      text: `Upset Alert! ${recap.stats.biggestUpset.winner} (ranked #${recap.stats.biggestUpset.winnerRank}) defeated ${recap.stats.biggestUpset.loser} (ranked #${recap.stats.biggestUpset.loserRank})!`
    });
  }

  if (recap.stats.closestMatch && recap.stats.closestMatch.margin < 3) {
    recap.highlights.push({
      type: 'close_game',
      text: `Nail-biter! ${recap.stats.closestMatch.player1} edged out ${recap.stats.closestMatch.player2} by just ${recap.stats.closestMatch.margin.toFixed(1)} points!`
    });
  }

  if (recap.stats.highestScorer) {
    recap.highlights.push({
      type: 'top_scorer',
      text: `${recap.stats.highestScorer.player} dominated with ${recap.stats.highestScorer.score.toFixed(1)} points this week!`
    });
  }

  return recap;
}

/**
 * SCHEDULED: Generate weekly matchups for ALL leagues
 * Runs Sunday 11:59 PM ET to prepare matchups before Monday notifications
 */
exports.generateWeeklyMatchups = onSchedule(
  {
    schedule: "59 23 * * 0", // Sunday 11:59 PM
    timeZone: "America/New_York",
    memory: "512MiB",
  },
  async () => {
    logger.info("Starting automated weekly matchup generation for all leagues");

    const db = getDb();
    const namespace = dataNamespaceParam.value();

    try {
      // Get current week
      const currentWeek = await getCurrentWeek(db);
      const nextWeek = currentWeek + 1;

      logger.info(`Generating matchups for week ${nextWeek}`);

      // Get all active leagues
      const leaguesSnapshot = await db
        .collection(`artifacts/${namespace}/leagues`)
        .get();

      if (leaguesSnapshot.empty) {
        logger.info("No leagues found");
        return;
      }

      let leaguesProcessed = 0;
      let matchupsGenerated = 0;
      let errors = [];

      for (const leagueDoc of leaguesSnapshot.docs) {
        try {
          const league = leagueDoc.data();
          const leagueId = leagueDoc.id;
          const members = league.members || [];

          if (members.length < 2) {
            logger.info(`Skipping league ${leagueId}: less than 2 members`);
            continue;
          }

          // Check if matchups already exist for this week
          const matchupRef = db.doc(`artifacts/${namespace}/leagues/${leagueId}/matchups/week-${nextWeek}`);
          const existingMatchup = await matchupRef.get();

          if (existingMatchup.exists) {
            logger.info(`Skipping league ${leagueId}: week ${nextWeek} matchups already exist`);
            continue;
          }

          // Fetch member profiles to get corps classes
          const profileRefs = members.map(memberId =>
            db.doc(`artifacts/${namespace}/users/${memberId}/profile/data`)
          );
          const profileDocs = await db.getAll(...profileRefs);

          // Build standings from existing data
          const standingsDoc = await db.doc(`artifacts/${namespace}/leagues/${leagueId}/standings/current`).get();
          const standingsData = standingsDoc.exists ? standingsDoc.data()?.standings || [] : [];
          const standings = {};
          standingsData.forEach((s, idx) => {
            standings[s.uid] = { ...s, rank: idx + 1 };
          });

          // Group members by corps class
          const membersByClass = {
            worldClass: [],
            openClass: [],
            aClass: [],
            soundSport: []
          };

          profileDocs.forEach((doc, index) => {
            const memberId = members[index];
            if (doc.exists) {
              const profileData = doc.data();
              const corps = profileData.corps || {};

              for (const corpsClass of CORPS_CLASSES) {
                if (corps[corpsClass] && corps[corpsClass].corpsName) {
                  membersByClass[corpsClass].push(memberId);
                }
              }
            }
          });

          // Generate matchups for each corps class using smart pairing
          const matchupData = {
            week: nextWeek,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            autoGenerated: true,
            pairs: []
          };

          for (const corpsClass of CORPS_CLASSES) {
            const classMembers = membersByClass[corpsClass];
            const matchupArrayKey = `${corpsClass}Matchups`;

            // Use smart pairing based on standings
            matchupData[matchupArrayKey] = smartPairMembers(classMembers, standings);
            matchupsGenerated += matchupData[matchupArrayKey].filter(m => !m.isBye).length;
          }

          await matchupRef.set(matchupData);
          leaguesProcessed++;

          logger.info(`Generated matchups for league ${leagueId}: ${JSON.stringify({
            worldClass: matchupData.worldClassMatchups?.length || 0,
            openClass: matchupData.openClassMatchups?.length || 0,
            aClass: matchupData.aClassMatchups?.length || 0,
            soundSport: matchupData.soundSportMatchups?.length || 0
          })}`);

        } catch (leagueError) {
          logger.error(`Error processing league ${leagueDoc.id}:`, leagueError);
          errors.push({ leagueId: leagueDoc.id, error: leagueError.message });
        }
      }

      // Log summary
      logger.info(`Weekly matchup generation complete: ${leaguesProcessed} leagues processed, ${matchupsGenerated} matchups created`);

      if (errors.length > 0) {
        logger.warn(`Errors encountered: ${JSON.stringify(errors)}`);
      }

    } catch (error) {
      logger.error("Fatal error in weekly matchup generation:", error);
      throw error;
    }
  }
);

/**
 * SCHEDULED: Generate weekly recaps for all leagues
 * Runs Sunday 10:00 PM ET after week's shows are complete
 */
exports.generateWeeklyRecaps = onSchedule(
  {
    schedule: "0 22 * * 0", // Sunday 10:00 PM
    timeZone: "America/New_York",
    memory: "512MiB",
  },
  async () => {
    logger.info("Starting weekly recap generation for all leagues");

    const db = getDb();
    const namespace = dataNamespaceParam.value();

    try {
      const currentWeek = await getCurrentWeek(db);

      if (currentWeek < 1) {
        logger.info("Season hasn't started yet, skipping recaps");
        return;
      }

      logger.info(`Generating recaps for week ${currentWeek}`);

      const leaguesSnapshot = await db
        .collection(`artifacts/${namespace}/leagues`)
        .get();

      let recapsGenerated = 0;

      for (const leagueDoc of leaguesSnapshot.docs) {
        try {
          const leagueId = leagueDoc.id;
          const league = leagueDoc.data();
          const members = league.members || [];

          // Get week's matchups
          const matchupRef = db.doc(`artifacts/${namespace}/leagues/${leagueId}/matchups/week-${currentWeek}`);
          const matchupDoc = await matchupRef.get();

          if (!matchupDoc.exists) {
            continue;
          }

          const matchupData = matchupDoc.data();

          // Get standings
          const standingsDoc = await db.doc(`artifacts/${namespace}/leagues/${leagueId}/standings/current`).get();
          const standingsData = standingsDoc.exists ? standingsDoc.data()?.standings || [] : [];
          const standings = {};
          standingsData.forEach((s, idx) => {
            standings[s.uid] = { ...s, rank: idx + 1 };
          });

          // Get member profiles
          const profileRefs = members.map(uid =>
            db.doc(`artifacts/${namespace}/users/${uid}/profile/data`)
          );
          const profileDocs = await db.getAll(...profileRefs);
          const memberProfiles = {};
          profileDocs.forEach((doc, idx) => {
            if (doc.exists) {
              memberProfiles[members[idx]] = doc.data();
            }
          });

          // Generate recap
          const recap = generateWeeklyRecap(matchupData, standings, memberProfiles);
          recap.week = currentWeek;
          recap.generatedAt = admin.firestore.FieldValue.serverTimestamp();

          // Fetch matchup history for rivalry detection
          const matchupHistorySnapshot = await db
            .collection(`artifacts/${namespace}/leagues/${leagueId}/matchups`)
            .get();

          const matchupHistory = {};
          matchupHistorySnapshot.forEach(doc => {
            matchupHistory[doc.id] = { ...doc.data(), week: parseInt(doc.id.replace('week-', '')) };
          });

          // Detect rivalries
          const rivalries = detectRivalries(matchupHistory, members);
          recap.rivalries = rivalries.slice(0, 5); // Top 5 rivalries

          // Save recap
          await db.doc(`artifacts/${namespace}/leagues/${leagueId}/recaps/week-${currentWeek}`).set(recap);
          recapsGenerated++;

          logger.info(`Generated recap for league ${leagueId}: ${recap.highlights.length} highlights`);

        } catch (leagueError) {
          logger.error(`Error generating recap for league ${leagueDoc.id}:`, leagueError);
        }
      }

      logger.info(`Weekly recap generation complete: ${recapsGenerated} recaps generated`);

    } catch (error) {
      logger.error("Fatal error in weekly recap generation:", error);
      throw error;
    }
  }
);

/**
 * SCHEDULED: Update rivalry data for all leagues
 * Runs Monday 6:00 AM ET after matchups are generated
 */
exports.updateLeagueRivalries = onSchedule(
  {
    schedule: "0 6 * * 1", // Monday 6:00 AM
    timeZone: "America/New_York",
    memory: "256MiB",
  },
  async () => {
    logger.info("Starting league rivalry update");

    const db = getDb();
    const namespace = dataNamespaceParam.value();

    try {
      const leaguesSnapshot = await db
        .collection(`artifacts/${namespace}/leagues`)
        .get();

      let rivalriesUpdated = 0;

      for (const leagueDoc of leaguesSnapshot.docs) {
        try {
          const leagueId = leagueDoc.id;
          const league = leagueDoc.data();
          const members = league.members || [];

          if (members.length < 2) continue;

          // Fetch all matchup history
          const matchupHistorySnapshot = await db
            .collection(`artifacts/${namespace}/leagues/${leagueId}/matchups`)
            .get();

          const matchupHistory = {};
          matchupHistorySnapshot.forEach(doc => {
            matchupHistory[doc.id] = { ...doc.data(), week: parseInt(doc.id.replace('week-', '')) };
          });

          // Detect rivalries
          const rivalries = detectRivalries(matchupHistory, members);

          // Store rivalries
          if (rivalries.length > 0) {
            await db.doc(`artifacts/${namespace}/leagues/${leagueId}/meta/rivalries`).set({
              rivalries,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            rivalriesUpdated++;
          }

        } catch (leagueError) {
          logger.error(`Error updating rivalries for league ${leagueDoc.id}:`, leagueError);
        }
      }

      logger.info(`Rivalry update complete: ${rivalriesUpdated} leagues updated`);

    } catch (error) {
      logger.error("Fatal error in rivalry update:", error);
      throw error;
    }
  }
);

/**
 * CALLABLE: Manual trigger for matchup generation (admin only)
 * Allows admins to force matchup generation for a specific week
 */
exports.triggerMatchupGeneration = onCall(
  { cors: true },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Authentication required.");
    }

    const { leagueId, week, forceRegenerate } = request.data;
    const uid = request.auth.uid;

    if (!leagueId) {
      throw new HttpsError("invalid-argument", "League ID is required.");
    }

    const db = getDb();
    const namespace = dataNamespaceParam.value();

    // Check if user is commissioner
    const leagueRef = db.doc(`artifacts/${namespace}/leagues/${leagueId}`);
    const leagueDoc = await leagueRef.get();

    if (!leagueDoc.exists) {
      throw new HttpsError("not-found", "League not found.");
    }

    const league = leagueDoc.data();

    if (league.creatorId !== uid) {
      throw new HttpsError("permission-denied", "Only the commissioner can trigger matchup generation.");
    }

    const targetWeek = week || (await getCurrentWeek(db)) + 1;
    const matchupRef = db.doc(`artifacts/${namespace}/leagues/${leagueId}/matchups/week-${targetWeek}`);

    const existingMatchup = await matchupRef.get();
    if (existingMatchup.exists && !forceRegenerate) {
      throw new HttpsError("already-exists", `Matchups for week ${targetWeek} already exist. Set forceRegenerate to true to overwrite.`);
    }

    const members = league.members || [];
    if (members.length < 2) {
      throw new HttpsError("failed-precondition", "Need at least 2 members to generate matchups.");
    }

    // Fetch member profiles
    const profileRefs = members.map(memberId =>
      db.doc(`artifacts/${namespace}/users/${memberId}/profile/data`)
    );
    const profileDocs = await db.getAll(...profileRefs);

    // Build standings
    const standingsDoc = await db.doc(`artifacts/${namespace}/leagues/${leagueId}/standings/current`).get();
    const standingsData = standingsDoc.exists ? standingsDoc.data()?.standings || [] : [];
    const standings = {};
    standingsData.forEach((s, idx) => {
      standings[s.uid] = { ...s, rank: idx + 1 };
    });

    // Group by corps class
    const membersByClass = {
      worldClass: [],
      openClass: [],
      aClass: [],
      soundSport: []
    };

    profileDocs.forEach((doc, index) => {
      const memberId = members[index];
      if (doc.exists) {
        const profileData = doc.data();
        const corps = profileData.corps || {};
        for (const corpsClass of CORPS_CLASSES) {
          if (corps[corpsClass] && corps[corpsClass].corpsName) {
            membersByClass[corpsClass].push(memberId);
          }
        }
      }
    });

    // Generate with smart pairing
    const matchupData = {
      week: targetWeek,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      autoGenerated: false,
      triggeredBy: uid,
      pairs: []
    };

    for (const corpsClass of CORPS_CLASSES) {
      matchupData[`${corpsClass}Matchups`] = smartPairMembers(membersByClass[corpsClass], standings);
    }

    await matchupRef.set(matchupData);

    return {
      success: true,
      message: `Matchups generated for week ${targetWeek}`,
      matchups: {
        worldClass: matchupData.worldClassMatchups?.length || 0,
        openClass: matchupData.openClassMatchups?.length || 0,
        aClass: matchupData.aClassMatchups?.length || 0,
        soundSport: matchupData.soundSportMatchups?.length || 0
      }
    };
  }
);

module.exports = {
  generateWeeklyMatchups: exports.generateWeeklyMatchups,
  generateWeeklyRecaps: exports.generateWeeklyRecaps,
  updateLeagueRivalries: exports.updateLeagueRivalries,
  triggerMatchupGeneration: exports.triggerMatchupGeneration
};
