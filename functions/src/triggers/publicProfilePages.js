// Public director profile pages (see helpers/publicProfilePages.js for the
// layout/allowlist layer). Backs the /d/** hosting rewrite on both hosts:
// crawlable HTML for a director's public profile, cached at the CDN.
//
// Like /results/**, the rewrite serves this SSR page to crawlers AND humans —
// there is deliberately no SPA route for /d (see the rewrite ordering note in
// firebase.json: /d/** resolves before the ** -> index.html catch-all, so a
// React route would only ever be reachable by client-side navigation and the
// same URL would render two different documents). Signed-in directors get a
// door back into the app via the page's "Open in marching.art" link, which
// lands on the auth-walled /profile/@{username} route.

const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { paths } = require("../helpers/paths");
const { buildErrorPageHtml } = require("../helpers/resultsPages");
const {
  parseDirectorPath,
  isProfilePrivate,
  buildDirectorPageHtml,
  buildPrivateDirectorPageHtml,
} = require("../helpers/publicProfilePages");

/**
 * Same styled error responses as the results pages — a crawler or a phone
 * hitting a dead username gets a real page with a way back into the site.
 *
 * @param {import("express").Response} res
 * @param {number} status
 * @param {{title: string, heading: string, message: string, cacheControl: string}} params
 */
function sendErrorPage(res, status, { title, heading, message, cacheControl }) {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", cacheControl);
  res.status(status).send(buildErrorPageHtml({ title, heading, message, canonicalPath: "/" }));
}

// Profiles move with play (stats, corps, level), so cache lighter than the
// immutable results pages: browser 10m, CDN 6h, stale for a day. Same policy
// as the /share pages, whose data churns at the same cadence.
const PROFILE_CACHE_CONTROL =
  "public, max-age=600, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=86400";

/**
 * Resolve a username to its profile doc via the usernames/{lower} reservation
 * index (the same index the updateUsername callable maintains transactionally).
 * Returns null when the name is unclaimed, the profile is gone, or the
 * reservation is stale (profile renamed but old reservation lingered).
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {string} username Case-insensitive username from the URL.
 * @returns {Promise<{uid: string, data: Object} | null>}
 */
async function resolveDirectorProfile(db, username) {
  const key = username.toLowerCase();
  const reservation = await db.doc(`usernames/${key}`).get();
  if (!reservation.exists) return null;
  const uid = reservation.data().uid;
  if (!uid || typeof uid !== "string") return null;

  const profileDoc = await db.doc(paths.userProfile(uid)).get();
  if (!profileDoc.exists) return null;
  const data = profileDoc.data();
  // Guard against a stale reservation: the profile's current username is the
  // source of truth for which URL this director owns.
  if (typeof data.username !== "string" || data.username.toLowerCase() !== key) return null;
  return { uid, data };
}

exports.getPublicProfilePageHttp = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (req, res) => {
    const route = parseDirectorPath(req.path);
    if (!route) {
      sendErrorPage(res, 404, {
        title: "Director Not Found | marching.art",
        heading: "No director page here",
        message:
          "That URL doesn't match a director profile. Usernames are 3-15 letters, numbers, or underscores.",
        cacheControl: "public, max-age=300, s-maxage=3600",
      });
      return;
    }

    try {
      const db = getDb();
      const resolved = await resolveDirectorProfile(db, route.username);

      if (!resolved) {
        // Proper 404 (not a redirect) so crawlers drop dead usernames.
        sendErrorPage(res, 404, {
          title: "Director Not Found | marching.art",
          heading: "No director by that name",
          message:
            "No marching.art director uses that username. They may have renamed, or the profile was deleted.",
          cacheControl: "public, max-age=300, s-maxage=3600",
        });
        return;
      }

      // One canonical URL per director: the stored username's exact casing.
      if (resolved.data.username !== route.username) {
        res.set("Cache-Control", "public, max-age=300, s-maxage=3600");
        res.redirect(301, `/d/${encodeURIComponent(resolved.data.username)}`);
        return;
      }

      if (isProfilePrivate(resolved.data)) {
        res.set("Content-Type", "text/html; charset=utf-8");
        // Short-cache the stub so flipping visibility back on shows up fast.
        res.set("Cache-Control", "public, max-age=300, s-maxage=3600");
        res.status(200).send(buildPrivateDirectorPageHtml({ username: resolved.data.username }));
        return;
      }

      const html = buildDirectorPageHtml({
        username: resolved.data.username,
        profile: resolved.data,
      });
      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", PROFILE_CACHE_CONTROL);
      res.status(200).send(html);
    } catch (error) {
      logger.error("Error rendering public director page:", error);
      sendErrorPage(res, 500, {
        title: "Profile Unavailable | marching.art",
        heading: "Profile temporarily unavailable",
        message: "Something went wrong loading this page. Please try again in a moment.",
        cacheControl: "no-store",
      });
    }
  }
);

module.exports = {
  getPublicProfilePageHttp: exports.getPublicProfilePageHttp,
  resolveDirectorProfile,
};
