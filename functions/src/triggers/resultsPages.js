// Public results pages (see helpers/resultsPages.js for the layout layer).
// Backs the /results/** hosting rewrite on both hosts: crawlable HTML for
// season indexes and nightly results, cached at the CDN.

const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const {
  buildDayResultsHtml,
  buildSeasonIndexHtml,
  buildErrorPageHtml,
  parseResultsPath,
} = require("../helpers/resultsPages");

/**
 * The response object as typed by firebase-functions' onRequest handler.
 * Deriving it from onRequest (rather than `import("express").Response`) pins
 * the type to the @types/express copy firebase-functions bundles: jwks-rsa
 * (via firebase-admin) drags a second, incompatible major to the top level,
 * and the two Response types are not assignable to each other.
 *
 * @typedef {Parameters<Parameters<typeof onRequest>[0]>[1]} ExpressResponse
 */

/**
 * Error responses used to be bare strings. Express serves a string as
 * text/html, so they rendered as an unstyled document with no charset, no
 * viewport, and no links — a dead end for a crawler or a phone. Send real
 * pages instead.
 *
 * @param {ExpressResponse} res
 * @param {number} status
 * @param {{title: string, heading: string, message: string, cacheControl: string}} params
 */
function sendErrorPage(res, status, { title, heading, message, cacheControl }) {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", cacheControl);
  res.status(status).send(buildErrorPageHtml({ title, heading, message }));
}

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
    cpu: 1,
  },
  async (req, res) => {
    const route = parseResultsPath(req.path);
    if (!route) {
      sendErrorPage(res, 404, {
        title: "Page Not Found | marching.art",
        heading: "No such results page",
        message:
          "That URL doesn't match a season or a scored day. Browse the seasons below.",
        cacheControl: "public, max-age=300, s-maxage=3600",
      });
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
          sendErrorPage(res, 404, {
            title: "No Active Season | marching.art",
            heading: "No active season",
            message: "There's no season running right now. Past results are still here.",
            cacheControl: "public, max-age=300, s-maxage=3600",
          });
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
        sendErrorPage(res, 404, {
          title: "No Results Yet | marching.art",
          heading: "No results here yet",
          message: "Scores land nightly around 2 AM ET. Try another day or season.",
          cacheControl: "public, max-age=300, s-maxage=3600",
        });
        return;
      }

      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", RESULTS_CACHE_CONTROL);
      res.status(200).send(html);
    } catch (error) {
      logger.error("Error rendering results page:", error);
      sendErrorPage(res, 500, {
        title: "Results Unavailable | marching.art",
        heading: "Results temporarily unavailable",
        message: "Something went wrong loading this page. Please try again in a moment.",
        cacheControl: "no-store",
      });
    }
  }
);

module.exports = {
  getResultsPageHttp: exports.getResultsPageHttp,
  listScoredDays,
};
