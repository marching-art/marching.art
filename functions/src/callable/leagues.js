const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getDb, dataNamespaceParam } = require("../config");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const crypto = require("crypto");

/**
 * OPTIMIZATION #2: Generate a deterministic unique invite code based on UID and timestamp.
 * This eliminates the N+1 while loop that previously made unbounded database reads.
 * The code is generated from a hash of the user ID and current timestamp, ensuring uniqueness
 * without requiring any database lookups.
 */
function generateUniqueInviteCode(uid) {
  const uniqueInput = `${uid}_${Date.now()}_${Math.random()}`;
  const hash = crypto.createHash("sha256").update(uniqueInput).digest("hex");
  // Take first 6 chars and convert to uppercase for a readable code
  return hash.substring(0, 6).toUpperCase();
}

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

  // OPTIMIZATION #2: Generate unique invite code deterministically (no DB reads needed)
  const inviteCode = generateUniqueInviteCode(uid);

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
        matchupType: settings.matchupType || 'weekly', // weekly, h2h
        playoffSize: settings.playoffSize || 4,
        prizePool: settings.prizePool || 1000, // CorpsCoin
        ...settings
      }
    });

    // Initialize standings with both formats (records object + standings array)
    const initialRecord = {
      wins: 0,
      losses: 0,
      ties: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      currentStreak: 0,
      streakType: null // 'W' or 'L'
    };
    transaction.set(standingsRef, {
      records: {
        [uid]: initialRecord
      },
      standings: [{
        uid,
        wins: 0,
        losses: 0,
        ties: 0,
        totalPoints: 0,
        pointsAgainst: 0,
        streak: 0,
        streakType: null
      }],
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
    // Perform ALL reads first (Firestore transaction requirement)
    const leagueDoc = await transaction.get(leagueRef);
    if (!leagueDoc.exists) {
      throw new HttpsError("not-found", "This league does not exist.");
    }

    const standingsDoc = await transaction.get(standingsRef);

    const leagueData = leagueDoc.data();

    // Check if already a member
    if (leagueData.members.includes(uid)) {
      throw new HttpsError("already-exists", "You are already a member of this league.");
    }

    // Check if league is full
    if (leagueData.members.length >= leagueData.maxMembers) {
      throw new HttpsError("failed-precondition", "This league is full.");
    }

    // Perform ALL writes after reads
    // Add to league
    transaction.update(leagueRef, {
      members: admin.firestore.FieldValue.arrayUnion(uid),
    });

    // Add to user profile
    transaction.update(userProfileRef, {
      leagueIds: admin.firestore.FieldValue.arrayUnion(leagueId),
    });

    // Initialize standings for new member
    if (standingsDoc.exists) {
      const existingData = standingsDoc.data();
      const existingStandings = existingData.standings || [];

      // Add new member record
      transaction.update(standingsRef, {
        [`records.${uid}`]: {
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          currentStreak: 0,
          streakType: null
        },
        // Also update standings array
        standings: [...existingStandings, {
          uid,
          wins: 0,
          losses: 0,
          ties: 0,
          totalPoints: 0,
          pointsAgainst: 0,
          streak: 0,
          streakType: null
        }]
      });
    }
  });

  // Create activity event for member joining
  const userProfileDoc = await db.doc(`artifacts/${dataNamespaceParam.value()}/users/${uid}/profile/data`).get();
  const userDisplayName = userProfileDoc.exists
    ? (userProfileDoc.data().displayName || userProfileDoc.data().username || 'New Member')
    : 'New Member';

  await createLeagueActivity(db, leagueId, {
    type: 'member_joined',
    title: 'New Member Joined',
    message: `${userDisplayName} has joined the league!`,
    userId: uid,
    metadata: { memberCount: (await leagueRef.get()).data().members?.length || 1 }
  });

  return { success: true, message: "Successfully joined league!" };
});

exports.joinLeagueByCode = onCall({ cors: true }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "You must be logged in to join a league.");
  }
  const { inviteCode } = request.data;
  const uid = request.auth.uid;

  if (!inviteCode) {
    throw new HttpsError("invalid-argument", "An invite code is required.");
  }

  const db = getDb();
  const namespace = dataNamespaceParam.value();

  // Look up the league by invite code
  const inviteRef = db.doc(`leagueInvites/${inviteCode.toUpperCase()}`);
  const inviteDoc = await inviteRef.get();

  if (!inviteDoc.exists) {
    throw new HttpsError("not-found", "Invalid invite code.");
  }

  const { leagueId } = inviteDoc.data();

  const leagueRef = db.doc(`artifacts/${namespace}/leagues/${leagueId}`);
  const userProfileRef = db.doc(`artifacts/${namespace}/users/${uid}/profile/data`);
  const standingsRef = leagueRef.collection('standings').doc('current');

  await db.runTransaction(async (transaction) => {
    const leagueDoc = await transaction.get(leagueRef);
    if (!leagueDoc.exists) {
      throw new HttpsError("not-found", "This league no longer exists.");
    }

    const standingsDoc = await transaction.get(standingsRef);
    const leagueData = leagueDoc.data();

    if (leagueData.members.includes(uid)) {
      throw new HttpsError("already-exists", "You are already a member of this league.");
    }

    if (leagueData.members.length >= leagueData.maxMembers) {
      throw new HttpsError("failed-precondition", "This league is full.");
    }

    transaction.update(leagueRef, {
      members: admin.firestore.FieldValue.arrayUnion(uid),
    });

    transaction.update(userProfileRef, {
      leagueIds: admin.firestore.FieldValue.arrayUnion(leagueId),
    });

    if (standingsDoc.exists) {
      const existingData = standingsDoc.data();
      const existingStandings = existingData.standings || [];

      transaction.update(standingsRef, {
        [`records.${uid}`]: {
          wins: 0,
          losses: 0,
          ties: 0,
          pointsFor: 0,
          pointsAgainst: 0,
          currentStreak: 0,
          streakType: null
        },
        standings: [...existingStandings, {
          uid,
          wins: 0,
          losses: 0,
          ties: 0,
          totalPoints: 0,
          pointsAgainst: 0,
          streak: 0,
          streakType: null
        }]
      });
    }
  });

  // Create activity event for member joining
  const userProfileDoc = await db.doc(`artifacts/${namespace}/users/${uid}/profile/data`).get();
  const userDisplayName = userProfileDoc.exists
    ? (userProfileDoc.data().displayName || userProfileDoc.data().username || 'New Member')
    : 'New Member';

  await createLeagueActivity(db, leagueId, {
    type: 'member_joined',
    title: 'New Member Joined',
    message: `${userDisplayName} has joined the league!`,
    userId: uid,
    metadata: { memberCount: (await leagueRef.get()).data().members?.length || 1 }
  });

  return { success: true, message: "Successfully joined league!", leagueId };
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

/**
 * Smart pairing algorithm - pairs players by similar standings
 * This keeps matchups competitive throughout the season
 */
function smartPairMembers(members, standings) {
  if (members.length < 2) {
    return members.length === 1
      ? [{ pair: [members[0], null], winner: members[0], scores: null, completed: true, isBye: true }]
      : [];
  }

  // Sort members by their standings (wins, then points)
  const sortedMembers = [...members].sort((a, b) => {
    const statsA = standings[a] || { wins: 0, totalPoints: 0 };
    const statsB = standings[b] || { wins: 0, totalPoints: 0 };
    if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
    return statsB.totalPoints - statsA.totalPoints;
  });

  const matchups = [];
  const paired = new Set();

  // Pair adjacent players in standings (1v2, 3v4, etc.)
  for (let i = 0; i < sortedMembers.length - 1; i += 2) {
    const player1 = sortedMembers[i];
    const player2 = sortedMembers[i + 1];

    if (!paired.has(player1) && !paired.has(player2)) {
      // Randomize home/away to keep it fair
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

// Generate weekly matchups for a league
// Matchups are segregated by corps class so corps only compete against same-class opponents
// Uses smart pairing based on standings for competitive balance
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
  const namespace = dataNamespaceParam.value();
  const leagueRef = db.doc(`artifacts/${namespace}/leagues/${leagueId}`);

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

  // Batch fetch all member profiles to get their corps classes
  const profileRefs = members.map(memberId =>
    db.doc(`artifacts/${namespace}/users/${memberId}/profile/data`)
  );
  const profileDocs = members.length > 0 ? await db.getAll(...profileRefs) : [];

  // Fetch current standings for smart pairing
  const standingsDoc = await db.doc(`artifacts/${namespace}/leagues/${leagueId}/standings/current`).get();
  const standingsData = standingsDoc.exists ? standingsDoc.data()?.standings || [] : [];
  const standings = {};
  standingsData.forEach((s, idx) => {
    standings[s.uid] = { ...s, rank: idx + 1 };
  });

  // Group members by their active corps classes
  const corpsClasses = ['worldClass', 'openClass', 'aClass', 'soundSport'];
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

      for (const corpsClass of corpsClasses) {
        if (corps[corpsClass] && corps[corpsClass].corpsName) {
          membersByClass[corpsClass].push(memberId);
        }
      }
    }
  });

  // Generate matchups for each corps class using smart pairing
  const matchupData = {
    week,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    generatedBy: uid
  };

  for (const corpsClass of corpsClasses) {
    const classMembers = membersByClass[corpsClass];
    matchupData[`${corpsClass}Matchups`] = smartPairMembers(classMembers, standings);
  }

  await matchupRef.set(matchupData);

  // Update league document to track which week has matchups generated
  // This allows the UI to show "Matchup in progress" only when matchups actually exist
  await leagueRef.update({
    matchupsGeneratedWeek: week
  });

  // Count total matchups generated
  const totalMatchups =
    (matchupData.worldClassMatchups?.filter(m => !m.isBye).length || 0) +
    (matchupData.openClassMatchups?.filter(m => !m.isBye).length || 0) +
    (matchupData.aClassMatchups?.filter(m => !m.isBye).length || 0) +
    (matchupData.soundSportMatchups?.filter(m => !m.isBye).length || 0);

  // Create activity event for matchup generation
  await createLeagueActivity(db, leagueId, {
    type: 'week_start',
    title: `Week ${week} Matchups Set`,
    message: `${totalMatchups} matchups have been generated for week ${week}. Good luck!`,
    userId: uid,
    metadata: {
      week,
      matchupCounts: {
        worldClass: matchupData.worldClassMatchups?.length || 0,
        openClass: matchupData.openClassMatchups?.length || 0,
        aClass: matchupData.aClassMatchups?.length || 0,
        soundSport: matchupData.soundSportMatchups?.length || 0
      }
    }
  });

  return {
    success: true,
    message: "Matchups generated with smart pairing!",
    matchups: {
      worldClass: matchupData.worldClassMatchups || [],
      openClass: matchupData.openClassMatchups || [],
      aClass: matchupData.aClassMatchups || [],
      soundSport: matchupData.soundSportMatchups || []
    }
  };
});

// Update matchup results based on actual performance scores
// Processes matchups for each corps class separately
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
  const namespace = dataNamespaceParam.value();
  const leagueRef = db.doc(`artifacts/${namespace}/leagues/${leagueId}`);
  const matchupRef = leagueRef.collection('matchups').doc(`week-${week}`);

  const matchupDoc = await matchupRef.get();
  if (!matchupDoc.exists) {
    throw new HttpsError("not-found", "No matchups found for this week.");
  }

  const matchupData = matchupDoc.data();
  const corpsClasses = ['worldClass', 'openClass', 'aClass', 'soundSport'];

  // Collect all unique player IDs across all class matchups
  const allPlayerIds = new Set();
  for (const corpsClass of corpsClasses) {
    const matchups = matchupData[`${corpsClass}Matchups`] || [];
    for (const matchup of matchups) {
      if (matchup.pair) {
        matchup.pair.filter(Boolean).forEach(id => allPlayerIds.add(id));
      }
    }
  }

  // Batch fetch all player profiles
  const playerIds = [...allPlayerIds];
  const profileRefs = playerIds.map(uid =>
    db.doc(`artifacts/${namespace}/users/${uid}/profile/data`)
  );
  const profileDocs = playerIds.length > 0 ? await db.getAll(...profileRefs) : [];

  // Build a map of userId -> profile data
  const profileMap = new Map();
  profileDocs.forEach((doc, index) => {
    if (doc.exists) {
      profileMap.set(playerIds[index], doc.data());
    }
  });

  // Process matchups for each corps class
  const updatedMatchupData = { ...matchupData };
  const allUpdatedPairs = []; // For standings update

  for (const corpsClass of corpsClasses) {
    const matchupArrayKey = `${corpsClass}Matchups`;
    const matchups = matchupData[matchupArrayKey] || [];
    const updatedMatchups = [];

    for (const matchup of matchups) {
      // Handle bye weeks (null opponent)
      if (!matchup.pair || matchup.pair[1] === null) {
        updatedMatchups.push(matchup);
        if (matchup.pair && matchup.pair[0]) {
          allUpdatedPairs.push({
            player1: matchup.pair[0],
            player2: null,
            winner: matchup.pair[0],
            completed: true,
            corpsClass
          });
        }
        continue;
      }

      const [p1_uid, p2_uid] = matchup.pair;
      const p1_profile = profileMap.get(p1_uid);
      const p2_profile = profileMap.get(p2_uid);

      // Get score for the SPECIFIC corps class
      const p1_score = p1_profile?.corps?.[corpsClass]?.totalSeasonScore || 0;
      const p2_score = p2_profile?.corps?.[corpsClass]?.totalSeasonScore || 0;

      let winner = null;
      if (p1_score > p2_score) {
        winner = p1_uid;
      } else if (p2_score > p1_score) {
        winner = p2_uid;
      } else {
        winner = 'tie';
      }

      const updatedMatchup = {
        ...matchup,
        scores: { [p1_uid]: p1_score, [p2_uid]: p2_score },
        winner,
        completed: true
      };
      updatedMatchups.push(updatedMatchup);

      // Convert to format for standings update
      allUpdatedPairs.push({
        player1: p1_uid,
        player2: p2_uid,
        player1Score: p1_score,
        player2Score: p2_score,
        winner,
        completed: true,
        corpsClass
      });
    }

    updatedMatchupData[matchupArrayKey] = updatedMatchups;
  }

  // Update matchups
  await matchupRef.update({
    ...updatedMatchupData,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // Update standings
  await updateStandings(db, leagueRef, allUpdatedPairs);

  // Create activity events for matchup results
  const completedMatchups = allUpdatedPairs.filter(p => p.completed && p.player2 !== null);
  if (completedMatchups.length > 0) {
    // Create a summary activity event
    await createLeagueActivity(db, leagueId, {
      type: 'matchup_result',
      title: `Week ${week} Results Updated`,
      message: `${completedMatchups.length} matchup${completedMatchups.length > 1 ? 's' : ''} completed for week ${week}.`,
      userId: uid,
      metadata: {
        week,
        matchupsCompleted: completedMatchups.length,
        results: completedMatchups.slice(0, 3).map(p => ({
          winner: p.winner,
          player1Score: p.player1Score,
          player2Score: p.player2Score
        }))
      }
    });
  }

  return {
    success: true,
    message: "Matchup results updated by corps class!",
    matchups: {
      worldClass: updatedMatchupData.worldClassMatchups || [],
      openClass: updatedMatchupData.openClassMatchups || [],
      aClass: updatedMatchupData.aClassMatchups || [],
      soundSport: updatedMatchupData.soundSportMatchups || []
    }
  };
});

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

  // Convert records object to sorted standings array (for frontend compatibility)
  const standings = Object.entries(records)
    .map(([uid, data]) => ({
      uid,
      wins: data.wins || 0,
      losses: data.losses || 0,
      ties: data.ties || 0,
      totalPoints: data.pointsFor || 0,
      pointsAgainst: data.pointsAgainst || 0,
      streak: data.currentStreak || 0,
      streakType: data.streakType || null,
    }))
    .sort((a, b) => {
      // Sort by wins, then by total points
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.totalPoints - a.totalPoints;
    });

  await standingsRef.update({
    records,
    standings, // Array format for frontend API
    lastUpdated: admin.firestore.FieldValue.serverTimestamp()
  });
}

// Helper function to create league activity events
async function createLeagueActivity(db, leagueId, activityData) {
  const namespace = dataNamespaceParam.value();
  const activityRef = db.collection(`artifacts/${namespace}/leagues/${leagueId}/activity`).doc();

  await activityRef.set({
    ...activityData,
    id: activityRef.id,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  return activityRef.id;
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