const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { checkBirthDate, MIN_AGE_YEARS } = require("../helpers/ageGate");
const { logger } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { getDb } = require("../config");
const { calculateLevel, getLevelTitle } = require("../helpers/xpCalculations");
const { assertAuth, assertAdmin, assertWriteBudget } = require("../helpers/callableGuards");
const { sumSeasonScore } = require("../helpers/seasonRankings");
const { processAllInPages } = require("../helpers/firestorePaging");
const {
  showRegistrationEventKey,
  registrationEntryKey,
  collectPodiumRegistrations,
} = require("../helpers/showRegistrations");
const { homeGeoFor } = require("../helpers/corpsGeo");
const podiumStore = require("../helpers/podium/store");

exports.setUserRole = onCall({ cors: true }, async (request) => {
  assertAdmin(request);

  const { email, makeAdmin } = request.data;
  if (typeof email !== "string" || !email.trim()) {
    throw new HttpsError("invalid-argument", "A valid email is required.");
  }
  logger.info(`Admin ${request.auth.uid} attempting to set role for ${email} to admin: ${makeAdmin}`);

  try {
    const user = await admin.auth().getUserByEmail(email);
    // Merge onto the existing claims — a bare { admin } here would clobber
    // any other custom claims the user carries.
    await admin.auth().setCustomUserClaims(user.uid, {
      ...user.customClaims,
      admin: makeAdmin === true,
    });

    const action = makeAdmin ? "granted" : "revoked";
    return {
      success: true,
      message: `Admin privileges have been ${action} for ${email}. User must re-login to see changes.`,
    };
  } catch (error) {
    logger.error(`Error setting user role for ${email}:`, error);
    if (error.code === "auth/user-not-found") {
      throw new HttpsError("not-found", `User with email ${email} was not found.`);
    }
    throw new HttpsError("internal", "An error occurred while setting the user role.");
  }
});

exports.checkUsername = onCall({ cors: true }, async (request) => {
  // Both callers (onboarding, the username prompt) run signed in, so the
  // existence check is no longer an anonymous, unthrottled oracle over the
  // username → uid map: it needs an account and draws from the shared
  // profile budget (far above the debounced human rate).
  const uid = assertAuth(request);
  await assertWriteBudget(getDb(), uid, "profile", { max: 60, windowMs: 10 * 60 * 1000 });

  const { username } = request.data || {};
  if (typeof username !== "string" || username.length < 3 || username.length > 15) {
    throw new HttpsError("invalid-argument",
      "Username must be between 3 and 15 characters.");
  }
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    throw new HttpsError("invalid-argument",
      "Username can only contain letters, numbers, and underscores.");
  }

  const usernameRef = getDb().doc(`usernames/${username.toLowerCase()}`);
  const usernameDoc = await usernameRef.get();

  if (usernameDoc.exists) {
    throw new HttpsError("already-exists", "This username is already taken.");
  }

  return { success: true, message: "Username is available." };
});

exports.createUserProfile = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);

  // Abuse throttle (shared profile bucket) — far above any human rate.
  await assertWriteBudget(getDb(), uid, "profile", { max: 60, windowMs: 10 * 60 * 1000 });

  const { username, displayName, birthDate } = request.data;
  const { email } = request.auth.token;

  if (!username) {
    throw new HttpsError("invalid-argument", "Username is required for profile creation.");
  }
  // Age screening (helpers/ageGate): the sign-up form collects a date of
  // birth and validates it client-side; this is the authoritative check and
  // the record. Optional so older clients / retries without the stash still
  // create the profile — a missing date is recorded as "not attested", never
  // as "attested".
  let ageAttestation = null;
  if (birthDate !== undefined && birthDate !== null && birthDate !== "") {
    const check = checkBirthDate(birthDate);
    if (!check.ok) {
      // JSDoc unions don't narrow on the `ok` literal under checkJs; `in` does.
      if (!("reason" in check) || check.reason === "invalid") {
        throw new HttpsError("invalid-argument", "Please enter a valid date of birth.");
      }
      throw new HttpsError(
        "failed-precondition",
        `You must be at least ${MIN_AGE_YEARS} years old to play marching.art.`
      );
    }
    ageAttestation = { birthDate: check.birthDate, attestedAt: new Date().toISOString() };
  }
  const trimmedUsername = username.trim();
  if (trimmedUsername.length < 3 || trimmedUsername.length > 15 || !/^[a-zA-Z0-9_]+$/.test(trimmedUsername)) {
    throw new HttpsError("invalid-argument",
      "Username must be 3-15 characters and contain only letters, numbers, and underscores.");
  }
  // Optional display name (falls back to the username).
  const cleanDisplayName = (typeof displayName === "string" && displayName.trim())
    ? displayName.trim().slice(0, 50)
    : trimmedUsername;

  try {
    const db = getDb();

    const userProfileRef = db.doc(paths.userProfile(uid));
    const userPrivateRef = db.doc(paths.userPrivate(uid));
    const usernameRef = db.doc(`usernames/${trimmedUsername.toLowerCase()}`);

    // The whole reservation runs in ONE transaction. The old
    // check-then-batch flow let two concurrent claims of the same name both
    // pass the read: the loser's batch.set silently overwrote the winner's
    // reservation while both profiles kept the username — a duplicate
    // display identity on leaderboards. Inside a transaction the second
    // commit conflicts and retries, re-reads the reservation, and fails
    // cleanly with already-exists.
    const alreadyExists = await db.runTransaction(async (t) => {
      // Idempotent: if this user already has a profile, treat as success so
      // the onboarding/guard flow can safely retry without erroring out.
      const existingProfile = await t.get(userProfileRef);
      if (existingProfile.exists) {
        return true;
      }

      const usernameDoc = await t.get(usernameRef);
      // Allow the reservation only if it's free or already owned by this user.
      if (usernameDoc.exists && usernameDoc.data().uid !== uid) {
        throw new HttpsError("already-exists", "This username is already taken.");
      }

      t.set(userProfileRef, {
      uid: uid,
      username: trimmedUsername,
      displayName: cleanDisplayName,
      createdAt: new Date(),
      lastActive: new Date(),
      bio: `Welcome to my marching.art profile!`,
      // XP & Progression
      xp: 0,
      xpLevel: 1,
      userTitle: 'Rookie',
      // Currency
      corpsCoin: 1000,
      // Unlocks
      unlockedClasses: ['soundSport'],
      // Corps data
      corps: {},
      // Uniform customization
      uniform: {
        skinTone: '#d8aa7c',
        headwear: { style: 'shako', colors: { hat: '#1a1a1a', trim: '#ffffff' } },
        plume: { style: 'fountain', colors: { plume: '#ff0000' } },
        jacket: { style: 'sash', colors: { base: '#000080', accent: '#ffffff', trim: '#ffd700' } },
        pants: { style: 'stripe', colors: { base: '#ffffff', stripe: '#000080' } },
        shoes: { style: 'white' },
      },
      // Stats
      stats: {
        seasonsPlayed: 0,
        championships: 0,
        topTenFinishes: 0,
        leagueWins: 0,
      },
        trophies: { championships: [], regionals: [], finalistMedals: [] },
        seasons: [],
      });

      t.set(userPrivateRef, {
        email: email,
        // Owner-only: the date of birth never reaches the public profile doc.
        ...(ageAttestation ? { ageAttestation } : {}),
      });

      t.set(usernameRef, { uid: uid });
      return false;
    });

    if (alreadyExists) {
      logger.info(`createUserProfile: profile already exists for ${uid}, treating as no-op.`);
      return { success: true, message: "User profile already exists.", alreadyExists: true };
    }

    logger.info(`Successfully created profile for user ${uid} with username ${trimmedUsername}`);
    return { success: true, message: "User profile created successfully." };

  } catch (error) {
    logger.error(`Error creating user profile for ${uid}:`, error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Failed to create user profile.");
  }
});

exports.getShowRegistrations = onCall({ cors: true }, async (request) => {
  assertAuth(request);

  const { week, eventName } = request.data;
  // Director-hosted shows carry no calendar date (date === null): they're placed
  // on a competition day, not a scraped tour date. Only week + eventName are
  // required; normalize a missing date to null so the index key (`date ?? ""`)
  // and the legacy per-profile match below both treat "no date" consistently.
  const date = request.data.date ?? null;
  // Optional competition day. When provided, Podium corps that picked this show
  // for that day are folded into the roster below (their picks live outside the
  // fantasy registration index). Callers that don't pass it get fantasy only.
  const day = Number.isInteger(request.data.day) ? request.data.day : null;
  if (!week || !eventName) {
    throw new HttpsError("invalid-argument", "Missing required show data.");
  }

  const db = getDb();
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) throw new HttpsError("not-found", "No active season.");

  const activeSeasonId = seasonDoc.data().seasonUid;
  if (!activeSeasonId) {
    throw new HttpsError("not-found", "Active season UID is not configured.");
  }

  // Fast path: the materialized index (helpers/showRegistrations.js) answers
  // in ONE doc read. The previous implementation ran the collectionGroup
  // scan below on EVERY show-detail page view — O(all active players)
  // full-corps-map reads per call, the same pattern getUserRankings had
  // before seasonRankings was materialized.
  const eventKey = showRegistrationEventKey(week, eventName, date);
  const indexRef = db.doc(paths.showRegistrationEvent(activeSeasonId, eventKey));
  const indexSnap = await indexRef.get();

  // Fantasy corps registered for this show (from the index, else a one-time
  // profile scan that materializes the index). `uid` is carried through so
  // callers can dedupe a director's corps into one attendee/slot.
  let registrations;
  if (indexSnap.exists) {
    registrations = Object.values(indexSnap.data().registrations || {}).map((entry) => ({
      uid: entry.uid || null,
      corpsName: entry.corpsName || "Unnamed Corps",
      corpsClass: entry.corpsClass,
      username: entry.username,
    }));
  } else {
    // Legacy fallback (index doc absent — e.g. selections that predate the
    // index and haven't been rebuilt yet): scan profiles, then materialize the
    // result so this event pays the scan at most once. The nightly rebuild in
    // the lifetime-leaderboard job replaces the doc from source-of-truth
    // profiles regardless.
    registrations = [];
    const indexEntries = {};
    // Field projection: Only fetch fields needed for registration display
    const q = db.collectionGroup("profile")
      .where("activeSeasonId", "==", activeSeasonId)
      .select("corps", "username");
    const querySnapshot = await q.get();

    querySnapshot.forEach((doc) => {
      const profile = doc.data();
      const userCorps = profile.corps || {};
      const uid = doc.ref.parent.parent?.id;

      for (const corpsClass in userCorps) {
        const corps = userCorps[corpsClass];
        const showsForWeek = corps.selectedShows ? corps.selectedShows[`week${week}`] : [];

        if (
          showsForWeek &&
          showsForWeek.some((s) => s.eventName === eventName && (s.date ?? null) === date)
        ) {
          registrations.push({
            uid: uid || null,
            corpsName: corps.corpsName || "Unnamed Corps",
            corpsClass: corpsClass,
            username: profile.username,
          });
          if (uid) {
            indexEntries[registrationEntryKey(uid, corpsClass)] = {
              uid,
              corpsClass,
              corpsName: corps.corpsName || "Unnamed Corps",
              username: profile.username || null,
              homeGeo: corps.homeGeo || homeGeoFor(corps.location) || null,
            };
          }
        }
      }
    });

    try {
      await indexRef.set({ week, eventName, date, registrations: indexEntries });
    } catch (indexError) {
      logger.warn("Could not materialize show-registration index doc:", indexError);
    }
  }

  // Podium corps pick shows day-based, in their own podium/state docs — outside
  // the fantasy registration index. When the caller passes the show's day (the
  // hosted-show roster does), fold in every Podium corps whose pick for that day
  // names this show, so the roster and slot count include the Podium field.
  //
  // The efficient lookup would be a collection-group array-contains query on
  // `podium.selectedShowDays`, but that needs a COLLECTION_GROUP index and the
  // deploy pipeline intentionally never ships firestore.indexes.json (a `--force`
  // deploy would delete console-managed indexes — see .github/workflows/
  // deploy-functions.yml). Undeployed, that query throws FAILED_PRECONDITION and
  // the catch below silently drops every Podium corps from hosted rosters — the
  // bug this replaces. Instead enumerate the season's Podium roster
  // (podium-season/{seasonUid}/corps — a plain collection read, no index) and
  // batch-read the corps' states, exactly as the nightly processor does (the
  // roster exists for this reason; helpers/podium/store.rosterCollection). A
  // field mask keeps each state read to the three fields the match needs, and
  // the roster is the bounded opt-in Podium field, not the whole player base.
  if (day != null) {
    try {
      const rosterSnap = await podiumStore.rosterCollection(db, activeSeasonId).get();
      const rosterUids = rosterSnap.docs.map((doc) => doc.id);
      const GETALL_CHUNK = 300;
      const entries = [];
      for (let i = 0; i < rosterUids.length; i += GETALL_CHUNK) {
        const chunkUids = rosterUids.slice(i, i + GETALL_CHUNK);
        const snaps = await db.getAll(
          ...chunkUids.map((uid) => podiumStore.stateRef(db, uid)),
          { fieldMask: ["seasonUid", "corpsName", "selectedShows"] }
        );
        snaps.forEach((snap, j) => {
          if (snap.exists) entries.push({ uid: chunkUids[j], state: snap.data() });
        });
      }
      registrations.push(
        ...collectPodiumRegistrations(entries, { day, eventName, activeSeasonId })
      );
    } catch (podiumError) {
      logger.warn("Could not fold Podium corps into show registrations:", podiumError.message);
    }
  }

  return { registrations };
});

exports.getUserRankings = onCall({ cors: true }, async (request) => {
  const uid = assertAuth(request);
  const db = getDb();

  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists) {
    throw new HttpsError("not-found", "No active season found.");
  }
  const activeSeasonId = seasonDoc.data().seasonUid;

  // Fast path: read the precomputed rankings snapshot (materialized nightly by
  // the lifetime-leaderboard job) instead of scanning every profile per call.
  // This turns an O(players) read into a single document read.
  const rankingsSnap = await db.doc(paths.seasonRankings()).get();
  const rankings = rankingsSnap.exists ? rankingsSnap.data() : null;
  if (rankings && rankings.ranks) {
    const totalPlayers = rankings.totalPlayers || Object.keys(rankings.ranks).length || 1;
    const mine = rankings.ranks[uid];
    // Stale snapshot (e.g. right after a season rollover, before the nightly
    // job re-materializes): serve the previous snapshot flagged `stale`
    // rather than letting every caller pay the full profile scan below — a
    // thundering herd exactly when the whole player base reloads.
    const stale = rankings.seasonUid !== activeSeasonId;
    if (mine) {
      return { globalRank: mine.rank, totalPlayers, totalScore: mine.totalScore, ...(stale && { stale }) };
    }
    // Registered since the last materialization (not yet in the snapshot):
    // rank at the bottom rather than mis-reporting rank 1.
    return { globalRank: totalPlayers, totalPlayers, totalScore: 0, ...(stale && { stale }) };
  }

  // Fallback: no usable snapshot exists at all (first-ever season, before the
  // first materialization lands). Compute from a single scan so the value is
  // never wrong — just occasionally expensive until the nightly job runs.
  const profilesQuery = db.collectionGroup("profile")
    .where("activeSeasonId", "==", activeSeasonId)
    .select("corps", "corpsName", "totalSeasonScore");
  const profilesSnapshot = await profilesQuery.get();

  if (profilesSnapshot.empty) {
    return { globalRank: 1, totalPlayers: 1 };
  }

  const allPlayerScores = [];
  let myTotalScore = 0;

  profilesSnapshot.docs.forEach((doc) => {
    const profile = doc.data();
    const userId = doc.ref.parent.parent.id;
    const totalScore = sumSeasonScore(profile);

    allPlayerScores.push(totalScore);
    if (userId === uid) {
      myTotalScore = totalScore;
    }
  });

  allPlayerScores.sort((a, b) => b - a);
  const rank = allPlayerScores.findIndex((score) => score === myTotalScore) + 1;

  return {
    globalRank: rank > 0 ? rank : allPlayerScores.length,
    totalPlayers: allPlayerScores.length,
    totalScore: myTotalScore,
  };
});

// NOTE: dailyXPCheckIn and awardXP used to live here. Both were orphaned —
// dailyXPCheckIn's client binding pointed at a function name that never
// existed ('dailyRehearsal'), and awardXP had no callers at all, which is
// why weekly-participation and league-win XP never paid. Those two sources
// are now paid server-side inside the guarded weekly scoring run
// (helpers/weeklyMatchups.js payWeeklyParticipationXP / processWeeklyMatchups),
// and daily-login XP is owned by claimDailyLogin (callable/dailyOps.js).

/**
 * Fix missing profile fields for existing users
 * Admin-only function to ensure all profiles have required fields
 */
exports.fixProfileFields = onCall({ cors: true, timeoutSeconds: 540, memory: "512MiB", cpu: 1 }, async (request) => {
  assertAdmin(request);

  const db = getDb();
  let fixedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // Default profile fields that should exist
  const defaultFields = {
    xp: 0,
    xpLevel: 1,
    userTitle: 'Rookie',
    corpsCoin: 1000,
    unlockedClasses: ['soundSport'],
    corps: {},
    stats: {
      seasonsPlayed: 0,
      championships: 0,
      topTenFinishes: 0,
      leagueWins: 0,
    },
  };

  try {
    const profilesQuery = db.collectionGroup("profile");

    let batch = db.batch();
    let batchCount = 0;
    let scannedCount = 0;

    await processAllInPages(profilesQuery, 300, async (docSnap) => {
      scannedCount++;
      const profile = docSnap.data();
      const updates = {};

      // Check each required field and add if missing
      if (profile.xp === undefined) updates.xp = defaultFields.xp;
      if (profile.xpLevel === undefined) updates.xpLevel = defaultFields.xpLevel;
      if (profile.userTitle === undefined) updates.userTitle = defaultFields.userTitle;
      if (profile.corpsCoin === undefined) updates.corpsCoin = defaultFields.corpsCoin;
      if (profile.unlockedClasses === undefined) updates.unlockedClasses = defaultFields.unlockedClasses;
      if (profile.corps === undefined) updates.corps = defaultFields.corps;

      // Reconcile level + title from XP in case earlier code paths left them stale
      const effectiveXp = updates.xp !== undefined ? updates.xp : (profile.xp || 0);
      const computedLevel = calculateLevel(effectiveXp);
      const computedTitle = getLevelTitle(computedLevel, {
        totalSeasons: profile.lifetimeStats?.totalSeasons,
      });
      const currentLevel = updates.xpLevel !== undefined ? updates.xpLevel : profile.xpLevel;
      const currentTitle = updates.userTitle !== undefined ? updates.userTitle : profile.userTitle;
      if (currentLevel !== computedLevel) updates.xpLevel = computedLevel;
      if (currentTitle !== computedTitle) updates.userTitle = computedTitle;

      // Fix displayName if missing (use username or 'Director')
      if (profile.displayName === undefined || profile.displayName === null) {
        updates.displayName = profile.username || 'Director';
      }

      // Initialize stats object if missing or not an object
      if (!profile.stats || typeof profile.stats !== 'object') {
        updates.stats = defaultFields.stats;
      } else {
        // Ensure all stat fields exist
        const statsUpdates = {};
        if (profile.stats.seasonsPlayed === undefined) statsUpdates['stats.seasonsPlayed'] = 0;
        if (profile.stats.championships === undefined) statsUpdates['stats.championships'] = 0;
        if (profile.stats.topTenFinishes === undefined) statsUpdates['stats.topTenFinishes'] = 0;
        if (profile.stats.leagueWins === undefined) statsUpdates['stats.leagueWins'] = 0;
        Object.assign(updates, statsUpdates);
      }

      // Only update if there are missing fields
      if (Object.keys(updates).length > 0) {
        try {
          batch.update(docSnap.ref, updates);
          fixedCount++;
          batchCount++;

          // Commit in batches of 400 to avoid Firestore limits (swap in the
          // fresh batch before awaiting so in-page siblings never queue onto
          // a batch that is mid-commit)
          if (batchCount >= 400) {
            const committing = batch;
            batch = db.batch();
            batchCount = 0;
            await committing.commit();
          }
        } catch (error) {
          logger.error(`Error fixing profile ${docSnap.id}:`, error);
          errorCount++;
        }
      } else {
        skippedCount++;
      }
    });

    if (scannedCount === 0) {
      return { success: true, message: "No profiles found." };
    }

    // Commit any remaining updates
    if (batchCount > 0) {
      await batch.commit();
    }

    logger.info(`Profile fix completed: ${fixedCount} fixed, ${skippedCount} already complete, ${errorCount} errors`);

    return {
      success: true,
      message: `Profile fix completed: ${fixedCount} profiles fixed, ${skippedCount} already complete, ${errorCount} errors`,
      fixedCount,
      skippedCount,
      errorCount,
    };
  } catch (error) {
    logger.error("Profile fix failed:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "Profile fix failed.");
  }
});