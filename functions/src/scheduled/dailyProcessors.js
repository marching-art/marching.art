const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb, dataNamespaceParam } = require("../config");
const { processAndArchiveOffSeasonScoresLogic, processAndScoreLiveSeasonDayLogic } = require("../helpers/scoring");

exports.dailyOffSeasonProcessor = onSchedule({
  schedule: "every day 02:00",
  timeZone: "America/New_York",
}, async () => {
  await processAndArchiveOffSeasonScoresLogic();
});

exports.processDailyLiveScores = onSchedule({
  schedule: "every day 02:00",
  timeZone: "America/New_York",
}, async () => {
  const db = getDb();
  logger.info("Running Daily Live Season Score Processor...");

  const seasonDoc = await db.doc("game-settings/season").get();
  
  if (!seasonDoc.exists || seasonDoc.data().status !== "live-season") {
    logger.info("No active live season found. Exiting processor.");
    return;
  }

  const seasonData = seasonDoc.data();
  const seasonStartDate = seasonData.schedule.startDate.toDate();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const diffInMillis = yesterday.getTime() - seasonStartDate.getTime();
  const scoredDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;

  if (scoredDay < 1) {
    logger.info(`Scored day (${scoredDay}) is not within the season yet. Exiting.`);
    return;
  }
  
  await processAndScoreLiveSeasonDayLogic(scoredDay, seasonData);
});

exports.generateWeeklyMatchups = onSchedule({
  schedule: "every monday 04:00",
  timeZone: "America/New_York",
}, async () => {
  logger.info("Starting class-based weekly matchup generation...");
  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) {
    logger.error("No active season found. Aborting.");
    return;
  }
  const seasonData = seasonDoc.data();
  const now = new Date();
  const diffInMillis = now.getTime() - seasonData.schedule.startDate.toDate().getTime();
  const currentWeek = Math.ceil((Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1) / 7);

  const leaguesSnapshot = await db.collection("leagues").get();
  if (leaguesSnapshot.empty) return;

  const batch = db.batch();
  const corpsClasses = ["worldClass", "openClass", "aClass", "soundSport"];

  for (const leagueDoc of leaguesSnapshot.docs) {
    const league = leagueDoc.data();
    const members = league.members || [];
    if (members.length < 2) continue;

    const weeklyMatchupData = {
      week: currentWeek,
      seasonUid: seasonData.seasonUid,
    };

    const profilePromises = members.map((uid) => db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`).get());
    const profileDocs = await Promise.all(profilePromises);

    for (const corpsClass of corpsClasses) {
      const eligibleMembers = profileDocs
        .filter((pDoc) => pDoc.exists && pDoc.data().corps && pDoc.data().corps[corpsClass])
        .map((pDoc) => pDoc.ref.parent.parent.id); 

      if (eligibleMembers.length < 2) continue;

      const shuffledMembers = [...eligibleMembers].sort(() => 0.5 - Math.random());
      const matchups = [];
      while (shuffledMembers.length > 1) {
        const p1 = shuffledMembers.pop();
        const p2 = shuffledMembers.pop();
        matchups.push({ pair: [p1, p2], scores: { [p1]: 0, [p2]: 0 }, winner: null });
      }
      if (shuffledMembers.length === 1) {
        const p = shuffledMembers.pop();
        matchups.push({ pair: [p, "BYE"], scores: { [p]: 0 }, winner: p });
      }

      weeklyMatchupData[`${corpsClass}Matchups`] = matchups;
    }

    const matchupDocRef = db.doc(`leagues/${leagueDoc.id}/matchups/week${currentWeek}`);
    batch.set(matchupDocRef, weeklyMatchupData);
    logger.info(`Generated matchups for league ${league.name} for week ${currentWeek}.`);
  }

  await batch.commit();
  logger.info("Weekly matchup generation complete.");
  return null;
});