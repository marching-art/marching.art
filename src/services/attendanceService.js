import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';

// Multi-layer caching system for ultimate efficiency
class AttendanceCache {
    constructor() {
        this.memoryCache = new Map();
        this.requestCache = new Map(); // Prevent duplicate requests
        this.maxMemoryEntries = 100;
        this.cacheTimeout = 15 * 60 * 1000; // 15 minutes
        this.persistentCacheKey = 'drum_corps_attendance_cache_v2';
        
        // Load persistent cache on initialization
        this.loadPersistentCache();
        
        // Cleanup old entries periodically
        this.startCleanupTimer();
    }

    loadPersistentCache() {
        try {
            const stored = localStorage.getItem(this.persistentCacheKey);
            if (stored) {
                const data = JSON.parse(stored);
                const now = Date.now();
                
                // Only load recent entries
                Object.entries(data).forEach(([key, entry]) => {
                    if (entry.timestamp > now - this.cacheTimeout) {
                        this.memoryCache.set(key, entry.data);
                    }
                });
                
                console.log(`Loaded ${this.memoryCache.size} cached attendance entries`);
            }
        } catch (error) {
            console.warn('Error loading persistent cache:', error);
            localStorage.removeItem(this.persistentCacheKey);
        }
    }

    savePersistentCache() {
        try {
            const cacheData = {};
            const now = Date.now();
            
            // Only save recent entries
            this.memoryCache.forEach((value, key) => {
                if (value.timestamp > now - this.cacheTimeout) {
                    cacheData[key] = {
                        data: value,
                        timestamp: value.timestamp || now
                    };
                }
            });
            
            localStorage.setItem(this.persistentCacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('Error saving persistent cache:', error);
        }
    }

    startCleanupTimer() {
        setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000); // Cleanup every 5 minutes
    }

    cleanup() {
        const now = Date.now();
        const keysToDelete = [];
        
        this.memoryCache.forEach((value, key) => {
            if (value.timestamp && now - value.timestamp > this.cacheTimeout) {
                keysToDelete.push(key);
            }
        });
        
        keysToDelete.forEach(key => this.memoryCache.delete(key));
        
        // Limit memory cache size
        if (this.memoryCache.size > this.maxMemoryEntries) {
            const entries = Array.from(this.memoryCache.entries());
            entries.sort((a, b) => (b[1].timestamp || 0) - (a[1].timestamp || 0));
            
            // Keep only the most recent entries
            this.memoryCache.clear();
            entries.slice(0, this.maxMemoryEntries).forEach(([key, value]) => {
                this.memoryCache.set(key, value);
            });
        }
        
        this.savePersistentCache();
    }

    get(key) {
        const entry = this.memoryCache.get(key);
        if (!entry) return null;
        
        const now = Date.now();
        if (entry.timestamp && now - entry.timestamp > this.cacheTimeout) {
            this.memoryCache.delete(key);
            return null;
        }
        
        return entry;
    }

    set(key, data) {
        const entry = {
            ...data,
            timestamp: Date.now()
        };
        
        this.memoryCache.set(key, entry);
        
        // Save to persistent cache periodically
        if (this.memoryCache.size % 10 === 0) {
            this.savePersistentCache();
        }
    }

    has(key) {
        return this.get(key) !== null;
    }

    clear() {
        this.memoryCache.clear();
        localStorage.removeItem(this.persistentCacheKey);
    }

    invalidate(pattern) {
        const keysToDelete = [];
        this.memoryCache.forEach((_, key) => {
            if (key.includes(pattern)) {
                keysToDelete.push(key);
            }
        });
        keysToDelete.forEach(key => this.memoryCache.delete(key));
    }
}

// Global cache instance
const attendanceCache = new AttendanceCache();

/**
 * Enhanced request deduplication system
 */
class RequestManager {
    constructor() {
        this.activeRequests = new Map();
        this.requestTimeout = 30000; // 30 seconds
    }

    async executeRequest(key, requestFn) {
        // Check if request is already in progress
        if (this.activeRequests.has(key)) {
            return this.activeRequests.get(key);
        }

        // Create new request with timeout
        const requestPromise = Promise.race([
            requestFn(),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Request timeout')), this.requestTimeout)
            )
        ]).finally(() => {
            this.activeRequests.delete(key);
        });

        this.activeRequests.set(key, requestPromise);
        return requestPromise;
    }
}

const requestManager = new RequestManager();

/**
 * Enhanced error handling and retry logic
 */
class AttendanceError extends Error {
    constructor(message, code = 'UNKNOWN', isRetryable = false) {
        super(message);
        this.name = 'AttendanceError';
        this.code = code;
        this.isRetryable = isRetryable;
    }
}

/**
 * Smart attendance fetching with multiple fallback strategies
 */
export const fetchAttendanceForShow = async (seasonUid, eventName, week, retryCount = 0) => {
    const maxRetries = 2;
    const baseDelay = 1000;

    try {
        console.log(`🔍 Fetching attendance: ${eventName} (Week ${week}, Season: ${seasonUid})`);

        // Strategy 1: Direct attendance collection query (most detailed)
        try {
            const attendanceQuery = query(
                collection(db, `artifacts/${dataNamespace}/attendance`),
                where('seasonUid', '==', seasonUid),
                where('eventName', '==', eventName),
                where('week', '==', week),
                orderBy('timestamp', 'desc'),
                limit(1)
            );

            const attendanceSnapshot = await getDocs(attendanceQuery);
            
            if (!attendanceSnapshot.empty) {
                const attendanceDoc = attendanceSnapshot.docs[0];
                const attendanceData = attendanceDoc.data();
                
                console.log(`✅ Found attendance data for ${eventName}`);
                
                return {
                    counts: attendanceData.counts || { worldClass: 0, openClass: 0, aClass: 0 },
                    attendees: attendanceData.attendees || { worldClass: [], openClass: [], aClass: [] },
                    source: 'direct',
                    lastUpdated: attendanceData.timestamp?.toDate?.() || new Date()
                };
            }
        } catch (directError) {
            console.warn(`Direct query failed for ${eventName}:`, directError.message);
        }

        // Strategy 2: User profile aggregation (fallback)
        try {
            const profilesQuery = query(
                collection(db, `artifacts/${dataNamespace}/users`),
                limit(500) // Reasonable limit to prevent performance issues
            );

            const profilesSnapshot = await getDocs(profilesQuery);
            const attendeesByClass = { worldClass: [], openClass: [], aClass: [] };
            const counts = { worldClass: 0, openClass: 0, aClass: 0 };

            for (const userDoc of profilesSnapshot.docs) {
                try {
                    const profileDoc = await getDoc(doc(userDoc.ref, 'profile', 'data'));
                    if (!profileDoc.exists()) continue;

                    const profile = profileDoc.data();
                    if (!profile.attendance?.[seasonUid]?.[week]?.includes(eventName)) continue;

                    // Check each corps class
                    Object.keys(attendeesByClass).forEach(corpsClass => {
                        if (profile.corps?.[corpsClass]) {
                            const attendeeData = {
                                uid: userDoc.id,
                                username: profile.displayName || profile.username || 'Unknown',
                                corpsName: profile.corps[corpsClass].name,
                                corpsLocation: profile.corps[corpsClass].location || ''
                            };
                            
                            attendeesByClass[corpsClass].push(attendeeData);
                            counts[corpsClass]++;
                        }
                    });
                } catch (profileError) {
                    // Skip individual profile errors
                    continue;
                }
            }

            const totalAttendees = counts.worldClass + counts.openClass + counts.aClass;
            
            if (totalAttendees > 0) {
                console.log(`✅ Aggregated ${totalAttendees} attendees for ${eventName}`);
                
                return {
                    counts,
                    attendees: attendeesByClass,
                    source: 'aggregated',
                    lastUpdated: new Date()
                };
            }
        } catch (aggregationError) {
            console.warn(`Profile aggregation failed for ${eventName}:`, aggregationError.message);
        }

        // Strategy 3: Registration data (minimal info)
        try {
            const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
            if (seasonDoc.exists()) {
                const seasonData = seasonDoc.data();
                const event = seasonData.events?.find(e => e.shows?.some(s => s.eventName === eventName));
                const show = event?.shows?.find(s => s.eventName === eventName);
                
                if (show?.registrationCounts) {
                    console.log(`✅ Using registration data for ${eventName}`);
                    
                    return {
                        counts: show.registrationCounts,
                        attendees: { worldClass: [], openClass: [], aClass: [] },
                        source: 'registration',
                        lastUpdated: new Date()
                    };
                }
            }
        } catch (registrationError) {
            console.warn(`Registration data fetch failed for ${eventName}:`, registrationError.message);
        }

        // No data found
        throw new AttendanceError(
            `No attendance data found for ${eventName}`,
            'NOT_FOUND',
            false
        );

    } catch (error) {
        if (error instanceof AttendanceError) {
            throw error;
        }

        const isPermissionError = error.code === 'permission-denied';
        const isNetworkError = error.code === 'unavailable';
        const isRetryable = isPermissionError || isNetworkError;

        if (retryCount < maxRetries && isRetryable) {
            const delay = baseDelay * Math.pow(2, retryCount);
            console.warn(`Retrying attendance fetch for ${eventName} in ${delay}ms (attempt ${retryCount + 1})`);
            
            await new Promise(resolve => setTimeout(resolve, delay));
            return fetchAttendanceForShow(seasonUid, eventName, week, retryCount + 1);
        }

        throw new AttendanceError(
            isPermissionError ? 'Access denied' : error.message,
            error.code || 'FETCH_ERROR',
            isRetryable
        );
    }
};

/**
 * Main attendance fetching function with comprehensive caching
 */
export const getAttendanceWithCaching = async (showKey, seasonUid, eventName, dayNumber, seasonEvents, attendanceStats) => {
    try {
        // Layer 1: Memory cache (instant access)
        if (attendanceCache.has(showKey)) {
            const cached = attendanceCache.get(showKey);
            console.log(`📋 Cache hit for ${showKey}`);
            return cached;
        }

        // Layer 2: Precomputed stats (fast access)
        if (attendanceStats?.shows?.[showKey]) {
            const stats = attendanceStats.shows[showKey];
            if (stats.attendees && Object.values(stats.attendees).some(arr => arr.length > 0)) {
                const data = {
                    counts: stats.counts || { worldClass: 0, openClass: 0, aClass: 0 },
                    attendees: stats.attendees || { worldClass: [], openClass: [], aClass: [] },
                    source: 'precomputed'
                };
                attendanceCache.set(showKey, data);
                return data;
            }
        }

        // Layer 3: Registration counters (medium speed)
        const event = seasonEvents?.find(e => e.offSeasonDay === dayNumber);
        const showData = event?.shows?.find(s => s.eventName === eventName);
        if (showData?.registrationCounts) {
            const totalRegistered = Object.values(showData.registrationCounts).reduce((sum, count) => sum + count, 0);
            if (totalRegistered > 0) {
                const data = {
                    counts: showData.registrationCounts,
                    attendees: { worldClass: [], openClass: [], aClass: [] },
                    source: 'registration'
                };
                attendanceCache.set(showKey, data);
                return data;
            }
        }

        // Layer 4: Live database query (slowest, with deduplication)
        const requestKey = `live_${showKey}`;
        return await requestManager.executeRequest(requestKey, async () => {
            const week = Math.ceil(dayNumber / 7);
            const liveData = await fetchAttendanceForShow(seasonUid, eventName, week);
            
            // Cache successful results
            attendanceCache.set(showKey, liveData);
            return liveData;
        });

    } catch (error) {
        console.error(`❌ Failed to fetch attendance for ${showKey}:`, error.message);
        
        // Return empty data instead of throwing
        const emptyData = {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] },
            source: 'error',
            error: error.message
        };
        
        // Cache empty results briefly to prevent repeated failed requests
        attendanceCache.set(showKey, { ...emptyData, timestamp: Date.now() - (10 * 60 * 1000) }); // 10 minute cache
        
        return emptyData;
    }
};

/**
 * Batch attendance fetching for multiple shows
 */
export const fetchBatchAttendance = async (showKeys, seasonUid, seasonEvents, attendanceStats) => {
    const results = new Map();
    const uncachedKeys = [];
    
    // First pass: check cache and precomputed data
    for (const showKey of showKeys) {
        if (attendanceCache.has(showKey)) {
            results.set(showKey, attendanceCache.get(showKey));
        } else if (attendanceStats?.shows?.[showKey]) {
            const stats = attendanceStats.shows[showKey];
            const data = {
                counts: stats.counts || { worldClass: 0, openClass: 0, aClass: 0 },
                attendees: stats.attendees || { worldClass: [], openClass: [], aClass: [] },
                source: 'precomputed'
            };
            attendanceCache.set(showKey, data);
            results.set(showKey, data);
        } else {
            uncachedKeys.push(showKey);
        }
    }
    
    // Second pass: fetch uncached data in batches
    if (uncachedKeys.length > 0) {
        const batchSize = 5; // Limit concurrent requests
        for (let i = 0; i < uncachedKeys.length; i += batchSize) {
            const batch = uncachedKeys.slice(i, i + batchSize);
            
            const batchPromises = batch.map(async (showKey) => {
                const [dayNumber, eventName] = showKey.split('_');
                try {
                    const data = await getAttendanceWithCaching(
                        showKey, seasonUid, eventName, parseInt(dayNumber), seasonEvents, attendanceStats
                    );
                    return [showKey, data];
                } catch (error) {
                    console.warn(`Batch fetch failed for ${showKey}:`, error.message);
                    return [showKey, {
                        counts: { worldClass: 0, openClass: 0, aClass: 0 },
                        attendees: { worldClass: [], openClass: [], aClass: [] },
                        source: 'error',
                        error: error.message
                    }];
                }
            });
            
            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach(result => {
                if (result.status === 'fulfilled' && result.value) {
                    const [showKey, data] = result.value;
                    results.set(showKey, data);
                }
            });
            
            // Small delay between batches to be respectful to the database
            if (i + batchSize < uncachedKeys.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
    }
    
    return results;
};

/**
 * Preload attendance data for upcoming events
 */
export const preloadUpcomingAttendance = async (seasonSettings, currentDay, attendanceStats) => {
    if (!seasonSettings?.events) return;
    
    try {
        const upcomingEvents = seasonSettings.events.filter(event => {
            const eventDay = seasonSettings.status === 'live-season' ? event.dayIndex + 1 : event.offSeasonDay;
            return eventDay >= currentDay && eventDay <= currentDay + 7; // Next 7 days
        });
        
        const showKeys = upcomingEvents.flatMap(event => 
            event.shows?.map(show => {
                const dayNumber = seasonSettings.status === 'live-season' ? event.dayIndex + 1 : event.offSeasonDay;
                return `${dayNumber}_${show.eventName}`;
            }) || []
        );
        
        if (showKeys.length > 0) {
            console.log(`🚀 Preloading attendance for ${showKeys.length} upcoming shows`);
            await fetchBatchAttendance(showKeys, seasonSettings.seasonUid, seasonSettings.events, attendanceStats);
        }
    } catch (error) {
        console.warn('Preload failed:', error.message);
    }
};

/**
 * Get attendance statistics for analytics
 */
export const getAttendanceStats = (attendanceData) => {
    if (!attendanceData) return null;
    
    const totalAttendance = Object.values(attendanceData.counts).reduce((sum, count) => sum + count, 0);
    const classDistribution = {};
    
    Object.entries(attendanceData.counts).forEach(([className, count]) => {
        classDistribution[className] = totalAttendance > 0 ? (count / totalAttendance) * 100 : 0;
    });
    
    return {
        total: totalAttendance,
        distribution: classDistribution,
        hasDetailedData: Object.values(attendanceData.attendees).some(arr => arr.length > 0),
        source: attendanceData.source,
        lastUpdated: attendanceData.lastUpdated
    };
};

/**
 * Search for corps across all events
 */
export const searchCorpsInEvents = (events, attendanceStats, searchTerm) => {
    const results = [];
    const term = searchTerm.toLowerCase();
    
    events.forEach(event => {
        event.shows?.forEach(show => {
            const dayNumber = event.offSeasonDay || event.dayIndex + 1;
            const showKey = `${dayNumber}_${show.eventName}`;
            const attendance = attendanceStats?.shows?.[showKey];
            
            if (attendance?.attendees) {
                Object.values(attendance.attendees).forEach(classAttendees => {
                    classAttendees.forEach(attendee => {
                        if (attendee.corpsName.toLowerCase().includes(term)) {
                            results.push({
                                corpsName: attendee.corpsName,
                                username: attendee.username,
                                eventName: show.eventName,
                                location: show.location,
                                day: dayNumber,
                                showKey
                            });
                        }
                    });
                });
            }
        });
    });
    
    return results;
};

/**
 * Get user's corps schedule
 */
export const getUserCorpsSchedule = (userCorps, events, attendanceStats) => {
    const schedule = [];
    const userCorpsNames = Object.values(userCorps).map(corps => corps.name);
    
    events.forEach(event => {
        event.shows?.forEach(show => {
            const dayNumber = event.offSeasonDay || event.dayIndex + 1;
            const showKey = `${dayNumber}_${show.eventName}`;
            const attendance = attendanceStats?.shows?.[showKey];
            
            if (attendance?.attendees) {
                const userCorpsInShow = [];
                
                Object.entries(attendance.attendees).forEach(([className, classAttendees]) => {
                    classAttendees.forEach(attendee => {
                        if (userCorpsNames.includes(attendee.corpsName)) {
                            userCorpsInShow.push({
                                ...attendee,
                                className
                            });
                        }
                    });
                });
                
                if (userCorpsInShow.length > 0) {
                    schedule.push({
                        eventName: show.eventName,
                        location: show.location,
                        day: dayNumber,
                        showKey,
                        userCorps: userCorpsInShow,
                        totalAttendance: Object.values(attendance.counts).reduce((sum, count) => sum + count, 0)
                    });
                }
            }
        });
    });
    
    return schedule.sort((a, b) => a.day - b.day);
};

/**
 * Cache management utilities
 */
export const clearAttendanceCache = () => {
    attendanceCache.clear();
    console.log('🧹 Attendance cache cleared');
};

export const invalidateSeasonCache = (seasonUid) => {
    attendanceCache.invalidate(seasonUid);
    console.log(`🧹 Cache invalidated for season ${seasonUid}`);
};

export const getCacheStats = () => {
    return {
        size: attendanceCache.memoryCache.size,
        maxSize: attendanceCache.maxMemoryEntries,
        cacheHitRate: attendanceCache.cacheHitRate || 0
    };
};

/**
 * Export cache instance for direct access if needed
 */
export { attendanceCache };

// Cleanup cache when page is about to unload
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        attendanceCache.savePersistentCache();
    });
    
    // Also save cache when tab becomes hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            attendanceCache.savePersistentCache();
        }
    });
}

// Initialize cache cleanup
setTimeout(() => {
    attendanceCache.cleanup();
}, 60000); // Initial cleanup after 1 minute