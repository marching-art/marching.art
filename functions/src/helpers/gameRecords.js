/**
 * Records Book — all-time game records.
 *
 * A single public doc (game-records/records) holds the best-ever marks per
 * competitive class: highest single-night score, highest GE / Visual / Music,
 * and best season total, each with the record-holder's name, corps, season,
 * and day. SoundSport is excluded — it's deliberately non-competitive.
 *
 * Updated incrementally after each nightly scoring run (scoring.js) and at
 * season archival for season-total records (season.js). A full rebuild from
 * every archived recap is available via manualTrigger("rebuildGameRecords")
 * to backfill history when this ships.
 */

const { logger } = require("firebase-functions/v2");

const RECORDS_DOC_PATH = "game-records/records";
const RECORD_CLASSES = ["worldClass", "openClass", "aClass", "podiumClass"];
const NIGHT_CATEGORIES = [
  ["highestScore", "totalScore"],
  ["highestGE", "geScore"],
  ["highestVisual", "visualScore"],
  ["highestMusic", "musicScore"],
];

/**
 * Best per-class marks from one day's recap.
 * Returns { [corpsClass]: { [category]: {value, corpsName, displayName, uid} } }
 */
function extractDayCandidates(dailyRecap) {
  const candidates = {};
  for (const show of dailyRecap.shows || []) {
    for (const result of show.results || []) {
      if (!RECORD_CLASSES.includes(result.corpsClass)) continue;
      const byClass = (candidates[result.corpsClass] = candidates[result.corpsClass] || {});
      for (const [category, field] of NIGHT_CATEGORIES) {
        const value = result[field];
        if (typeof value !== "number" || value <= 0) continue;
        if (!byClass[category] || value > byClass[category].value) {
          byClass[category] = {
            value,
            corpsName: result.corpsName || null,
            displayName: result.displayName || null,
            uid: result.uid || null,
          };
        }
      }
    }
  }
  return candidates;
}

/**
 * Merge candidate marks into the records doc; only strictly-better values
 * replace existing records. `meta` is stamped onto any new record
 * (e.g. { seasonName, day }).
 */
async function mergeRecordCandidates(db, candidates, meta) {
  const classKeys = Object.keys(candidates);
  if (classKeys.length === 0) return;

  const recordsRef = db.doc(RECORDS_DOC_PATH);
  await db.runTransaction(async (transaction) => {
    const doc = await transaction.get(recordsRef);
    const data = doc.exists ? doc.data() : {};
    const classes = data.classes || {};
    let changed = false;

    for (const corpsClass of classKeys) {
      const existing = (classes[corpsClass] = classes[corpsClass] || {});
      for (const [category, candidate] of Object.entries(candidates[corpsClass])) {
        if (!existing[category] || candidate.value > existing[category].value) {
          existing[category] = { ...candidate, ...meta };
          changed = true;
        }
      }
    }

    if (changed) {
      transaction.set(recordsRef, { ...data, classes, updatedAt: new Date() });
    }
  });
}

/**
 * Incremental update after a nightly scoring run. Never throws — a records
 * hiccup must not fail the scoring pipeline.
 */
async function updateRecordsFromRecap(db, dailyRecap, seasonName, scoredDay) {
  try {
    const candidates = extractDayCandidates(dailyRecap);
    await mergeRecordCandidates(db, candidates, { seasonName, day: scoredDay });
  } catch (error) {
    logger.error("Records update failed (scoring unaffected):", error);
  }
}

/**
 * Podium recap docs carry a per-show `shows: [{ results }]` array (legacy docs
 * used a flat `results`). Same record categories; the Podium class rides the
 * same records doc (stats-archive parity, design §14.1.6). Never throws.
 */
async function updateRecordsFromPodiumRecap(db, recap, seasonName, scoredDay) {
  try {
    const normalized = recap.shows
      ? { shows: recap.shows }
      : { shows: [{ results: recap.results || [] }] };
    const candidates = extractDayCandidates(normalized);
    await mergeRecordCandidates(db, candidates, { seasonName, day: scoredDay });
  } catch (error) {
    logger.error("Podium records update failed (scoring unaffected):", error);
  }
}

/**
 * Season-total records, called from season archival with each class's
 * top finisher: [{ corpsClass, value, corpsName, displayName, uid }].
 */
async function updateSeasonBestRecords(db, topFinishers, seasonName) {
  try {
    const candidates = {};
    for (const finisher of topFinishers) {
      if (!RECORD_CLASSES.includes(finisher.corpsClass)) continue;
      if (typeof finisher.value !== "number" || finisher.value <= 0) continue;
      candidates[finisher.corpsClass] = {
        bestSeason: {
          value: finisher.value,
          corpsName: finisher.corpsName || null,
          displayName: finisher.displayName || null,
          uid: finisher.uid || null,
        },
      };
    }
    await mergeRecordCandidates(db, candidates, { seasonName });
  } catch (error) {
    logger.error("Season-best records update failed (archival unaffected):", error);
  }
}

/**
 * Full rebuild from every archived recap (admin backfill). Also folds in
 * legacy seasons that stored recaps as an array on the parent doc.
 */
async function rebuildGameRecords(db) {
  const recapDocs = await db.collection("fantasy_recaps").listDocuments();
  let daysProcessed = 0;

  for (const recapDocRef of recapDocs) {
    const parentDoc = await recapDocRef.get();
    const seasonName = (parentDoc.exists && parentDoc.data().seasonName) || recapDocRef.id;

    const daysSnapshot = await recapDocRef.collection("days").get();
    const recaps = daysSnapshot.docs.map((d) => d.data());
    if (parentDoc.exists && Array.isArray(parentDoc.data().recaps)) {
      recaps.push(...parentDoc.data().recaps);
    }

    for (const recap of recaps) {
      const candidates = extractDayCandidates(recap);
      await mergeRecordCandidates(db, candidates, {
        seasonName,
        day: recap.offSeasonDay || null,
      });
      daysProcessed++;
    }
  }

  // Podium recap days (flat results arrays) join the same records doc.
  const podiumDocs = await db.collection("podium-recaps").listDocuments();
  for (const podiumDocRef of podiumDocs) {
    const daysSnapshot = await podiumDocRef.collection("days").get();
    for (const dayDoc of daysSnapshot.docs) {
      const recap = dayDoc.data();
      const normalized = recap.shows
        ? { shows: recap.shows }
        : { shows: [{ results: recap.results || [] }] };
      const candidates = extractDayCandidates(normalized);
      await mergeRecordCandidates(db, candidates, {
        seasonName: podiumDocRef.id,
        day: recap.competitionDay || null,
      });
      daysProcessed++;
    }
  }

  logger.info(`Rebuilt game records from ${daysProcessed} recap days across ${recapDocs.length} seasons.`);
  return { seasons: recapDocs.length + podiumDocs.length, daysProcessed };
}

module.exports = {
  RECORDS_DOC_PATH,
  updateRecordsFromRecap,
  updateRecordsFromPodiumRecap,
  updateSeasonBestRecords,
  rebuildGameRecords,
};
