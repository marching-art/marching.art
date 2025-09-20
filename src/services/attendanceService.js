import { collection, query, where, getDocs, collectionGroup } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { CORPS_CLASS_ORDER } from '../utils/profileCompatibility';

// Memory cache for session
const memoryCache = new Map();

/**
 * Efficiently fetch attendance data for a specific show
 * Uses collection group queries that work with your Firestore rules
 */
export const fetchAttendanceForShow = async (seasonUid, eventName, week) => {
    try {
        const attendance = {
            counts: { worldClass: 0, openClass: 0, aClass: 0 },
            attendees: { worldClass: [], openClass: [], aClass: [] }
        };

        // Use collection group query on 'data' documents (this is allowed by your rules)
        const profilesQuery = query(
            collectionGroup(db, 'data'),
            where('activeSeasonId', '==', seasonUid)
        );

        const snapshot = await getDocs(profilesQuery);
        
        snapshot.docs.forEach(doc => {
            const profile = doc.data();
            
            // Process each corps class
            CORPS_CLASS_ORDER.forEach(corpsClass => {
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
        });

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
    window.addEventListener('beforeunload', () => {
        memoryCache.clear();
    });
    
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            memoryCache.clear();
        }
    });
    
    const clearOldCache = () => {
        try {
            const cache = JSON.parse(localStorage.getItem('schedule_attendance_cache') || '{}');
            const oneHourAgo = Date.now() - (60 * 60 * 1000);
            const validEntries = Object.entries(cache)
                .filter(([, entry]) => entry.timestamp > oneHourAgo)
                .slice(-50);
            
            localStorage.setItem('schedule_attendance_cache', JSON.stringify(Object.fromEntries(validEntries)));
        } catch (error) {
            console.error('Error cleaning cache:', error);
            localStorage.removeItem('schedule_attendance_cache');
        }
    };
    
    clearOldCache();
}