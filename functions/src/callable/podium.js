/**
 * Podium Class callables (Phase 2, PODIUM_CLASS_DESIGN.md).
 *
 * Every mutation is server-validated: "today" is always derived from the
 * shared 2 AM ET game clock (never client-supplied), state lives in the
 * server-only podium/state subcollection, and every callable is gated on
 * game-settings/features.podiumClass. Scores are never computed here — only
 * the nightly processor scores shows.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { assertAuth } = require("../helpers/callableGuards");
const { isPodiumEnabled } = require("../helpers/features");
const { getActiveCalendarDay, toCompetitionDay } = require("../helpers/gameDay");
const engine = require("../helpers/podium/engine");
const store = require("../helpers/podium/store");

const AUDITION_POOL = 100;
const NAME_MIN = 3;
const NAME_MAX = 40;

/** Validate a challenge map: all 8 captions, integers 1-8. Returns normalized copy. */
function validateChallenge(challenge) {
  if (!challenge || typeof challenge !== "object") {
    throw new HttpsError("invalid-argument", "Challenge levels are required.");
  }
  const normalized = {};
  for (const caption of engine.CAPTIONS) {
    const level = challenge[caption];
    if (!Number.isInteger(level) || level < 1 || level > 8) {
      throw new HttpsError("invalid-argument", `Challenge for ${caption} must be an integer 1-8.`);
    }
    normalized[caption] = level;
  }
  return normalized;
}

/**
 * Validate an audition allocation: non-negative integers per caption summing
 * to at most AUDITION_POOL. Returns per-caption shares for the engine
 * (undefined when the director skipped the step — even distribution).
 */
function validateAuditions(auditions) {
  if (auditions == null) return undefined;
  if (typeof auditions !== "object") {
    throw new HttpsError("invalid-argument", "Auditions must be a points-per-caption object.");
  }
  let total = 0;
  const points = {};
  for (const caption of engine.CAPTIONS) {
    const value = auditions[caption] ?? 0;
    if (!Number.isInteger(value) || value < 0) {
      throw new HttpsError("invalid-argument", `Audition points for ${caption} must be a non-negative integer.`);
    }
    points[caption] = value;
    total += value;
  }
  if (total === 0) return undefined;
  if (total > AUDITION_POOL) {
    throw new HttpsError("invalid-argument", `Audition points exceed the pool of ${AUDITION_POOL}.`);
  }
  const shares = {};
  for (const caption of engine.CAPTIONS) shares[caption] = points[caption] / total;
  return shares;
}

/**
 * Validate self-selected show days for one week against the pick budget
 * (majors and championship week are auto-attended and never selectable).
 * @returns {number[]} sorted, deduped days
 */
function validateShowDays(week, days, uid, seasonUid, currentCompetitionDay) {
  if (!Number.isInteger(week) || week < 1 || week > 7) {
    throw new HttpsError("invalid-argument", "Week must be 1-7.");
  }
  if (!Array.isArray(days)) {
    throw new HttpsError("invalid-argument", "Days must be an array.");
  }
  const maxPicks = store.maxPicksForWeek(week);
  const autoDays = store.autoDaysFor(uid, seasonUid);
  const unique = [...new Set(days)].sort((a, b) => a - b);
  if (unique.length > maxPicks) {
    throw new HttpsError("invalid-argument", `Week ${week} allows at most ${maxPicks} selected shows.`);
  }
  for (const day of unique) {
    if (!Number.isInteger(day) || Math.ceil(day / 7) !== week) {
      throw new HttpsError("invalid-argument", `Day ${day} is not in week ${week}.`);
    }
    if (autoDays.includes(day) || store.EASTERN_DAYS.includes(day)) {
      throw new HttpsError("invalid-argument", `Day ${day} is auto-attended (major/championship) and not selectable.`);
    }
    if (day <= currentCompetitionDay) {
      throw new HttpsError("invalid-argument", `Day ${day} has already passed.`);
    }
  }
  return unique;
}

/** Shared preamble: flag gate, auth, season, day context. */
async function podiumContext(request) {
  const uid = assertAuth(request);
  const db = getDb();
  if (!(await isPodiumEnabled(db))) {
    throw new HttpsError("failed-precondition", "Podium Class is not currently enabled.");
  }
  const seasonDoc = await db.doc("game-settings/season").get();
  if (!seasonDoc.exists || !seasonDoc.data().seasonUid) {
    throw new HttpsError("failed-precondition", "There is no active season.");
  }
  const seasonData = seasonDoc.data();
  const calendarDay = getActiveCalendarDay(seasonData.schedule.startDate.toDate());
  const competitionDay = toCompetitionDay(calendarDay, seasonData);
  return { uid, db, seasonData, calendarDay, competitionDay };
}

/**
 * Roll podium/state.today forward to the active calendar day. The completed
 * day's block usage is snapshotted to pendingEndOfDay so the nightly
 * processor can apply decay/recovery even if it runs after the roll.
 */
function rollToday(state, calendarDay) {
  if (state.today && state.today.calendarDay === calendarDay) return state;
  if (state.today && state.today.calendarDay < calendarDay) {
    state.pendingEndOfDay = { ...state.today };
  }
  state.today = { calendarDay, blocksUsed: 0, blocks: [], restDay: false, warmupUsed: false };
  return state;
}

exports.registerPodiumCorps = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, calendarDay } = await podiumContext(request);
  const { corpsName, location, showConcept } = request.data || {};

  if (typeof corpsName !== "string" || corpsName.trim().length < NAME_MIN || corpsName.trim().length > NAME_MAX) {
    throw new HttpsError("invalid-argument", `Corps name must be ${NAME_MIN}-${NAME_MAX} characters.`);
  }
  if (calendarDay < 1) {
    throw new HttpsError("failed-precondition", "The season has not started yet.");
  }
  const challenge = validateChallenge(request.data?.challenge);
  const auditionShares = validateAuditions(request.data?.auditions);

  const seasonUid = seasonData.seasonUid;
  const trimmedName = corpsName.trim();
  const normalizedName = trimmedName.toLowerCase();
  // Same reservation namespace as fantasy registration: one corps name per
  // season across the whole game.
  const nameRef = db.doc(`corpsnames/${seasonUid}_${normalizedName}`);
  const sRef = store.stateRef(db, uid);

  await db.runTransaction(async (transaction) => {
    const [existingState, existingName] = await Promise.all([
      transaction.get(sRef),
      transaction.get(nameRef),
    ]);
    if (existingState.exists && existingState.data().seasonUid === seasonUid) {
      throw new HttpsError("already-exists", "You already field a Podium corps this season.");
    }
    if (existingName.exists && existingName.data().uid !== uid) {
      throw new HttpsError("already-exists", "That corps name is taken this season.");
    }


    // Mid-season joiners start from the corpus catch-up baseline: the engine
    // seeds day-1 state; content advances toward the median pace for the
    // current day (§9 catch-up: playable, never advantaged).
    const engineState = engine.createSeasonState(
      { challenge, auditions: auditionShares, repTier: 1 },
      store.curves,
      store.balance
    );
    const competitionDay = toCompetitionDay(calendarDay, seasonData);
    if (competitionDay > 1) {
      const catchUp = Math.min(0.85, (competitionDay - 1) / 49) * 0.35;
      for (const caption of engine.CAPTIONS) {
        engineState.captions[caption].content = Math.min(1, engineState.captions[caption].content + catchUp);
        engineState.captions[caption].clean = Math.min(1, engineState.captions[caption].clean + catchUp * 0.6);
      }
    }

    const stored = store.dehydrateState(engineState);
    transaction.set(sRef, {
      ...stored,
      seasonUid,
      corpsName: trimmedName,
      location: typeof location === "string" ? location.slice(0, 80) : "",
      showConcept: typeof showConcept === "string" ? showConcept.slice(0, 200) : "",
      challenge,
      auditions: auditionShares || null,
      reputation: 0,
      repTier: 1,
      selectedShowDays: [],
      today: { calendarDay, blocksUsed: 0, blocks: [], restDay: false, warmupUsed: false },
      lastScoredDay: null,
      lastTotal: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    transaction.set(nameRef, { uid, corpsClass: "podiumClass", seasonUid });
    transaction.set(store.rosterRef(db, seasonUid, uid), {
      uid,
      corpsName: trimmedName,
      createdAt: new Date().toISOString(),
    });
    // Display copy on the profile (identity + placeholders the UI reads).
    transaction.set(
      store.profileRef(db, uid),
      {
        corps: {
          podiumClass: {
            corpsName: trimmedName,
            location: typeof location === "string" ? location.slice(0, 80) : "",
            showConcept: typeof showConcept === "string" ? showConcept.slice(0, 200) : "",
            class: "podiumClass",
            repTier: 1,
            totalSeasonScore: null,
            seasonRank: null,
            seasonRankOf: null,
            createdAt: new Date().toISOString(),
          },
        },
      },
      { merge: true }
    );
  });

  logger.info(`Podium corps registered: ${trimmedName} (${uid}) season ${seasonUid}`);
  return { success: true, corpsName: trimmedName, easternNight: store.easternNightFor(uid, seasonUid) };
});

exports.allocateRehearsalBlock = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, calendarDay, competitionDay } = await podiumContext(request);
  const { blockType, blockIndex } = request.data || {};

  if (!engine.BLOCK_TYPES.includes(blockType)) {
    throw new HttpsError("invalid-argument", `Unknown block type: ${blockType}`);
  }
  if (calendarDay < 1) {
    throw new HttpsError("failed-precondition", "The season has not started yet.");
  }
  if (competitionDay > 49) {
    throw new HttpsError("failed-precondition", "The season is over.");
  }

  const sRef = store.stateRef(db, uid);
  const result = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = store.hydrateState(snapshot.data());
    rollToday(state, calendarDay);

    if (state.today.restDay) {
      throw new HttpsError("failed-precondition", "Today is a declared rest day.");
    }
    const isShowDay = store.isShowDayFor(state, uid, competitionDay);
    const isSpringTraining = seasonData.status === "live-season" && competitionDay < 1;
    const maxBlocks = engine.blocksAvailable(state, { isShowDay, isSpringTraining }, store.balance);

    if (state.today.blocksUsed >= maxBlocks) {
      throw new HttpsError("resource-exhausted", `All ${maxBlocks} blocks are used for today.`);
    }
    // Idempotency: the client passes the index it believes it is allocating;
    // a retry of an applied call is rejected instead of double-applied.
    if (Number.isInteger(blockIndex) && blockIndex !== state.today.blocksUsed) {
      throw new HttpsError(
        "aborted",
        `Block index ${blockIndex} already allocated (next is ${state.today.blocksUsed}).`
      );
    }

    const blocksSoFar = {};
    for (const b of state.today.blocks) blocksSoFar[b] = (blocksSoFar[b] || 0) + 1;
    const panel = engine.allocateBlock(
      state,
      blockType,
      competitionDay,
      state.today.blocksUsed,
      blocksSoFar,
      store.curves,
      store.balance
    );

    state.today.blocksUsed += 1;
    state.today.blocks = [...state.today.blocks, blockType];
    if (blockType === "warmup") state.today.warmupUsed = true;
    state.updatedAt = new Date().toISOString();

    transaction.set(sRef, store.dehydrateState(state));
    return {
      panel,
      today: state.today,
      condition: state.condition,
      blocksRemaining: maxBlocks - state.today.blocksUsed,
    };
  });

  return { success: true, ...result };
});

exports.setPodiumRestDay = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, calendarDay } = await podiumContext(request);
  if (calendarDay < 1) {
    throw new HttpsError("failed-precondition", "The season has not started yet.");
  }
  const sRef = store.stateRef(db, uid);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = snapshot.data();
    rollToday(state, calendarDay);
    if (state.today.blocksUsed > 0) {
      throw new HttpsError("failed-precondition", "Rest days must be declared before rehearsing.");
    }
    state.today.restDay = true;
    state.updatedAt = new Date().toISOString();
    transaction.set(sRef, state);
  });
  return { success: true };
});

exports.setPodiumShows = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, competitionDay } = await podiumContext(request);
  const { week, days } = request.data || {};
  const sRef = store.stateRef(db, uid);

  const selected = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(sRef);
    if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
      throw new HttpsError("failed-precondition", "Register a Podium corps first.");
    }
    const state = snapshot.data();
    const validated = validateShowDays(week, days, uid, seasonData.seasonUid, Math.max(0, competitionDay));
    const keep = (state.selectedShowDays || []).filter((d) => Math.ceil(d / 7) !== week);
    state.selectedShowDays = [...keep, ...validated].sort((a, b) => a - b);
    state.updatedAt = new Date().toISOString();
    transaction.set(sRef, state);
    return state.selectedShowDays;
  });

  return { success: true, selectedShowDays: selected };
});

exports.getPodiumState = onCall({ cors: true }, async (request) => {
  const { uid, db, seasonData, calendarDay, competitionDay } = await podiumContext(request);
  const snapshot = await store.stateRef(db, uid).get();
  if (!snapshot.exists || snapshot.data().seasonUid !== seasonData.seasonUid) {
    return { exists: false, calendarDay, competitionDay };
  }
  const state = snapshot.data();
  const isShowDay = store.isShowDayFor(state, uid, competitionDay);
  return {
    exists: true,
    calendarDay,
    competitionDay,
    isShowDay,
    autoDays: store.autoDaysFor(uid, seasonData.seasonUid),
    state,
  };
});

module.exports.validateChallenge = validateChallenge;
module.exports.validateAuditions = validateAuditions;
module.exports.validateShowDays = validateShowDays;
