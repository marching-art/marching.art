// @ts-nocheck -- grandfathered when functions checkJs landed (functions/tsconfig.json); remove when this file is typed or cleaned up
// Championship, trophy, and matchup processing for scoring runs: season
// standings cutoffs, championship day config, CorpsCoin awards, regional and
// class trophies, finals champions, and weekly league matchups. Extracted
// verbatim from scoring.js.

const { paths } = require("./paths");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const {
  TRANSACTION_TYPES,
  addCoinHistoryEntryToBatch,
  WEEKLY_LEAGUE_WIN_REWARD,
} = require("./economy");
const { XP_SOURCES } = require("./xpCalculations");
const { ChunkedWriter } = require("./chunkedWriter");
const { updateStandings } = require("./leagueStandings");
const { createLeagueActivity } = require("./leagueHelpers");
const { MATCHUP_CLASSES } = require("./classRegistry");
const {
  showAwardToken,
  weeklyXpToken,
  weeklyWinToken,
  matchupRecordToken,
  hasAwardToken,
  awardTokenWrite,
} = require("./awardLedger");

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
 * Idempotency: when `seasonUid` and `scoredDay` are supplied, each user's
 * increment carries a per-(uid, day) token in the profile's `awardLedger` — the
 * token and the increment ride the SAME document write, so they land together
 * or not at all. Before writing, the target profiles are read and any user
 * already carrying today's token is skipped, so a ChunkedWriter partial-failure
 * retry cannot double-pay. `force` (admin reprocess) bypasses the skip. Callers
 * that omit the season context (e.g. the Podium processor) keep the original
 * unmarked behavior.
 *
 * @param {Array} coinAwards - Array of { uid, corpsClass, showName, amount }
 * @param {WriteBatch|ChunkedWriter} batch - Firestore batch (or ChunkedWriter) to add updates to
 * @param {Firestore} db - Firestore database instance
 * @param {Object} [options]
 * @param {string} [options.seasonUid] - Enables per-day idempotency markers.
 * @param {number} [options.scoredDay] - The season day being awarded.
 * @param {boolean} [options.force] - Re-apply even if the day's token exists.
 * @param {Map<string, Object>} [options.captionPoints] - uid -> per-caption
 *   points; banked as captionStats increments in the SAME tokened write.
 */
async function processCoinAwardsBatch(coinAwards, batch, db, options = {}) {
  const { seasonUid = null, scoredDay = null, force = false, captionPoints = null } = options;
  const hasCaptionPoints = captionPoints instanceof Map && captionPoints.size > 0;
  if (coinAwards.length === 0 && !hasCaptionPoints) return;
  const idempotent = seasonUid != null && scoredDay != null;
  const token = idempotent ? showAwardToken(seasonUid, scoredDay) : null;

  const coinByUser = new Map(); // uid -> { totalAmount, xpAmount, history: [] }

  for (const award of coinAwards) {
    const existing = coinByUser.get(award.uid) || { totalAmount: 0, xpAmount: 0, history: [] };
    existing.totalAmount += award.amount;
    // Competing is the core act, so each attended show also pays XP
    // (XP_SOURCES.showParticipation) alongside its CC. Design bonuses
    // (type 'show_design') are CC-only.
    if (!award.type || award.type === TRANSACTION_TYPES.SHOW_PARTICIPATION) {
      existing.xpAmount += XP_SOURCES.showParticipation;
    }
    existing.history.push({
      type: award.type || TRANSACTION_TYPES.SHOW_PARTICIPATION,
      amount: award.amount,
      description: award.description || `Show performance at ${award.showName}`,
      corpsClass: award.corpsClass,
      timestamp: new Date(),
    });
    coinByUser.set(award.uid, existing);
  }

  // The award universe: everyone with coins to mint or caption points to
  // bank. Caption mastery (captionStats) increments ride the SAME guarded
  // write as the coins — they used to be separate un-tokened updates in
  // commitDailyScoring, so a torn ChunkedWriter commit followed by a
  // scheduler retry double-banked them (the exact hazard awardLedger.js
  // documents). One write op, one token, all-or-nothing together.
  const allUids = new Set(coinByUser.keys());
  if (hasCaptionPoints) for (const uid of captionPoints.keys()) allUids.add(uid);

  // Idempotency pre-read: skip users already paid for this day (unless forced).
  const skip = new Set();
  if (idempotent && !force) {
    const uids = [...allUids];
    const refs = uids.map((uid) => db.doc(paths.userProfile(uid)));
    const snaps = refs.length > 0 ? await db.getAll(...refs) : [];
    snaps.forEach((snap, i) => {
      if (snap.exists && hasAwardToken(snap.data(), token)) skip.add(uids[i]);
    });
    if (skip.size > 0) {
      logger.warn(
        `Coin awards day ${scoredDay}: skipping ${skip.size} already-awarded users (idempotency).`
      );
    }
  }

  // Add coin updates to batch (uses increment for concurrency safety)
  // History entries are written to subcollection instead of arrayUnion on profile
  // XP lands as a raw increment; xpLevel/title/unlocks recompute on the next
  // claimDailyLogin (same convention as the weekly XP payments).
  let awarded = 0;
  for (const uid of allUids) {
    if (skip.has(uid)) continue;
    const data = coinByUser.get(uid) || null;

    // Caption mastery (WS5.5): bank tonight's per-caption points into the
    // lifetime captionStats counters, rounded to one decimal.
    const captionUpdates = {};
    if (hasCaptionPoints) {
      for (const [caption, value] of Object.entries(captionPoints.get(uid) || {})) {
        if (value > 0) {
          captionUpdates[`captionStats.${caption}`] =
            admin.firestore.FieldValue.increment(Math.round(value * 10) / 10);
        }
      }
    }
    if (!data && Object.keys(captionUpdates).length === 0) continue;

    const userProfileRef = db.doc(paths.userProfile(uid));
    batch.update(userProfileRef, {
      ...(data ? { corpsCoin: admin.firestore.FieldValue.increment(data.totalAmount) } : {}),
      ...(data && data.xpAmount > 0
        ? { xp: admin.firestore.FieldValue.increment(data.xpAmount) }
        : {}),
      ...captionUpdates,
      // The token rides this same update op, so it commits atomically with the
      // increments above — its presence proves they were applied.
      ...(idempotent ? awardTokenWrite(token) : {}),
    });

    for (const entry of data ? data.history : []) {
      addCoinHistoryEntryToBatch(batch, db, uid, entry);
    }
    awarded += 1;
  }

  logger.info(`Batched ${coinAwards.length} coin awards for ${awarded} users`);
}

/**
 * Award regional trophies for specified trophy days.
 *
 * @param {WriteBatch|ChunkedWriter} batch - Firestore batch (or ChunkedWriter) to add updates to
 * @param {Object} dailyRecap - The day's recap with shows and results
 * @param {number} scoredDay - The day being scored
 * @param {Object} seasonData - Season configuration data
 * @param {Firestore} db - Firestore database instance
 */
async function awardRegionalTrophies(batch, dailyRecap, scoredDay, seasonData, db) {
  const regionalTrophyDays = [28, 35, 41, 42];
  if (!regionalTrophyDays.includes(scoredDay)) return;

  // The Eastern Classic is ONE event spanning days 41-42 with each corps
  // performing a single assigned night (§5.11, helpers/easternSplit.js).
  // Crowning a champion per night would mint two Eastern champions per
  // class from half-fields, so night one defers and night two awards from
  // the COMBINED two-night results.
  if (scoredDay === 41) {
    logger.info("Day 41 (Eastern night 1): regional trophies defer to the day-42 combined field.");
    return;
  }
  let shows = dailyRecap.shows;
  if (scoredDay === 42) {
    const night1Snapshot = await db
      .doc(`fantasy_recaps/${seasonData.seasonUid}/days/41`)
      .get();
    const night1Shows = night1Snapshot.exists ? night1Snapshot.data().shows || [] : [];
    shows = dailyRecap.shows.map(show => {
      const night1 = night1Shows.find(s => s.eventName === show.eventName);
      return night1
        ? { ...show, results: [...(night1.results || []), ...(show.results || [])] }
        : show;
    });
  }

  logger.info(`Day ${scoredDay} is a regional trophy day. Awarding trophies...`);

  // Each competitive class crowns its own regional CHAMPION (1st in class),
  // recorded with corpsClass so the trophy case can color it by class.
  // SoundSport (non-competitive) earns a Regional Best in Show instead.
  const competitiveClasses = ["worldClass", "openClass", "aClass"];

  shows.forEach(show => {
    competitiveClasses.forEach(corpsClass => {
      const classResults = show.results
        .filter(r => r.corpsClass === corpsClass)
        .sort((a, b) => b.totalScore - a.totalScore);
      const champion = classResults[0];
      if (!champion) return;

      const userProfileRef = db.doc(paths.userProfile(champion.uid));
      const trophy = {
        type: "regional",
        corpsClass,
        seasonName: seasonData.name,
        eventName: show.eventName,
        score: champion.totalScore,
        rank: 1
      };
      batch.update(userProfileRef, {
        "trophies.regionals": admin.firestore.FieldValue.arrayUnion(trophy)
      });
    });

    // SoundSport Regional Best in Show — top SoundSport corps in the show.
    const soundSportResults = show.results
      .filter(r => r.corpsClass === "soundSport")
      .sort((a, b) => b.totalScore - a.totalScore);
    const bestInShow = soundSportResults[0];
    if (bestInShow) {
      const userProfileRef = db.doc(paths.userProfile(bestInShow.uid));
      const award = {
        type: "regional_best_in_show",
        seasonName: seasonData.name,
        eventName: show.eventName,
        score: bestInShow.totalScore
      };
      batch.update(userProfileRef, {
        "trophies.soundSportAwards": admin.firestore.FieldValue.arrayUnion(award)
      });
    }
  });
}

/**
 * Award Day 46 Open and A Class Finals trophies.
 *
 * @param {WriteBatch|ChunkedWriter} batch - Firestore batch (or ChunkedWriter) to add updates to
 * @param {Object} dailyRecap - The day's recap with shows and results
 * @param {Object} seasonData - Season configuration data
 * @param {Firestore} db - Firestore database instance
 */
function awardClassChampionshipTrophies(batch, dailyRecap, seasonData, db) {
  const metals = ["gold", "silver", "bronze"];
  logger.info("Day 46: Awarding Open and A Class Finals trophies...");

  dailyRecap.shows.forEach(show => {
    const openClassResults = show.results.filter(r => r.corpsClass === "openClass");
    const aClassResults = show.results.filter(r => r.corpsClass === "aClass");

    openClassResults.sort((a, b) => b.totalScore - a.totalScore);
    aClassResults.sort((a, b) => b.totalScore - a.totalScore);

    // Award Open Class champion trophies (top 3)
    openClassResults.slice(0, 3).forEach((winner, index) => {
      const userProfileRef = db.doc(paths.userProfile(winner.uid));
      const trophy = {
        type: "class_championship",
        classType: "openClass",
        metal: metals[index],
        seasonName: seasonData.name,
        eventName: show.eventName,
        score: winner.totalScore,
        rank: index + 1
      };
      batch.update(userProfileRef, {
        "trophies.classChampionships": admin.firestore.FieldValue.arrayUnion(trophy)
      });
    });

    // Award A Class champion trophies (top 3)
    aClassResults.slice(0, 3).forEach((winner, index) => {
      const userProfileRef = db.doc(paths.userProfile(winner.uid));
      const trophy = {
        type: "class_championship",
        classType: "aClass",
        metal: metals[index],
        seasonName: seasonData.name,
        eventName: show.eventName,
        score: winner.totalScore,
        rank: index + 1
      };
      batch.update(userProfileRef, {
        "trophies.classChampionships": admin.firestore.FieldValue.arrayUnion(trophy)
      });
    });

    // Award finalist ribbons to all participants
    show.results.forEach((finalist) => {
      const userProfileRef = db.doc(paths.userProfile(finalist.uid));
      const ribbon = {
        type: "class_finalist",
        classType: finalist.corpsClass,
        seasonName: seasonData.name,
        eventName: show.eventName
      };
      batch.update(userProfileRef, {
        "trophies.classFinalistRibbons": admin.firestore.FieldValue.arrayUnion(ribbon)
      });
    });

    logger.info(`Awarded trophies to ${openClassResults.slice(0, 3).length} Open Class and ${aClassResults.slice(0, 3).length} A Class champions.`);
  });
}

/**
 * Award Day 49 Finals trophies and save season champions.
 *
 * @param {WriteBatch|ChunkedWriter} batch - Firestore batch (or ChunkedWriter) to add updates to
 * @param {Object} dailyRecap - The day's recap with shows and results
 * @param {Object} seasonData - Season configuration data
 * @param {Firestore} db - Firestore database instance
 * @returns {Promise<Object>} Season champions data for saving
 */
async function awardFinalsAndSaveChampions(batch, dailyRecap, seasonData, db) {
  const metals = ["gold", "silver", "bronze"];
  logger.info("Day 49 is Finals day. Awarding championship trophies and finalist medals...");

  const allResultsByClass = {};

  for (const show of dailyRecap.shows) {
    show.results.sort((a, b) => b.totalScore - a.totalScore);

    const isSoundSport = show.eventName.includes("SoundSport");

    if (isSoundSport) {
      // SoundSport is non-competitive: the Festival crowns a single
      // International Festival Best in Show (top corps) — no medals, no
      // finalist ribbons.
      const bestInShow = show.results[0];
      if (bestInShow) {
        const userProfileRef = db.doc(paths.userProfile(bestInShow.uid));
        const award = {
          type: "international_festival",
          seasonName: seasonData.name,
          eventName: show.eventName,
          score: bestInShow.totalScore
        };
        batch.update(userProfileRef, {
          "trophies.soundSportAwards": admin.firestore.FieldValue.arrayUnion(award)
        });
      }
    } else {
      // World Championship Finals: top-3 medals + finalist medals for all.
      const top3 = show.results.slice(0, 3);
      top3.forEach((winner, index) => {
        const userProfileRef = db.doc(paths.userProfile(winner.uid));
        const trophy = {
          type: "championship",
          metal: metals[index],
          corpsClass: winner.corpsClass || "worldClass",
          seasonName: seasonData.name,
          eventName: show.eventName,
          score: winner.totalScore,
          rank: index + 1
        };
        batch.update(userProfileRef, {
          "trophies.championships": admin.firestore.FieldValue.arrayUnion(trophy)
        });
      });

      // Award finalist medals to all participants
      show.results.forEach((finalist, index) => {
        const userProfileRef = db.doc(paths.userProfile(finalist.uid));
        const medal = {
          type: "finalist",
          seasonName: seasonData.name,
          eventName: show.eventName,
          rank: index + 1
        };
        batch.update(userProfileRef, {
          "trophies.finalistMedals": admin.firestore.FieldValue.arrayUnion(medal)
        });
      });
    }

    // Collect results by class for season champions
    show.results.forEach(result => {
      const corpsClass = result.corpsClass || "worldClass";
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
    db.doc(paths.userProfile(uid))
  );
  const championProfileDocs = championProfileRefs.length > 0 ? await db.getAll(...championProfileRefs) : [];
  const championUsernameMap = new Map();
  championProfileDocs.forEach(doc => {
    if (doc.exists) {
      championUsernameMap.set(doc.ref.parent.parent.id, doc.data().username || "Unknown");
    }
  });

  // Build champion data using the pre-fetched usernames
  for (const [corpsClass, classTop3] of Object.entries(allChampionsByClass)) {
    const championsWithUsernames = classTop3.map((result, index) => ({
      rank: index + 1,
      uid: result.uid,
      username: championUsernameMap.get(result.uid) || "Unknown",
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
async function processWeeklyMatchups(week, seasonData, db, { force = false } = {}) {
  logger.info(`End of week ${week}. Determining class-based matchup winners...`);

  const LEAGUE_FETCH_LIMIT = 500;
  // Leagues live under the data namespace (see callable/leagues.js) and
  // matchup docs are written as `week-N` by generateMatchups /
  // generateWeeklyMatchups — these paths must stay in sync with those
  // writers or winner determination silently processes zero leagues.
  const leaguesSnapshot = await db
    .collection(paths.leagues())
    .limit(LEAGUE_FETCH_LIMIT)
    .get();
  if (leaguesSnapshot.size === LEAGUE_FETCH_LIMIT) {
    logger.warn(`OPTIMIZATION WARNING: League fetch hit limit of ${LEAGUE_FETCH_LIMIT}. Consider implementing pagination.`);
  }

  // ChunkedWriter: two record writes per matchup across up to 500 leagues
  // plus coin awards can exceed a single WriteBatch's per-request cap.
  const winnerBatch = new ChunkedWriter(db);
  // Registry-derived (Phase 7.4): every matchup class resolves head-to-head
  // on corps.{class}.totalSeasonScore — Podium's nightly display copy
  // included, once its registry entry enables at launch.
  const corpsClasses = MATCHUP_CLASSES;
  // Per-league resolved pairs, applied to standings only after the matchup
  // docs commit (see below).
  const standingsByLeague = [];

  // Batch fetch ALL matchup documents in ONE operation
  const matchupRefs = leaguesSnapshot.docs.map(leagueDoc =>
    db.doc(`${leagueDoc.ref.path}/matchups/week-${week}`)
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
    // Resolved pairs for the standings/current doc — same shape the
    // commissioner callable feeds updateStandings, so the automatic weekly
    // close and a manual resolution produce identical standings.
    const standingsPairs = [];

    for (const corpsClass of corpsClasses) {
      const matchupArrayKey = `${corpsClass}Matchups`;
      const matchups = matchupData[matchupArrayKey] || [];
      if (matchups.length === 0) continue;

      const updatedMatchupsForClass = [];

      // Batch fetch all matchup profiles for this class upfront
      const matchupsNeedingScores = matchups.filter(m => !m.winner && !m.completed);
      const allPlayerIds = [...new Set(matchupsNeedingScores.flatMap(m => m.pair))];

      // Batch fetch all profiles in ONE operation
      const profileRefs = allPlayerIds.map(uid =>
        db.doc(paths.userProfile(uid))
      );
      const profileDocs = allPlayerIds.length > 0 ? await db.getAll(...profileRefs) : [];
      const profileMap = new Map();
      profileDocs.forEach((doc, i) => {
        if (doc.exists) {
          profileMap.set(allPlayerIds[i], { ref: doc.ref, data: doc.data() });
        }
      });

      for (const matchup of matchups) {
        if (matchup.winner || matchup.completed) {
          // Already resolved: a generator bye, a previous run, or a
          // commissioner manual resolution (which folded itself into
          // standings). Byes are folded into standings HERE — this guarded
          // once-per-week run is their single counting point.
          if (matchup.isBye && matchup.pair?.[0]) {
            standingsPairs.push({
              player1: matchup.pair[0],
              player2: null,
              winner: matchup.pair[0],
              completed: true,
              corpsClass,
            });
          }
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
          // Idempotency: the record increment and its token ride ONE set op per
          // participant, so a ChunkedWriter partial-failure retry (which re-runs
          // any matchup whose `completed` flag didn't land) cannot re-increment
          // a record that already applied. Keyed per uid so each side is
          // independently guarded. `force` bypasses the guard for admin reprocess.
          const p1RecToken = matchupRecordToken(seasonData.seasonUid, week, leagueDoc.id, corpsClass, p1_uid);
          const p2RecToken = matchupRecordToken(seasonData.seasonUid, week, leagueDoc.id, corpsClass, p2_uid);
          const writeP1 = force || !hasAwardToken(p1_profile.data, p1RecToken);
          const writeP2 = force || !hasAwardToken(p2_profile.data, p2RecToken);
          let p1Delta = null;
          let p2Delta = null;
          if (winnerUid === p1_uid) {
            p1Delta = "w";
            p2Delta = "l";
          } else if (winnerUid === p2_uid) {
            p1Delta = "l";
            p2Delta = "w";
          } else {
            p1Delta = "t";
            p2Delta = "t";
          }
          if (writeP1) {
            winnerBatch.set(
              p1_profile.ref,
              { [seasonRecordPath]: { [p1Delta]: increment }, ...awardTokenWrite(p1RecToken) },
              { merge: true }
            );
          }
          if (writeP2) {
            winnerBatch.set(
              p2_profile.ref,
              { [seasonRecordPath]: { [p2Delta]: increment }, ...awardTokenWrite(p2RecToken) },
              { merge: true }
            );
          }

          // Pay the advertised weekly-win bonus (getEarningOpportunities:
          // "Win your weekly matchup to earn bonus CC") and keep the
          // profile's leagueWins stat live. Byes and ties award nothing.
          // The XP lands as a raw increment; xpLevel/title/class unlocks
          // recompute from the stored xp total on the next claimDailyLogin,
          // where the level-up stipend also settles via lastRewardedLevel.
          // The bonus is a SEPARATE write from the record above, so it carries
          // its own token (win vs rec) — otherwise a retry that landed the
          // record but not the bonus would skip the unpaid bonus.
          if (winnerUid) {
            const winner = winnerUid === p1_uid ? p1_profile : p2_profile;
            const winToken = weeklyWinToken(seasonData.seasonUid, week, leagueDoc.id, corpsClass);
            if (force || !hasAwardToken(winner.data, winToken)) {
              winnerBatch.set(
                winner.ref,
                {
                  stats: { leagueWins: increment },
                  corpsCoin: admin.firestore.FieldValue.increment(WEEKLY_LEAGUE_WIN_REWARD),
                  xp: admin.firestore.FieldValue.increment(XP_SOURCES.leagueWin),
                  ...awardTokenWrite(winToken),
                },
                { merge: true }
              );
              addCoinHistoryEntryToBatch(winnerBatch, db, winnerUid, {
                type: TRANSACTION_TYPES.LEAGUE_WIN,
                amount: WEEKLY_LEAGUE_WIN_REWARD,
                description: `Week ${week} ${corpsClass} matchup win in ${leagueDoc.data().name || "your league"}`,
                corpsClass,
                timestamp: new Date(),
              });
            }
          }
        }

        // Doc convention matches the commissioner callable: completed flag
        // set, ties stored as the string 'tie' (winnerUid stays null
        // internally so ties pay nothing above). The completed flag is what
        // the weekly recap generator and the Monday push job read.
        const newMatchup = {
          ...matchup,
          scores: { [p1_uid]: p1_score, [p2_uid]: p2_score },
          winner: winnerUid ?? "tie",
          completed: true,
        };
        updatedMatchupsForClass.push(newMatchup);

        standingsPairs.push({
          player1: p1_uid,
          player2: p2_uid,
          player1Score: p1_score,
          player2Score: p2_score,
          winner: winnerUid ?? "tie",
          completed: true,
          corpsClass,
        });
      }
      matchupData[matchupArrayKey] = updatedMatchupsForClass;
      hasUpdates = true;
    }
    if (hasUpdates) {
      winnerBatch.update(matchupDocRef, matchupData);
    }
    if (standingsPairs.length > 0) {
      standingsByLeague.push({ leagueDoc, standingsPairs });
    }
  }

  await winnerBatch.commit();

  // Fold this week's results into each league's standings/current and drop a
  // summary event into the activity feed — previously only the
  // commissioner-invoked updateMatchupResults callable did either, so
  // auto-generated matchups never moved the standings. Applied strictly
  // AFTER the matchup docs commit: if the commit fails, matchups stay
  // unresolved and the re-run re-derives everything; standings are never
  // ahead of the docs they summarize.
  for (const { leagueDoc, standingsPairs } of standingsByLeague) {
    try {
      await updateStandings(db, leagueDoc.ref, standingsPairs);
      const decided = standingsPairs.filter((p) => p.player2 !== null).length;
      if (decided > 0) {
        await createLeagueActivity(db, leagueDoc.id, {
          type: "matchup_result",
          title: `Week ${week} Results`,
          message: `${decided} matchup${decided > 1 ? "s" : ""} decided in week ${week}.`,
          metadata: { week, matchupsCompleted: decided },
        });
      }
    } catch (error) {
      // Standings/feed are derived views — never let them fail the
      // guarded scoring run that pays rewards.
      logger.error(`Standings/activity update failed for league ${leagueDoc.id}:`, error);
    }
  }

  logger.info(`Matchup winner determination for week ${week} complete.`);
}

/**
 * Pay the advertised weekly-participation XP to every director who competed
 * in at least one show this week — once per participating class, so a
 * director fielding two classes earns two grants.
 *
 * Participation is derived from the week's committed recap docs
 * (fantasy_recaps/{seasonUid}/days/{day}), which only contain corps that
 * actually attended and were scored — the same source of truth the
 * standings read. Runs at the week boundary inside the scoringRunGuard-
 * protected run, so scheduler redeliveries cannot double-pay (with the
 * same documented ChunkedWriter mid-commit residual risk the CorpsCoin
 * awards carry).
 *
 * XP lands as a raw increment; xpLevel/title/class unlocks recompute from
 * the stored xp total on the next claimDailyLogin, where the level-up
 * CorpsCoin stipend also settles via lastRewardedLevel — no reward is lost
 * by deferring the recompute.
 *
 * @param {number} week - The week number (1-7)
 * @param {Object} seasonData - Season configuration data
 * @param {Firestore} db - Firestore database instance
 */
async function payWeeklyParticipationXP(week, seasonData, db, { force = false } = {}) {
  const firstDay = week * 7 - 6;
  const lastDay = week * 7;
  const dayRefs = [];
  for (let day = firstDay; day <= lastDay; day++) {
    dayRefs.push(db.doc(`fantasy_recaps/${seasonData.seasonUid}/days/${day}`));
  }
  const dayDocs = await db.getAll(...dayRefs);

  // Distinct participating classes per director across the week.
  const classesByUid = new Map();
  for (const dayDoc of dayDocs) {
    if (!dayDoc.exists) continue;
    for (const show of (dayDoc.data().shows || [])) {
      for (const result of (show.results || [])) {
        if (!result?.uid || !result?.corpsClass) continue;
        if (!classesByUid.has(result.uid)) classesByUid.set(result.uid, new Set());
        classesByUid.get(result.uid).add(result.corpsClass);
      }
    }
  }

  if (classesByUid.size === 0) {
    logger.info(`Week ${week}: no show participants in recaps; no weekly participation XP to pay.`);
    return;
  }

  // Idempotency pre-read: skip directors already paid this week's XP (unless
  // forced). The token rides the same set op as the increment below, so a torn
  // ChunkedWriter commit cannot double-pay on retry.
  const token = weeklyXpToken(seasonData.seasonUid, week);
  const uids = [...classesByUid.keys()];
  const profileRefs = uids.map((uid) => db.doc(paths.userProfile(uid)));
  const skip = new Set();
  if (!force) {
    const snaps = profileRefs.length > 0 ? await db.getAll(...profileRefs) : [];
    snaps.forEach((snap, i) => {
      if (snap.exists && hasAwardToken(snap.data(), token)) skip.add(uids[i]);
    });
  }

  const xpBatch = new ChunkedWriter(db);
  let totalXP = 0;
  let paid = 0;
  for (const [uid, classes] of classesByUid.entries()) {
    if (skip.has(uid)) continue;
    const amount = XP_SOURCES.weeklyParticipation * classes.size;
    totalXP += amount;
    const profileRef = db.doc(
      paths.userProfile(uid)
    );
    xpBatch.set(
      profileRef,
      { xp: admin.firestore.FieldValue.increment(amount), ...awardTokenWrite(token) },
      { merge: true }
    );
    paid += 1;
  }
  await xpBatch.commit();
  logger.info(
    `Week ${week}: paid weekly-participation XP to ${paid} directors (${totalXP} XP total)` +
      (skip.size > 0 ? `, skipped ${skip.size} already paid.` : ".")
  );
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
  payWeeklyParticipationXP,
};
