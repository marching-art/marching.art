// Schedule running-order producer (Phase 2 of docs/EVENT_SCHEDULES_AND_SLOTS.md).
//
// Denormalizes a REAL-FIELD running order onto each upcoming competition in the
// active season's schedule doc (schedules/{seasonUid}.competitions[]), so a
// director sees their own corps slotted into a believable order at a real time,
// with scores landing exactly at the night's drop. The field is the players who
// actually registered (read from the materialized show_registrations index),
// slotted worst-to-best by recent performance (fantasy_standings), and paced by
// the fit-to-window engine so everyone gets a timed slot before the drop.
//
// Cost profile mirrors scheduleWeather.js: a bounded window of upcoming shows,
// one registration-index doc read per show, a handful of standings docs, and a
// single merge write only when something changed. Runs a few times a day; the
// evening pass refreshes today's field a couple hours before the ~9 p.m. drop.
//
// Championship days (45-49) are intentionally skipped — they keep the pool-driven
// heritage synthesis (offSeasonHeritage.buildChampionshipLineup). Everything is
// best-effort: a show we can't build (no registrations, no date) is left as-is.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onCall } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { assertAdmin } = require("../helpers/callableGuards");
const { RANKED_CLASSES } = require("../helpers/classRegistry");
const { MODEL_VERSION } = require("../helpers/scheduleModel");
const { buildShowRunningOrder } = require("../helpers/showRunningOrder");
const { showRegistrationEventKey, collectPodiumRegistrations } = require("../helpers/showRegistrations");
const { zonedWallTimeToUtc } = require("../helpers/eventDetails");
const { isPodiumEnabled } = require("../helpers/features");
const { homeGeoFor } = require("../helpers/corpsGeo");
const { assignEncore, encoreKey } = require("../helpers/encore");
const podiumStore = require("../helpers/podium/store");

// Batch size for the getAll fan-out over Podium state docs (matches users.js).
const GETALL_CHUNK = 300;

const DAY_MS = 86400000;
// How far ahead to materialize. Covers the current week plus a couple of days so
// "this week" is always populated and next week starts filling in. A show
// further out has a field too unsettled to be worth the read.
const HORIZON_DAYS = 9;

/** A Firestore Timestamp, Date, ISO string, or epoch ms → Date, or null. */
function coerceDate(value) {
  if (!value) return null;
  const d =
    typeof value.toDate === "function" ? value.toDate() : value instanceof Date ? value : new Date(value);
  return d instanceof Date && !Number.isNaN(d.getTime()) ? d : null;
}

/** A competition's calendar date: its own `date`, else season start + day. */
function competitionDate(comp, seasonStartDate) {
  const explicit = coerceDate(comp.date);
  if (explicit) return explicit;
  if (seasonStartDate && Number.isFinite(comp.day)) {
    return new Date(seasonStartDate.getTime() + (comp.day - 1) * DAY_MS);
  }
  return null;
}

/** True for the auto-enrolled championship events (they keep heritage synthesis). */
function isChampionship(comp) {
  return comp.type === "championship" || comp.mandatory === true;
}

/**
 * The real fantasy score-drop instant for a show:
 *  - live season: the scraped "scores announced" time when we have it;
 *  - otherwise (off-season, or a live show not yet scraped): a flat 9 PM ET on
 *    the show's labeled date — the off-season drop, and a safe provisional.
 * @param {Object} comp
 * @param {Date} date  the show's calendar date
 * @param {boolean} isLive
 * @returns {Date}
 */
function resolveScoresDropAt(comp, date, isLive) {
  if (isLive) {
    const scraped = coerceDate(comp.scoresAt);
    if (scraped) return scraped;
  }
  // 9 PM ET on the date's labeled (UTC) calendar day.
  return zonedWallTimeToUtc(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    21,
    0,
    "America/New_York"
  );
}

/** A cheap signature of a materialized order, to skip no-op writes. */
function scheduleSignature(sched) {
  if (!sched) return "";
  const ids = sched.lineup.map((e) => `${e.uid || "?"}:${e.order}`).join(",");
  return `${sched.fieldSize}|${sched.intervalMin}|${sched.scoresAt}|${sched.overflow.length}|${ids}`;
}

/** Shape a builder result into the stored schedule object (sans updatedAt). */
function toScheduleDoc(order) {
  return {
    modelVersion: MODEL_VERSION,
    timezone: order.timezone,
    gatesAt: order.gatesAt,
    startsAt: order.startsAt,
    scoresAt: order.scoresAt,
    intervalMin: order.intervalMin,
    fieldSize: order.fieldSize,
    lineup: order.lineup,
    overflow: order.overflow,
  };
}

/**
 * Read the season's Podium roster + the state fields needed to build a running
 * order (field, recent form, picks). A plain roster read + a batched getAll —
 * no collection-group index — exactly like getShowRegistrations. Returns
 * [{uid, state}] ready for collectPodiumRegistrations.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} seasonUid
 * @returns {Promise<Array<{uid:string, state:Object}>>}
 */
async function loadPodiumEntries(db, seasonUid) {
  const rosterSnap = await podiumStore.rosterCollection(db, seasonUid).get();
  const uids = rosterSnap.docs.map((doc) => doc.id);
  const entries = [];
  for (let i = 0; i < uids.length; i += GETALL_CHUNK) {
    const chunk = uids.slice(i, i + GETALL_CHUNK);
    const snaps = await db.getAll(...chunk.map((uid) => podiumStore.stateRef(db, uid)), {
      fieldMask: ["seasonUid", "corpsName", "selectedShows", "lastTotal"],
    });
    snaps.forEach((snap, j) => {
      if (snap.exists) entries.push({ uid: chunk[j], state: snap.data() });
    });
  }
  return entries;
}

/**
 * Load every ranked class's standings into a `${uid}_${class}` → entry map for
 * the recent-performance metric. SoundSport isn't ranked, so its corps fall to
 * cold-start ordering (as intended — ratings are never revealed).
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} seasonUid
 * @returns {Promise<Map<string, Object>>}
 */
async function loadStandingsMetric(db, seasonUid) {
  const map = new Map();
  const snaps = await Promise.all(
    RANKED_CLASSES.map((cls) => db.doc(`fantasy_standings/${seasonUid}/classes/${cls}`).get())
  );
  for (const snap of snaps) {
    if (!snap.exists) continue;
    for (const entry of snap.data().entries || []) {
      if (entry && entry.uid && entry.corpsClass) map.set(`${entry.uid}_${entry.corpsClass}`, entry);
    }
  }
  return map;
}

/**
 * Walk the active season's schedule and materialize each upcoming show's
 * fantasy running order into `competition.fantasySchedule`. Pure-ish: all effects
 * go through the injected db + build function, so the test drives it with fakes.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {Object} [deps] { build, now } overrides for tests.
 * @returns {Promise<{updated:number, built:number, total:number, seasonId:string|null}>}
 */
async function enrichScheduleRunningOrdersLogic(db, deps = {}) {
  const build = deps.build || buildShowRunningOrder;
  const now = deps.now || Date.now();

  const seasonSnap = await db.doc("game-settings/season").get();
  if (!seasonSnap.exists) {
    logger.info("[running-order] no active season; nothing to enrich.");
    return { updated: 0, built: 0, total: 0, seasonId: null };
  }
  const season = seasonSnap.data() || {};
  const seasonId = season.seasonUid || null;
  if (!seasonId) {
    logger.info("[running-order] active season has no seasonUid; skipping.");
    return { updated: 0, built: 0, total: 0, seasonId: null };
  }
  const isLive = season.status === "live-season";
  const seasonStartDate =
    coerceDate(season.schedule && season.schedule.startDate) || coerceDate(season.startDate);

  const schedRef = db.doc(`schedules/${seasonId}`);
  const schedSnap = await schedRef.get();
  const competitions = (schedSnap.exists && schedSnap.data().competitions) || [];
  if (competitions.length === 0) {
    logger.info(`[running-order] schedules/${seasonId} has no competitions.`);
    return { updated: 0, built: 0, total: 0, seasonId };
  }

  const metric = await loadStandingsMetric(db, seasonId);
  const metricFor = (uid, cls) => (uid ? metric.get(`${uid}_${cls}`) || null : null);

  // The Podium field shares the venue/date but is its own running order (its own
  // field, its own recent-form metric, and a flat 9 PM ET drop year-round). Read
  // its roster once, gated on the Podium feature.
  let podiumEntries = [];
  const podiumOn =
    deps.podiumEnabled !== undefined
      ? deps.podiumEnabled
      : await isPodiumEnabled(db).catch(() => false);
  if (podiumOn) {
    try {
      podiumEntries = await (deps.loadPodiumEntries || loadPodiumEntries)(db, seasonId);
    } catch (err) {
      logger.warn(`[running-order] podium roster read failed: ${err.message}`);
    }
  }

  let updated = 0;
  let built = 0;
  const out = [];
  // Encore is assigned in a second, date-ordered pass so the 1-per-season cap is
  // consumed chronologically. Frozen (pre-window) shows seed the used set; window
  // shows are (re)assigned. { entry, registrations, venueGeo, hostUid }.
  const encoreCandidates = [];
  const usedKeys = new Set();
  for (const comp of competitions) {
    const entry = { ...comp };
    const date = competitionDate(comp, seasonStartDate);
    const daysFromNow = date ? Math.floor((date.getTime() - now) / DAY_MS) : null;
    const inWindow = daysFromNow !== null && daysFromNow >= -1 && daysFromNow <= HORIZON_DAYS;

    // A frozen past show's encore already consumed that corps' season slot.
    if (daysFromNow !== null && daysFromNow < -1 && comp.encore && comp.encore.uid) {
      usedKeys.add(encoreKey(comp.encore));
    }

    if (date && inWindow && !isChampionship(comp)) {
      const week = comp.week || Math.ceil((comp.day || 1) / 7);
      const eventKey = showRegistrationEventKey(week, comp.name, comp.date ?? null);
      try {
        // --- Fantasy running order (from the registration index) ---
        const regSnap = await db.doc(paths.showRegistrationEvent(seasonId, eventKey)).get();
        const registrations = regSnap.exists
          ? Object.values(regSnap.data().registrations || {}).map((r) => ({
              uid: r.uid || null,
              corpsClass: r.corpsClass,
              corpsName: r.corpsName || "Unnamed Corps",
              homeGeo: r.homeGeo || null,
              encoreDeclined: r.encoreDeclined === true,
            }))
          : [];
        built += 1;
        const fantasy = toScheduleDoc(
          build({
            registrations,
            metricFor,
            scoresDropAt: resolveScoresDropAt(comp, date, isLive),
            timezone: comp.timezone || null,
            location: comp.location || "",
          })
        );
        if (scheduleSignature(comp.fantasySchedule) !== scheduleSignature(fantasy)) {
          updated += 1;
          entry.fantasySchedule = { ...fantasy, updatedAt: new Date().toISOString() };
        }

        // --- Podium running order (from the podium roster; 9 PM ET year-round) ---
        if (podiumOn && Number.isFinite(comp.day)) {
          const pField = collectPodiumRegistrations(podiumEntries, {
            day: comp.day,
            eventName: comp.name,
            activeSeasonId: seasonId,
          });
          const pLast = new Map(pField.map((p) => [p.uid, p.lastTotal]));
          const podium = toScheduleDoc(
            build({
              registrations: pField,
              metricFor: (uid) => (pLast.has(uid) ? { totalScore: pLast.get(uid) } : null),
              scoresDropAt: resolveScoresDropAt(comp, date, false), // podium: always 9 PM ET
              timezone: comp.timezone || null,
              location: comp.location || "",
            })
          );
          if (scheduleSignature(comp.podiumSchedule) !== scheduleSignature(podium)) {
            updated += 1;
            entry.podiumSchedule = { ...podium, updatedAt: new Date().toISOString() };
          }
        }

        // Stash for the chronological encore pass (fantasy field only).
        encoreCandidates.push({
          entry,
          date,
          registrations,
          venueGeo: homeGeoFor(comp.location),
          hostUid: comp.hostUid || null,
        });
      } catch (err) {
        logger.warn(`[running-order] build failed for ${comp.name}: ${err.message}`);
      }
    }
    out.push(entry);
  }

  // Encore pass: assign in date order so the season cap is consumed
  // chronologically. Each assignment marks that corps used for later shows.
  encoreCandidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const cand of encoreCandidates) {
    const encore = assignEncore({
      registrations: cand.registrations,
      venueGeo: cand.venueGeo,
      usedKeys,
      hostUid: cand.hostUid,
    });
    if (encore) usedKeys.add(encoreKey(encore));
    const sig = (e) => (e && e.uid ? `${e.uid}|${e.reason}` : "");
    if (sig(cand.entry.encore) !== sig(encore)) {
      updated += 1;
      cand.entry.encore = encore; // may be null → clears a stale encore
    }
  }

  if (updated > 0) {
    await schedRef.set({ competitions: out }, { merge: true });
  }
  logger.info(
    `[running-order] season ${seasonId}: built ${built}, updated ${updated} of ${competitions.length}.`
  );
  return { updated, built, total: competitions.length, seasonId };
}

exports.enrichScheduleRunningOrdersLogic = enrichScheduleRunningOrdersLogic;
exports.competitionDate = competitionDate;
exports.resolveScoresDropAt = resolveScoresDropAt;
exports.scheduleSignature = scheduleSignature;
exports.isChampionship = isChampionship;

exports.scheduledScheduleRunningOrder = onSchedule(
  {
    // Morning pass, after the overnight scoring/standings pipeline settles, so
    // the recent-performance metric reflects last night's results.
    schedule: "0 6 * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    logger.info("Starting scheduled running-order enrichment");
    const result = await enrichScheduleRunningOrdersLogic(getDb());
    logger.info("Completed running-order enrichment", result);
  }
);

exports.scheduledScheduleRunningOrderEvening = onSchedule(
  {
    // Evening pass, a couple of hours before the ~9 p.m. ET drop, to capture
    // late registration changes in today's field.
    schedule: "0 18 * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 300,
    memory: "256MiB",
  },
  async () => {
    logger.info("Starting evening running-order refresh");
    const result = await enrichScheduleRunningOrdersLogic(getDb());
    logger.info("Completed evening running-order refresh", result);
  }
);

exports.refreshScheduleRunningOrderNow = onCall({ cors: true, timeoutSeconds: 300 }, async (request) => {
  assertAdmin(request);
  return enrichScheduleRunningOrdersLogic(getDb());
});
