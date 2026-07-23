const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");
const { getDb } = require("../config");
const { assertAdmin } = require("../helpers/callableGuards");

// Define YouTube API key secret
const youtubeApiKey = defineSecret("YOUTUBE_API_KEY");

// Cache collection name
const CACHE_COLLECTION = "youtubeCache";

// Video IDs an admin has rejected via resetYoutubeVideo, keyed by video ID.
// A video on this list is excluded from every future search result.
const NOPE_COLLECTION = "youtubeNopeList";

// Per-user budget for QUOTA-SPENDING searches (cache misses and skipCache
// retries — cache hits are free and unmetered). The YouTube Data API quota
// is a single daily pool shared by every user; without a per-user ceiling,
// one account looping skipCache searches could exhaust it for the whole
// site. 30/hour is far above any legitimate browsing session. Budget docs
// live in their own server-only collection, keyed by uid (no client rule
// matches it, so it is unreadable/unwritable from the app).
const QUOTA_COLLECTION = "youtubeSearchQuota";
const QUOTA_MAX_SEARCHES_PER_WINDOW = 30;
const QUOTA_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Consume one unit of the caller's hourly search budget. Plain
 * read-then-write (not a transaction) is deliberate: an interleaved pair of
 * calls can at worst over-admit by one, which is fine for abuse throttling
 * and keeps the hot path at one small doc read.
 *
 * @returns {Promise<boolean>} true if the search may proceed.
 */
async function consumeSearchBudget(db, uid) {
  try {
    const ref = db.collection(QUOTA_COLLECTION).doc(uid);
    const snap = await ref.get();
    const now = Date.now();
    const data = snap.exists ? snap.data() : {};
    const inWindow =
      typeof data.windowStart === "number" && now - data.windowStart < QUOTA_WINDOW_MS;
    const count = inWindow ? data.count || 0 : 0;

    if (count >= QUOTA_MAX_SEARCHES_PER_WINDOW) return false;

    await ref.set({
      windowStart: inWindow ? data.windowStart : now,
      count: count + 1,
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    // Never let the throttle's own bookkeeping break the feature.
    logger.warn("Search-budget check failed, allowing search:", error);
    return true;
  }
}

// Words to filter out from video titles (partial performances, warmups, vlogs, etc.)
const TITLE_BLACKLIST = [
  "lot",
  "drumline",
  "hornline",
  "brass",
  "guard",
  "camp",
  "vlog",
  "percussion",
  "warmup",
  "warm up",
  "warm-up",
  "encore",
  "headcam",
  "pit",
  "snareline",
  "snare",
  "cam",
  "battery",
  "learn",
  "transcription"
];

// Duration constraints (in seconds)
const MIN_DURATION_SECONDS = 8 * 60;  // 8 minutes
const MAX_DURATION_SECONDS = 15 * 60; // 15 minutes

/**
 * Check if a video title contains any blacklisted words
 */
function shouldFilterVideo(title) {
  const lowerTitle = title.toLowerCase();
  return TITLE_BLACKLIST.some(word => lowerTitle.includes(word));
}

/**
 * Parse ISO 8601 duration format (e.g., "PT11M30S") to seconds
 */
function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;

  const hours = parseInt(match[1] || 0, 10);
  const minutes = parseInt(match[2] || 0, 10);
  const seconds = parseInt(match[3] || 0, 10);

  return hours * 3600 + minutes * 60 + seconds;
}

/**
 * Check if duration is within acceptable range (8-15 minutes)
 */
function isDurationValid(durationSeconds) {
  return durationSeconds >= MIN_DURATION_SECONDS && durationSeconds <= MAX_DURATION_SECONDS;
}

/**
 * Create a cache key from the search query
 * Normalizes the query to create consistent keys
 */
function getCacheKey(query) {
  return query.toLowerCase().trim().replace(/[^a-z0-9]/g, "_");
}

/**
 * Store result in cache and return it
 */
async function cacheAndReturn(db, cacheKey, result) {
  try {
    await db.collection(CACHE_COLLECTION).doc(cacheKey).set({
      ...result,
      cachedAt: new Date().toISOString()
    });
    logger.info("Cached result:", { cacheKey });
  } catch (cacheError) {
    logger.warn("Cache write error:", cacheError);
  }
  return result;
}

/**
 * Look up which of the candidate video IDs are on the admin nope list.
 * Fails open (no exclusions) on read errors so a Firestore hiccup can't
 * break search entirely.
 */
async function getNopedVideoIds(db, videoIds) {
  if (!videoIds.length) return new Set();
  try {
    const snaps = await Promise.all(
      videoIds.map((id) => db.collection(NOPE_COLLECTION).doc(id).get())
    );
    return new Set(videoIds.filter((id, i) => snaps[i].exists));
  } catch (err) {
    logger.warn("Nope list read error:", err);
    return new Set();
  }
}

/**
 * Run the YouTube search + filter pipeline for a query and cache the pick.
 * Callers are responsible for auth gating and cache reads.
 */
async function performYoutubeSearch(db, query, apiKey) {
  const cacheKey = getCacheKey(query);

  // Extract year from query (expects format like "2024 Blue Devils corps")
  const yearMatch = query.match(/^\d{4}/);
  const year = yearMatch ? yearMatch[0] : null;

  try {
    // Use YouTube Data API v3 search endpoint
    // Request more results so we can filter out unwanted videos
    const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
    searchUrl.searchParams.set("part", "snippet");
    searchUrl.searchParams.set("q", query);
    searchUrl.searchParams.set("type", "video");
    searchUrl.searchParams.set("maxResults", "25");
    searchUrl.searchParams.set("videoEmbeddable", "true");
    searchUrl.searchParams.set("key", apiKey);

    const response = await fetch(searchUrl.toString());

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      logger.error("YouTube API error:", {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      // Return detailed error for debugging
      const errorMessage = errorData?.error?.message || "Failed to search YouTube";
      throw new HttpsError("internal", errorMessage);
    }

    const data = await response.json();

    if (!data.items || data.items.length === 0) {
      return {
        success: true,
        found: false,
        message: "No videos found for this search."
      };
    }

    // Drop admin-rejected videos before any other filtering so a noped ID
    // can never be picked again — not even by the fallback paths below.
    const nopedIds = await getNopedVideoIds(
      db,
      data.items.map((item) => item.id.videoId)
    );
    const searchItems = data.items.filter(
      (item) => !nopedIds.has(item.id.videoId)
    );
    if (nopedIds.size > 0) {
      logger.info("Excluded noped videos:", { count: nopedIds.size, cacheKey });
    }

    if (searchItems.length === 0) {
      return {
        success: true,
        found: false,
        message: "No videos found for this search."
      };
    }

    // Filter by title blacklist and require year in title
    const shortYear = year ? year.slice(-2) : null; // e.g., "18" from "2018"
    logger.info("Year filtering:", { year, shortYear, totalResults: searchItems.length });

    const titleFilteredVideos = searchItems.filter(item => {
      const title = item.snippet.title;
      // Must not contain blacklisted words
      if (shouldFilterVideo(title)) {
        logger.info("Filtered by blacklist:", { title });
        return false;
      }
      // Must contain the full year or last two digits (e.g., "2018" or "18")
      if (year) {
        const hasFullYear = title.includes(year);
        const hasShortYear = shortYear && title.includes(shortYear);
        if (!hasFullYear && !hasShortYear) {
          logger.info("Filtered by year:", { title, year, shortYear });
          return false;
        }
      }
      return true;
    });

    logger.info("After filtering:", { remaining: titleFilteredVideos.length });

    if (titleFilteredVideos.length === 0) {
      // All results were filtered by title, return the first one anyway as fallback
      logger.info("All results filtered by title, using first result as fallback");
      const fallbackVideo = searchItems[0];
      return cacheAndReturn(db, cacheKey, {
        success: true,
        found: true,
        videoId: fallbackVideo.id.videoId,
        title: fallbackVideo.snippet.title,
        thumbnail: fallbackVideo.snippet.thumbnails?.high?.url || fallbackVideo.snippet.thumbnails?.default?.url,
        channelTitle: fallbackVideo.snippet.channelTitle
      });
    }

    // Get video IDs to fetch duration information
    const videoIds = titleFilteredVideos.map(item => item.id.videoId).join(",");

    // Fetch video details to get duration
    const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
    videosUrl.searchParams.set("part", "contentDetails");
    videosUrl.searchParams.set("id", videoIds);
    videosUrl.searchParams.set("key", apiKey);

    const videosResponse = await fetch(videosUrl.toString());

    if (!videosResponse.ok) {
      logger.error("YouTube videos API error:", {
        status: videosResponse.status,
        statusText: videosResponse.statusText
      });
      // Fall back to first title-filtered video if we can't get duration
      const fallbackVideo = titleFilteredVideos[0];
      return cacheAndReturn(db, cacheKey, {
        success: true,
        found: true,
        videoId: fallbackVideo.id.videoId,
        title: fallbackVideo.snippet.title,
        thumbnail: fallbackVideo.snippet.thumbnails?.high?.url || fallbackVideo.snippet.thumbnails?.default?.url,
        channelTitle: fallbackVideo.snippet.channelTitle
      });
    }

    const videosData = await videosResponse.json();

    // Create a map of video ID to duration
    const durationMap = {};
    if (videosData.items) {
      for (const item of videosData.items) {
        const durationSeconds = parseDuration(item.contentDetails.duration);
        durationMap[item.id] = durationSeconds;
      }
    }

    // Filter videos that pass duration check
    const validVideos = titleFilteredVideos.filter(item => {
      const duration = durationMap[item.id.videoId];
      if (duration === undefined) return false;
      return isDurationValid(duration);
    });

    // Prioritize videos with "finals" in the title
    let video = validVideos.find(item =>
      item.snippet.title.toLowerCase().includes("finals")
    );

    // If no finals video, use first valid video
    if (!video && validVideos.length > 0) {
      video = validVideos[0];
    }

    if (!video) {
      // No video passed duration filter, return first title-filtered as fallback
      logger.info("No videos in 8-15 min range, using first title-filtered result as fallback");
      const fallbackVideo = titleFilteredVideos[0];
      return cacheAndReturn(db, cacheKey, {
        success: true,
        found: true,
        videoId: fallbackVideo.id.videoId,
        title: fallbackVideo.snippet.title,
        thumbnail: fallbackVideo.snippet.thumbnails?.high?.url || fallbackVideo.snippet.thumbnails?.default?.url,
        channelTitle: fallbackVideo.snippet.channelTitle
      });
    }

    return cacheAndReturn(db, cacheKey, {
      success: true,
      found: true,
      videoId: video.id.videoId,
      title: video.snippet.title,
      thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
      channelTitle: video.snippet.channelTitle
    });
  } catch (error) {
    logger.error("YouTube search failed:", error);
    if (error instanceof HttpsError) throw error;
    throw new HttpsError("internal", "An error occurred while searching YouTube.");
  }
}

/**
 * Search YouTube and return the first video result that passes filtering
 * Used to embed corps performance videos
 */
exports.searchYoutubeVideo = onCall(
  {
    cors: true,
    secrets: [youtubeApiKey]
  },
  async (request) => {
    const { query } = request.data;

    // Each uncached call spends billed YouTube Data API quota, so anonymous
    // clients are limited to cache hits: they can view already-found videos
    // (public Landing/Article pages) but cannot trigger API searches or
    // bypass the cache.
    const isAuthenticated = !!request.auth;
    const skipCache = isAuthenticated && !!request.data.skipCache;

    if (!query || typeof query !== "string") {
      throw new HttpsError("invalid-argument", "Search query is required.");
    }

    const apiKey = youtubeApiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "YouTube API key is not configured.");
    }

    // Check cache first (unless skipCache is true)
    const db = getDb();
    const cacheKey = getCacheKey(query);

    if (!skipCache) {
      try {
        const cachedDoc = await db.collection(CACHE_COLLECTION).doc(cacheKey).get();
        if (cachedDoc.exists) {
          logger.info("Cache hit:", { query, cacheKey });
          return cachedDoc.data();
        }
        logger.info("Cache miss:", { query, cacheKey });
      } catch (cacheError) {
        logger.warn("Cache read error:", cacheError);
        // Continue without cache
      }
    } else {
      logger.info("Skipping cache:", { query, cacheKey });
    }

    // Cache miss from here on — only signed-in users may spend API quota.
    if (!isAuthenticated) {
      logger.info("Unauthenticated cache miss, not searching:", { query, cacheKey });
      return {
        success: true,
        found: false,
        message: "Sign in to search for this performance video.",
      };
    }

    // Signed-in and about to spend billed quota — enforce the per-user
    // hourly budget so one account can't drain the shared daily API pool.
    if (!(await consumeSearchBudget(db, request.auth.uid))) {
      logger.warn("Search budget exhausted:", { uid: request.auth.uid, query });
      throw new HttpsError(
        "resource-exhausted",
        "You've searched for a lot of videos in the last hour — try again a bit later."
      );
    }

    return performYoutubeSearch(db, query, apiKey);
  }
);

/**
 * Admin-only: reject the currently cached video for a query. The video ID
 * goes on the nope list (never returned by any future search), the stale
 * cache entry is deleted, and a fresh search runs immediately so the caller
 * gets a replacement in the same round trip.
 */
exports.resetYoutubeVideo = onCall(
  {
    cors: true,
    secrets: [youtubeApiKey]
  },
  async (request) => {
    const uid = assertAdmin(request);
    const { query, videoId } = request.data;

    if (!query || typeof query !== "string") {
      throw new HttpsError("invalid-argument", "Search query is required.");
    }
    // YouTube video IDs are short URL-safe tokens; reject anything else so
    // arbitrary strings can't become nope-list document IDs.
    if (!videoId || typeof videoId !== "string" || !/^[\w-]{5,20}$/.test(videoId)) {
      throw new HttpsError("invalid-argument", "A valid video ID is required.");
    }

    const apiKey = youtubeApiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "YouTube API key is not configured.");
    }

    const db = getDb();
    const cacheKey = getCacheKey(query);

    await db.collection(NOPE_COLLECTION).doc(videoId).set({
      videoId,
      query,
      cacheKey,
      nopedBy: uid,
      nopedAt: new Date().toISOString()
    });

    await db.collection(CACHE_COLLECTION).doc(cacheKey).delete();
    logger.info("Admin reset video:", { videoId, query, cacheKey, uid });

    return performYoutubeSearch(db, query, apiKey);
  }
);
