const { getDb, dataNamespaceParam } = require("../config");
const { logger } = require("firebase-functions/v2");
const { getDoc } = require("firebase-admin/firestore");
const admin = require("firebase-admin");
const { shuffleArray } = require("./season");

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
    date: new Date(),
    shows: [],
  };
  const batch = db.batch();
  const dailyScores = new Map();

  // --- NEW: CHAMPIONSHIP PROGRESSION LOGIC ---
  let championshipParticipants = null;
  if (scoredDay === 48 || scoredDay === 49) {
    const recapDoc = await db.doc(`fantasy_recaps/${seasonData.seasonUid}`).get();
    if (recapDoc.exists) {
      const allRecaps = recapDoc.data().recaps || [];
      if (scoredDay === 48) { // Semifinals
        const prelimsRecap = allRecaps.find(r => r.offSeasonDay === 47);
        if (prelimsRecap) {
          const allResults = prelimsRecap.shows.flatMap(s => s.results);
          allResults.sort((a, b) => b.totalScore - a.totalScore);
          championshipParticipants = allResults.slice(0, 25).map(r => r.uid);
          logger.info(`Found ${championshipParticipants.length} corps advancing to Semifinals.`);
        }
      } else if (scoredDay === 49) { // Finals
        const semisRecap = allRecaps.find(r => r.offSeasonDay === 48);
        if (semisRecap) {
          const allResults = semisRecap.shows.flatMap(s => s.results);
          allResults.sort((a, b) => b.totalScore - a.totalScore);
          if (allResults.length >= 12) {
            const twelfthPlaceScore = allResults[11].totalScore;
            championshipParticipants = allResults.filter(r => r.totalScore >= twelfthPlaceScore).map(r => r.uid);
            logger.info(`Found ${championshipParticipants.length} corps advancing to Finals (tie-breaker included).`);
          } else {
            championshipParticipants = allResults.map(r => r.uid); // All advance if less than 12
          }
        }
      }
    }
  }
  // --- END: CHAMPIONSHIP PROGRESSION LOGIC ---

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

    // --- NEW: DAY 41/42 REGIONAL SPLIT LOGIC ---
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

    for (const userDoc of profilesSnapshot.docs) {
      const userProfile = userDoc.data();
      const uid = userDoc.ref.parent.parent.id;

      // --- NEW: Filter participants for championships/regionals ---
      if (championshipParticipants && !championshipParticipants.includes(uid)) continue;
      if (day41_42_participants && !day41_42_participants.includes(uid)) continue;
      // --- END: Filter ---

      const userCorps = userProfile.corps || {};
      Object.keys(userCorps).forEach(corpsClass => {
        const corps = userCorps[corpsClass];
        if (!corps || !corps.corpsName) return;

        let attended = false;
        if (scoredDay >= 47) {
            attended = true; // All corps automatically enrolled in championships
        } else {
            const userShows = corps.selectedShows?.[`week${week}`] || [];
            attended = userShows.some(s => s.eventName === show.eventName && s.date === show.date);
        }

        if (attended) {
          let geScore = 0, rawVisualScore = 0, rawMusicScore = 0;
          for (const caption in corps.lineup) {
            const [corpsName, , year] = corps.lineup[caption].split("|");
            const captionScore = getRealisticCaptionScore(corpsName, year, caption, scoredDay, historicalData);

            if (["GE1", "GE2"].includes(caption)) geScore += captionScore;
            else if (["VP", "VA", "CG"].includes(caption)) rawVisualScore += captionScore;
            else if (["B", "MA", "P"].includes(caption)) rawMusicScore += captionScore;
          }
          const visualScore = rawVisualScore / 2;
          const musicScore = rawMusicScore / 2;
          const totalShowScore = geScore + visualScore + musicScore;

          const currentDailyTotal = dailyScores.get(`${uid}_${corpsClass}`) || 0;
          dailyScores.set(`${uid}_${corpsClass}`, currentDailyTotal + totalShowScore);

          showResult.results.push({
            uid: uid,
            corpsClass: corpsClass,
            corpsName: corps.corpsName,
            totalScore: totalShowScore,
            geScore, visualScore, musicScore,
          });
        }
      });
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

  // --- NEW: TROPHY AWARDING LOGIC ---
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

  if (scoredDay === 49) { // Finals Day
    logger.info(`Day ${scoredDay} is Finals day. Awarding championship trophies and finalist medals...`);
    const finalsShow = dailyRecap.shows[0]; // There's only one show on Finals day
    finalsShow.results.sort((a,b) => b.totalScore - a.totalScore);
    
    // Award trophies to top 3
    const top3 = finalsShow.results.slice(0, 3);
    top3.forEach((winner, index) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${winner.uid}/profile/data`);
        const trophy = {
            type: 'championship',
            metal: metals[index],
            seasonName: seasonData.name,
            eventName: finalsShow.eventName,
            score: winner.totalScore,
            rank: index + 1
        };
        batch.update(userProfileRef, {
            'trophies.championships': admin.firestore.FieldValue.arrayUnion(trophy)
        });
    });

    // Award finalist medals to all participants on Day 49
    finalsShow.results.forEach((finalist, index) => {
        const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${finalist.uid}/profile/data`);
        const medal = {
            type: 'finalist',
            seasonName: seasonData.name,
            rank: index + 1
        };
        batch.update(userProfileRef, {
            'trophies.finalistMedals': admin.firestore.FieldValue.arrayUnion(medal)
        });
    });
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
    const corpsClasses = ["worldClass", "openClass", "aClass"];

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

  const historicalData = await fetchHistoricalData(seasonData.dataDocId);
  const dailyRecap = {
    offSeasonDay: scoredDay,
    date: new Date(),
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

            for (const caption in corps.lineup) {
                const [selectedCorps, , sourceYear] = corps.lineup[caption].split("|");
                let captionScore = 0;
            
                if (realScoresMap.has(selectedCorps) && realScoresMap.get(selectedCorps)[caption] > 0) {
                    captionScore = realScoresMap.get(selectedCorps)[caption];
                } else {
                    captionScore = await getLiveCaptionScore(selectedCorps, sourceYear, caption, scoredDay, historicalData);
                }
            
                if (["GE1", "GE2"].includes(caption)) geScore += captionScore;
                else if (["VP", "VA", "CG"].includes(caption)) rawVisualScore += captionScore;
                else if (["B", "MA", "P"].includes(caption)) rawMusicScore += captionScore;
            }

            const visualScore = rawVisualScore / 2;
            const musicScore = rawMusicScore / 2;
            totalScore = geScore + visualScore + musicScore;

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