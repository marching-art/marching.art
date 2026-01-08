const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");

// Define YouTube API key secret
const youtubeApiKey = defineSecret("YOUTUBE_API_KEY");

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
  "battery"
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

    if (!query || typeof query !== "string") {
      throw new HttpsError("invalid-argument", "Search query is required.");
    }

    const apiKey = youtubeApiKey.value();
    if (!apiKey) {
      throw new HttpsError("failed-precondition", "YouTube API key is not configured.");
    }

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
      searchUrl.searchParams.set("maxResults", "10");
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

      // Filter by title blacklist and require year in title
      const titleFilteredVideos = data.items.filter(item => {
        const title = item.snippet.title;
        // Must not contain blacklisted words
        if (shouldFilterVideo(title)) return false;
        // Must contain the year if we extracted one
        if (year && !title.includes(year)) return false;
        return true;
      });

      if (titleFilteredVideos.length === 0) {
        // All results were filtered by title, return the first one anyway as fallback
        logger.info("All results filtered by title, using first result as fallback");
        const fallbackVideo = data.items[0];
        return {
          success: true,
          found: true,
          videoId: fallbackVideo.id.videoId,
          title: fallbackVideo.snippet.title,
          thumbnail: fallbackVideo.snippet.thumbnails?.high?.url || fallbackVideo.snippet.thumbnails?.default?.url,
          channelTitle: fallbackVideo.snippet.channelTitle
        };
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
        return {
          success: true,
          found: true,
          videoId: fallbackVideo.id.videoId,
          title: fallbackVideo.snippet.title,
          thumbnail: fallbackVideo.snippet.thumbnails?.high?.url || fallbackVideo.snippet.thumbnails?.default?.url,
          channelTitle: fallbackVideo.snippet.channelTitle
        };
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
        return {
          success: true,
          found: true,
          videoId: fallbackVideo.id.videoId,
          title: fallbackVideo.snippet.title,
          thumbnail: fallbackVideo.snippet.thumbnails?.high?.url || fallbackVideo.snippet.thumbnails?.default?.url,
          channelTitle: fallbackVideo.snippet.channelTitle
        };
      }

      return {
        success: true,
        found: true,
        videoId: video.id.videoId,
        title: video.snippet.title,
        thumbnail: video.snippet.thumbnails?.high?.url || video.snippet.thumbnails?.default?.url,
        channelTitle: video.snippet.channelTitle
      };
    } catch (error) {
      logger.error("YouTube search failed:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "An error occurred while searching YouTube.");
    }
  }
);
