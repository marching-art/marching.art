// News feed SWR cache + prefetch cache. Extracted from NewsFeed.jsx.
// Module-level singletons that persist across mounts for instant perceived loads.

export const NEWS_CACHE_TTL = 2 * 60 * 1000; // 2 min - considered fresh
export const NEWS_CACHE_STALE_TTL = 30 * 60 * 1000; // 30 min - usable while revalidating

export const newsCache = {
  data: null, // { news, engagement, hasMore }
  timestamp: 0, // When cache was set
  maxItems: 0, // Cache key - invalidate if different

  /**
   * Check if cache is fresh (no revalidation needed)
   */
  isFresh(maxItems) {
    if (!this.data) return false;
    if (this.maxItems !== maxItems) return false;
    return Date.now() - this.timestamp < NEWS_CACHE_TTL;
  },

  /**
   * Check if cache is stale but usable (show immediately, revalidate in background)
   */
  isStale(maxItems) {
    if (!this.data) return false;
    if (this.maxItems !== maxItems) return false;
    const age = Date.now() - this.timestamp;
    return age >= NEWS_CACHE_TTL && age < NEWS_CACHE_STALE_TTL;
  },

  /**
   * Check if cache has any data for immediate display
   */
  hasData(maxItems) {
    return this.data && this.maxItems === maxItems;
  },

  set(data, maxItems) {
    this.data = data;
    this.timestamp = Date.now();
    this.maxItems = maxItems;
  },

  get() {
    return this.data;
  },

  getAge() {
    return Date.now() - this.timestamp;
  },

  clear() {
    this.data = null;
    this.timestamp = 0;
    this.maxItems = 0;
  },
};

export const prefetchCache = {
  data: null,
  cursor: null,
  timestamp: 0,
  TTL: 30 * 1000, // 30 seconds

  set(data, cursor) {
    this.data = data;
    this.cursor = cursor;
    this.timestamp = Date.now();
  },

  get(cursor) {
    if (!this.data || this.cursor !== cursor) return null;
    if (Date.now() - this.timestamp > this.TTL) {
      this.clear();
      return null;
    }
    return this.data;
  },

  clear() {
    this.data = null;
    this.cursor = null;
    this.timestamp = 0;
  },
};
