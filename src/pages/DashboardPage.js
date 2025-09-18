import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/userStore';
import { hasAnyCorps } from '../utils/profileCompatibility';

// Import your components
import MyStatus from '../components/dashboard/MyStatus';
import CorpsSelector from '../components/dashboard/CorpsSelector';
import SeasonSignup from '../components/dashboard/SeasonSignup';

const DashboardPage = () => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [corpsData, setCorpsData] = useState([]);
    const [seasonEvents, setSeasonEvents] = useState([]);
    const [currentOffSeasonDay, setCurrentOffSeasonDay] = useState(0);
    const [seasonStartDate, setSeasonStartDate] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (isLoadingAuth) return; // Wait for auth to finish loading
            
            setIsLoading(true);
            try {
                // Fetch season settings
                const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
                if (seasonDoc.exists()) {
                    const seasonData = seasonDoc.data();
                    setSeasonSettings(seasonData);
                    setSeasonStartDate(seasonData.schedule?.startDate?.toDate() || null);
                    setSeasonEvents(seasonData.events || []);

                    // Calculate current day
                    if (seasonData.schedule?.startDate) {
                        const startDate = seasonData.schedule.startDate.toDate();
                        const diffInMillis = new Date().getTime() - startDate.getTime();
                        const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
                        setCurrentOffSeasonDay(Math.max(1, currentDay));
                    }

                    // Fetch corps data
                    if (seasonData.dataDocId) {
                        const corpsDoc = await getDoc(doc(db, 'dci-data', seasonData.dataDocId));
                        if (corpsDoc.exists()) {
                            setCorpsData(corpsDoc.data().corpsValues || []);
                        }
                    }
                }
            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchDashboardData();
    }, [isLoadingAuth]);

    // Show loading state
    if (isLoadingAuth || isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    // Show error state if no season
    if (!seasonSettings) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">No Active Season</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">There's no active season right now. Check back later!</p>
                </div>
            </div>
        );
    }

    // Check if user needs to sign up for the season
    const needsSeasonSignup = !loggedInProfile || !hasAnyCorps(loggedInProfile) || 
        loggedInProfile.activeSeasonId !== seasonSettings.seasonUid;

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                    {needsSeasonSignup ? (
                        <SeasonSignup 
                            seasonSettings={seasonSettings}
                            corpsData={corpsData}
                        />
                    ) : (
                        <>
                            <MyStatus />
                            <CorpsSelector
                                corpsData={corpsData}
                                seasonSettings={seasonSettings}
                                seasonEvents={seasonEvents}
                                currentOffSeasonDay={currentOffSeasonDay}
                                seasonStartDate={seasonStartDate}
                            />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;