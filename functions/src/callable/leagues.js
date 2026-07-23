const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { getDb } = require("../config");
const admin = require("firebase-admin");
const { logger } = require("firebase-functions/v2");
const { generateUniqueInviteCode, smartPairMembers, createLeagueActivity } = require("../helpers/leagueHelpers");
const { applyStandingsInTransaction } = require("../helpers/leagueStandings");
const { assertAuth, hasAdminClaim } = require("../helpers/callableGuards");
const { chargeEntryFeeInTransaction, MAX_LEAGUE_ENTRY_FEE } = require("../helpers/leagueEconomy");
const { addCoinHistoryEntryToTransaction, TRANSACTION_TYPES } = require("../helpers/economy");
const { MATCHUP_CLASSES } = require("../helpers/classRegistry");

exports.createLeague = onCall({ cors: true }, async (request) => {
  assertAuth(request);
  const {
    name,
    description = '',
    isPublic = true,
    maxMembers = 20,
    settings = {}
  } = request.data;
  const uid = request.auth.uid;

  if (typeof name !== 'string' || name.trim().length < 3) {
    throw new HttpsError("invalid-argument", "League name must be at least 3 characters long.");
  }
  if (name.trim().length > 50) {
    throw new HttpsError("invalid-argument", "League name must be 50 characters or fewer.");
  }

  if (typeof description !== 'string' || description.length > 500) {
    throw new HttpsError("invalid-argument", "League description must be text of 500 characters or fewer.");
  }

  if (!Number.isInteger(maxMembers) || maxMembers < 2 || maxMembers > 50) {
    throw new HttpsError("invalid-argument", "Max members must be a whole number between 2 and 50.");
  }

  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) {
    throw new HttpsError("invalid-argument", "League settings must be an object.");
  }

  // Commissioner-set entry fee: validated here, charged to every joiner
  // (including the creator, below) and paid into the prize pool.
  const entryFee = Number(settings.entryFee) || 0;
  if (!Number.isInteger(entryFee) || entryFee < 0 || entryFee > MAX_LEAGUE_ENTRY_FEE) {
    throw new HttpsError(
      "invalid-argument",
      `Entry fee must be a whole number between 0 and ${MAX_LEAGUE_ENTRY_FEE.toLocaleString()} CC.`
    );
  }

  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) throw new HttpsError("not-found", "No active season.");
  const { seasonUid } = seasonDoc.data();

  // OPTIMIZATION #2: Generate unique invite code deterministically (no DB reads needed)
  const inviteCode = generateUniqueInviteCode(uid);

  const leagueRef = db.collection(paths.leagues()).doc();
  const inviteRef = db.doc(`leagueInvites/${inviteCode}`);
  const userProfileRef = db.doc(paths.userProfile(uid));
  const standingsRef = leagueRef.collection('standings').doc('current');

  await db.runTransaction(async (transaction) => {
    // Creator pays the entry fee too — same terms as every member
    let creatorBalance = null;
    if (entryFee > 0) {
      const creatorProfileDoc = await transaction.get(userProfileRef);
      if (!creatorProfileDoc.exists) {
        throw new HttpsError("not-found", "User profile not found.");
      }
      creatorBalance = creatorProfileDoc.data().corpsCoin || 0;
      if (creatorBalance < entryFee) {
        throw new HttpsError(
          "failed-precondition",
          `You need ${entryFee.toLocaleString()} CC to cover your own entry fee.`
        );
      }
    }

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
        // Whitelisted keys only — never spread arbitrary client-supplied
        // settings into the stored doc.
        matchupType: settings.matchupType || 'weekly', // weekly, h2h
        playoffSize: settings.playoffSize || 4,
        scoringFormat: settings.scoringFormat || 'circuit',
        finalsSize: settings.finalsSize || 12,
        // Applied last so client values can't override the validated fee
        // or the pool. The prize pool is PURE ESCROW: it holds only entry
        // fees actually debited from members (creator's fee here, joiners'
        // via helpers/leagueEconomy.js) and is paid out + zeroed at season
        // archival. It must never seed from a client value — the payout
        // mints whatever this field says, so a client-supplied prizePool
        // would be free CorpsCoin printed for the league champion.
        entryFee,
        prizePool: entryFee,
      }
    });

    if (entryFee > 0) {
      transaction.update(userProfileRef, {
        corpsCoin: admin.firestore.FieldValue.increment(-entryFee),
      });
      addCoinHistoryEntryToTransaction(transaction, db, uid, {
        type: TRANSACTION_TYPES.LEAGUE_ENTRY,
        amount: -entryFee,
        balance: creatorBalance - entryFee,
        description: `Entry fee for ${name.trim()}`,
        leagueId: leagueRef.id,
      });
    }

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
  assertAuth(request);
  const { leagueId } = request.data;
  const uid = request.auth.uid;

  if (!leagueId) throw new HttpsError("invalid-argument", "A league ID is required.");

  const db = getDb();
  const leagueRef = db.doc(paths.league(leagueId));
  const userProfileRef = db.doc(paths.userProfile(uid));
  const standingsRef = leagueRef.collection('standings').doc('current');

  await db.runTransaction(async (transaction) => {
    // Perform ALL reads first (Firestore transaction requirement)
    const leagueDoc = await transaction.get(leagueRef);
    if (!leagueDoc.exists) {
      throw new HttpsError("not-found", "This league does not exist.");
    }

    const standingsDoc = await transaction.get(standingsRef);
    const profileDoc = await transaction.get(userProfileRef);

    const leagueData = leagueDoc.data();

    // Check if already a member
    if (leagueData.members.includes(uid)) {
      throw new HttpsError("already-exists", "You are already a member of this league.");
    }

    // Check if league is full
    if (leagueData.members.length >= leagueData.maxMembers) {
      throw new HttpsError("failed-precondition", "This league is full.");
    }

    // Commissioner-set entry fee (if any) goes into the prize pool
    const entryFee = chargeEntryFeeInTransaction(transaction, db, uid, profileDoc, leagueRef, leagueData);

    // Perform ALL writes after reads
    // Add to league
    transaction.update(leagueRef, {
      members: admin.firestore.FieldValue.arrayUnion(uid),
    });

    // Add to user profile
    transaction.update(userProfileRef, {
      leagueIds: admin.firestore.FieldValue.arrayUnion(leagueId),
      ...(entryFee > 0 ? { corpsCoin: admin.firestore.FieldValue.increment(-entryFee) } : {}),
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
  const userProfileDoc = await db.doc(paths.userProfile(uid)).get();
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
  assertAuth(request);
  const { inviteCode } = request.data;
  const uid = request.auth.uid;

  if (!inviteCode) {
    throw new HttpsError("invalid-argument", "An invite code is required.");
  }

  const db = getDb();

  // Look up the league by invite code
  const inviteRef = db.doc(`leagueInvites/${inviteCode.toUpperCase()}`);
  const inviteDoc = await inviteRef.get();

  if (!inviteDoc.exists) {
    throw new HttpsError("not-found", "Invalid invite code.");
  }

  const { leagueId } = inviteDoc.data();

  const leagueRef = db.doc(paths.league(leagueId));
  const userProfileRef = db.doc(paths.userProfile(uid));
  const standingsRef = leagueRef.collection('standings').doc('current');

  await db.runTransaction(async (transaction) => {
    const leagueDoc = await transaction.get(leagueRef);
    if (!leagueDoc.exists) {
      throw new HttpsError("not-found", "This league no longer exists.");
    }

    const standingsDoc = await transaction.get(standingsRef);
    const profileDoc = await transaction.get(userProfileRef);
    const leagueData = leagueDoc.data();

    if (leagueData.members.includes(uid)) {
      throw new HttpsError("already-exists", "You are already a member of this league.");
    }

    if (leagueData.members.length >= leagueData.maxMembers) {
      throw new HttpsError("failed-precondition", "This league is full.");
    }

    // Commissioner-set entry fee (if any) goes into the prize pool
    const entryFee = chargeEntryFeeInTransaction(transaction, db, uid, profileDoc, leagueRef, leagueData);

    transaction.update(leagueRef, {
      members: admin.firestore.FieldValue.arrayUnion(uid),
    });

    transaction.update(userProfileRef, {
      leagueIds: admin.firestore.FieldValue.arrayUnion(leagueId),
      ...(entryFee > 0 ? { corpsCoin: admin.firestore.FieldValue.increment(-entryFee) } : {}),
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
  const userProfileDoc = await db.doc(paths.userProfile(uid)).get();
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
  assertAuth(request);
  const { leagueId } = request.data;
  const uid = request.auth.uid;

  if (!leagueId) {
    throw new HttpsError("invalid-argument", "A league ID is required.");
  }

  const db = getDb();
  const leagueRef = db.doc(paths.league(leagueId));
  const userProfileRef = db.doc(paths.userProfile(uid));

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
// Matchups are segregated by corps class so corps only compete against same-class opponents
// Uses smart pairing based on standings for competitive balance
exports.generateMatchups = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { leagueId, week } = request.data;
  const uid = request.auth.uid;

  if (!leagueId || !week) {
    throw new HttpsError("invalid-argument", "League ID and week are required.");
  }

  const db = getDb();
  const leagueRef = db.doc(paths.league(leagueId));

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
    db.doc(paths.userProfile(memberId))
  );
  const profileDocs = members.length > 0 ? await db.getAll(...profileRefs) : [];

  // Fetch current standings for smart pairing
  const standingsDoc = await db.doc(paths.leagueStandings(leagueId)).get();
  const standingsData = standingsDoc.exists ? standingsDoc.data()?.standings || [] : [];
  const standings = {};
  standingsData.forEach((s, idx) => {
    standings[s.uid] = { ...s, rank: idx + 1 };
  });

  // Group members by their active corps classes. Registry-derived (Phase
  // 7.4) so Podium corps join league matchups automatically at launch.
  const corpsClasses = MATCHUP_CLASSES;
  const membersByClass = Object.fromEntries(corpsClasses.map((c) => [c, []]));

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

  // Count total matchups generated (across every matchup class)
  const totalMatchups = corpsClasses.reduce(
    (sum, corpsClass) =>
      sum + (matchupData[`${corpsClass}Matchups`]?.filter(m => !m.isBye).length || 0),
    0
  );

  // Create activity event for matchup generation
  await createLeagueActivity(db, leagueId, {
    type: 'week_start',
    title: `Week ${week} Matchups Set`,
    message: `${totalMatchups} matchups have been generated for week ${week}. Good luck!`,
    userId: uid,
    metadata: {
      week,
      matchupCounts: Object.fromEntries(
        corpsClasses.map(corpsClass => [
          corpsClass,
          matchupData[`${corpsClass}Matchups`]?.length || 0
        ])
      )
    }
  });

  return {
    success: true,
    message: "Matchups generated with smart pairing!",
    matchups: Object.fromEntries(
      corpsClasses.map(corpsClass => [corpsClass, matchupData[`${corpsClass}Matchups`] || []])
    )
  };
});

// Update matchup results based on actual performance scores
// Processes matchups for each corps class separately
exports.updateMatchupResults = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { leagueId, week } = request.data;
  const uid = request.auth.uid;

  if (!leagueId || !week) {
    throw new HttpsError("invalid-argument", "League ID and week are required.");
  }

  const db = getDb();
  const leagueRef = db.doc(paths.league(leagueId));
  const matchupRef = leagueRef.collection('matchups').doc(`week-${week}`);
  const standingsRef = leagueRef.collection('standings').doc('current');

  // Commissioner-only, like generateWeeklyMatchups: this call freezes the
  // week (completed matchups never re-resolve) and folds it into standings.
  // It used to be open to ANY signed-in user for ANY league, letting a
  // stranger lock in mid-week partial scores for leagues they weren't in.
  const leagueDoc = await leagueRef.get();
  if (!leagueDoc.exists) {
    throw new HttpsError("not-found", "League not found.");
  }
  if (leagueDoc.data().creatorId !== uid && !hasAdminClaim(request)) {
    throw new HttpsError("permission-denied", "Only the commissioner can update matchup results.");
  }

  const corpsClasses = ['worldClass', 'openClass', 'aClass', 'soundSport'];

  // Resolve the week and fold standings in ONE transaction. The old flow
  // (plain read → plain matchup update → get-then-update standings) let two
  // concurrent calls — or a call racing the nightly weekly resolution — both
  // observe completed:false and fold the same pairs into standings twice,
  // permanently corrupting W/L records and streaks (which feed matchup
  // pairing and season-finish payouts).
  const { updatedMatchupData, allUpdatedPairs } = await db.runTransaction(async (t) => {
    const matchupDoc = await t.get(matchupRef);
    if (!matchupDoc.exists) {
      throw new HttpsError("not-found", "No matchups found for this week.");
    }

    const matchupData = matchupDoc.data();

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

    // Batch fetch all player profiles through the transaction (all reads
    // must precede writes)
    const playerIds = [...allPlayerIds];
    const profileRefs = playerIds.map(playerUid => db.doc(paths.userProfile(playerUid)));
    const profileDocs = playerIds.length > 0 ? await t.getAll(...profileRefs) : [];
    const standingsDoc = await t.get(standingsRef);

    // Build a map of userId -> profile data
    const profileMap = new Map();
    profileDocs.forEach((doc, index) => {
      if (doc.exists) {
        profileMap.set(playerIds[index], doc.data());
      }
    });

    // Process matchups for each corps class
    const updated = { ...matchupData };
    const resolvedPairs = []; // For standings update

    for (const corpsClass of corpsClasses) {
      const matchupArrayKey = `${corpsClass}Matchups`;
      const matchups = matchupData[matchupArrayKey] || [];
      const updatedMatchups = [];

      for (const matchup of matchups) {
        // Idempotency: a matchup that is already resolved (by the automatic
        // weekly resolution in the nightly scoring run, or by a previous
        // call) must not be re-folded into standings — that double-counts
        // wins. Byes are never folded here at all: the generator creates
        // them already completed, and the guarded nightly weekly resolution
        // is their single standings counting point (see scoringAwards.js) —
        // the old code folded a not-yet-completed bye WITHOUT marking it
        // completed, so every repeat call counted it again.
        if (matchup.completed || !matchup.pair || matchup.pair[1] === null) {
          updatedMatchups.push(matchup);
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
        resolvedPairs.push({
          player1: p1_uid,
          player2: p2_uid,
          player1Score: p1_score,
          player2Score: p2_score,
          winner,
          completed: true,
          corpsClass
        });
      }

      updated[matchupArrayKey] = updatedMatchups;
    }

    t.update(matchupRef, {
      ...updated,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    applyStandingsInTransaction(t, standingsDoc, resolvedPairs);

    return { updatedMatchupData: updated, allUpdatedPairs: resolvedPairs };
  });

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

// Standings updater lives in helpers/leagueStandings.js — shared with the
// automatic weekly resolution in the nightly scoring run.


// Post a message to league chat
exports.postLeagueMessage = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { leagueId, message } = request.data;
  const uid = request.auth.uid;

  if (!leagueId || !message || !message.trim()) {
    throw new HttpsError("invalid-argument", "League ID and message are required.");
  }

  const db = getDb();
  const leagueRef = db.doc(paths.league(leagueId));

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
