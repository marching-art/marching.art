const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { paths } = require("../helpers/paths");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const admin = require("firebase-admin");
const { assertAuth, assertWriteBudget } = require("../helpers/callableGuards");
const { getRegistrationLock, registrationLockMessage } = require("../helpers/registrationLock");
const { refreshLeaguesForUser } = require("../helpers/leagueActivity");

const isProfane = (text) => /fuck|shit|damn/.test(text.toLowerCase());

exports.registerCorps = onCall({ cors: true }, async (request) => {
  const { corpsName, location, description, class: corpsClass } = request.data;
  const uid = assertAuth(request);

  // Abuse throttle (shared corps bucket) — far above any human rate.
  await assertWriteBudget(getDb(), uid, "corps", { max: 60, windowMs: 10 * 60 * 1000 });

  // --- 1. Validation ---
  if (!corpsName || !location || !corpsClass) {
    throw new HttpsError("invalid-argument", "Missing required fields.");
  }
  if (corpsName.length > 50 || location.length > 50 || (description && description.length > 500)) {
    throw new HttpsError("invalid-argument", "Input field exceeds length limit.");
  }
  if (isProfane(corpsName) || isProfane(location) || (description && isProfane(description))) {
    throw new HttpsError("invalid-argument", "Profane language is not allowed.");
  }

  const db = getDb();
  const profileDocRef = db.doc(paths.userProfile(uid));

  try {
    const profileDoc = await profileDocRef.get();
    if (!profileDoc.exists) {
      throw new HttpsError("not-found", "User profile does not exist.");
    }

    const profileData = profileDoc.data();

    // --- 2. Check Registration Locks Based on Weeks Remaining ---
    // The window is measured backward from the season end, so it already
    // accounts for the spring-training period at the front of the season.
    const seasonDoc = await db.doc("game-settings/season").get();
    const seasonData = seasonDoc.exists ? seasonDoc.data() : null;

    if (seasonData) {
      const { locked, lockWeeks, weeksRemaining } = getRegistrationLock(seasonData, corpsClass);
      if (locked) {
        throw new HttpsError(
          "failed-precondition",
          registrationLockMessage(corpsClass, lockWeeks, weeksRemaining)
        );
      }
    }

    // --- 3. Check Unlocked Classes ---
    const unlockedClasses = profileData.unlockedClasses || ['soundSport'];
    if (!unlockedClasses.includes(corpsClass)) {
      throw new HttpsError("permission-denied", `You have not unlocked the ${corpsClass} class.`);
    }

    // --- 4. Check if corps already exists for this class ---
    if (profileData.corps && profileData.corps[corpsClass]) {
      throw new HttpsError("already-exists", `You already have a corps in the ${corpsClass} class.`);
    }

    // --- 4a. Check the director isn't reusing a name from one of their own
    // active corps in a different class. The corpsnames reservation below
    // also covers this, but a missing reservation (legacy data) shouldn't
    // let the same director slip a duplicate name across classes.
    const normalizedNewName = corpsName.toLowerCase().trim();
    if (profileData.corps) {
      for (const [otherClass, otherCorps] of Object.entries(profileData.corps)) {
        if (otherClass === corpsClass) continue;
        if (otherCorps?.corpsName?.toLowerCase().trim() === normalizedNewName) {
          throw new HttpsError("already-exists",
            `You already have a corps named "${otherCorps.corpsName}" in ${otherClass}. Each corps name must be unique.`);
        }
      }
    }

    // --- 4b. Check if corps name is already taken this season ---
    // Friendly pre-check for the common case; the batch.create() below is the
    // race-proof backstop for two directors submitting the same name at once.
    const seasonId = seasonData?.seasonUid || 'default';
    const corpsNameKey = `${seasonId}_${normalizedNewName}`;
    const corpsNameRef = db.doc(`corpsnames/${corpsNameKey}`);
    const corpsNameDoc = await corpsNameRef.get();

    if (corpsNameDoc.exists) {
      throw new HttpsError("already-exists", "This corps name is already taken. Please choose a different name.");
    }

    // --- 5. Create New Corps Data ---
    const newCorpsData = {
      corpsName,
      location,
      description: description || '',
      class: corpsClass,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lineup: {},
      selectedShows: {},
      totalSeasonScore: 0,
      biography: `The ${corpsName} from ${location}.`,
    };

    // Stamp the corps with the season it was registered for. League
    // participation reads this first (helpers/leagueActivity.js) precisely so
    // it does not depend on the activeSeasonId guard below, which deliberately
    // stays silent for a director who still owes corps decisions. Rollover
    // rebuilds each corps without the field, so it never outlives its season.
    // Only written when a season actually exists — an explicit null means
    // "sitting this class out", which is not what a registration is saying.
    if (seasonData?.seasonUid) {
      newCorpsData.seasonUid = seasonData.seasonUid;
    }

    // --- 6. Set activeSeasonId if not already set ---
    const updateData = {
      [`corps.${corpsClass}`]: newCorpsData
    };

    // Set activeSeasonId when registering a corps for this season.
    //
    // This used to fire only when the field was entirely UNSET, which left a
    // hole: a returning director who retired everything last season has a
    // stale activeSeasonId and no corps, so the setup wizard sends them
    // straight to registration (there are no continue/retire decisions to
    // make) and processCorpsDecisions — the other writer of this field —
    // never runs. They ended up fielding a corps while their profile still
    // claimed the previous season. That was invisible until league
    // participation started keying off activeSeasonId
    // (helpers/leagueActivity.js), where it reads as "not playing".
    //
    // Guarded on having no other named corps so the wizard's step-0 detection
    // is untouched: a director who DOES hold corps from last season must keep
    // the season mismatch until they work through those decisions, which is
    // what makes the verification step appear. That guard no longer costs them
    // league visibility — the corps carries its own `seasonUid` stamp above,
    // which is what participation is computed from.
    const hasOtherNamedCorps = Object.entries(profileData.corps || {})
      .some(([cls, c]) => cls !== corpsClass && c?.corpsName);
    if (
      seasonData?.seasonUid &&
      profileData.activeSeasonId !== seasonData.seasonUid &&
      !hasOtherNamedCorps
    ) {
      updateData.activeSeasonId = seasonData.seasonUid;
      logger.info(`Setting activeSeasonId for user ${uid} to ${seasonData.seasonUid}`);
    }

    // --- 7. Write to DB (batch to ensure atomicity) ---
    const batch = db.batch();
    batch.update(profileDocRef, updateData);
    // Reserve the corps name for this season. create() (not set) so a
    // concurrent registration of the same name atomically fails the whole
    // commit instead of silently overwriting the other director's
    // reservation — the pre-check above cannot see an in-flight rival.
    batch.create(corpsNameRef, {
      uid,
      corpsName,
      corpsClass,
      seasonId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (commitError) {
      // gRPC ALREADY_EXISTS (code 6): we lost the reservation race. Surface
      // the same user-facing error the pre-check produces.
      if (commitError?.code === 6 || /ALREADY_EXISTS/i.test(String(commitError?.message))) {
        throw new HttpsError("already-exists", "This corps name is already taken. Please choose a different name.");
      }
      throw commitError;
    }

    // This director now counts as registered for the season, so any league
    // they belong to may have just become publicly discoverable. Best-effort:
    // the nightly refresh is the backstop (helpers/leagueActivity.js).
    await refreshLeaguesForUser(db, uid, seasonData?.seasonUid);

    logger.info(`User ${uid} successfully registered ${corpsName} (${corpsClass}).`);
    return { success: true, message: "Corps registered!" };

  } catch (error) {
    logger.error(`Error registering corps for user ${uid}:`, error);
    if (error instanceof HttpsError) {
      throw error;
    }
    throw new HttpsError("internal", "An error occurred while registering your corps.");
  }
});