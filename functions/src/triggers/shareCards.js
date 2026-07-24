// Share URLs and OG card images — the viral-loop surface. Social scrapers
// (Discord, Slack, iMessage, X, Facebook) do not execute JavaScript, so the
// SPA's client-side meta tags never reach link unfurls. In-app share actions
// therefore hand out /share/* URLs, served here with real OG tags whose
// og:image points at /api/og/* — a PNG rendered from live Firestore data.
// Humans who click a share URL are redirected to the real app route.
//
// Both endpoints back hosting rewrites in firebase.json AND vercel.json
// (kept in sync by scripts/checkHostingParity.mjs).

const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions/v2");
// sharp's dual-package typings claim a `.default` export, but the CJS
// runtime export IS the callable — cast through the type it actually has.
const sharp = /** @type {import("sharp").default} */ (
  /** @type {unknown} */ (require("sharp"))
);
const { getDb } = require("../config");
const {
  SITE_URL,
  buildScoresCardSvg,
  buildChampionCardSvg,
  buildShareHtml,
  parseOgPath,
  parseSharePath,
  clamp,
} = require("../helpers/shareCards");
const { CLASS_LABELS, aggregateNightlyStandings } = require("../helpers/scoreDrop");

const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

// Card data is historical once a day is scored, so cache hard: browsers 1h,
// CDN 24h, serve stale while revalidating. A re-render after expiry reads
// two small docs — no origin cache needed.
const CARD_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800, stale-if-error=604800";
const SHARE_CACHE_CONTROL =
  "public, max-age=600, s-maxage=21600, stale-while-revalidate=86400, stale-if-error=86400";

/** Read a fantasy_recaps day doc; null when missing. */
async function fetchDayRecap(db, seasonUid, day) {
  const snap = await db.doc(`fantasy_recaps/${seasonUid}/days/${day}`).get();
  return snap.exists ? snap.data() : null;
}

/** Read a season_champions doc; null when missing. */
async function fetchChampions(db, seasonId) {
  const snap = await db.doc(`season_champions/${seasonId}`).get();
  return snap.exists ? snap.data() : null;
}

/** Season display name for card subtitles; empty string when unavailable. */
async function fetchSeasonName(db, seasonUid) {
  try {
    const settings = await db.doc("game-settings/season").get();
    if (settings.exists && settings.data().seasonUid === seasonUid) {
      return settings.data().name || "";
    }
    const archived = await db.doc(`season_champions/${seasonUid}`).get();
    if (archived.exists) return archived.data().seasonName || "";
  } catch (error) {
    logger.warn("Failed to resolve season name for share card:", error);
  }
  return "";
}

/**
 * PNG card endpoint backing the /api/og/** rewrite.
 * 404s render nothing fancy — scrapers treat a broken og:image as absent.
 */
exports.getOgCardHttp = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
    // sharp's libvips is memory-hungrier than the default 256MiB comfortable.
    memory: "512MiB",
  },
  async (req, res) => {
    const route = parseOgPath(req.path);
    if (!route) {
      res.status(404).send("Not found");
      return;
    }

    try {
      const db = getDb();
      let svg = null;

      if (route.type === "scores") {
        const [recap, seasonName] = await Promise.all([
          fetchDayRecap(db, route.seasonUid, route.day),
          fetchSeasonName(db, route.seasonUid),
        ]);
        if (recap) {
          svg = buildScoresCardSvg({
            recap,
            day: route.day,
            classKey: route.classKey,
            seasonName,
          });
        }
      } else if (route.type === "champion") {
        const champions = await fetchChampions(db, route.seasonId);
        if (champions) {
          svg = buildChampionCardSvg({ champions, classKey: route.classKey });
        }
      }

      if (!svg) {
        res.status(404).send("No data for this card");
        return;
      }

      const png = await sharp(Buffer.from(svg)).png().toBuffer();
      res.set("Content-Type", "image/png");
      res.set("Cache-Control", CARD_CACHE_CONTROL);
      res.status(200).send(png);
    } catch (error) {
      logger.error("Error rendering OG card:", error);
      res.set("Cache-Control", "no-store");
      res.status(500).send("Card render failed");
    }
  }
);

/** Resolve a composite article id (seasonId_day_N_type) to its doc data. */
async function fetchArticle(db, articleId) {
  const match = articleId.match(/^(.+)_(day_\d+)_(.+)$/);
  if (!match) return null;
  const [, seasonId, dayId, articleType] = match;
  const snap = await db.doc(`news_hub/${seasonId}/days/${dayId}/articles/${articleType}`).get();
  if (!snap.exists) return null;
  const data = snap.data();
  return data.isPublished === false ? null : data;
}

/**
 * Share-page endpoint backing the /share/** rewrite: OG meta for scrapers,
 * instant redirect for humans. Unknown or dataless routes redirect to the
 * homepage rather than 404 — a share link should never dead-end a person.
 */
exports.getShareHttp = onRequest(
  {
    cors: true,
    timeoutSeconds: 30,
  },
  async (req, res) => {
    const route = parseSharePath(req.path);
    if (!route) {
      res.redirect(302, SITE_URL);
      return;
    }

    try {
      const db = getDb();
      let page = null;

      if (route.type === "article") {
        const article = await fetchArticle(db, route.articleId);
        if (article) {
          page = {
            title: `${article.headline || "marching.art news"} | marching.art`,
            description: clamp(article.summary || "Fantasy drum corps news on marching.art.", 200),
            imageUrl: article.imageUrl || DEFAULT_OG_IMAGE,
            redirectPath: `/article/${route.articleId}`,
            imageAlt: article.headline || undefined,
          };
        }
      } else if (route.type === "scores") {
        const recap = await fetchDayRecap(db, route.seasonUid, route.day);
        const standings = recap ? aggregateNightlyStandings(recap) : null;
        const entries = standings ? standings.byClass.get(route.classKey) : null;
        if (entries && entries.length > 0) {
          const classLabel = CLASS_LABELS[route.classKey] || route.classKey;
          const leader = entries[0];
          page = {
            title: `Day ${route.day} ${classLabel} scores | marching.art`,
            description:
              `${clamp(leader.corpsName, 60)} leads ${classLabel} with ${leader.score.toFixed(3)} ` +
              `after day ${route.day}. Full fantasy drum corps standings on marching.art.`,
            imageUrl: `${SITE_URL}/api/og/scores/${route.seasonUid}/${route.day}/${route.classKey}.png`,
            redirectPath: "/",
          };
        }
      } else if (route.type === "champion") {
        const champions = await fetchChampions(db, route.seasonId);
        const entries =
          (champions && champions.classes && champions.classes[route.classKey]) || [];
        if (entries.length > 0) {
          const classLabel = CLASS_LABELS[route.classKey] || route.classKey;
          const soundSport = route.classKey === "soundSport";
          const champ = entries[0];
          page = {
            title: soundSport
              ? `${champions.seasonName || "Season"} SoundSport Best in Show | marching.art`
              : `${champions.seasonName || "Season"} ${classLabel} champions | marching.art`,
            description:
              (soundSport
                ? `${clamp(champ.corpsName || "", 60)} earned SoundSport Best in Show. `
                : `${clamp(champ.corpsName || "", 60)} took the ${classLabel} title. `) +
              `Every champion lives forever in the marching.art Hall of Champions.`,
            imageUrl: `${SITE_URL}/api/og/champion/${route.seasonId}/${route.classKey}.png`,
            redirectPath: "/hall-of-champions",
          };
        }
      }

      if (!page) {
        res.redirect(302, SITE_URL);
        return;
      }

      res.set("Content-Type", "text/html; charset=utf-8");
      res.set("Cache-Control", SHARE_CACHE_CONTROL);
      // The share URL itself must stay out of search indexes — the canonical
      // in the page body points crawlers at the real destination.
      res.set("X-Robots-Tag", "noindex");
      res.status(200).send(buildShareHtml(page));
    } catch (error) {
      logger.error("Error rendering share page:", error);
      res.set("Cache-Control", "no-store");
      res.redirect(302, SITE_URL);
    }
  }
);

module.exports = {
  getOgCardHttp: exports.getOgCardHttp,
  getShareHttp: exports.getShareHttp,
};
