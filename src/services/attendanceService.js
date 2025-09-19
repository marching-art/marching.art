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