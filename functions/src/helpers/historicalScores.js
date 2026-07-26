const { logger } = require("firebase-functions/v2");
const { postOpsAlert } = require("./opsAlerts");

// Firestore hard-caps documents at 1 MiB, and historical_scores/{year}
// accretes a whole season's events into one array — a season with an unusual
// number of events would hit the cap as a hard write failure at 2 AM. Alert
// while there is still headroom instead. (Sharding the year into a
// subcollection is the real fix, deliberately out of scope here.)
const SIZE_ALERT_BYTES = 700 * 1024;

/**
 * Read the ops webhook without throwing when the secret isn't bound to the
 * calling function (mirrors dciFetch's readApiKey). Returns "" — which
 * disables postOpsAlert — so the guard degrades to its logger.error line.
 * @returns {string}
 */
function readOpsWebhookUrl() {
  try {
    const { discordOpsWebhookUrl } = require("./discord");
    return discordOpsWebhookUrl.value() || "";
  } catch {
    return "";
  }
}

/**
 * Merge one scored event into the historical_scores/{year} document, inside a
 * transaction. Shared by the DCI and live-score recap pubsub handlers, which
 * previously each carried a byte-for-byte copy of this merge logic.
 *
 * Merge rules (idempotent, additive — never overwrites existing data):
 *  - No year document yet     -> create it with this event.
 *  - Event not present         -> append it.
 *  - Event already present     -> add any missing corps, and fill only
 *                                 blank/zero captions on existing corps. If
 *                                 nothing changed, skip the write.
 *
 * Overwrite mode (`newEventData.overwrite === true`, used only by the admin
 * day-range backfill to CORRECT bad data): an existing corps' total score and
 * every caption are REPLACED with the freshly scraped values rather than only
 * filling blanks. New corps are still appended. Never enabled by the nightly or
 * deep-scrape paths, which omit the flag.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string|number} year - Calendar year; used as the document id.
 * @param {Object} newEventData - { eventName, date, location, scores, headerMap, offSeasonDay, overwrite? }
 * @param {Object} [options]
 * @param {typeof postOpsAlert} [options.postAlert] - Injectable for tests.
 * @returns {Promise<void>}
 */
async function mergeEventIntoHistoricalScores(db, year, newEventData, { postAlert = postOpsAlert } = {}) {
  const docId = year.toString();
  const yearDocRef = db.collection("historical_scores").doc(docId);

  // Every branch returns the serialized size of the year's data array (as
  // written, or as-is when nothing changed) so the size guard below can warn
  // before Firestore's 1 MiB cap turns the nightly archive into a hard fail.
  const approxBytes = await db.runTransaction(async (transaction) => {
    const yearDoc = await transaction.get(yearDocRef);

    if (!yearDoc.exists) {
      logger.info(`Creating new historical_scores document for year ${year}.`);
      transaction.set(yearDocRef, { data: [newEventData] });
      return JSON.stringify([newEventData]).length;
    }

    const existingData = yearDoc.data().data || [];
    const eventIndex = existingData.findIndex((event) =>
      event.eventName === newEventData.eventName &&
      new Date(event.date).getTime() === new Date(newEventData.date).getTime()
    );

    if (eventIndex === -1) {
      const updatedData = [...existingData, newEventData];
      logger.info(`Appending new event to historical_scores/${year}. Total events: ${updatedData.length}`);
      transaction.update(yearDocRef, { data: updatedData });
      return JSON.stringify(updatedData).length;
    }

    logger.info(`Event "${newEventData.eventName}" already exists. Checking for missing scores to merge.`);
    const eventToUpdate = existingData[eventIndex];
    let hasBeenUpdated = false;

    for (const newScore of newEventData.scores) {
      const existingScoreIndex = eventToUpdate.scores.findIndex((s) => s.corps === newScore.corps);

      if (existingScoreIndex === -1) {
        eventToUpdate.scores.push(newScore);
        hasBeenUpdated = true;
        logger.info(`Adding missing corps entry for ${newScore.corps}.`);
      } else if (newEventData.overwrite) {
        // Backfill/correct mode: replace the existing total + captions outright.
        const existingScore = eventToUpdate.scores[existingScoreIndex];
        existingScore.score = newScore.score;
        existingScore.captions = { ...newScore.captions };
        hasBeenUpdated = true;
        logger.info(`Overwrote score + captions for ${newScore.corps}.`);
      } else {
        const existingScore = eventToUpdate.scores[existingScoreIndex];
        let captionsUpdated = false;
        for (const caption in newScore.captions) {
          if (newScore.captions[caption] > 0 &&
            (!existingScore.captions[caption] || existingScore.captions[caption] === 0)) {
            existingScore.captions[caption] = newScore.captions[caption];
            captionsUpdated = true;
          }
        }
        if (captionsUpdated) {
          hasBeenUpdated = true;
          logger.info(`Updated captions for ${newScore.corps}.`);
        }
      }
    }

    if (hasBeenUpdated) {
      existingData[eventIndex] = eventToUpdate;
      transaction.update(yearDocRef, { data: existingData });
      logger.info(`Successfully merged new scores into event: ${newEventData.eventName}`);
    } else {
      logger.info(`No new scores to merge for event: ${newEventData.eventName}. Skipping.`);
    }
    return JSON.stringify(existingData).length;
  });

  // Size guard, outside the transaction (which may retry): warn the operator
  // while there is still headroom before the 1 MiB cap. Best-effort — the
  // merge itself already succeeded, and postAlert never throws.
  if (approxBytes > SIZE_ALERT_BYTES) {
    const sizeKb = Math.round(approxBytes / 1024);
    logger.error(
      `[historical-scores] historical_scores/${docId} is ~${sizeKb}KB, past the ` +
      `${Math.round(SIZE_ALERT_BYTES / 1024)}KB soft limit and approaching Firestore's 1MiB ` +
      "document cap — the nightly archive will start hard-failing when it lands. " +
      "Shard the year into a subcollection before that happens."
    );
    await postAlert(readOpsWebhookUrl(), {
      title: `historical_scores/${docId} nearing Firestore's 1MiB document cap`,
      source: "historical-scores",
      severity: "warning",
      summary:
        `The year document is ~${sizeKb}KB. When it crosses 1MiB, every nightly archive write ` +
        "for the year fails hard — shard the season into a subcollection before then.",
      details: [`historical_scores/${docId}: ~${sizeKb}KB (soft limit ${Math.round(SIZE_ALERT_BYTES / 1024)}KB)`],
    });
  }
}

module.exports = { mergeEventIntoHistoricalScores, SIZE_ALERT_BYTES };
