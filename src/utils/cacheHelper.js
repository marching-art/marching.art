// Cache Helper Utilities for Optimal Performance

const CACHE_VERSIONS = {
  SCORES: 'v1',
  LEADERBOARD: 'v1',
  SCHEDULE: 'v1',
  PROFILE: 'v1'
};

const CACHE_DURATIONS = {
  SCORES: 5 * 60 * 1000, // 5 minutes
  LEADERBOARD: 2 * 60 * 1000, // 2 minutes
  SCHEDULE: 30 * 60 * 1000, // 30 minutes
  PROFILE: 10 * 60 * 1000, // 10 minutes
  STATIC: 24 * 60 * 60 * 1000 // 24 hours
};

/**
 * Generate a cache key with version
 */
export const getCacheKey = (category, identifier) => {
  const version = CACHE_VERSIONS[category.toUpperCase()] || 'v1';
  return `${category}_${version}_${identifier}`;
};

/**
 * Set data in cache with expiration
 */
export const setCacheData = (category, identifier, data, customDuration = null) => {
  try {
    const key = getCacheKey(category, identifier);
    const duration = customDuration || CACHE_DURATIONS[category.toUpperCase()] || CACHE_DURATIONS.STATIC;
    
    const cacheItem = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + duration
    };
    
    sessionStorage.setItem(key, JSON.stringify(cacheItem));
    return true;
  } catch (error) {
    console.error('Error setting cache:', error);
    return false;
  }
};

/**
 * Get data from cache if not expired
 */
export const getCacheData = (category, identifier) => {
  try {
    const key = getCacheKey(category, identifier);
    const cached = sessionStorage.getItem(key);
    
    if (!cached) return null;
    
    const cacheItem = JSON.parse(cached);
    
    // Check if expired
    if (Date.now() > cacheItem.expiresAt) {
      sessionStorage.removeItem(key);
      return null;
    }
    
    return cacheItem.data;
  } catch (error) {
    console.error('Error getting cache:', error);
    return null;
  }
};

/**
 * Check if cache is stale (exists but about to expire)
 */
export const isCacheStale = (category, identifier, staleThreshold = 0.8) => {
  try {
    const key = getCacheKey(category, identifier);
    const cached = sessionStorage.getItem(key);
    
    if (!cached) return true;
    
    const cacheItem = JSON.parse(cached);
    const duration = cacheItem.expiresAt - cacheItem.timestamp;
    const elapsed = Date.now() - cacheItem.timestamp;
    
    // If we're past 80% of the cache duration, consider it stale
    return elapsed > (duration * staleThreshold);
  } catch (error) {
    return true;
  }
};

/**
 * Invalidate cache for a specific category and identifier
 */
export const invalidateCache = (category, identifier) => {
  try {
    const key = getCacheKey(category, identifier);
    sessionStorage.removeItem(key);
    return true;
  } catch (error) {
    console.error('Error invalidating cache:', error);
    return false;
  }
};

/**
 * Invalidate all cache entries for a category
 */
export const invalidateCategoryCache = (category) => {
  try {
    const prefix = `${category}_${CACHE_VERSIONS[category.toUpperCase()]}`;
    const keys = Object.keys(sessionStorage);
    
    keys.forEach(key => {
      if (key.startsWith(prefix)) {
        sessionStorage.removeItem(key);
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error invalidating category cache:', error);
    return false;
  }
};

/**
 * Clear all cache
 */
export const clearAllCache = () => {
  try {
    sessionStorage.clear();
    return true;
  } catch (error) {
    console.error('Error clearing cache:', error);
    return false;
  }
};

/**
 * Stale-While-Revalidate Pattern
 * Returns cached data immediately, triggers background refresh if stale
 */
export const staleWhileRevalidate = async (category, identifier, fetchFunction) => {
  const cached = getCacheData(category, identifier);
  
  // Return cached data immediately if available
  if (cached) {
    // If cache is stale, trigger background refresh
    if (isCacheStale(category, identifier)) {
      fetchFunction()
        .then(freshData => setCacheData(category, identifier, freshData))
        .catch(error => console.error('Background refresh failed:', error));
    }
    
    return { data: cached, fromCache: true };
  }
  
  // No cache, fetch fresh data
  try {
    const freshData = await fetchFunction();
    setCacheData(category, identifier, freshData);
    return { data: freshData, fromCache: false };
  } catch (error) {
    console.error('Fetch failed:', error);
    throw error;
  }
};

/**
 * Custom hook for cached data with stale-while-revalidate
 */
export const useCachedData = (category, identifier, fetchFunction, dependencies = []) => {
  const [data, setData] = React.useState(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [isStale, setIsStale] = React.useState(false);
  const [error, setError] = React.useState(null);
  
  React.useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      try {
        const result = await staleWhileRevalidate(category, identifier, fetchFunction);
        
        if (isMounted) {
          setData(result.data);
          setIsStale(result.fromCache && isCacheStale(category, identifier));
          setIsLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err);
          setIsLoading(false);
        }
      }
    };
    
    loadData();
    
    return () => {
      isMounted = false;
    };
  }, dependencies);
  
  const refresh = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const freshData = await fetchFunction();
      setCacheData(category, identifier, freshData);
      setData(freshData);
      setIsStale(false);
    } catch (err) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [category, identifier, fetchFunction]);
  
  return { data, isLoading, isStale, error, refresh };
};

/**
 * Get cache statistics
 */
export const getCacheStats = () => {
  try {
    const keys = Object.keys(sessionStorage);
    const stats = {
      totalItems: keys.length,
      totalSize: 0,
      categories: {}
    };
    
    keys.forEach(key => {
      const item = sessionStorage.getItem(key);
      stats.totalSize += item.length;
      
      const category = key.split('_')[0];
      if (!stats.categories[category]) {
        stats.categories[category] = {
          count: 0,
          size: 0
        };
      }
      
      stats.categories[category].count++;
      stats.categories[category].size += item.length;
    });
    
    // Convert bytes to KB
    stats.totalSize = (stats.totalSize / 1024).toFixed(2) + ' KB';
    Object.keys(stats.categories).forEach(cat => {
      stats.categories[cat].size = (stats.categories[cat].size / 1024).toFixed(2) + ' KB';
    });
    
    return stats;
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return null;
  }
};

export default {
  getCacheKey,
  setCacheData,
  getCacheData,
  isCacheStale,
  invalidateCache,
  invalidateCategoryCache,
  clearAllCache,
  staleWhileRevalidate,
  useCachedData,
  getCacheStats,
  CACHE_DURATIONS
};