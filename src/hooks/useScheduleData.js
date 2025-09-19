import { useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';

export const useScheduleData = () => {
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [fantasyRecaps, setFantasyRecaps] = useState(null);
    const [attendanceStats, setAttendanceStats] = useState(null);
    const [currentDay, setCurrentDay] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchScheduleData = async () => {
            setIsLoading(true);
            setError(null);
            
            try {
                // Fetch season settings first
                const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
                
                if (!seasonDoc.exists()) {
                    throw new Error('No active season found');
                }

                const seasonData = seasonDoc.data();
                setSeasonSettings(seasonData);

                // Calculate current day
                if (seasonData.schedule?.startDate) {
                    const startDate = seasonData.schedule.startDate.toDate();
                    const diffInMillis = new Date().getTime() - startDate.getTime();
                    const day = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
                    setCurrentDay(Math.max(1, day));
                }

                // Fetch other data in parallel
                const [recapsSnapshot, statsDoc] = await Promise.all([
                    getDocs(query(
                        collection(db, 'fantasy_recaps'), 
                        where('seasonUid', '==', seasonData.seasonUid), 
                        limit(1)
                    )),
                    getDoc(doc(db, 'attendance_stats', seasonData.seasonUid))
                ]);

                // Set recaps data
                if (!recapsSnapshot.empty) {
                    setFantasyRecaps(recapsSnapshot.docs[0].data());
                }

                // Set pre-computed attendance stats (if available)
                if (statsDoc.exists()) {
                    setAttendanceStats(statsDoc.data());
                }

            } catch (err) {
                console.error("Error fetching schedule data:", err);
                setError(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchScheduleData();
    }, []);

    return {
        seasonSettings,
        fantasyRecaps,
        attendanceStats,
        currentDay,
        isLoading,
        error
    };
};