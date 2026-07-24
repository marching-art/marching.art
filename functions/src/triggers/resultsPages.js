// Public results pages (see helpers/resultsPages.js for the layout layer).
// Backs the /results/** hosting rewrite on both hosts: crawlable HTML for
// season indexes and nightly results, cached at the CDN.

const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const {
  buildDayResultsHtml,
  buildSeasonIndexHtml,
  parseResultsPath,
} = require("../helpers/resultsPages");

// Scored nights never change once written (rank movement happens in later
// docs), so cache generously: browser 1h, CDN 6h, stale for a day.
const RESULTS_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=86400";

/**
 * Scored day numbers for a season, cheaply: listDocuments reads refs only
 * (no document contents billed/fetched).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} seasonUid
 * @returns {Promise<number[]>}
 */
async function listScoredDays(db, seasonUid) {
  const refs = await db.collection(`fantasy_recaps/${seasonUid}/days`).listDocuments();
  return refs
    .map((ref) => Number(ref.id))
    .filter((day) => Number.isInteger(day) && day >= 1 && day <= 49)
    .sort((a, b) => a - b);
}

/** Season display name: current-season settings doc, else the archive doc. */
async function resolveSeasonName(db, seasonUid) {
  try {
    const settings = await db.doc("game-settings/season").get();
    if (settings.exists && settings.data().seasonUid === seasonUid) {
      return settings.data().name || "";
    }
    const archived = await db.doc(`season_champions/${seasonUid}`).get();
    if (archived.exists) return archived.data().seasonName || "";
  } catch (error) {
    logger.warn("Failed to resolve season name for results page:", error);
  }
  return "";
}

exports.getResultsPageHttp = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (req, res) => {
    const route = parseResultsPath(req.path);
    if (!route) {
      res.status(404).send("Not found");
      return;
    }

    try {
      const db = getDb();

      // Bare /results → the current season's index, so static links (footer,
      // docs, posts) can point at one stable URL across season rollovers.
      if (route.seasonUid == null) {
        const settings = await db.doc("game-settings/season").get();
        const currentUid = settings.exists ? settings.data().seasonUid : null;
        if (currentUid) {
          res.redirect(302, `/results/${currentUid}`);
        } else {
          res.status(404).send("No active season");
        }
        return;
      }

      let html = null;

      if (route.day == null) {
        const [days, seasonName, championsDoc] = await Promise.all([
          listScoredDays(db, route.seasonUid),
          resolveSeasonName(db, route.seasonUid),
          db.doc(`season_champions/${route.seasonUid}`).get(),
        ]);
        html = buildSeasonIndexHtml({
          seasonUid: route.seasonUid,
          seasonName,
          days,
          champions: championsDoc.exists ? championsDoc.data() : null,
        });
      } else {
        const [recapDoc, days, seasonName] = await Promise.all([
          db.doc(`fantasy_recaps/${route.seasonUid}/days/${route.day}`).get(),
          listScoredDays(db, route.seasonUid),
          resolveSeasonName(db, route.seasonUid),
        ]);
        if (recapDoc.exists) {
          html = buildDayResultsHtml({
            seasonUid: route.seasonUid,
            seasonName,
            day: route.day,
            recap: recapDoc.data(),
            days,
          });
        }
      }

      if (!html) {
        // Proper 404 (not a redirect) so crawlers drop dead URLs instead of
        // indexing the homepage under them.
        res.set("Cache-Control", "public, max-age=300, s-maxage=3600");
        res
          .status(404)
          .send(
            "No results here (yet). Scores land nightly at " +
              '<a href="https://marching.art/">marching.art</a>.'
          );
        return;
      }

      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", RESULTS_CACHE_CONTROL);
      res.status(200).send(html);
    } catch (error) {
      logger.error("Error rendering results page:", error);
      res.set("Cache-Control", "no-store");
      res.status(500).send("Results temporarily unavailable");
    }
  }
);

module.exports = {
  getResultsPageHttp: exports.getResultsPageHttp,
  listScoredDays,
};
