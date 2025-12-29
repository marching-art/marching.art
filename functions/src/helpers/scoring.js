const { getDb, dataNamespaceParam } = require("../config");
const { logger } = require("firebase-functions/v2");
const { getDoc } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const { shuffleArray } = require("./season");
const { calculateLineupSynergyBonus } = require('./showConceptSynergy');
const { awardCorpsCoin } = require("../callable/economy");


async function fetchHistoricalData(dataDocId) {
  const db = getDb();
  const corpsDataRef = db.doc(`dci-data/${dataDocId}`);
  const corpsDataSnap = await corpsDataRef.get();
  if (!corpsDataSnap.exists) {
    logger.error(`dci-data document ${dataDocId} not found.`);
    return {};
  }

  const seasonCorpsList = corpsDataSnap.data().corpsValues || [];
  const yearsToFetch = [...new Set(seasonCorpsList.map((c) => c.sourceYear))];
  const historicalDocs = await Promise.all(
    yearsToFetch.map((year) => db.doc(`historical_scores/${year}`).get())
  );

  const historicalData = {};
  historicalDocs.forEach((doc) => {
    if (doc.exists) {
      historicalData[doc.id] = doc.data().data;
    }
  });
  return historicalData;
}

function simpleLinearRegression(data) {
  const n = data.length;
  if (n < 2) {
    return { m: 0, c: data.length > 0 ? data[0][1] : 0 };
  }

  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  for (const [x, y] of data) {
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }

  const m = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
  const c = (sumY - m * sumX) / n;

  return { m, c };
}

function getRealisticCaptionScore(corpsName, sourceYear, caption, currentDay, historicalData) {
  const actualScore = getScoreForDay(currentDay, corpsName, sourceYear, caption, historicalData);
  if (actualScore !== null) {
    return actualScore; // Always use the real score if it exists.
  }

  const allDataPoints = [];
  const yearData = historicalData[sourceYear] || [];
  for (const event of yearData) {
    const score = getScoreForDay(event.offSeasonDay, corpsName, sourceYear, caption, historicalData);
    if (score !== null) {
      if (!allDataPoints.some((p) => p[0] === event.offSeasonDay)) {
        allDataPoints.push([event.offSeasonDay, score]);
      }
    }
  }

  const maxScore = 20;

  if (allDataPoints.length >= 2) {
    const regression = logarithmicRegression(allDataPoints);
    const predictedScore = regression.predict(currentDay);
    const jitter = (Math.random() - 0.5) * 0.5;
    const finalScore = predictedScore + jitter;
    const roundedScore = parseFloat(finalScore.toFixed(3));
    return Math.max(0, Math.min(maxScore, roundedScore));
  } else if (allDataPoints.length === 1) {
    return allDataPoints[0][1];
  } else {
    logger.warn(`No historical scores found for ${corpsName} (${sourceYear}), caption ${caption}. Returning 0.`);
    return 0;
  }
}

function getScoreForDay(day, corps, year, caption, historicalData) {
  const events = historicalData[year]?.filter((e) => e.offSeasonDay === day);
  if (!events || events.length === 0) return null;

  for (const event of events) {
    const scoreData = event.scores.find((s) => s.corps === corps);
    if (scoreData && scoreData.captions[caption] > 0) {
      return scoreData.captions[caption]; // Return the first one found
    }
  }
  return null;
}

function logarithmicRegression(data) {
  const transformedData = data.map(([x, y]) => [x, y > 0 ? Math.log(y) : 0]);

  const { m, c } = simpleLinearRegression(transformedData);

  return {
    predict: (x) => {
      const logPrediction = m * x + c;
      // Use Math.exp() to reverse the Math.log() transformation.
      return Math.exp(logPrediction);
    },
  };
}

function mapLiveDayToOffSeasonDay(liveDay) {
  const liveSeasonStartDay = 22;
  const dayOffset = 21;
  if (liveDay < liveSeasonStartDay) {
    return 1;
  } else {
    return liveDay - dayOffset;
  }
}

async function getLiveCaptionScore(corpsName, sourceYear, caption, currentDay, historicalData) {
  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();
  const activeSeasonId = seasonDoc.data().seasonUid;

  const liveScoresRef = db.collection(`live_scores/${activeSeasonId}/scores`).where("corpsName", "==", corpsName);
  const liveScoresSnap = await liveScoresRef.get();

  const currentSeasonScores = [];
  liveScoresSnap.forEach((doc) => {
    const data = doc.data();
    if (data.captions && data.captions[caption]) {
      currentSeasonScores.push([data.day, data.captions[caption]]);
    }
  });

  if (currentSeasonScores.length >= 3) {
    const regression = logarithmicRegression(currentSeasonScores);
    const predictedScore = regression.predict(currentDay);
    const jitter = (Math.random() - 0.5) * 0.5;
    const finalScore = predictedScore + jitter;
    return Math.max(0, Math.min(20, parseFloat(finalScore.toFixed(3))));
  } else {
    const equivalentOffSeasonDay = mapLiveDayToOffSeasonDay(currentDay);
    return getRealisticCaptionScore(corpsName, sourceYear, caption, equivalentOffSeasonDay, historicalData);
  }
}

async function processAndArchiveOffSeasonScoresLogic() {
  const db = getDb();
  logger.info("Running Daily Off-Season Score Processor & Archiver...");

  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();

  if (!seasonDoc.exists || seasonDoc.data().status !== "off-season") {
    logger.info("No active off-season found. Exiting.");
    return;
  }

  const seasonData = seasonDoc.data();
  const seasonStartDate = seasonData.schedule.startDate.toDate();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const diffInMillis = yesterday.getTime() - seasonStartDate.getTime();
  const scoredDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;

  if (scoredDay < 1 || scoredDay > 49) {
    logger.info(`Scored day (${scoredDay}) is outside the 1-49 range. Exiting.`);
    return;
  }

  logger.info(`Processing and archiving scores for Off-Season Day: ${scoredDay}`);

  const historicalData = await fetchHistoricalData(seasonData.dataDocId);
  const dayEventData = seasonData.events.find((e) => e.offSeasonDay === scoredDay);

  const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", seasonData.seasonUid);
  const profilesSnapshot = await profilesQuery.get();
  if (profilesSnapshot.empty) return;

  const week = Math.ceil(scoredDay / 7);
  const dailyRecap = {
    offSeasonDay: scoredDay,
    date: yesterday,  // Use yesterday since scores are for the previous day
    shows: [],
  };
  const batch = db.batch();
  const dailyScores = new Map();

  // --- CHAMPIONSHIP WEEK AUTO-ENROLLMENT & PROGRESSION LOGIC ---
  // Structure: { showEventName: { participants: [uid], classFilter: [corpsClass] } }
  let championshipConfig = null;

  if (scoredDay >= 45) {
    const recapDoc = await db.doc(`fantasy_recaps/${seasonData.seasonUid}`).get();
    const allRecaps = recapDoc.exists ? recapDoc.data().recaps || [] : [];

    if (scoredDay === 45) {
      // Day 45: Open and A Class Prelims - All Open and A Class corps auto-enrolled
      championshipConfig = {
        "Open and A Class Prelims": {
          participants: null, // null means all eligible
          classFilter: ["openClass", "aClass"],
        },
      };
      logger.info("Day 45: Auto-enrolling all Open Class and A Class corps in Prelims.");

    } else if (scoredDay === 46) {
      // Day 46: Open and A Class Finals - Top 8 Open, Top 4 A Class from Day 45
      const day45Recap = allRecaps.find(r => r.offSeasonDay === 45);
      if (day45Recap) {
        const openClassResults = [];
        const aClassResults = [];

        day45Recap.shows.forEach(show => {
          show.results.forEach(r => {
            if (r.corpsClass === "openClass") openClassResults.push(r);
            else if (r.corpsClass === "aClass") aClassResults.push(r);
          });
        });

        openClassResults.sort((a, b) => b.totalScore - a.totalScore);
        aClassResults.sort((a, b) => b.totalScore - a.totalScore);

        // Top 8 Open Class
        const top8Open = openClassResults.slice(0, 8).map(r => ({ uid: r.uid, corpsClass: "openClass" }));
        // Top 4 A Class
        const top4AClass = aClassResults.slice(0, 4).map(r => ({ uid: r.uid, corpsClass: "aClass" }));

        const finalists = [...top8Open, ...top4AClass];
        logger.info(`Day 46: ${top8Open.length} Open Class and ${top4AClass.length} A Class corps advancing to Finals.`);

        championshipConfig = {
          "Open and A Class Finals": {
            participants: finalists, // Array of { uid, corpsClass }
            classFilter: ["openClass", "aClass"],
          },
        };
      }

    } else if (scoredDay === 47) {
      // Day 47: World Championships Prelims - All World, Open, and A Class corps
      championshipConfig = {
        "marching.art World Championship Prelims": {
          participants: null, // All eligible
          classFilter: ["worldClass", "openClass", "aClass"],
        },
      };
      logger.info("Day 47: Auto-enrolling all World, Open, and A Class corps in World Championship Prelims.");

    } else if (scoredDay === 48) {
      // Day 48: World Championships Semifinals - Top 25 from Day 47
      const prelimsRecap = allRecaps.find(r => r.offSeasonDay === 47);
      if (prelimsRecap) {
        const allResults = prelimsRecap.shows.flatMap(s => s.results);
        allResults.sort((a, b) => b.totalScore - a.totalScore);

        // Handle tie at 25th place
        let advancingCorps = [];
        if (allResults.length >= 25) {
          const twentyFifthPlaceScore = allResults[24].totalScore;
          advancingCorps = allResults.filter(r => r.totalScore >= twentyFifthPlaceScore);
        } else {
          advancingCorps = allResults;
        }

        const participants = advancingCorps.map(r => ({ uid: r.uid, corpsClass: r.corpsClass }));
        logger.info(`Day 48: ${participants.length} corps advancing to Semifinals.`);

        championshipConfig = {
          "marching.art World Championship Semifinals": {
            participants,
            classFilter: ["worldClass", "openClass", "aClass"],
          },
        };
      }

    } else if (scoredDay === 49) {
      // Day 49: Two shows - World Finals (top 12) and SoundSport Festival (all SoundSport)
      const semisRecap = allRecaps.find(r => r.offSeasonDay === 48);

      championshipConfig = {
        // World Championship Finals - Top 12 from Day 48
        "marching.art World Championship Finals": {
          participants: [],
          classFilter: ["worldClass", "openClass", "aClass"],
        },
        // SoundSport Festival - All SoundSport corps
        "SoundSport International Music & Food Festival": {
          participants: null, // All eligible
          classFilter: ["soundSport"],
        },
      };

      if (semisRecap) {
        const allResults = semisRecap.shows.flatMap(s => s.results);
        allResults.sort((a, b) => b.totalScore - a.totalScore);

        // Handle tie at 12th place
        let finalists = [];
        if (allResults.length >= 12) {
          const twelfthPlaceScore = allResults[11].totalScore;
          finalists = allResults.filter(r => r.totalScore >= twelfthPlaceScore);
        } else {
          finalists = allResults;
        }

        championshipConfig["marching.art World Championship Finals"].participants =
          finalists.map(r => ({ uid: r.uid, corpsClass: r.corpsClass }));

        logger.info(`Day 49: ${finalists.length} corps advancing to World Championship Finals.`);
      }
      logger.info("Day 49: All SoundSport corps enrolled in SoundSport Festival.");
    }
  }
  // --- END: CHAMPIONSHIP WEEK AUTO-ENROLLMENT & PROGRESSION LOGIC ---

  if (!dayEventData || !dayEventData.shows || dayEventData.shows.length === 0) {
    logger.info(`No shows for day ${scoredDay}. Nothing to process.`);
    return;
  }

  for (const show of dayEventData.shows) {
    const showResult = {
      eventName: show.eventName,
      location: show.location,
      results: [],
    };

    // --- DAY 41/42 REGIONAL SPLIT LOGIC ---
    let day41_42_participants = null;
    if ([41, 42].includes(scoredDay) && show.eventName.includes("Eastern Classic")) {
        const allEnrollees = [];
        for (const userDoc of profilesSnapshot.docs) {
            const userProfile = userDoc.data();
            const userShows = userProfile.corps?.worldClass?.selectedShows?.[`week${week}`] || [];
            if (userShows.some(s => s.eventName === show.eventName)) {
                allEnrollees.push(userDoc.ref.parent.parent.id);
            }
        }
        allEnrollees.sort(); // Deterministic sort
        const splitIndex = Math.ceil(allEnrollees.length / 2);
        if (scoredDay === 41) {
            day41_42_participants = allEnrollees.slice(0, splitIndex);
            logger.info(`Day 41: Scoring first half (${day41_42_participants.length}) of Eastern Classic enrollees.`);
        } else { // Day 42
            day41_42_participants = allEnrollees.slice(splitIndex);
            logger.info(`Day 42: Scoring second half (${day41_42_participants.length}) of Eastern Classic enrollees.`);
        }
    }
    // --- END: DAY 41/42 REGIONAL SPLIT LOGIC ---

    // --- CHAMPIONSHIP SHOW CONFIGURATION ---
    // Get config for this specific show if it's a championship event
    const showConfig = championshipConfig ? championshipConfig[show.eventName] : null;
    // --- END: CHAMPIONSHIP SHOW CONFIGURATION ---

    for (const userDoc of profilesSnapshot.docs) {
      const userProfile = userDoc.data();
      const uid = userDoc.ref.parent.parent.id;

      // Filter for regional split
      if (day41_42_participants && !day41_42_participants.includes(uid)) continue;

      const userCorps = userProfile.corps || {};
      for (const corpsClass of Object.keys(userCorps)) {
        const corps = userCorps[corpsClass];
        if (!corps || !corps.corpsName || !corps.lineup) continue;

        let attended = false;

        // Championship Week Logic (Days 45-49)
        if (showConfig) {
          // Check if this corps class is eligible for this show
          if (!showConfig.classFilter.includes(corpsClass)) {
            continue; // This class can't participate in this show
          }

          // Check if this user/class combo is in the participants list (for advancement rounds)
          if (showConfig.participants !== null) {
            // participants is an array of { uid, corpsClass } objects
            const isParticipant = showConfig.participants.some(
              p => p.uid === uid && p.corpsClass === corpsClass
            );
            if (!isParticipant) {
              continue; // Didn't advance to this round
            }
          }

          // If we get here, the corps is eligible and has advanced (if applicable)
          attended = true;
        } else {
          // Regular show - check manual registration
          const userShows = corps.selectedShows?.[`week${week}`] || [];
          // Match by eventName only - dates can have type mismatches (Timestamp vs string)
          // and eventName should be unique enough within a week
          attended = userShows.some(s => s.eventName === show.eventName);
        }

        if (attended) {
          let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;

          // Calculate synergy bonus for show concept
          const { captionBonuses } = calculateLineupSynergyBonus(
            corps.showConcept || {},
            corps.lineup
          );

          for (const caption in corps.lineup) {
            const [corpsName, sourceYear, points] = corps.lineup[caption].split("|");
            const baseCaptionScore = getRealisticCaptionScore(corpsName, sourceYear, caption, scoredDay, historicalData);

            // Apply synergy bonus (0 - 1.0 based on show concept match)
            const synergyBonus = captionBonuses[caption] || 0;
            // Hard cap each caption at 20 points
            const captionScore = Math.min(20, baseCaptionScore + synergyBonus);

            if (["GE1", "GE2"].includes(caption)) geScore += captionScore;
            else if (["VP", "VA", "CG"].includes(caption)) rawVisualScore += captionScore;
            else if (["B", "MA", "P"].includes(caption)) rawMusicScore += captionScore;
          }
          const visualScore = rawVisualScore / 2;
          const musicScore = rawMusicScore / 2;
          // Hard cap at 100 - this is the maximum possible score
          const totalShowScore = Math.min(100, geScore + visualScore + musicScore);

          const currentDailyTotal = dailyScores.get(`${uid}_${corpsClass}`) || 0;
          dailyScores.set(`${uid}_${corpsClass}`, currentDailyTotal + totalShowScore);

          // Award CorpsCoin for performance
          await awardCorpsCoin(uid, corpsClass, show.eventName);

          showResult.results.push({
            uid: uid,
            corpsClass: corpsClass,
            corpsName: corps.corpsName,
            totalScore: totalShowScore,
            geScore, visualScore, musicScore,
          });
        }
      }
    }
    dailyRecap.shows.push(showResult);
  }

  // Action 1: Update user profiles with their most recent score
  for (const [uidAndClass, totalDailyScore] of dailyScores.entries()) {
    if (totalDailyScore > 0) {
      const [uid, corpsClass] = uidAndClass.split("_");
      const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
      batch.update(userProfileRef, {
        [`corps.${corpsClass}.totalSeasonScore`]: totalDailyScore,
        [`corps.${corpsClass}.lastScoredDay`]: scoredDay,
      });
    }
  }

  // Action 2: Save the completed recap document
  const recapDocRef = db.doc(`fantasy_recaps/${seasonData.seasonUid}`);
  const recapDoc = await recapDocRef.get();
  if (!recapDoc.exists) {
    batch.set(recapDocRef, {
      seasonName: seasonData.name,
      recaps: [dailyRecap],
    });
  } else {
    const existingRecaps = recapDoc.data().recaps || [];
    const updatedRecaps = existingRecaps.filter((r) => r.offSeasonDay !== scoredDay);
    updatedRecaps.push(dailyRecap);
    batch.update(recapDocRef, { recaps: updatedRecaps });
  }

  // --- TROPHY AWARDING LOGIC ---
  const regionalTrophyDays = [28, 35, 41, 42];
  const metals = ['gold', 'silver', 'bronze'];

  if (regionalTrophyDays.includes(scoredDay)) {
    logger.info(`Day ${scoredDay} is a regional trophy day. Awarding trophies...`);
    dailyRecap.shows.forEach(show => {
        show.results.sort((a,b) => b.totalScore - a.totalScore);
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

  // Day 46: Open and A Class Finals - Award class-specific trophies
  if (scoredDay === 46) {
    logger.info("Day 46: Awarding Open and A Class Finals trophies...");
    dailyRecap.shows.forEach(show => {
      // Group results by class for separate awards
      const openClassResults = show.results.filter(r => r.corpsClass === "openClass");
      const aClassResults = show.results.filter(r => r.corpsClass === "aClass");

      // Sort each class
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

  if (scoredDay === 49) { // Finals Day - Multiple shows
    logger.info(`Day ${scoredDay} is Finals day. Awarding championship trophies and finalist medals...`);

    // Collect all results by class for season champions
    const allResultsByClass = {};

    // Process each show on Day 49 (World Finals and SoundSport Festival)
    for (const show of dailyRecap.shows) {
      show.results.sort((a, b) => b.totalScore - a.totalScore);

      // Determine trophy type based on show
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

      // Award finalist medals/ribbons to all participants
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

    // Process each class and get top 3
    for (const [corpsClass, classResults] of Object.entries(allResultsByClass)) {
      classResults.sort((a, b) => b.totalScore - a.totalScore);
      const classTop3 = classResults.slice(0, 3);

      // Fetch usernames for champions
      const championsWithUsernames = await Promise.all(classTop3.map(async (result, index) => {
        const userProfileDoc = await db.doc(`artifacts/${dataNamespaceParam.value()}/users/${result.uid}/profile/data`).get();
        const username = userProfileDoc.exists ? userProfileDoc.data().username : 'Unknown';
        return {
          rank: index + 1,
          uid: result.uid,
          username,
          corpsName: result.corpsName,
          score: result.totalScore
        };
      }));

      seasonChampionsData.classes[corpsClass] = championsWithUsernames;
    }

    // Save to season_champions collection
    const seasonChampionsRef = db.doc(`season_champions/${seasonData.seasonUid}`);
    batch.set(seasonChampionsRef, seasonChampionsData);
    logger.info(`Saved season champions for ${Object.keys(allResultsByClass).length} classes.`);
    // --- END SAVE SEASON CHAMPIONS BY CLASS ---
  }
  // --- END: TROPHY AWARDING LOGIC ---

  // Commit all database writes at once
  await batch.commit();
  logger.info(`Successfully processed and archived scores for day ${scoredDay}.`);

  if (scoredDay % 7 === 0) {
    const week = scoredDay / 7;
    logger.info(`End of week ${week}. Determining class-based matchup winners...`);

    const leaguesSnapshot = await db.collection("leagues").get();
    const winnerBatch = db.batch();
    const corpsClasses = ["worldClass", "openClass", "aClass", "soundSport"];

    for (const leagueDoc of leaguesSnapshot.docs) {
      const matchupDocRef = db.doc(`leagues/${leagueDoc.id}/matchups/week${week}`);
      const matchupDoc = await matchupDocRef.get();

      if (matchupDoc.exists) {
        const matchupData = matchupDoc.data();
        let hasUpdates = false;

        for (const corpsClass of corpsClasses) {
          const matchupArrayKey = `${corpsClass}Matchups`;
          const matchups = matchupData[matchupArrayKey] || [];
          if (matchups.length === 0) continue;

          const updatedMatchupsForClass = [];

          for (const matchup of matchups) {
            if (matchup.winner) {
              updatedMatchupsForClass.push(matchup);
              continue;
            }

            const [p1_uid, p2_uid] = matchup.pair;
            const p1_profileDoc = await db.doc(`artifacts/${dataNamespaceParam.value()}/users/${p1_uid}/profile/data`).get();
            const p2_profileDoc = await db.doc(`artifacts/${dataNamespaceParam.value()}/users/${p2_uid}/profile/data`).get();

            // IMPORTANT: Get score for the SPECIFIC corps class, not total score
            const p1_score = p1_profileDoc.data()?.corps?.[corpsClass]?.totalSeasonScore || 0;
            const p2_score = p2_profileDoc.data()?.corps?.[corpsClass]?.totalSeasonScore || 0;

            let winnerUid = null;
            if (p1_score > p2_score) winnerUid = p1_uid;
            if (p2_score > p1_score) winnerUid = p2_uid;

            // Path to the new, class-specific record
            const seasonRecordPath = `seasons.${seasonData.seasonUid}.records.${corpsClass}`;
            const increment = admin.firestore.FieldValue.increment(1);

            if (winnerUid === p1_uid) {
              winnerBatch.set(p1_profileDoc.ref, { [seasonRecordPath]: { w: increment } }, { merge: true });
              winnerBatch.set(p2_profileDoc.ref, { [seasonRecordPath]: { l: increment } }, { merge: true });
            } else if (winnerUid === p2_uid) {
              winnerBatch.set(p1_profileDoc.ref, { [seasonRecordPath]: { l: increment } }, { merge: true });
              winnerBatch.set(p2_profileDoc.ref, { [seasonRecordPath]: { w: increment } }, { merge: true });
            } else { // Tie
              winnerBatch.set(p1_profileDoc.ref, { [seasonRecordPath]: { t: increment } }, { merge: true });
              winnerBatch.set(p2_profileDoc.ref, { [seasonRecordPath]: { t: increment } }, { merge: true });
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
    }
    await winnerBatch.commit();
    logger.info(`Matchup winner determination for week ${week} complete.`);
  }
}

async function processAndScoreLiveSeasonDayLogic(scoredDay, seasonData) {
  const db = getDb();
  logger.info(`Processing and scoring Live Season Day: ${scoredDay}`);
  const week = Math.ceil(scoredDay / 7);

  const profilesQuery = db.collectionGroup("profile").where("activeSeasonId", "==", seasonData.seasonUid);
  const profilesSnapshot = await profilesQuery.get();
  if (profilesSnapshot.empty) {
    logger.info("No active profiles found for the live season.");
    return;
  }

  // Calculate the actual date for this scored day
  const seasonStartDate = seasonData.schedule.startDate.toDate();
  const scoreDate = new Date(seasonStartDate);
  scoreDate.setDate(seasonStartDate.getDate() + (scoredDay - 1));

  const historicalData = await fetchHistoricalData(seasonData.dataDocId);
  const dailyRecap = {
    offSeasonDay: scoredDay,
    date: scoreDate,  // Use the calculated date for this day, not the current date
    shows: [],
  };
  const batch = db.batch();

  // --- LIVE SEASON CHAMPIONSHIP PROGRESSION ---
  let championshipParticipants = null;
  if (scoredDay === 69 || scoredDay === 70) {
    const recapDoc = await db.doc(`fantasy_recaps/${seasonData.seasonUid}`).get();
    if (recapDoc.exists) {
      const allRecaps = recapDoc.data().recaps || [];
      if (scoredDay === 69) { // Semifinals
        const prelimsRecap = allRecaps.find(r => r.offSeasonDay === 68);
        if (prelimsRecap) {
          const allResults = prelimsRecap.shows.flatMap(s => s.results);
          allResults.sort((a, b) => b.totalScore - a.totalScore);
          championshipParticipants = allResults.slice(0, 25).map(r => r.uid);
          logger.info(`Found ${championshipParticipants.length} corps advancing to Live Season Semifinals.`);
        }
      } else if (scoredDay === 70) { // Finals
        const semisRecap = allRecaps.find(r => r.offSeasonDay === 69);
        if (semisRecap) {
          const allResults = semisRecap.shows.flatMap(s => s.results);
          allResults.sort((a, b) => b.totalScore - a.totalScore);
          if (allResults.length >= 12) {
            const twelfthPlaceScore = allResults[11].totalScore;
            championshipParticipants = allResults.filter(r => r.totalScore >= twelfthPlaceScore).map(r => r.uid);
            logger.info(`Found ${championshipParticipants.length} corps advancing to Live Season Finals (tie-breaker included).`);
          } else {
            championshipParticipants = allResults.map(r => r.uid);
          }
        }
      }
    }
  }
  // --- END LIVE SEASON CHAMPIONSHIP PROGRESSION ---

  const dayEventData = seasonData.events.find(e => e.dayIndex === (scoredDay - 1));
  const showsForDay = dayEventData ? dayEventData.shows : [];
  
  // Create recap shows for both real and predicted scores
  const recapShows = new Map();
  showsForDay.forEach(show => recapShows.set(show.eventName, { eventName: show.eventName, location: show.location, results: [] }));
  const predictedShowKey = `Predicted Scores - Day ${scoredDay}`;
  recapShows.set(predictedShowKey, { eventName: predictedShowKey, location: "Cloud Arena", results: [] });


  for (const userDoc of profilesSnapshot.docs) {
    const userProfile = userDoc.data();
    const uid = userDoc.ref.parent.parent.id;
    const userCorps = userProfile.corps || {};

    if (championshipParticipants && !championshipParticipants.includes(uid)) continue;

    for (const corpsClass in userCorps) {
        const corps = userCorps[corpsClass];
        if (!corps || !corps.lineup) continue;

        let attendedShow = null;
        if (scoredDay >= 68) {
            attendedShow = { eventName: `DCI World Championships Day ${scoredDay - 67}` };
        } else {
            const userShowsForWeek = corps.selectedShows?.[`week${week}`] || [];
            const dayShows = showsForDay.map(s => s.eventName);
            attendedShow = userShowsForWeek.find(us => dayShows.includes(us.eventName));
        }
        
        if (attendedShow) {
            // --- LIVE SEASON DAY 62/63 REGIONAL SPLIT ---
            if ([62, 63].includes(scoredDay) && attendedShow.eventName.includes("Regional")) {
                const allEnrollees = [];
                for (const doc of profilesSnapshot.docs) {
                    const profile = doc.data();
                    const shows = profile.corps?.[corpsClass]?.selectedShows?.[`week${week}`] || [];
                    if (shows.some(s => s.eventName === attendedShow.eventName)) {
                        allEnrollees.push(doc.ref.parent.parent.id);
                    }
                }
                allEnrollees.sort(); // Deterministic split
                const splitIndex = Math.ceil(allEnrollees.length / 2);
                const firstHalf = allEnrollees.slice(0, splitIndex);

                if ((scoredDay === 62 && !firstHalf.includes(uid)) || (scoredDay === 63 && firstHalf.includes(uid))) {
                    continue; // Skip this user if they are not in the correct half for today
                }
            }
            // --- END REGIONAL SPLIT ---

            let totalScore = 0;
            let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;

            const liveScoresTodayRef = db.collection(`live_scores/${seasonData.seasonUid}/scores`).where("day", "==", scoredDay);
            const liveScoresTodaySnap = await liveScoresTodayRef.get();
            const realScoresMap = new Map();
            liveScoresTodaySnap.forEach(doc => {
                realScoresMap.set(doc.data().corpsName, doc.data().captions);
            });

            // Calculate synergy bonus for show concept
            const { captionBonuses } = calculateLineupSynergyBonus(
                corps.showConcept || {},
                corps.lineup
            );

            for (const caption in corps.lineup) {
                const [selectedCorps, sourceYear, points] = corps.lineup[caption].split("|");
                let baseCaptionScore = 0;

                if (realScoresMap.has(selectedCorps) && realScoresMap.get(selectedCorps)[caption] > 0) {
                    baseCaptionScore = realScoresMap.get(selectedCorps)[caption];
                } else {
                    baseCaptionScore = await getLiveCaptionScore(selectedCorps, sourceYear, caption, scoredDay, historicalData);
                }

                // Apply synergy bonus (0 - 1.0 based on show concept match)
                const synergyBonus = captionBonuses[caption] || 0;
                // Hard cap each caption at 20 points
                const captionScore = Math.min(20, baseCaptionScore + synergyBonus);

                if (["GE1", "GE2"].includes(caption)) geScore += captionScore;
                else if (["VP", "VA", "CG"].includes(caption)) rawVisualScore += captionScore;
                else if (["B", "MA", "P"].includes(caption)) rawMusicScore += captionScore;
            }

            const visualScore = rawVisualScore / 2;
            const musicScore = rawMusicScore / 2;
            // Hard cap at 100 - this is the maximum possible score
            totalScore = Math.min(100, geScore + visualScore + musicScore);

            if (totalScore > 0) {
                batch.update(userDoc.ref, {
                    [`corps.${corpsClass}.totalSeasonScore`]: totalScore
                });

                const result = { uid, corpsClass, corpsName: corps.corpsName, totalScore, geScore, visualScore, musicScore };
                
                const usedAnyRealScores = Array.from(realScoresMap.values()).length > 0;
                const showKey = usedAnyRealScores ? attendedShow.eventName : predictedShowKey;

                if(recapShows.has(showKey)) {
                    recapShows.get(showKey).results.push(result);
                }
            }
        }
    }
  }

  dailyRecap.shows = Array.from(recapShows.values()).filter(s => s.results.length > 0);
  
  // --- LIVE SEASON TROPHY AWARDING ---
  const liveRegionalTrophyDays = [49, 56, 62, 63];
  const metals = ['gold', 'silver', 'bronze'];

  if (liveRegionalTrophyDays.includes(scoredDay)) {
    logger.info(`Day ${scoredDay} is a Live Season regional trophy day. Awarding trophies...`);
    dailyRecap.shows.forEach(show => {
        if(show.eventName.includes("Predicted")) return; // Don't award for predicted shows
        show.results.sort((a,b) => b.totalScore - a.totalScore);
        const top3 = show.results.slice(0, 3);
        top3.forEach((winner, index) => {
            const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
            const trophy = { type: 'regional', metal: metals[index], seasonName: seasonData.name, eventName: show.eventName, score: winner.totalScore, rank: index + 1 };
            batch.update(userProfileRef, { 'trophies.regionals': admin.firestore.FieldValue.arrayUnion(trophy) });
        });
    });
  }

  if (scoredDay === 70) { // Finals Day
    logger.info(`Day ${scoredDay} is Live Season Finals day. Awarding championship trophies...`);
    const finalsShow = dailyRecap.shows[0];
    if (finalsShow) {
        finalsShow.results.sort((a,b) => b.totalScore - a.totalScore);
        const top3 = finalsShow.results.slice(0, 3);
        top3.forEach((winner, index) => {
            const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
            const trophy = { type: 'championship', metal: metals[index], seasonName: seasonData.name, eventName: finalsShow.eventName, score: winner.totalScore, rank: index + 1 };
            batch.update(userProfileRef, { 'trophies.championships': admin.firestore.FieldValue.arrayUnion(trophy) });
        });
        finalsShow.results.forEach((finalist, index) => {
            const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${finalist.uid}/profile/data`);
            const medal = { type: 'finalist', seasonName: seasonData.name, rank: index + 1 };
            batch.update(userProfileRef, { 'trophies.finalistMedals': admin.firestore.FieldValue.arrayUnion(medal) });
        });

        // --- SAVE SEASON CHAMPIONS BY CLASS ---
        // Group results by corps class and get top 3 for each
        const resultsByClass = {};
        finalsShow.results.forEach(result => {
          const corpsClass = result.corpsClass || 'worldClass';
          if (!resultsByClass[corpsClass]) {
            resultsByClass[corpsClass] = [];
          }
          resultsByClass[corpsClass].push(result);
        });

        const seasonChampionsData = {
          seasonId: seasonData.seasonUid,
          seasonName: seasonData.name,
          seasonType: seasonData.status,
          archivedAt: new Date(),
          classes: {}
        };

        // Process each class and get top 3
        for (const [corpsClass, classResults] of Object.entries(resultsByClass)) {
          classResults.sort((a, b) => b.totalScore - a.totalScore);
          const classTop3 = classResults.slice(0, 3);

          // Fetch usernames for champions
          const championsWithUsernames = await Promise.all(classTop3.map(async (result, index) => {
            const userProfileDoc = await db.doc(`artifacts/${dataNamespaceParam.value()}/users/${result.uid}/profile/data`).get();
            const username = userProfileDoc.exists ? userProfileDoc.data().username : 'Unknown';
            return {
              rank: index + 1,
              uid: result.uid,
              username,
              corpsName: result.corpsName,
              score: result.totalScore
            };
          }));

          seasonChampionsData.classes[corpsClass] = championsWithUsernames;
        }

        // Save to season_champions collection
        const seasonChampionsRef = db.doc(`season_champions/${seasonData.seasonUid}`);
        batch.set(seasonChampionsRef, seasonChampionsData);
        logger.info(`Saved season champions for ${Object.keys(resultsByClass).length} classes.`);
        // --- END SAVE SEASON CHAMPIONS BY CLASS ---
    }
  }
  // --- END LIVE SEASON TROPHY AWARDING ---

  // Save the recap document
  const recapDocRef = db.doc(`fantasy_recaps/${seasonData.seasonUid}`);
  const recapDoc = await recapDocRef.get();
  if (!recapDoc.exists) {
    batch.set(recapDocRef, { seasonName: seasonData.name, recaps: [dailyRecap] });
  } else {
    const existingRecaps = recapDoc.data().recaps || [];
    const updatedRecaps = existingRecaps.filter((r) => r.offSeasonDay !== scoredDay);
    if(dailyRecap.shows.length > 0) {
        updatedRecaps.push(dailyRecap);
    }
    batch.update(recapDocRef, { recaps: updatedRecaps });
  }

  await batch.commit();
  logger.info("Daily Live Season Score Processor & Archiver finished.");
}

async function calculateCorpsStatisticsLogic() {
  logger.info("Starting corps statistics calculation...");
  const db = getDb();

  // 1. Get the current season to identify the active corps list
  const seasonSettingsRef = db.doc("game-settings/season");
  const seasonDoc = await seasonSettingsRef.get();
  if (!seasonDoc.exists) {
    throw new Error("No active season document found.");
  }
  const seasonData = seasonDoc.data();
  const seasonId = seasonData.seasonUid;

  const corpsDataRef = db.doc(`dci-data/${seasonData.dataDocId}`);
  const corpsSnap = await getDoc(corpsDataRef);
  if (!corpsSnap.exists) {
    throw new Error(`Corps data document not found: ${seasonData.dataDocId}`);
  }
  const corpsInSeason = corpsSnap.data().corpsValues || [];
  const yearsToFetch = [...new Set(corpsInSeason.map((c) => c.sourceYear))];

  // 2. Fetch all necessary historical score documents
  const historicalPromises = yearsToFetch.map((year) => db.doc(`historical_scores/${year}`).get());
  const historicalDocs = await Promise.all(historicalPromises);
  const historicalData = {};
  historicalDocs.forEach((doc) => {
    if (doc.exists) {
      historicalData[doc.id] = doc.data().data;
    }
  });

  // 3. Process the data for each corps
  const allCorpsStats = [];
  for (const corps of corpsInSeason) {
    const uniqueId = `${corps.corpsName}|${corps.sourceYear}`;
    const corpsEvents = (historicalData[corps.sourceYear] || []).filter((event) =>
      event.scores.some((s) => s.corps === corps.corpsName)
    );

    const captionScores = { GE1: [], GE2: [], VP: [], VA: [], CG: [], B: [], MA: [], P: [] };

    corpsEvents.forEach((event) => {
      const scoreData = event.scores.find((s) => s.corps === corps.corpsName);
      if (scoreData) {
        for (const caption in captionScores) {
          if (scoreData.captions[caption] > 0) {
            captionScores[caption].push(scoreData.captions[caption]);
          }
        }
      }
    });

    const calculatedStats = {};
    for (const caption in captionScores) {
      const scores = captionScores[caption];
      if (scores.length > 0) {
        const sum = scores.reduce((a, b) => a + b, 0);
        calculatedStats[caption] = {
          avg: parseFloat((sum / scores.length).toFixed(3)),
          max: Math.max(...scores),
          min: Math.min(...scores),
          count: scores.length,
        };
      } else {
        calculatedStats[caption] = { avg: 0, max: 0, min: 0, count: 0 };
      }
    }

    allCorpsStats.push({
      id: uniqueId,
      corpsName: corps.corpsName,
      sourceYear: corps.sourceYear,
      points: corps.points,
      stats: calculatedStats,
    });
  }

  // 4. Save the aggregated data to a new document
  const statsDocRef = db.doc(`dci-stats/${seasonId}`);
  await statsDocRef.set({
    seasonName: seasonData.name,
    lastUpdated: new Date(),
    data: allCorpsStats,
  });

  logger.info(`Successfully processed and saved stats for ${allCorpsStats.length} corps.`);
}



module.exports = {
  fetchHistoricalData,
  simpleLinearRegression,
  getRealisticCaptionScore,
  getScoreForDay,
  logarithmicRegression,
  mapLiveDayToOffSeasonDay,
  getLiveCaptionScore,
  processAndArchiveOffSeasonScoresLogic,
  calculateCorpsStatisticsLogic,
  processAndScoreLiveSeasonDayLogic,
};