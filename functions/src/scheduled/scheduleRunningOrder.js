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
// Cost profile mirrors scheduleWeather.js: every upcoming show in the season is
// processed (one registration-index doc read each), a handful of standings docs,
// and a single merge write only when something changed — an empty far-out show
// writes nothing. Runs a few times a day; the evening pass refreshes today's
// field a couple hours before the ~9 p.m. drop.
//
// Championship week (days 45-49) is built on BOTH sides from the real field.
// Fantasy: the auto-enrolled classes come from the registration index (the
// nightly rebuild folds the rounds in from the schedule; until it has, the
// standings already read for the slotting metric stand in), and an advancement
// round (46/48/49) is narrowed to the prior night's cut by the SAME function
// that decides who the scorer enrolls (scoringAwards.buildChampionshipConfig),
// with `fantasySchedule.advancement` saying whether that cut is decided yet.
// The heritage engine's synthesized DCI cast (offSeasonHeritage
// .buildChampionshipLineup) is no longer what a director sees on those nights.
// The Podium side is built for every upcoming show the same way: its field is
// the real roster (self-picks plus the auto-attended majors and championship
// rounds), never a synthesized pool. Everything is best-effort: a show we
// can't build (no registrations, no date) is left as-is.

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { RANKED_CLASSES } = require("../helpers/classRegistry");
const { MODEL_VERSION } = require("../helpers/scheduleModel");
const { buildShowRunningOrder } = require("../helpers/showRunningOrder");
const {
  showRegistrationEventKey,
  classIdOf,
  collectPodiumRegistrations,
  loadPodiumAdvancing,
  PODIUM_REGISTRATION_FIELDS,
} = require("../helpers/showRegistrations");
const { buildChampionshipConfig } = require("../helpers/scoringAwards");
const { CUTS: FANTASY_CUTS } = require("../helpers/championshipCuts");
const { zonedWallTimeToUtc } = require("../helpers/eventDetails");
const { isPodiumEnabled } = require("../helpers/features");
const { homeGeoFor } = require("../helpers/corpsGeo");
const { assignEncore, encoreKey } = require("../helpers/encore");
const podiumStore = require("../helpers/podium/store");
const {
  EASTERN_NIGHTS,
  isTwoNightShow,
  loadNightAssignmentIndex,
  nightFieldFor,
} = require("../helpers/easternSplit");

// Batch size for the getAll fan-out over Podium state docs (matches users.js).
const GETALL_CHUNK = 300;

const DAY_MS = 86400000;

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

/** True for the auto-enrolled championship events (days 45-49). */
function isChampionship(comp) {
  return comp.type === "championship" || comp.mandatory === true;
}

/** Canonical class ids a championship round auto-enrolls (schedule metadata). */
function championshipClassesOf(comp) {
  return (comp.allowedClasses || comp.eligibleClasses || [])
    .map(classIdOf)
    .filter((id, i, arr) => id && arr.indexOf(id) === i);
}

/**
 * @typedef {Object} FantasyAdvancing
 * @property {number} fromDay - The night whose scores decide this round.
 * @property {string} rule - Display copy for the cutoff ("Top 25 from Prelims").
 * @property {Record<string, {participants: Set<string>|null, classFilter: string[]}>} byEvent
 *   The scorer's own config for the day, keyed by event name; `participants`
 *   is the `${uid}_${corpsClass}` survivor set once the prior night has
 *   scored, null while the cut is still pending (the whole eligible field).
 */

/**
 * The fantasy cut entering an advancement round (46/48/49), from the prior
 * round's fantasy recap — or null on a day that decides nothing. Delegates to
 * `buildChampionshipConfig`, the one function that decides who the scorer
 * enrolls, so the running order can never name a corps the scorer then leaves
 * out. One doc read at most; a read failure degrades to "pending" (the whole
 * eligible field marches) rather than emptying the field.
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} seasonUid
 * @param {number} day
 * @returns {Promise<FantasyAdvancing|null>}
 */
async function loadFantasyAdvancing(db, seasonUid, day) {
  const cut = FANTASY_CUTS[day];
  if (!cut) return null;
  let recap = null;
  try {
    const snap = await db.doc(`fantasy_recaps/${seasonUid}/days/${cut.from}`).get();
    recap = snap.exists ? snap.data() : null;
  } catch {
    recap = null;
  }
  // `allRecaps` is empty on purpose: its only use is the season-standings
  // fallback for a MISSING prior night, and before that night has scored the
  // honest field is everyone eligible, not a projection of who might make it.
  const config = buildChampionshipConfig(day, new Map(recap ? [[cut.from, recap]] : []), []) || {};
  /** @type {FantasyAdvancing["byEvent"]} */
  const byEvent = {};
  for (const [eventName, value] of Object.entries(config)) {
    byEvent[eventName] = {
      participants: Array.isArray(value.participants)
        ? new Set(value.participants.map((p) => `${p.uid}_${p.corpsClass}`))
        : null,
      classFilter: Array.isArray(value.classFilter) ? value.classFilter : [],
    };
  }
  return { fromDay: cut.from, rule: cut.rule, byEvent };
}

/**
 * Narrow a championship round's eligible field to the corps actually marching
 * it. Always filters to the round's classes; on an advancement day also to the
 * prior night's survivors once that cut is decided. Returns the field plus the
 * `advancement` stamp for the schedule doc (null on a night with no cut —
 * Prelims, and the SoundSport festival, which is never cut).
 *
 * The scorer's config is matched by event name first; a renamed round falls
 * back to the entry whose class filter covers the round's classes, so a
 * branding change never silently drops the cut.
 *
 * @param {Object} comp - The schedule entry.
 * @param {Array<{uid:string|null, corpsClass:string}>} registrations
 * @param {FantasyAdvancing|null} advancing
 * @returns {{registrations: Array<Object>,
 *   advancement: {fromDay:number, rule:string, status:("pending"|"final")}|null}}
 */
function applyChampionshipCut(comp, registrations, advancing) {
  const classes = championshipClassesOf(comp);
  let field = classes.length
    ? registrations.filter((r) => classes.includes(classIdOf(r.corpsClass) || r.corpsClass))
    : registrations;
  if (!advancing) return { registrations: field, advancement: null };

  const entry =
    advancing.byEvent[comp.name] ||
    Object.values(advancing.byEvent).find(
      (v) => classes.length > 0 && classes.every((c) => v.classFilter.includes(c))
    ) ||
    null;
  if (!entry) return { registrations: field, advancement: null };

  // A festival stage (SoundSport only) rides the same config but is never cut.
  const cutRound = entry.classFilter.some((c) => c !== "soundSport");
  if (!cutRound) return { registrations: field, advancement: null };

  field = field.filter((r) => entry.classFilter.includes(r.corpsClass));
  if (entry.participants) {
    field = field.filter((r) => entry.participants.has(`${r.uid}_${r.corpsClass}`));
  }
  return {
    registrations: field,
    advancement: {
      fromDay: advancing.fromDay,
      rule: advancing.rule,
      status: entry.participants ? "final" : "pending",
    },
  };
}

/**
 * The eligible fantasy field for a championship round when the registration
 * index has no doc for it yet (the nightly rebuild hasn't run since the
 * rounds were folded in): every corps the season standings know in the
 * round's classes. Zero extra reads — the standings are already loaded for
 * the slotting metric. SoundSport isn't ranked, so the festival waits for the
 * index. Standings rows carry no home geo, so no proximity encore from here.
 * @param {Object} comp
 * @param {Map<string, Object>} metric - `${uid}_${class}` → standings entry.
 * @returns {Array<{uid:string, corpsClass:string, corpsName:string, homeGeo:null, encoreDeclined:boolean}>}
 */
function championshipFieldFromStandings(comp, metric) {
  const classes = championshipClassesOf(comp);
  const out = [];
  for (const entry of metric.values()) {
    if (!entry || !entry.uid || !classes.includes(entry.corpsClass)) continue;
    out.push({
      uid: entry.uid,
      corpsClass: entry.corpsClass,
      corpsName: entry.corpsName || entry.corps || "Unnamed Corps",
      homeGeo: null,
      encoreDeclined: false,
    });
  }
  return out;
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
  const night = sched.night ? `${sched.night.day}:${sched.night.status}` : "";
  const adv = sched.advancement ? `${sched.advancement.fromDay}:${sched.advancement.status}` : "";
  return `${sched.fieldSize}|${sched.intervalMin}|${sched.scoresAt}|${sched.overflow.length}|${night}|${adv}|${ids}`;
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
      fieldMask: [...PODIUM_REGISTRATION_FIELDS],
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
  // The published Eastern night snake seats each corps on one night of the
  // two-night major; null before Day 39 (uid-parity fallback, like scoring).
  let easternAssignments = null;
  if (podiumOn) {
    try {
      podiumEntries = await (deps.loadPodiumEntries || loadPodiumEntries)(db, seasonId);
      easternAssignments = await podiumStore.loadEasternAssignments(db, seasonId);
    } catch (err) {
      logger.warn(`[running-order] podium roster read failed: ${err.message}`);
    }
  }
  // The fantasy field's Eastern night assignment (helpers/easternSplit.js):
  // final once night one has scored, the day-38+ preview before that, null
  // until anything is published (provisional snake per show below).
  let fantasyNightIndex = null;
  try {
    fantasyNightIndex = await loadNightAssignmentIndex(db, seasonId);
  } catch (err) {
    logger.warn(`[running-order] eastern night assignment read failed: ${err.message}`);
  }
  // Cut survivors per advancement round (46/48/49), read lazily once per day
  // the walk actually reaches; null = no cut known yet, the whole field marches.
  const advancingByDay = new Map();
  const advancingFor = async (day) => {
    if (!advancingByDay.has(day)) {
      advancingByDay.set(day, await loadPodiumAdvancing(db, seasonId, day));
    }
    return advancingByDay.get(day);
  };
  // The fantasy side's cut, from the prior night's fantasy recap — same
  // laziness, one read per advancement day the walk reaches.
  const fantasyAdvancingByDay = new Map();
  const fantasyAdvancingFor = async (day) => {
    if (!fantasyAdvancingByDay.has(day)) {
      fantasyAdvancingByDay.set(day, await loadFantasyAdvancing(db, seasonId, day));
    }
    return fantasyAdvancingByDay.get(day);
  };

  let updated = 0;
  let built = 0;
  const out = [];
  // Encore is assigned in a second, date-ordered pass so the 1-per-season cap is
  // consumed chronologically. Frozen (pre-window) shows seed the used set; window
  // shows are (re)assigned. { entry, registrations, venueGeo, hostUid }.
  // The Podium side runs its own independent track — its own field, its own
  // season cap — so a director can be the encore on both games; the corpsClass
  // in encoreKey ("podiumClass" vs the fantasy classes) keeps the two apart.
  const encoreCandidates = [];
  const usedKeys = new Set();
  const podiumEncoreCandidates = [];
  const podiumUsedKeys = new Set();
  for (const comp of competitions) {
    const entry = { ...comp };
    const date = competitionDate(comp, seasonStartDate);
    const daysFromNow = date ? Math.floor((date.getTime() - now) / DAY_MS) : null;
    // Materialize the whole REMAINING season, not a near window — a show's
    // running order should appear as soon as any corps registers for it, however
    // far out. Past shows (before yesterday) freeze.
    const isUpcoming = daysFromNow !== null && daysFromNow >= -1;

    // A frozen past show's encore already consumed that corps' season slot.
    if (daysFromNow !== null && daysFromNow < -1) {
      if (comp.encore && comp.encore.uid) usedKeys.add(encoreKey(comp.encore));
      if (comp.podiumEncore && comp.podiumEncore.uid) {
        podiumUsedKeys.add(encoreKey(comp.podiumEncore));
      }
    }

    if (date && isUpcoming) {
      // A two-night event (the Eastern Classic) is ONE registration covering
      // both nights, stored under the FIRST night's entry (showSelection
      // .resolveShowsAgainstSchedule) — so its index doc is keyed by night
      // one's week + date, whichever night is being materialized.
      const twoNight = isTwoNightShow(comp) && !isChampionship(comp);
      const nights = twoNight
        ? (Array.isArray(comp.multiNight?.nights) && comp.multiNight.nights.length > 1
          ? comp.multiNight.nights
          : EASTERN_NIGHTS)
        : null;
      const regComp = twoNight
        ? competitions.find((c) => c && c.name === comp.name && c.day === nights[0]) || comp
        : comp;
      const week = regComp.week || Math.ceil((regComp.day || 1) / 7);
      const eventKey = showRegistrationEventKey(week, comp.name, regComp.date ?? null);
      try {
        // One venue geocode, shared by both sides' proximity encore.
        const venueGeo = homeGeoFor(comp.location);
        // --- Fantasy running order (from the registration index) ---
        // Championship rounds are auto-enrolled by class: the index carries
        // them once the nightly rebuild has folded the schedule in; until then
        // the standings stand in, and an advancement round is narrowed to the
        // prior night's cut below.
        {
          const championship = isChampionship(comp);
          const regSnap = await db.doc(paths.showRegistrationEvent(seasonId, eventKey)).get();
          let registrations = regSnap.exists
            ? Object.values(regSnap.data().registrations || {}).map((r) => ({
                uid: r.uid || null,
                corpsClass: r.corpsClass,
                corpsName: r.corpsName || "Unnamed Corps",
                homeGeo: r.homeGeo || null,
                encoreDeclined: r.encoreDeclined === true,
              }))
            : championship
              ? championshipFieldFromStandings(comp, metric)
              : [];
          let advancement = null;
          if (championship && Number.isFinite(comp.day)) {
            const cut = applyChampionshipCut(
              comp,
              registrations,
              await fantasyAdvancingFor(comp.day)
            );
            registrations = cut.registrations;
            advancement = cut.advancement;
          }
          // Each corps marches ONE night of a two-night event: seat only this
          // night's assignment (published snake, else the provisional one) —
          // the whole field on both nights is the bug this replaces.
          let night = null;
          if (twoNight && Number.isFinite(comp.day)) {
            const seated = nightFieldFor({
              registrations,
              night: comp.day,
              nights,
              seasonUid: seasonId,
              index: fantasyNightIndex,
              scoreFor: (uid, cls) => {
                const m = metricFor(uid, cls);
                return m ? Number(m.totalScore ?? m.score) || 0 : 0;
              },
            });
            registrations = seated.registrations;
            night = { day: comp.day, nights: [...nights], status: seated.status };
          }
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
          if (night) fantasy.night = night;
          if (advancement) fantasy.advancement = advancement;
          // Write when there's a field, or to CLEAR a schedule whose field emptied.
          // An always-empty far-out show writes nothing (no churn).
          if (
            (fantasy.fieldSize > 0 || comp.fantasySchedule) &&
            scheduleSignature(comp.fantasySchedule) !== scheduleSignature(fantasy)
          ) {
            updated += 1;
            entry.fantasySchedule = { ...fantasy, updatedAt: new Date().toISOString() };
          }

          // Stash for the chronological encore pass (fantasy field only). Only
          // shows with a field can have an encore; skip empty ones.
          if (registrations.length > 0) {
            encoreCandidates.push({
              entry,
              date,
              registrations,
              venueGeo,
              hostUid: comp.hostUid || null,
            });
          }
        }

        // --- Podium running order (from the podium roster; 9 PM ET year-round) ---
        // Self-picks by name, plus the auto-attended majors / championship
        // rounds — the same field the nightly processor scores that night.
        if (podiumOn && Number.isFinite(comp.day)) {
          const pField = collectPodiumRegistrations(podiumEntries, {
            day: comp.day,
            eventName: comp.name,
            activeSeasonId: seasonId,
            show: comp,
            easternAssignments,
            advancing: await advancingFor(comp.day),
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
          if (
            (podium.fieldSize > 0 || comp.podiumSchedule) &&
            scheduleSignature(comp.podiumSchedule) !== scheduleSignature(podium)
          ) {
            updated += 1;
            entry.podiumSchedule = { ...podium, updatedAt: new Date().toISOString() };
          }

          // Stash the podium field for its own chronological encore pass.
          if (pField.length > 0) {
            podiumEncoreCandidates.push({
              entry,
              date,
              registrations: pField,
              venueGeo,
              hostUid: comp.hostUid || null,
            });
          }
        }
      } catch (err) {
        logger.warn(`[running-order] build failed for ${comp.name}: ${err.message}`);
      }
    }
    out.push(entry);
  }

  // Encore pass: assign in date order so the season cap is consumed
  // chronologically. Each assignment marks that corps used for later shows.
  // Fantasy and Podium run as independent tracks (separate fields, separate
  // used-key sets), writing to `entry.encore` and `entry.podiumEncore`.
  const sig = (e) => (e && e.uid ? `${e.uid}|${e.reason}` : "");
  const runEncorePass = (candidates, keys, field) => {
    candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
    for (const cand of candidates) {
      const encore = assignEncore({
        registrations: cand.registrations,
        venueGeo: cand.venueGeo,
        usedKeys: keys,
        hostUid: cand.hostUid,
      });
      if (encore) keys.add(encoreKey(encore));
      if (sig(cand.entry[field]) !== sig(encore)) {
        updated += 1;
        cand.entry[field] = encore; // may be null → clears a stale encore
      }
    }
  };
  runEncorePass(encoreCandidates, usedKeys, "encore");
  runEncorePass(podiumEncoreCandidates, podiumUsedKeys, "podiumEncore");

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
exports.loadFantasyAdvancing = loadFantasyAdvancing;
exports.applyChampionshipCut = applyChampionshipCut;
exports.championshipFieldFromStandings = championshipFieldFromStandings;

exports.scheduledScheduleRunningOrder = onSchedule(
  {
    // Morning pass, after the overnight scoring/standings pipeline settles, so
    // the recent-performance metric reflects last night's results.
    schedule: "0 6 * * *",
    timeZone: "America/New_York",
    timeoutSeconds: 300,
    memory: "256MiB",
    cpu: 1,
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
    cpu: 1,
  },
  async () => {
    logger.info("Starting evening running-order refresh");
    const result = await enrichScheduleRunningOrdersLogic(getDb());
    logger.info("Completed evening running-order refresh", result);
  }
);
