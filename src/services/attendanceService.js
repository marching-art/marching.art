import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { CORPS_CLASS_ORDER } from '../utils/profileCompatibility';

/**
 * Efficiently fetch attendance data for a specific show
 * Only queries users who might be attending rather than all users
 */
export const fetchAttendanceForShow = async (seasonUid, eventName, week) => {
    try {
        const attendance = {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] }
        };

        // Query for each corps class separately to optimize Firestore queries
        for (const corpsClass of CORPS_CLASS_ORDER) {
            const profilesQuery = query(
                collection(db, 'artifacts', 'marching-art', 'users'),
                where('profile.activeSeasonId', '==', seasonUid),
                where(`profile.corps.${corpsClass}.corpsName`, '!=', null)
            );

            const snapshot = await getDocs(profilesQuery);
            
            snapshot.docs.forEach(doc => {
                const profile = doc.data().profile;
                const corps = profile?.corps?.[corpsClass];
                
                if (!corps?.selectedShows) return;

                const weekShows = corps.selectedShows[`week${week}`] || [];
                const isAttending = weekShows.some(s => s.eventName === eventName);

                if (isAttending) {
                    attendance.counts[corpsClass]++;
                    attendance.attendees[corpsClass].push({
                        uid: doc.id,
                        username: profile.username,
                        corpsName: corps.corpsName
                    });
                }
            });
        }

        return attendance;
    } catch (error) {
        console.error('Error fetching attendance data:', error);
        return {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] }
        };
    }
};

/**
 * Cache attendance data in localStorage for quick access
 * Useful for recently viewed shows
 */
export const cacheAttendanceData = (showKey, attendanceData) => {
    try {
        const cache = JSON.parse(localStorage.getItem('schedule_attendance_cache') || '{}');
        cache[showKey] = {
            data: attendanceData,
            timestamp: Date.now()
        };
        
        // Keep only last 20 entries and entries from last hour
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        const validEntries = Object.entries(cache)
            .filter(([, entry]) => entry.timestamp > oneHourAgo)
            .slice(-20);
        
        localStorage.setItem('schedule_attendance_cache', JSON.stringify(Object.fromEntries(validEntries)));
    } catch (error) {
        console.error('Error caching attendance data:', error);
    }
};

/**
 * Get cached attendance data if available and recent
 */
export const getCachedAttendanceData = (showKey) => {
    try {
        const cache = JSON.parse(localStorage.getItem('schedule_attendance_cache') || '{}');
        const entry = cache[showKey];
        
        if (!entry) return null;
        
        // Cache valid for 30 minutes
        const thirtyMinutesAgo = Date.now() - (30 * 60 * 1000);
        if (entry.timestamp < thirtyMinutesAgo) return null;
        
        return entry.data;
    } catch (error) {
        console.error('Error reading cached attendance data:', error);
        return null;
    }
};

// Memory cache for session
const memoryCache = new Map();

/**
 * Batch load attendance data for multiple shows efficiently
 * Reduces database queries by batching requests
 */
export const batchLoadAttendance = async (showKeys, seasonUid, seasonEvents, attendanceStats) => {
    const results = {};
    const uncachedKeys = [];
    
    // First pass: Check cache for each show
    for (const showKey of showKeys) {
        if (memoryCache.has(showKey)) {
            results[showKey] = memoryCache.get(showKey);
            continue;
        }
        
        const cached = getCachedAttendanceData(showKey);
        if (cached && cached.attendees.worldClass.length > 0) {
            results[showKey] = cached;
            memoryCache.set(showKey, cached);
            continue;
        }
        
        // Check precomputed stats
        if (attendanceStats?.shows?.[showKey]) {
            const stats = attendanceStats.shows[showKey];
            results[showKey] = stats;
            memoryCache.set(showKey, stats);
            continue;
        }
        
        uncachedKeys.push(showKey);
    }
    
    // Second pass: Batch load uncached data
    if (uncachedKeys.length > 0) {
        const batchPromises = uncachedKeys.map(async (showKey) => {
            const [dayNumber, eventName] = showKey.split('_', 2);
            const week = Math.ceil(parseInt(dayNumber) / 7);
            
            try {
                const attendance = await fetchAttendanceForShow(seasonUid, eventName, week);
                results[showKey] = attendance;
                cacheAttendanceData(showKey, attendance);
                memoryCache.set(showKey, attendance);
            } catch (error) {
                console.error(`Failed to load attendance for ${showKey}:`, error);
                results[showKey] = {
                    counts: { worldClass: 0, openClass: 0, aClass: 0 },
                    attendees: { worldClass: [], openClass: [], aClass: [] }
                };
            }
        });
        
        await Promise.all(batchPromises);
    }
    
    return results;
};

/**
 * Enhanced attendance fetching with multi-layer caching
 */
export const getAttendanceWithCaching = async (showKey, seasonUid, eventName, dayNumber, seasonEvents, attendanceStats) => {
    // Layer 1: Memory cache (instant)
    if (memoryCache.has(showKey)) {
        return memoryCache.get(showKey);
    }
    
    // Layer 2: localStorage cache (very fast)
    const cached = getCachedAttendanceData(showKey);
    if (cached && cached.attendees.worldClass.length > 0) {
        memoryCache.set(showKey, cached);
        return cached;
    }
    
    // Layer 3: Precomputed stats (fast)
    if (attendanceStats?.shows?.[showKey]) {
        const stats = attendanceStats.shows[showKey];
        if (stats.attendees.worldClass.length > 0) {
            cacheAttendanceData(showKey, stats);
            memoryCache.set(showKey, stats);
            return stats;
        }
    }
    
    // Layer 4: Registration counters with empty attendees (medium)
    const event = seasonEvents?.find(e => e.offSeasonDay === dayNumber);
    const showData = event?.shows?.find(s => s.eventName === eventName);
    if (showData?.registrationCounts) {
        const registrationData = {
            counts: showData.registrationCounts,
            attendees: { worldClass: [], openClass: [], aClass: [] }
        };
        return registrationData;
    }
    
    // Layer 5: Live query (expensive - last resort)
    try {
        const week = Math.ceil(dayNumber / 7);
        const liveData = await fetchAttendanceForShow(seasonUid, eventName, week);
        cacheAttendanceData(showKey, liveData);
        memoryCache.set(showKey, liveData);
        return liveData;
    } catch (error) {
        console.error('Failed to fetch live attendance:', error);
        return {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] }
        };
    }
};

/**
 * Clear memory cache (useful for season changes)
 */
export const clearAttendanceCache = () => {
    memoryCache.clear();
    localStorage.removeItem('schedule_attendance_cache');
};

// Cleanup memory cache on app visibility change
if (typeof window !== 'undefined') {
    // Clear cache when user leaves the page
    window.addEventListener('beforeunload', () => {
        memoryCache.clear();
    });
    
    // Clear cache when page becomes hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            // Clear memory cache but keep localStorage cache
            memoryCache.clear();
        }
    });
    
    // Clear old localStorage entries on app start
    const clearOldCache = () => {
        try {
            const cache = JSON.parse(localStorage.getItem('schedule_attendance_cache') || '{}');
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            const validEntries = Object.entries(cache)
                .filter(([, entry]) => entry.timestamp > oneHourAgo)
                .slice(-50); // Keep max 50 entries
            
            localStorage.setItem('schedule_attendance_cache', JSON.stringify(Object.fromEntries(validEntries)));
        } catch (error) {
            console.error('Error cleaning cache:', error);
            localStorage.removeItem('schedule_attendance_cache');
        }
    };
    
    // Clean cache on app start
    clearOldCache();
}