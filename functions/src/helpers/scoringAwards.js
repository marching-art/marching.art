// Championship, trophy, and matchup processing for scoring runs: season
// standings cutoffs, championship day config, CorpsCoin awards, regional and
// class trophies, finals champions, and weekly league matchups. Extracted
// verbatim from scoring.js.

const { dataNamespaceParam } = require("../config");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { TRANSACTION_TYPES, addCoinHistoryEntryToBatch } = require("../callable/economy");

/**
 * Get top N corps from season standings with tie handling at cutoff position.
 * Used for championship fallback when previous day results are missing.
 *
 * @param {Array} allRecaps - All season recaps from fantasy_recaps collection
 * @param {number} cutoffRank - Number of corps to include (25 for semis, 12 for finals)
 * @param {Array} eligibleClasses - Array of corps classes to include (e.g., ["worldClass", "openClass", "aClass"])
 * @returns {Array} Array of { uid, corpsClass } for corps that should advance
 */
function getTopCorpsFromSeasonStandings(allRecaps, cutoffRank, eligibleClasses) {
  // Aggregate best score per corps from all season recaps (excluding championship days 45+)
  const corpsScores = new Map(); // key: `${uid}_${corpsClass}`, value: { uid, corpsClass, totalScore, day }

  for (const recap of allRecaps) {
    if (recap.offSeasonDay >= 45) continue; // Skip championship days
    for (const show of (recap.shows || [])) {
      for (const result of (show.results || [])) {
        if (!eligibleClasses.includes(result.corpsClass)) continue;

        const key = `${result.uid}_${result.corpsClass}`;
        const existing = corpsScores.get(key);

        // Use most recent score (highest day number)
        if (!existing || recap.offSeasonDay > existing.day) {
          corpsScores.set(key, {
            uid: result.uid,
            corpsClass: result.corpsClass,
            totalScore: result.totalScore,
            day: recap.offSeasonDay,
          });
        }
      }
    }
  }

  // Convert to array and sort by score descending
  const sortedCorps = Array.from(corpsScores.values())
    .sort((a, b) => b.totalScore - a.totalScore);

  if (sortedCorps.length === 0) {
    return null; // No standings data, fall back to all eligible
  }

  // Handle ties at cutoff position
  let advancingCorps = [];
  if (sortedCorps.length >= cutoffRank) {
    const cutoffScore = sortedCorps[cutoffRank - 1].totalScore;
    advancingCorps = sortedCorps.filter(r => r.totalScore >= cutoffScore);
  } else {
    advancingCorps = sortedCorps;
  }

  return advancingCorps.map(r => ({ uid: r.uid, corpsClass: r.corpsClass }));
}

// =============================================================================
// OPTIMIZATION #5: Shared helper functions extracted from duplicated code
// These helpers consolidate ~500 lines of duplicate logic between off-season
// and live-season scoring into reusable functions.
// =============================================================================

/**
 * Build championship configuration for days 45-49.
 * Determines participant eligibility and progression for championship events.
 *
 * @param {number} scoredDay - The day being scored (45-49)
 * @param {Map} recapsByDay - Map of day number to recap data for O(1) lookups
 * @param {Array} allRecaps - All recap documents for fallback standings
 * @returns {Object|null} Championship configuration or null if not a championship day
 */
function buildChampionshipConfig(scoredDay, recapsByDay, allRecaps) {
  if (scoredDay < 45) return null;

  if (scoredDay === 45) {
    // Day 45: Open and A Class Prelims - All Open and A Class corps auto-enrolled
    logger.info("Day 45: Auto-enrolling all Open Class and A Class corps in Prelims.");
    return {
      "Open and A Class Prelims": {
        participants: null,
        classFilter: ["openClass", "aClass"],
      },
    };
  }

  if (scoredDay === 46) {
    // Day 46: Open and A Class Finals - Top 8 Open, Top 4 A Class from Day 45
    const day45Recap = recapsByDay.get(45);
    const day45Results = day45Recap?.shows?.flatMap(s => s.results) || [];

    if (day45Results.length > 0) {
      const openClassResults = [];
      const aClassResults = [];

      day45Results.forEach(r => {
        if (r.corpsClass === "openClass") openClassResults.push(r);
        else if (r.corpsClass === "aClass") aClassResults.push(r);
      });

      openClassResults.sort((a, b) => b.totalScore - a.totalScore);
      aClassResults.sort((a, b) => b.totalScore - a.totalScore);

      const top8Open = openClassResults.slice(0, 8).map(r => ({ uid: r.uid, corpsClass: "openClass" }));
      const top4AClass = aClassResults.slice(0, 4).map(r => ({ uid: r.uid, corpsClass: "aClass" }));
      const finalists = [...top8Open, ...top4AClass];

      logger.info(`Day 46: ${top8Open.length} Open Class and ${top4AClass.length} A Class corps advancing to Finals.`);

      return {
        "Open and A Class Finals": {
          participants: finalists,
          classFilter: ["openClass", "aClass"],
        },
      };
    } else {
      logger.info("Day 46: No Day 45 results found. Auto-enrolling all Open/A Class corps to Finals.");
      return {
        "Open and A Class Finals": {
          participants: null,
          classFilter: ["openClass", "aClass"],
        },
      };
    }
  }

  if (scoredDay === 47) {
    // Day 47: World Championships Prelims - All World, Open, and A Class corps
    logger.info("Day 47: Auto-enrolling all World, Open, and A Class corps in World Championship Prelims.");
    return {
      "marching.art World Championship Prelims": {
        participants: null,
        classFilter: ["worldClass", "openClass", "aClass"],
      },
    };
  }

  if (scoredDay === 48) {
    // Day 48: World Championships Semifinals - Top 25 from Day 47
    const prelimsRecap = recapsByDay.get(47);
    const prelimsResults = prelimsRecap?.shows?.flatMap(s => s.results) || [];

    if (prelimsResults.length > 0) {
      prelimsResults.sort((a, b) => b.totalScore - a.totalScore);

      let advancingCorps = [];
      if (prelimsResults.length >= 25) {
        const twentyFifthPlaceScore = prelimsResults[24].totalScore;
        advancingCorps = prelimsResults.filter(r => r.totalScore >= twentyFifthPlaceScore);
      } else {
        advancingCorps = prelimsResults;
      }

      const participants = advancingCorps.map(r => ({ uid: r.uid, corpsClass: r.corpsClass }));
      logger.info(`Day 48: ${participants.length} corps advancing to Semifinals.`);

      return {
        "marching.art World Championship Semifinals": {
          participants,
          classFilter: ["worldClass", "openClass", "aClass"],
        },
      };
    } else {
      // FALLBACK: Use season standings
      logger.info("Day 48: No Day 47 results found. Using season standings for top 25 corps.");
      const eligibleClasses = ["worldClass", "openClass", "aClass"];
      const top25FromStandings = getTopCorpsFromSeasonStandings(allRecaps, 25, eligibleClasses);

      if (top25FromStandings && top25FromStandings.length > 0) {
        logger.info(`Day 48: ${top25FromStandings.length} corps advancing to Semifinals from season standings.`);
        return {
          "marching.art World Championship Semifinals": {
            participants: top25FromStandings,
            classFilter: eligibleClasses,
          },
        };
      } else {
        logger.info("Day 48: No season standings data. Auto-enrolling all eligible corps.");
        return {
          "marching.art World Championship Semifinals": {
            participants: null,
            classFilter: eligibleClasses,
          },
        };
      }
    }
  }

  if (scoredDay === 49) {
    // Day 49: Two shows - World Finals (top 12) and SoundSport Festival (all SoundSport)
    const semisRecap = recapsByDay.get(48);
    const semisResults = semisRecap?.shows?.flatMap(s => s.results) || [];

    const config = {
      "marching.art World Championship Finals": {
        participants: null,
        classFilter: ["worldClass", "openClass", "aClass"],
      },
      "SoundSport International Music & Food Festival": {
        participants: null,
        classFilter: ["soundSport"],
      },
    };

    if (semisResults.length > 0) {
      semisResults.sort((a, b) => b.totalScore - a.totalScore);

      let finalists = [];
      if (semisResults.length >= 12) {
        const twelfthPlaceScore = semisResults[11].totalScore;
        finalists = semisResults.filter(r => r.totalScore >= twelfthPlaceScore);
      } else {
        finalists = semisResults;
      }

      config["marching.art World Championship Finals"].participants =
        finalists.map(r => ({ uid: r.uid, corpsClass: r.corpsClass }));
      logger.info(`Day 49: ${finalists.length} corps advancing to World Championship Finals.`);
    } else {
      // FALLBACK: Use season standings
      logger.info("Day 49: No Day 48 results found. Using season standings for top 12 corps.");
      const eligibleClasses = ["worldClass", "openClass", "aClass"];
      const top12FromStandings = getTopCorpsFromSeasonStandings(allRecaps, 12, eligibleClasses);

      if (top12FromStandings && top12FromStandings.length > 0) {
        config["marching.art World Championship Finals"].participants = top12FromStandings;
        logger.info(`Day 49: ${top12FromStandings.length} corps advancing to Finals from season standings.`);
      } else {
        logger.info("Day 49: No season standings data. Auto-enrolling all eligible corps.");
      }
    }

    logger.info("Day 49: All SoundSport corps enrolled in SoundSport Festival.");
    return config;
  }

  return null;
}

/**
 * Process coin awards in batch instead of individual transactions.
 * Aggregates by uid to minimize writes.
 *
 * @param {Array} coinAwards - Array of { uid, corpsClass, showName, amount }
 * @param {WriteBatch} batch - Firestore batch to add updates to
 * @param {Firestore} db - Firestore database instance
 */
function processCoinAwardsBatch(coinAwards, batch, db) {
  if (coinAwards.length === 0) return;

  const coinByUser = new Map(); // uid -> { totalAmount, history: [] }

  for (const award of coinAwards) {
    const existing = coinByUser.get(award.uid) || { totalAmount: 0, history: [] };
    existing.totalAmount += award.amount;
    existing.history.push({
      type: TRANSACTION_TYPES.SHOW_PARTICIPATION,
      amount: award.amount,
      description: `Show performance at ${award.showName}`,
      corpsClass: award.corpsClass,
      timestamp: new Date(),
    });
    coinByUser.set(award.uid, existing);
  }

  // Add coin updates to batch (uses increment for concurrency safety)
  // History entries are written to subcollection instead of arrayUnion on profile
  for (const [uid, data] of coinByUser) {
    const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
    batch.update(userProfileRef, {
      corpsCoin: admin.firestore.FieldValue.increment(data.totalAmount),
    });

    for (const entry of data.history) {
      addCoinHistoryEntryToBatch(batch, db, uid, entry);
    }
  }

  logger.info(`Batched ${coinAwards.length} coin awards for ${coinByUser.size} users`);
}

/**
 * Award regional trophies for specified trophy days.
 *
 * @param {WriteBatch} batch - Firestore batch to add updates to
 * @param {Object} dailyRecap - The day's recap with shows and results
 * @param {number} scoredDay - The day being scored
 * @param {Object} seasonData - Season configuration data
 * @param {Firestore} db - Firestore database instance
 */
function awardRegionalTrophies(batch, dailyRecap, scoredDay, seasonData, db) {
  const regionalTrophyDays = [28, 35, 41, 42];
  if (!regionalTrophyDays.includes(scoredDay)) return;

  const metals = ['gold', 'silver', 'bronze'];
  logger.info(`Day ${scoredDay} is a regional trophy day. Awarding trophies...`);

  dailyRecap.shows.forEach(show => {
    show.results.sort((a, b) => b.totalScore - a.totalScore);
    const top3 = show.results.slice(0, 3);

    top3.forEach((winner, index) => {
      const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
      const trophy = {
        type: 'regional',
        metal: metals[index],
        seasonName: seasonData.name,
        eventName: show.eventName,
        score: winner.totalScore,
        rank: index + 1
      };
      batch.update(userProfileRef, {
        'trophies.regionals': admin.firestore.FieldValue.arrayUnion(trophy)
      });
    });
  });
}

/**
 * Award Day 46 Open and A Class Finals trophies.
 *
 * @param {WriteBatch} batch - Firestore batch to add updates to
 * @param {Object} dailyRecap - The day's recap with shows and results
 * @param {Object} seasonData - Season configuration data
 * @param {Firestore} db - Firestore database instance
 */
function awardClassChampionshipTrophies(batch, dailyRecap, seasonData, db) {
  const metals = ['gold', 'silver', 'bronze'];
  logger.info("Day 46: Awarding Open and A Class Finals trophies...");

  dailyRecap.shows.forEach(show => {
    const openClassResults = show.results.filter(r => r.corpsClass === "openClass");
    const aClassResults = show.results.filter(r => r.corpsClass === "aClass");

    openClassResults.sort((a, b) => b.totalScore - a.totalScore);
    aClassResults.sort((a, b) => b.totalScore - a.totalScore);

    // Award Open Class champion trophies (top 3)
    openClassResults.slice(0, 3).forEach((winner, index) => {
      const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
      const trophy = {
        type: 'class_championship',
        classType: 'openClass',
        metal: metals[index],
        seasonName: seasonData.name,
        eventName: show.eventName,
        score: winner.totalScore,
        rank: index + 1
      };
      batch.update(userProfileRef, {
        'trophies.classChampionships': admin.firestore.FieldValue.arrayUnion(trophy)
      });
    });

    // Award A Class champion trophies (top 3)
    aClassResults.slice(0, 3).forEach((winner, index) => {
      const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
      const trophy = {
        type: 'class_championship',
        classType: 'aClass',
        metal: metals[index],
        seasonName: seasonData.name,
        eventName: show.eventName,
        score: winner.totalScore,
        rank: index + 1
      };
      batch.update(userProfileRef, {
        'trophies.classChampionships': admin.firestore.FieldValue.arrayUnion(trophy)
      });
    });

    // Award finalist ribbons to all participants
    show.results.forEach((finalist) => {
      const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${finalist.uid}/profile/data`);
      const ribbon = {
        type: 'class_finalist',
        classType: finalist.corpsClass,
        seasonName: seasonData.name,
        eventName: show.eventName
      };
      batch.update(userProfileRef, {
        'trophies.classFinalistRibbons': admin.firestore.FieldValue.arrayUnion(ribbon)
      });
    });

    logger.info(`Awarded trophies to ${openClassResults.slice(0, 3).length} Open Class and ${aClassResults.slice(0, 3).length} A Class champions.`);
  });
}

/**
 * Award Day 49 Finals trophies and save season champions.
 *
 * @param {WriteBatch} batch - Firestore batch to add updates to
 * @param {Object} dailyRecap - The day's recap with shows and results
 * @param {Object} seasonData - Season configuration data
 * @param {Firestore} db - Firestore database instance
 * @returns {Promise<Object>} Season champions data for saving
 */
async function awardFinalsAndSaveChampions(batch, dailyRecap, seasonData, db) {
  const metals = ['gold', 'silver', 'bronze'];
  logger.info("Day 49 is Finals day. Awarding championship trophies and finalist medals...");

  const allResultsByClass = {};

  for (const show of dailyRecap.shows) {
    show.results.sort((a, b) => b.totalScore - a.totalScore);

    const isSoundSport = show.eventName.includes("SoundSport");
    const trophyType = isSoundSport ? 'soundsport_championship' : 'championship';

    // Award trophies to top 3
    const top3 = show.results.slice(0, 3);
    top3.forEach((winner, index) => {
      const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
      const trophy = {
        type: trophyType,
        metal: metals[index],
        seasonName: seasonData.name,
        eventName: show.eventName,
        score: winner.totalScore,
        rank: index + 1
      };
      batch.update(userProfileRef, {
        'trophies.championships': admin.firestore.FieldValue.arrayUnion(trophy)
      });
    });

    // Award finalist medals to all participants
    show.results.forEach((finalist, index) => {
      const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${finalist.uid}/profile/data`);
      const medal = {
        type: isSoundSport ? 'soundsport_finalist' : 'finalist',
        seasonName: seasonData.name,
        eventName: show.eventName,
        rank: index + 1
      };
      batch.update(userProfileRef, {
        'trophies.finalistMedals': admin.firestore.FieldValue.arrayUnion(medal)
      });
    });

    // Collect results by class for season champions
    show.results.forEach(result => {
      const corpsClass = result.corpsClass || 'worldClass';
      if (!allResultsByClass[corpsClass]) {
        allResultsByClass[corpsClass] = [];
      }
      allResultsByClass[corpsClass].push(result);
    });
  }

  // --- SAVE SEASON CHAMPIONS BY CLASS ---
  const seasonChampionsData = {
    seasonId: seasonData.seasonUid,
    seasonName: seasonData.name,
    seasonType: seasonData.status,
    archivedAt: new Date(),
    classes: {}
  };

  // Collect all champion UIDs first, then batch fetch all profiles at once
  const allChampionsByClass = {};
  const allChampionUids = new Set();

  for (const [corpsClass, classResults] of Object.entries(allResultsByClass)) {
    classResults.sort((a, b) => b.totalScore - a.totalScore);
    const classTop3 = classResults.slice(0, 3);
    allChampionsByClass[corpsClass] = classTop3;
    classTop3.forEach(r => allChampionUids.add(r.uid));
  }

  // Single batched fetch for all champion profiles
  const championProfileRefs = [...allChampionUids].map(uid =>
    db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`)
  );
  const championProfileDocs = championProfileRefs.length > 0 ? await db.getAll(...championProfileRefs) : [];
  const championUsernameMap = new Map();
  championProfileDocs.forEach(doc => {
    if (doc.exists) {
      championUsernameMap.set(doc.ref.parent.parent.id, doc.data().username || 'Unknown');
    }
  });

  // Build champion data using the pre-fetched usernames
  for (const [corpsClass, classTop3] of Object.entries(allChampionsByClass)) {
    const championsWithUsernames = classTop3.map((result, index) => ({
      rank: index + 1,
      uid: result.uid,
      username: championUsernameMap.get(result.uid) || 'Unknown',
      corpsName: result.corpsName,
      score: result.totalScore
    }));
    seasonChampionsData.classes[corpsClass] = championsWithUsernames;
  }

  // Save to season_champions collection
  const seasonChampionsRef = db.doc(`season_champions/${seasonData.seasonUid}`);
  batch.set(seasonChampionsRef, seasonChampionsData);
  logger.info(`Saved season champions for ${Object.keys(allResultsByClass).length} classes.`);

  return seasonChampionsData;
}

/**
 * Build the participant set for the Eastern Classic Day 41/42 regional split.
 *
 * Eastern Classic is a two-day event. Every corps registered for the show competes
 * on either Friday (Day 41) or Saturday (Day 42). Enrollees are collected across
 * ALL corps classes (worldClass, openClass, aClass, soundSport) and the split is
 * balanced per class so each class gets a roughly even (+/-1) distribution across
 * both days. The sort is deterministic so Day 41 and Day 42 scoring runs agree
 * on the assignment.
 *
 * @param {QuerySnapshot} profilesSnapshot - Snapshot of active user profiles
 * @param {string} eventName - Eastern Classic show event name
 * @param {number} week - Week number containing Days 41/42 (week 6)
 * @param {number} scoredDay - Either 41 (Friday) or 42 (Saturday)
 * @returns {Set<string>} Set of "${uid}_${corpsClass}" keys competing on this day
 */
function buildEasternClassicParticipantSet(profilesSnapshot, eventName, week, scoredDay) {
  const enrolleesByClass = {};
  for (const userDoc of profilesSnapshot.docs) {
    const userProfile = userDoc.data();
    const uid = userDoc.ref.parent.parent.id;
    const userCorps = userProfile.corps || {};
    for (const corpsClass of Object.keys(userCorps)) {
      const corps = userCorps[corpsClass];
      if (!corps) continue;
      const userShows = corps.selectedShows?.[`week${week}`] || [];
      if (userShows.some((s) => s.eventName === eventName)) {
        if (!enrolleesByClass[corpsClass]) enrolleesByClass[corpsClass] = [];
        enrolleesByClass[corpsClass].push(`${uid}_${corpsClass}`);
      }
    }
  }

  const day41Keys = [];
  const day42Keys = [];
  for (const corpsClass of Object.keys(enrolleesByClass)) {
    const keys = enrolleesByClass[corpsClass].sort();
    const splitIndex = Math.ceil(keys.length / 2);
    day41Keys.push(...keys.slice(0, splitIndex));
    day42Keys.push(...keys.slice(splitIndex));
  }

  const classBreakdown = Object.entries(enrolleesByClass)
    .map(([cls, arr]) => `${cls}=${arr.length}`)
    .join(", ") || "none";
  const selected = scoredDay === 41 ? day41Keys : day42Keys;
  logger.info(
    `Eastern Classic Day ${scoredDay}: scoring ${selected.length} corps ` +
    `(total enrolled by class: ${classBreakdown})`
  );
  return new Set(selected);
}

/**
 * Process weekly matchup determination at end of each week.
 *
 * @param {number} week - The week number (1-7)
 * @param {Object} seasonData - Season configuration data
 * @param {Firestore} db - Firestore database instance
 */
async function processWeeklyMatchups(week, seasonData, db) {
  logger.info(`End of week ${week}. Determining class-based matchup winners...`);

  const LEAGUE_FETCH_LIMIT = 500;
  const leaguesSnapshot = await db.collection("leagues").limit(LEAGUE_FETCH_LIMIT).get();
  if (leaguesSnapshot.size === LEAGUE_FETCH_LIMIT) {
    logger.warn(`OPTIMIZATION WARNING: League fetch hit limit of ${LEAGUE_FETCH_LIMIT}. Consider implementing pagination.`);
  }

  const winnerBatch = db.batch();
  const corpsClasses = ["worldClass", "openClass", "aClass", "soundSport"];

  // Batch fetch ALL matchup documents in ONE operation
  const matchupRefs = leaguesSnapshot.docs.map(leagueDoc =>
    db.doc(`leagues/${leagueDoc.id}/matchups/week${week}`)
  );
  const matchupDocs = matchupRefs.length > 0 ? await db.getAll(...matchupRefs) : [];

  // Build a Map for O(1) lookup by league ID
  const matchupMap = new Map();
  matchupDocs.forEach((doc, i) => {
    if (doc.exists) {
      matchupMap.set(leaguesSnapshot.docs[i].id, { ref: doc.ref, data: doc.data() });
    }
  });

  logger.info(`Batch fetched ${matchupMap.size} matchup documents for ${leaguesSnapshot.size} leagues.`);

  for (const leagueDoc of leaguesSnapshot.docs) {
    const matchupEntry = matchupMap.get(leagueDoc.id);
    if (!matchupEntry) continue;

    const matchupData = { ...matchupEntry.data };
    const matchupDocRef = matchupEntry.ref;
    let hasUpdates = false;

    for (const corpsClass of corpsClasses) {
      const matchupArrayKey = `${corpsClass}Matchups`;
      const matchups = matchupData[matchupArrayKey] || [];
      if (matchups.length === 0) continue;

      const updatedMatchupsForClass = [];

      // Batch fetch all matchup profiles for this class upfront
      const matchupsNeedingScores = matchups.filter(m => !m.winner);
      const allPlayerIds = [...new Set(matchupsNeedingScores.flatMap(m => m.pair))];

      // Batch fetch all profiles in ONE operation
      const profileRefs = allPlayerIds.map(uid =>
        db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`)
      );
      const profileDocs = allPlayerIds.length > 0 ? await db.getAll(...profileRefs) : [];
      const profileMap = new Map();
      profileDocs.forEach((doc, i) => {
        if (doc.exists) {
          profileMap.set(allPlayerIds[i], { ref: doc.ref, data: doc.data() });
        }
      });

      for (const matchup of matchups) {
        if (matchup.winner) {
          updatedMatchupsForClass.push(matchup);
          continue;
        }

        const [p1_uid, p2_uid] = matchup.pair;
        const p1_profile = profileMap.get(p1_uid);
        const p2_profile = profileMap.get(p2_uid);

        const p1_score = p1_profile?.data?.corps?.[corpsClass]?.totalSeasonScore || 0;
        const p2_score = p2_profile?.data?.corps?.[corpsClass]?.totalSeasonScore || 0;

        let winnerUid = null;
        if (p1_score > p2_score) winnerUid = p1_uid;
        if (p2_score > p1_score) winnerUid = p2_uid;

        const seasonRecordPath = `seasons.${seasonData.seasonUid}.records.${corpsClass}`;
        const increment = admin.firestore.FieldValue.increment(1);

        if (p1_profile?.ref && p2_profile?.ref) {
          if (winnerUid === p1_uid) {
            winnerBatch.set(p1_profile.ref, { [seasonRecordPath]: { w: increment } }, { merge: true });
            winnerBatch.set(p2_profile.ref, { [seasonRecordPath]: { l: increment } }, { merge: true });
          } else if (winnerUid === p2_uid) {
            winnerBatch.set(p1_profile.ref, { [seasonRecordPath]: { l: increment } }, { merge: true });
            winnerBatch.set(p2_profile.ref, { [seasonRecordPath]: { w: increment } }, { merge: true });
          } else {
            // Tie
            winnerBatch.set(p1_profile.ref, { [seasonRecordPath]: { t: increment } }, { merge: true });
            winnerBatch.set(p2_profile.ref, { [seasonRecordPath]: { t: increment } }, { merge: true });
          }
        }

        const newMatchup = {
          ...matchup,
          scores: { [p1_uid]: p1_score, [p2_uid]: p2_score },
          winner: winnerUid,
        };
        updatedMatchupsForClass.push(newMatchup);
      }
      matchupData[matchupArrayKey] = updatedMatchupsForClass;
      hasUpdates = true;
    }
    if (hasUpdates) {
      winnerBatch.update(matchupDocRef, matchupData);
    }
  }

  await winnerBatch.commit();
  logger.info(`Matchup winner determination for week ${week} complete.`);
}

module.exports = {
  getTopCorpsFromSeasonStandings,
  buildChampionshipConfig,
  processCoinAwardsBatch,
  awardRegionalTrophies,
  awardClassChampionshipTrophies,
  awardFinalsAndSaveChampions,
  buildEasternClassicParticipantSet,
  processWeeklyMatchups,
};
