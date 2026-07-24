// Public sitemap endpoint. The SPA previously shipped a hand-maintained
// 7-URL public/sitemap.xml, which left every article page invisible to
// search engines. This endpoint emits the static public routes plus one URL
// per published article (the /article/:id pages are crawlable and now carry
// per-article meta), served through the same hosting rewrite + CDN-cache
// pattern as getNewsFeedHttp. robots.txt already points crawlers at
// /sitemap.xml, so no robots change is needed.

const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");

// Public, crawlable routes (see robots.txt for the disallow list these must
// stay out of). lastmod is intentionally omitted for static routes — a fake
// date teaches crawlers to distrust the field.
const STATIC_ROUTES = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/how-to-play", changefreq: "monthly", priority: "0.9" },
  { path: "/podium-guide", changefreq: "monthly", priority: "0.8" },
  { path: "/preview", changefreq: "weekly", priority: "0.8" },
  { path: "/podium", changefreq: "monthly", priority: "0.7" },
  { path: "/podium/preview", changefreq: "monthly", priority: "0.6" },
  { path: "/hall-of-champions", changefreq: "weekly", priority: "0.7" },
  { path: "/register", changefreq: "yearly", priority: "0.5" },
  { path: "/login", changefreq: "yearly", priority: "0.3" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

// Sitemaps cap at 50k URLs; articles accrue ~a handful per game day, so this
// bound is years of headroom while keeping the query and payload sane.
const MAX_ARTICLE_URLS = 5000;

// Server-side cache shares the news feed's collection on purpose: admin
// article writes call invalidateNewsCache (triggers/newsFeed.js), which
// clears the whole collection — deleting or archiving an article refreshes
// the sitemap through the same path.
const CACHE_COLLECTION = "news_feed_cache";
const CACHE_DOC_ID = "sitemap_xml";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // regenerated at most 4x/day

const SITE_URL = "https://marching.art";

/** @param {string} value */
const escapeXml = (value) =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/**
 * Render the sitemap XML. Pure — exported for unit tests.
 *
 * @param {Array<{path: string, changefreq: string, priority: string}>} staticRoutes
 * @param {Array<{id: string, lastmod?: string}>} articles
 *   Article page entries; lastmod is a YYYY-MM-DD string when known.
 * @returns {string}
 */
function buildSitemapXml(staticRoutes, articles) {
  const urls = [];

  for (const route of staticRoutes) {
    urls.push(
      "  <url>\n" +
        `    <loc>${SITE_URL}${escapeXml(route.path)}</loc>\n` +
        `    <changefreq>${route.changefreq}</changefreq>\n` +
        `    <priority>${route.priority}</priority>\n` +
        "  </url>"
    );
  }

  for (const article of articles) {
    urls.push(
      "  <url>\n" +
        `    <loc>${SITE_URL}/article/${escapeXml(article.id)}</loc>\n` +
        (article.lastmod ? `    <lastmod>${escapeXml(article.lastmod)}</lastmod>\n` : "") +
        "    <changefreq>monthly</changefreq>\n" +
        "    <priority>0.6</priority>\n" +
        "  </url>"
    );
  }

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") +
    "\n</urlset>\n"
  );
}

/**
 * Map a published-article Firestore doc to a sitemap entry. The article page
 * route id is `${seasonId}_${dayId}_${articleType}` — the same composite id
 * the news feed builds and src/api/articles.ts resolves.
 *
 * @param {FirebaseFirestore.QueryDocumentSnapshot} doc
 * @returns {{id: string, lastmod?: string}}
 */
function articleEntryFromDoc(doc) {
  // Path format: news_hub/{seasonId}/days/day_{n}/articles/{type}
  const pathParts = doc.ref.path.split("/");
  const seasonId = pathParts[1];
  const dayId = pathParts[3];
  const data = doc.data();

  const updated = data.updatedAt || data.createdAt;
  const date = updated && typeof updated.toDate === "function" ? updated.toDate() : null;

  return {
    id: `${seasonId}_${dayId}_${doc.id}`,
    ...(date ? { lastmod: date.toISOString().slice(0, 10) } : {}),
  };
}

/**
 * HTTP endpoint backing the /sitemap.xml hosting rewrite (firebase.json and
 * vercel.json). Same layered caching as getNewsFeedHttp: Firestore doc as
 * the origin cache, CDN s-maxage on top.
 */
exports.getSitemapHttp = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (req, res) => {
    const db = getDb();
    const cacheRef = db.collection(CACHE_COLLECTION).doc(CACHE_DOC_ID);

    const sendXml = (/** @type {string} */ xml, /** @type {string} */ cacheStatus) => {
      res.set("Content-Type", "application/xml; charset=utf-8");
      // Browser 1h; CDN 6h; serve stale for a day while revalidating or on error.
      res.set(
        "Cache-Control",
        "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=86400"
      );
      res.set("X-Cache-Status", cacheStatus);
      res.status(200).send(xml);
    };

    try {
      const cacheDoc = await cacheRef.get();
      if (cacheDoc.exists) {
        const cached = cacheDoc.data();
        if (cached.xml && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          sendXml(cached.xml, "HIT");
          return;
        }
      }

      const snapshot = await db
        .collectionGroup("articles")
        .where("isPublished", "==", true)
        .orderBy("createdAt", "desc")
        .limit(MAX_ARTICLE_URLS)
        .select("createdAt", "updatedAt")
        .get();

      const articles = snapshot.docs.map(articleEntryFromDoc);
      const xml = buildSitemapXml(STATIC_ROUTES, articles);

      // Best-effort cache write; a failed write must not fail the response.
      try {
        await cacheRef.set({ xml, timestamp: Date.now(), cachedAt: new Date().toISOString() });
      } catch (cacheError) {
        logger.warn("Failed to cache sitemap:", cacheError);
      }

      sendXml(xml, "MISS");
    } catch (error) {
      logger.error("Error generating sitemap:", error);
      // Degrade to the static routes alone rather than a 500 — an empty
      // sitemap response can get the URL dropped from crawler schedules.
      res.set("Content-Type", "application/xml; charset=utf-8");
      res.set("Cache-Control", "no-store");
      res.status(200).send(buildSitemapXml(STATIC_ROUTES, []));
    }
  }
);

module.exports = {
  getSitemapHttp: exports.getSitemapHttp,
  buildSitemapXml,
  articleEntryFromDoc,
  STATIC_ROUTES,
};
