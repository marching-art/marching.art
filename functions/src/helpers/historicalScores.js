const { logger } = require("firebase-functions/v2");

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
 * @param {FirebaseFirestore.Firestore} db
 * @param {string|number} year - Calendar year; used as the document id.
 * @param {Object} newEventData - { eventName, date, location, scores, headerMap, offSeasonDay }
 * @returns {Promise<void>}
 */
async function mergeEventIntoHistoricalScores(db, year, newEventData) {
  const docId = year.toString();
  const yearDocRef = db.collection("historical_scores").doc(docId);

  await db.runTransaction(async (transaction) => {
    const yearDoc = await transaction.get(yearDocRef);

    if (!yearDoc.exists) {
      logger.info(`Creating new historical_scores document for year ${year}.`);
      transaction.set(yearDocRef, { data: [newEventData] });
      return;
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
      return;
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
  });
}

module.exports = { mergeEventIntoHistoricalScores };
