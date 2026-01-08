const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { logger } = require("firebase-functions/v2");

// Define YouTube API key secret
const youtubeApiKey = defineSecret("YOUTUBE_API_KEY");

/**
 * Search YouTube and return the first video result
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

    try {
      // Use YouTube Data API v3 search endpoint
      const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
      searchUrl.searchParams.set("part", "snippet");
      searchUrl.searchParams.set("q", query);
      searchUrl.searchParams.set("type", "video");
      searchUrl.searchParams.set("maxResults", "1");
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

      const video = data.items[0];
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
