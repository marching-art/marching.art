/**
 * Rate Limiter Middleware for Firebase Cloud Functions
 * Prevents abuse and ensures fair usage across 10,000 users
 */

const admin = require('firebase-admin');

// Rate limit configurations
const RATE_LIMITS = {
  // Authentication endpoints
  LOGIN: { windowMs: 15 * 60 * 1000, max: 5 }, // 5 attempts per 15 minutes
  SIGNUP: { windowMs: 60 * 60 * 1000, max: 3 }, // 3 signups per hour
  
  // User actions
  CREATE_LEAGUE: { windowMs: 60 * 60 * 1000, max: 5 }, // 5 leagues per hour
  JOIN_LEAGUE: { windowMs: 5 * 60 * 1000, max: 10 }, // 10 joins per 5 minutes
  SUBMIT_LINEUP: { windowMs: 60 * 1000, max: 10 }, // 10 submissions per minute
  UPDATE_PROFILE: { windowMs: 60 * 60 * 1000, max: 20 }, // 20 updates per hour
  POST_COMMENT: { windowMs: 5 * 60 * 1000, max: 10 }, // 10 comments per 5 minutes
  
  // Read operations (more lenient)
  GET_LEADERBOARD: { windowMs: 60 * 1000, max: 60 }, // 60 requests per minute
  GET_SCORES: { windowMs: 60 * 1000, max: 100 }, // 100 requests per minute
  
  // Admin operations
  ADMIN_ACTION: { windowMs: 60 * 1000, max: 100 } // 100 per minute for admins
};

/**
 * Get rate limit key for a user
 */
const getRateLimitKey = (userId, action) => {
  return `ratelimit:${action}:${userId}`;
};

/**
 * Check if user has exceeded rate limit
 */
const checkRateLimit = async (userId, action, config = null) => {
  const db = admin.firestore();
  const limitConfig = config || RATE_LIMITS[action];
  
  if (!limitConfig) {
    console.warn(`No rate limit config for action: ${action}`);
    return { allowed: true };
  }
  
  const key = getRateLimitKey(userId, action);
  const now = Date.now();
  const windowStart = now - limitConfig.windowMs;
  
  try {
    const docRef = db.collection('rate_limits').doc(key);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      // First request, create new record
      await docRef.set({
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
        windowMs: limitConfig.windowMs
      });
      
      return {
        allowed: true,
        remaining: limitConfig.max - 1,
        resetAt: now + limitConfig.windowMs
      };
    }
    
    const data = doc.data();
    
    // Check if window has expired
    if (data.firstAttempt < windowStart) {
      // Reset window
      await docRef.set({
        attempts: 1,
        firstAttempt: now,
        lastAttempt: now,
        windowMs: limitConfig.windowMs
      });
      
      return {
        allowed: true,
        remaining: limitConfig.max - 1,
        resetAt: now + limitConfig.windowMs
      };
    }
    
    // Within window, check limit
    if (data.attempts >= limitConfig.max) {
      const resetAt = data.firstAttempt + limitConfig.windowMs;
      const retryAfter = Math.ceil((resetAt - now) / 1000); // seconds
      
      return {
        allowed: false,
        remaining: 0,
        resetAt: resetAt,
        retryAfter: retryAfter
      };
    }
    
    // Increment attempts
    await docRef.update({
      attempts: admin.firestore.FieldValue.increment(1),
      lastAttempt: now
    });
    
    return {
      allowed: true,
      remaining: limitConfig.max - data.attempts - 1,
      resetAt: data.firstAttempt + limitConfig.windowMs
    };
    
  } catch (error) {
    console.error('Rate limit check error:', error);
    // On error, allow request (fail open)
    return { allowed: true, error: error.message };
  }
};

/**
 * Rate limiter middleware for Cloud Functions
 */
const rateLimiter = (action, customConfig = null) => {
  return async (req, res, next) => {
    // Extract user ID from request
    const userId = req.auth?.uid || req.body?.userId || req.ip;
    
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Check if user is admin (admins get higher limits)
    const isAdmin = req.auth?.token?.admin || false;
    const finalAction = isAdmin ? 'ADMIN_ACTION' : action;
    
    const result = await checkRateLimit(userId, finalAction, customConfig);
    
    if (!result.allowed) {
      return res.status(429).json({
        error: 'Rate limit exceeded',
        retryAfter: result.retryAfter,
        resetAt: new Date(result.resetAt).toISOString(),
        message: `Too many requests. Please try again in ${result.retryAfter} seconds.`
      });
    }
    
    // Add rate limit info to response headers
    res.set({
      'X-RateLimit-Limit': RATE_LIMITS[finalAction]?.max || 'unknown',
      'X-RateLimit-Remaining': result.remaining || 0,
      'X-RateLimit-Reset': new Date(result.resetAt || Date.now()).toISOString()
    });
    
    next();
  };
};

/**
 * Clean up expired rate limit records (run periodically)
 */
const cleanupRateLimits = async () => {
  const db = admin.firestore();
  const now = Date.now();
  const cutoff = now - (24 * 60 * 60 * 1000); // 24 hours ago
  
  try {
    const snapshot = await db.collection('rate_limits')
      .where('lastAttempt', '<', cutoff)
      .limit(500)
      .get();
    
    if (snapshot.empty) {
      console.log('No expired rate limits to clean up');
      return 0;
    }
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`Cleaned up ${snapshot.size} expired rate limit records`);
    return snapshot.size;
    
  } catch (error) {
    console.error('Error cleaning up rate limits:', error);
    throw error;
  }
};

/**
 * Get rate limit status for a user
 */
const getRateLimitStatus = async (userId, action) => {
  const db = admin.firestore();
  const key = getRateLimitKey(userId, action);
  
  try {
    const doc = await db.collection('rate_limits').doc(key).get();
    
    if (!doc.exists) {
      return {
        action,
        attempts: 0,
        max: RATE_LIMITS[action]?.max || 0,
        remaining: RATE_LIMITS[action]?.max || 0,
        resetAt: null
      };
    }
    
    const data = doc.data();
    const config = RATE_LIMITS[action];
    const resetAt = data.firstAttempt + (config?.windowMs || 0);
    
    return {
      action,
      attempts: data.attempts,
      max: config?.max || 0,
      remaining: Math.max(0, (config?.max || 0) - data.attempts),
      resetAt: new Date(resetAt).toISOString(),
      windowMs: config?.windowMs || 0
    };
    
  } catch (error) {
    console.error('Error getting rate limit status:', error);
    return null;
  }
};

/**
 * Reset rate limit for a user (admin only)
 */
const resetRateLimit = async (userId, action) => {
  const db = admin.firestore();
  const key = getRateLimitKey(userId, action);
  
  try {
    await db.collection('rate_limits').doc(key).delete();
    return true;
  } catch (error) {
    console.error('Error resetting rate limit:', error);
    return false;
  }
};

module.exports = {
  rateLimiter,
  checkRateLimit,
  cleanupRateLimits,
  getRateLimitStatus,
  resetRateLimit,
  RATE_LIMITS
};