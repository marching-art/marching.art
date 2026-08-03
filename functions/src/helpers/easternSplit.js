/**
 * Eastern Classic two-night split for the fantasy classes (Phase 6.1,
 * PODIUM.md §5.11).
 *
 * The Eastern Classic is ONE event placed on days 41 and 42
 * (`multiNight: { nights: [41, 42] }`). Registering once covers both nights;
 * each corps performs on exactly one assigned night. This module replaces the
 * v0 alphabetical half-split with the designed mechanism:
 *
 *   - BALANCED SNAKE SPLIT: within each class, registrants are seeded by
 *     current season score and snaked across the nights (seeds 1,4,5,8… one
 *     night; 2,3,6,7… the other) so both nights carry equal strength. Night
 *     parity alternates by season so no corps is structurally the Friday
 *     corps forever.
 *   - PUBLISHED IN ADVANCE: after the day-38 nightly run a preview lineup is
 *     written to the public `eastern-classic/{seasonUid}` doc — the day-39
 *     community moment ("who got Friday?").
 *   - REPUBLISHED WHILE IT CAN STILL MOVE: week-6 show selections stay
 *     editable until show night, and the seeding is a snake over whoever is
 *     enrolled — so one late registration re-seeds the corps below it and can
 *     flip a night that was already published. The preview is therefore
 *     recomputed after every run in the days 38-40 window. A recompute that
 *     moves nobody between nights keeps the current `revision`; one that does
 *     bumps it, tells the moved directors in-app, and leaves the Discord
 *     announcer (helpers/easternClassicDiscord.js) a changed lineup to post
 *     an update off.
 *   - PERSISTED ASSIGNMENT: the day-41 run computes the FINAL split from
 *     final enrollment and persists it; the day-42 run scores the stored
 *     complement. The v0 build recomputed the split from live enrollment on
 *     both nights, so a registration edit between Friday and Saturday could
 *     shift the split point and let a corps score twice — or never.
 *
 * The split logic itself is event-agnostic (any `multiNight` show works);
 * the doc path and trigger days are Eastern-specific until a second
 * two-night event exists.
 */

const { logger } = require("firebase-functions/v2");

// The Eastern Classic nights, and the run whose completion publishes the
// preview lineup (post-Atlanta standings; visible to players on day 39).
const EASTERN_NIGHTS = [41, 42];
const PREVIEW_TRIGGER_DAY = 38;
// The last run that can still republish a moved lineup in time to matter: the
// night before the event. Day 41's run computes the FINAL split, but it does
// so while scoring night one, which is too late to warn anybody.
const PREVIEW_THROUGH_DAY = EASTERN_NIGHTS[0] - 1;

function splitDocRef(db, seasonUid) {
  return db.doc(`eastern-classic/${seasonUid}`);
}

/** True for the one-event-across-two-days schedule entry. */
function isTwoNightShow(show) {
  if (!show) return false;
  if (show.multiNight && Array.isArray(show.multiNight.nights) && show.multiNight.nights.length > 1) {
    return true;
  }
  // Older schedules predate multiNight metadata; the Eastern Classic is
  // name-branded there (matches the legacy split's detection).
  return typeof show.eventName === "string" && show.eventName.includes("Eastern Classic");
}

/** The two-night show on a day's schedule, or null. */
function findTwoNightShow(dayEventData) {
  return ((dayEventData && dayEventData.shows) || []).find(isTwoNightShow) || null;
}

/**
 * Deterministic per-season parity so night assignment alternates season to
 * season (§5.11: "no corps is structurally the Friday corps forever").
 */
function seasonNightParity(seasonUid) {
  let hash = 0;
  const s = String(seasonUid);
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(hash) % 2 === 1;
}

/**
 * Collect the event's registrants across every class (pure given the
 * snapshot). Entry shape carries what the published lineup needs.
 */
function collectEnrollees(profilesSnapshot, eventName, week) {
  const enrollees = [];
  for (const userDoc of profilesSnapshot.docs) {
    const userProfile = userDoc.data();
    const uid = userDoc.ref.parent.parent.id;
    const userCorps = userProfile.corps || {};
    for (const corpsClass of Object.keys(userCorps)) {
      const corps = userCorps[corpsClass];
      if (!corps) continue;
      const userShows = (corps.selectedShows && corps.selectedShows[`week${week}`]) || [];
      if (userShows.some((s) => s && s.eventName === eventName)) {
        enrollees.push({
          key: `${uid}_${corpsClass}`,
          uid,
          corpsClass,
          corpsName: corps.corpsName || null,
          score: typeof corps.totalSeasonScore === "number" ? corps.totalSeasonScore : 0,
        });
      }
    }
  }
  return enrollees;
}

/**
 * Snake-split enrollees across two nights (pure, event-agnostic).
 *
 * Within each class, registrants are seeded by current season score
 * (descending; unscored corps seed last, uid tiebreak for determinism) and
 * snaked: seed indices 0,3,4,7,8,11… to one night, 1,2,5,6,9,10… to the
 * other — both nights get equal strength AND an even (±1) headcount per
 * class. `parity` swaps which night gets the snake's first bucket.
 *
 * @returns {{[night: string]: Array<object>}} night -> assignment entries
 *   ({key, uid, corpsClass, corpsName, seed}).
 */
function snakeSplitByClass(enrollees, nights, parity) {
  const byClass = {};
  for (const enrollee of enrollees) {
    (byClass[enrollee.corpsClass] = byClass[enrollee.corpsClass] || []).push(enrollee);
  }
  const [firstNight, secondNight] = parity ? [nights[1], nights[0]] : [nights[0], nights[1]];
  const assignments = { [String(nights[0])]: [], [String(nights[1])]: [] };
  for (const corpsClass of Object.keys(byClass).sort()) {
    const seeded = byClass[corpsClass].sort(
      (a, b) => b.score - a.score || a.key.localeCompare(b.key)
    );
    seeded.forEach((enrollee, index) => {
      const inFirstBucket = index % 4 === 0 || index % 4 === 3;
      const night = inFirstBucket ? firstNight : secondNight;
      assignments[String(night)].push({
        key: enrollee.key,
        uid: enrollee.uid,
        corpsClass: enrollee.corpsClass,
        corpsName: enrollee.corpsName,
        seed: index + 1,
      });
    });
  }
  return assignments;
}

/**
 * Flatten a night -> entries assignment map into a key -> placement index,
 * the form both the change detector and the announcer compare on.
 *
 * @param {Object} assignments - {night: [{key, uid, corpsClass, corpsName, seed}]}
 * @returns {Object} {key: {uid, corpsClass, corpsName, seed, night}}
 */
function lineupIndex(assignments) {
  const lineup = {};
  for (const [night, entries] of Object.entries(assignments || {})) {
    for (const entry of entries || []) {
      if (!entry || !entry.key) continue;
      lineup[entry.key] = {
        uid: entry.uid,
        corpsClass: entry.corpsClass,
        corpsName: entry.corpsName ?? null,
        seed: entry.seed ?? null,
        night: Number(night),
      };
    }
  }
  return lineup;
}

/**
 * What changed between two lineups (both from `lineupIndex`).
 *
 * Only NIGHT membership counts as a change. Seeds churn every time anyone's
 * season score moves — a corps sliding from seed 6 to seed 7 inside the same
 * night is not news, and treating it as such would mean an "updated lineup"
 * post almost every night. What a director needs to be told is that the day
 * they're marching is no longer the day they were told.
 *
 * @returns {{moved: Array, added: Array, removed: Array}} Entries carry the
 *   lineup fields plus `key`; `moved` also carries `from`/`to` nights.
 */
function diffLineups(previous, current) {
  const before = previous || {};
  const after = current || {};
  const moved = [];
  const added = [];
  const removed = [];

  for (const key of Object.keys(after).sort()) {
    const entry = after[key];
    const priorEntry = before[key];
    if (!priorEntry) {
      added.push({ key, ...entry });
    } else if (priorEntry.night !== entry.night) {
      moved.push({ key, ...entry, from: priorEntry.night, to: entry.night });
    }
  }
  for (const key of Object.keys(before).sort()) {
    if (!after[key]) removed.push({ key, ...before[key] });
  }
  return { moved, added, removed };
}

/** True when a diff carries anything worth telling directors about. */
function hasLineupChange(changes) {
  if (!changes) return false;
  return (
    (changes.moved || []).length > 0 ||
    (changes.added || []).length > 0 ||
    (changes.removed || []).length > 0
  );
}

/** Build one split ({assignments, counts}) from current enrollment. */
function computeSplit(profilesSnapshot, eventName, week, seasonUid, nights) {
  const enrollees = collectEnrollees(profilesSnapshot, eventName, week);
  const assignments = snakeSplitByClass(enrollees, nights, seasonNightParity(seasonUid));
  const counts = {};
  for (const night of nights) counts[String(night)] = assignments[String(night)].length;
  return { assignments, counts, enrolled: enrollees.length };
}

/**
 * The night set the scorer filters on for `scoredDay`. Reads the persisted
 * final assignment; the first night's run computes and persists it (final
 * enrollment, final standings) so the second night scores the exact
 * complement. Returns null when the day has no two-night show — the caller
 * falls back to the legacy in-loop split on any failure.
 */
async function resolveEasternNightSet(db, seasonData, profilesSnapshot, dayEventData, week, scoredDay) {
  const show = findTwoNightShow(dayEventData);
  if (!show) return null;
  const nights = (show.multiNight && show.multiNight.nights) || EASTERN_NIGHTS;
  if (!nights.includes(scoredDay)) return null;

  const ref = splitDocRef(db, seasonData.seasonUid);
  const snapshot = await ref.get();
  const existing = snapshot.exists ? snapshot.data() : {};

  let final = existing.final;
  if (!final || !final.assignments) {
    final = computeSplit(profilesSnapshot, show.eventName, week, seasonData.seasonUid, nights);
    if (scoredDay !== nights[0]) {
      // Second night with no persisted split: the first night's run never
      // landed (skipped/failed season edge). The recompute is still the
      // correct complement for THIS enrollment; log it loudly.
      logger.warn(
        `[eastern-split] no persisted final split at day ${scoredDay} — computing now.`
      );
    }
    await ref.set(
      {
        seasonUid: seasonData.seasonUid,
        eventName: show.eventName,
        nights,
        final: { ...final, finalizedAfterDay: scoredDay - 1, finalizedAt: new Date().toISOString() },
      },
      { merge: true }
    );
  }

  const nightEntries = final.assignments[String(scoredDay)] || [];
  logger.info(
    `[eastern-split] day ${scoredDay}: ${nightEntries.length} corps assigned ` +
      `(${final.enrolled ?? "?"} enrolled across ${nights.join("/")}).`
  );
  return new Set(nightEntries.map((entry) => entry.key));
}

/** "Night 1 (Day 41)" — how a night reads inside inbox prose. */
function nightLabel(night, nights) {
  const index = nights.indexOf(Number(night));
  return index >= 0 ? `Night ${index + 1} (Day ${night})` : `Day ${night}`;
}

/**
 * Tell the directors whose corps just changed nights, in their own inbox.
 *
 * Only MOVED corps are notified. A corps that just registered is seeing its
 * night for the first time (it was never told anything else) and a corps that
 * dropped the show has no night to be told about — the moved ones are the
 * only directors holding a published assignment that is now wrong.
 *
 * Best-effort by construction: `createUserNotifications` never throws, and
 * the dedupe key is keyed to the revision so a re-run of the same publish
 * overwrites rather than duplicating the inbox entry.
 */
async function notifyMovedDirectors(db, seasonUid, nights, revision, moved) {
  if (!moved || moved.length === 0) return { written: 0, skipped: 0 };
  const { createUserNotifications } = require("./userNotifications");
  return createUserNotifications(
    db,
    moved.map((entry) => ({
      uid: entry.uid,
      type: "eastern_night_change",
      title: "Your Eastern Classic night changed",
      message:
        `${entry.corpsName || "Your corps"} now performs ${nightLabel(entry.to, nights)}, ` +
        `not ${nightLabel(entry.from, nights)}. The lineup re-seeds as corps register, ` +
        "and one registration still covers both nights.",
      link: "/schedule",
      dedupeKey: `eastern_night_${seasonUid}_r${revision}_${entry.corpsClass}`,
      metadata: {
        seasonUid,
        corpsClass: entry.corpsClass,
        night: entry.to,
        previousNight: entry.from,
        revision,
      },
    }))
  );
}

/**
 * Publish (or republish) the preview lineup after a days-38-40 run — players
 * see "who got Friday?" on day 39, and any re-seeding after that is
 * republished while there is still time to act on it.
 *
 * The doc is refreshed on every run in the window so seeds and names stay
 * current, but `revision` only advances when a corps actually changes nights
 * (or joins/leaves the field). That makes the revision the thing downstream
 * announcements key off: an unchanged night means an unchanged revision means
 * no post and no notification.
 *
 * Best-effort: the caller isolates failures so the nightly scorer is never at
 * risk; the final split at day 41 does not depend on the preview existing.
 *
 * @returns {Promise<?{preview: Object, revision: number, changed: boolean,
 *   changes: ?{moved: Array, added: Array, removed: Array}}>} Null when the
 *   day is outside the window or the season has no two-night show.
 */
async function publishEasternPreview(db, seasonData, profilesSnapshot, scoredDay) {
  if (scoredDay < PREVIEW_TRIGGER_DAY || scoredDay > PREVIEW_THROUGH_DAY) return null;
  const { getScheduleDay } = require("./seasonSchedule");
  const dayEventData = await getScheduleDay(seasonData.seasonUid, EASTERN_NIGHTS[0]);
  const show = findTwoNightShow(dayEventData);
  if (!show) return null;
  const nights = (show.multiNight && show.multiNight.nights) || EASTERN_NIGHTS;
  const week = Math.ceil(nights[0] / 7);

  const ref = splitDocRef(db, seasonData.seasonUid);
  const snapshot = await ref.get();
  const existing = (snapshot.exists ? snapshot.data() : null) || {};
  // A finalized split is the one the scorer uses; a preview must never be
  // written over the top of it as though it were still in play.
  if (existing.final && existing.final.assignments) return null;

  const previous = existing.preview && existing.preview.assignments ? existing.preview : null;
  const preview = computeSplit(profilesSnapshot, show.eventName, week, seasonData.seasonUid, nights);
  const changes = previous
    ? diffLineups(lineupIndex(previous.assignments), lineupIndex(preview.assignments))
    : null;
  const changed = !previous || hasLineupChange(changes);
  const revision = changed ? (previous ? (previous.revision || 0) + 1 : 0) : previous.revision || 0;

  await ref.set(
    {
      seasonUid: seasonData.seasonUid,
      eventName: show.eventName,
      nights,
      preview: {
        ...preview,
        computedAfterDay: scoredDay,
        publishedAt: new Date().toISOString(),
        revision,
      },
    },
    { merge: true }
  );

  if (!changed) {
    logger.info(
      `[eastern-split] preview refreshed after day ${scoredDay}: no night changes ` +
        `(revision ${revision} stands).`
    );
    return { preview, revision, changed: false, changes };
  }

  logger.info(
    `[eastern-split] preview revision ${revision} published after day ${scoredDay}: ` +
      `${preview.enrolled} enrolled (${nights.map((n) => preview.counts[String(n)]).join("/")})` +
      (changes
        ? `, ${changes.moved.length} moved / ${changes.added.length} added / ` +
          `${changes.removed.length} dropped.`
        : ".")
  );
  if (changes) {
    await notifyMovedDirectors(db, seasonData.seasonUid, nights, revision, changes.moved);
  }
  return { preview, revision, changed: true, changes };
}

module.exports = {
  EASTERN_NIGHTS,
  PREVIEW_TRIGGER_DAY,
  PREVIEW_THROUGH_DAY,
  splitDocRef,
  isTwoNightShow,
  findTwoNightShow,
  seasonNightParity,
  collectEnrollees,
  snakeSplitByClass,
  lineupIndex,
  diffLineups,
  hasLineupChange,
  computeSplit,
  resolveEasternNightSet,
  publishEasternPreview,
};
