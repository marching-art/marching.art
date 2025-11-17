const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, dataNamespaceParam } = require("../config");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");

exports.createLeague = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to create a league.");
  }
  const {
    name,
    description = '',
    isPublic = true,
    maxMembers = 20,
    settings = {}
  } = request.data;
  const uid = request.auth.uid;

  if (!name || name.trim().length < 3) {
    throw new HttpsError("invalid-argument", "League name must be at least 3 characters long.");
  }

  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) throw new HttpsError("not-found", "No active season.");
  const { seasonUid, currentWeek = 1 } = seasonDoc.data();

  // Generate unique invite code
  let inviteCode;
  let codeExists = true;
  while (codeExists) {
    inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const inviteDoc = await db.doc(`leagueInvites/${inviteCode}`).get();
    codeExists = inviteDoc.exists;
  }

  const leagueRef = db.collection(`artifacts/${dataNamespaceParam.value()}/leagues`).doc();
  const inviteRef = db.doc(`leagueInvites/${inviteCode}`);
  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
  const standingsRef = leagueRef.collection('standings').doc('current');

  await db.runTransaction(async (transaction) => {
    // Create league
    transaction.set(leagueRef, {
      name: name.trim(),
      description: description.trim(),
      creatorId: uid,
      seasonId: seasonUid,
      members: [uid],
      inviteCode,
      isPublic,
      maxMembers,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      settings: {
        enableStaffTrading: settings.enableStaffTrading !== false,
        matchupType: settings.matchupType || 'weekly', // weekly, h2h
        playoffSize: settings.playoffSize || 4,
        prizePool: settings.prizePool || 1000, // CorpsCoin
        ...settings
      }
    });

    // Initialize standings
    transaction.set(standingsRef, {
      records: {
        [uid]: {
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          currentStreak: 0,
          streakType: null // 'W' or 'L'
        }
      },
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    // Create invite code
    transaction.set(inviteRef, { leagueId: leagueRef.id });

    // Add to user profile
    transaction.update(userProfileRef, {
      leagueIds: admin.firestore.FieldValue.arrayUnion(leagueRef.id),
    });
  });

  return {
    success: true,
    message: "League created!",
    inviteCode,
    leagueId: leagueRef.id
  };
});

exports.joinLeague = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to join a league.");
  }
  const { leagueId } = request.data;
  const uid = request.auth.uid;

  if (!leagueId) throw new HttpsError("invalid-argument", "A league ID is required.");

  const db = getDb();
  const leagueRef = db.doc(`artifacts/${dataNamespaceParam.value()}/leagues/${leagueId}`);
  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);
  const standingsRef = leagueRef.collection('standings').doc('current');

  await db.runTransaction(async (transaction) => {
    const leagueDoc = await transaction.get(leagueRef);
    if (!leagueDoc.exists) {
      throw new HttpsError("not-found", "This league does not exist.");
    }

    const leagueData = leagueDoc.data();

    // Check if already a member
    if (leagueData.members.includes(uid)) {
      throw new HttpsError("already-exists", "You are already a member of this league.");
    }

    // Check if league is full
    if (leagueData.members.length >= leagueData.maxMembers) {
      throw new HttpsError("failed-precondition", "This league is full.");
    }

    // Add to league
    transaction.update(leagueRef, {
      members: admin.firestore.FieldValue.arrayUnion(uid),
    });

    // Add to user profile
    transaction.update(userProfileRef, {
      leagueIds: admin.firestore.FieldValue.arrayUnion(leagueId),
    });

    // Initialize standings for new member
    const standingsDoc = await transaction.get(standingsRef);
    if (standingsDoc.exists) {
      transaction.update(standingsRef, {
        [`records.${uid}`]: {
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          currentStreak: 0,
          streakType: null
        }
      });
    }
  });

  return { success: true, message: "Successfully joined league!" };
});

exports.leaveLeague = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to leave a league.");
  }
  const { leagueId } = request.data;
  const uid = request.auth.uid;

  if (!leagueId) {
    throw new HttpsError("invalid-argument", "A league ID is required.");
  }

  const db = getDb();
  const leagueRef = db.doc(`artifacts/${dataNamespaceParam.value()}/leagues/${leagueId}`);
  const userProfileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`);

  try {
    await db.runTransaction(async (transaction) => {
      const leagueDoc = await transaction.get(leagueRef);
      if (!leagueDoc.exists) {
        throw new HttpsError("not-found", "This league does not exist.");
      }

      const leagueData = leagueDoc.data();

      if (leagueData.creatorId === uid && leagueData.members.length === 1) {
        logger.info(`Creator ${uid} is the last member of league ${leagueId}. Deleting league.`);
        transaction.delete(leagueRef);
        if (leagueData.inviteCode) {
          const inviteRef = db.doc(`leagueInvites/${leagueData.inviteCode}`);
          transaction.delete(inviteRef);
        }
      } else {
        transaction.update(leagueRef, {
          members: admin.firestore.FieldValue.arrayRemove(uid),
        });
      }

      transaction.update(userProfileRef, {
        leagueIds: admin.firestore.FieldValue.arrayRemove(leagueId),
      });
    });

    return { success: true, message: "Successfully left the league." };
  } catch (error) {
    logger.error(`Failed to leave league ${leagueId} for user ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while leaving the league.");
  }
});

// Generate weekly matchups for a league
exports.generateMatchups = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { leagueId, week } = request.data;
  const uid = request.auth.uid;

  if (!leagueId || !week) {
    throw new HttpsError("invalid-argument", "League ID and week are required.");
  }

  const db = getDb();
  const leagueRef = db.doc(`artifacts/${dataNamespaceParam.value()}/leagues/${leagueId}`);

  const leagueDoc = await leagueRef.get();
  if (!leagueDoc.exists) {
    throw new HttpsError("not-found", "League not found.");
  }

  const leagueData = leagueDoc.data();

  // Only commissioner can generate matchups
  if (leagueData.creatorId !== uid) {
    throw new HttpsError("permission-denied", "Only the commissioner can generate matchups.");
  }

  const members = leagueData.members || [];
  const matchupRef = leagueRef.collection('matchups').doc(`week-${week}`);

  // Check if matchups already exist
  const existingMatchup = await matchupRef.get();
  if (existingMatchup.exists) {
    throw new HttpsError("already-exists", "Matchups for this week already exist.");
  }

  // Generate random pairings
  const shuffled = [...members].sort(() => Math.random() - 0.5);
  const pairs = [];

  for (let i = 0; i < shuffled.length; i += 2) {
    if (i + 1 < shuffled.length) {
      pairs.push({
        player1: shuffled[i],
        player2: shuffled[i + 1],
        winner: null,
        player1Score: null,
        player2Score: null,
        completed: false
      });
    } else {
      // Odd number of players - this player gets a bye
      pairs.push({
        player1: shuffled[i],
        player2: null, // Bye week
        winner: shuffled[i],
        player1Score: null,
        player2Score: null,
        completed: true
      });
    }
  }

  await matchupRef.set({
    week,
    pairs,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    results: null
  });

  return { success: true, message: "Matchups generated!", pairs };
});

// Update matchup results based on actual performance scores
exports.updateMatchupResults = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { leagueId, week } = request.data;
  const uid = request.auth.uid;

  if (!leagueId || !week) {
    throw new HttpsError("invalid-argument", "League ID and week are required.");
  }

  const db = getDb();
  const leagueRef = db.doc(`artifacts/${dataNamespaceParam.value()}/leagues/${leagueId}`);
  const matchupRef = leagueRef.collection('matchups').doc(`week-${week}`);
  const standingsRef = leagueRef.collection('standings').doc('current');

  const matchupDoc = await matchupRef.get();
  if (!matchupDoc.exists) {
    throw new HttpsError("not-found", "No matchups found for this week.");
  }

  const matchupData = matchupDoc.data();
  const pairs = matchupData.pairs;

  // Fetch scores for all players in this week
  const updatedPairs = await Promise.all(pairs.map(async (pair) => {
    if (pair.player2 === null) {
      // Bye week - already handled
      return pair;
    }

    // Get player scores from their corps performances this week
    const player1Score = await getPlayerWeekScore(db, pair.player1, week);
    const player2Score = await getPlayerWeekScore(db, pair.player2, week);

    let winner = null;
    if (player1Score !== null && player2Score !== null) {
      if (player1Score > player2Score) {
        winner = pair.player1;
      } else if (player2Score > player1Score) {
        winner = pair.player2;
      } else {
        winner = 'tie';
      }
    }

    return {
      ...pair,
      player1Score,
      player2Score,
      winner,
      completed: winner !== null
    };
  }));

  // Update matchups
  await matchupRef.update({
    pairs: updatedPairs,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Update standings
  await updateStandings(db, leagueRef, updatedPairs);

  return { success: true, message: "Matchup results updated!", pairs: updatedPairs };
});

// Helper function to get a player's score for a specific week
async function getPlayerWeekScore(db, userId, week) {
  try {
    // Get user's active corps class
    const profileRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${userId}/profile/data`);
    const profileDoc = await profileRef.get();

    if (!profileDoc.exists) return null;

    const profileData = profileDoc.data();
    const activeCorpsClass = profileData.activeCorpsClass || 'world';

    // Get the corps document
    const corpsRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${userId}/corps/${activeCorpsClass}`);
    const corpsDoc = await corpsRef.get();

    if (!corpsDoc.exists) return null;

    const corpsData = corpsDoc.data();

    // Check if they have a score for this week
    const weeklyScores = corpsData.weeklyScores || {};
    return weeklyScores[`week${week}`] || null;
  } catch (error) {
    logger.error(`Error getting score for user ${userId}, week ${week}:`, error);
    return null;
  }
}

// Helper function to update league standings
async function updateStandings(db, leagueRef, pairs) {
  const standingsRef = leagueRef.collection('standings').doc('current');
  const standingsDoc = await standingsRef.get();

  if (!standingsDoc.exists) return;

  const records = { ...standingsDoc.data().records };

  pairs.forEach(pair => {
    if (!pair.completed || pair.winner === null) return;

    if (pair.player2 === null) {
      // Bye week - count as a win
      if (records[pair.player1]) {
        records[pair.player1].wins += 1;
        records[pair.player1].currentStreak = records[pair.player1].streakType === 'W'
          ? records[pair.player1].currentStreak + 1
          : 1;
        records[pair.player1].streakType = 'W';
      }
    } else if (pair.winner === 'tie') {
      // Tie
      if (records[pair.player1]) {
        records[pair.player1].ties += 1;
        records[pair.player1].pointsFor += pair.player1Score || 0;
        records[pair.player1].pointsAgainst += pair.player2Score || 0;
        records[pair.player1].currentStreak = 0;
        records[pair.player1].streakType = null;
      }
      if (records[pair.player2]) {
        records[pair.player2].ties += 1;
        records[pair.player2].pointsFor += pair.player2Score || 0;
        records[pair.player2].pointsAgainst += pair.player1Score || 0;
        records[pair.player2].currentStreak = 0;
        records[pair.player2].streakType = null;
      }
    } else {
      // One player won
      const loser = pair.winner === pair.player1 ? pair.player2 : pair.player1;

      if (records[pair.winner]) {
        records[pair.winner].wins += 1;
        records[pair.winner].pointsFor += (pair.winner === pair.player1 ? pair.player1Score : pair.player2Score) || 0;
        records[pair.winner].pointsAgainst += (pair.winner === pair.player1 ? pair.player2Score : pair.player1Score) || 0;
        records[pair.winner].currentStreak = records[pair.winner].streakType === 'W'
          ? records[pair.winner].currentStreak + 1
          : 1;
        records[pair.winner].streakType = 'W';
      }

      if (records[loser]) {
        records[loser].losses += 1;
        records[loser].pointsFor += (loser === pair.player1 ? pair.player1Score : pair.player2Score) || 0;
        records[loser].pointsAgainst += (loser === pair.player1 ? pair.player1Score : pair.player2Score) || 0;
        records[loser].currentStreak = records[loser].streakType === 'L'
          ? records[loser].currentStreak + 1
          : 1;
        records[loser].streakType = 'L';
      }
    }
  });

  await standingsRef.update({
    records,
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });
}

// Propose a staff trade
exports.proposeStaffTrade = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { leagueId, toUserId, offeredStaffIds, requestedStaffIds } = request.data;
  const uid = request.auth.uid;

  if (!leagueId || !toUserId || !offeredStaffIds || !requestedStaffIds) {
    throw new HttpsError("invalid-argument", "Missing required parameters.");
  }

  const db = getDb();
  const leagueRef = db.doc(`artifacts/${dataNamespaceParam.value()}/leagues/${leagueId}`);
  const tradeRef = leagueRef.collection('trades').doc();

  // Verify both users are in the league
  const leagueDoc = await leagueRef.get();
  if (!leagueDoc.exists) {
    throw new HttpsError("not-found", "League not found.");
  }

  const leagueData = leagueDoc.data();
  if (!leagueData.members.includes(uid) || !leagueData.members.includes(toUserId)) {
    throw new HttpsError("permission-denied", "Both users must be league members.");
  }

  if (!leagueData.settings?.enableStaffTrading) {
    throw new HttpsError("failed-precondition", "Staff trading is disabled in this league.");
  }

  await tradeRef.set({
    fromUserId: uid,
    toUserId,
    offeredStaffIds,
    requestedStaffIds,
    status: 'pending', // pending, accepted, rejected, cancelled
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)) // 7 days
  });

  return { success: true, message: "Trade proposed!", tradeId: tradeRef.id };
});

// Accept or reject a staff trade
exports.respondToStaffTrade = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { leagueId, tradeId, accept } = request.data;
  const uid = request.auth.uid;

  if (!leagueId || !tradeId || accept === undefined) {
    throw new HttpsError("invalid-argument", "Missing required parameters.");
  }

  const db = getDb();
  const leagueRef = db.doc(`artifacts/${dataNamespaceParam.value()}/leagues/${leagueId}`);
  const tradeRef = leagueRef.collection('trades').doc(tradeId);

  const tradeDoc = await tradeRef.get();
  if (!tradeDoc.exists) {
    throw new HttpsError("not-found", "Trade not found.");
  }

  const tradeData = tradeDoc.data();

  // Verify user is the recipient
  if (tradeData.toUserId !== uid) {
    throw new HttpsError("permission-denied", "Only the recipient can respond to this trade.");
  }

  // Check if trade is still pending
  if (tradeData.status !== 'pending') {
    throw new HttpsError("failed-precondition", "This trade has already been processed.");
  }

  if (accept) {
    // Execute the trade
    await executeTrade(db, tradeData);
    await tradeRef.update({
      status: 'accepted',
      acceptedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: "Trade accepted and executed!" };
  } else {
    await tradeRef.update({
      status: 'rejected',
      rejectedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true, message: "Trade rejected." };
  }
});

// Helper function to execute a staff trade
async function executeTrade(db, tradeData) {
  const { fromUserId, toUserId, offeredStaffIds, requestedStaffIds } = tradeData;

  // Get both users' staff rosters
  const fromStaffRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${fromUserId}/staff/roster`);
  const toStaffRef = db.doc(`artifacts/${dataNamespaceParam.value()}/users/${toUserId}/staff/roster`);

  await db.runTransaction(async (transaction) => {
    const fromStaffDoc = await transaction.get(fromStaffRef);
    const toStaffDoc = await transaction.get(toStaffRef);

    if (!fromStaffDoc.exists || !toStaffDoc.exists) {
      throw new HttpsError("not-found", "Staff roster not found.");
    }

    const fromStaff = fromStaffDoc.data().members || [];
    const toStaff = toStaffDoc.data().members || [];

    // Remove offered staff from fromUser, add requested staff
    const fromUpdated = fromStaff
      .filter(s => !offeredStaffIds.includes(s.id))
      .concat(toStaff.filter(s => requestedStaffIds.includes(s.id)));

    // Remove requested staff from toUser, add offered staff
    const toUpdated = toStaff
      .filter(s => !requestedStaffIds.includes(s.id))
      .concat(fromStaff.filter(s => offeredStaffIds.includes(s.id)));

    transaction.update(fromStaffRef, { members: fromUpdated });
    transaction.update(toStaffRef, { members: toUpdated });
  });
}

// Post a message to league chat
exports.postLeagueMessage = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Authentication required.");
  }

  const { leagueId, message } = request.data;
  const uid = request.auth.uid;

  if (!leagueId || !message || !message.trim()) {
    throw new HttpsError("invalid-argument", "League ID and message are required.");
  }

  const db = getDb();
  const leagueRef = db.doc(`artifacts/${dataNamespaceParam.value()}/leagues/${leagueId}`);

  // Verify user is a member
  const leagueDoc = await leagueRef.get();
  if (!leagueDoc.exists) {
    throw new HttpsError("not-found", "League not found.");
  }

  const leagueData = leagueDoc.data();
  if (!leagueData.members.includes(uid)) {
    throw new HttpsError("permission-denied", "You must be a league member to post.");
  }

  const messageRef = leagueRef.collection('chat').doc();
  await messageRef.set({
    userId: uid,
    message: message.trim(),
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, message: "Message posted!", messageId: messageRef.id };
});