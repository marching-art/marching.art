import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/userStore';
import Leaderboard from '../components/dashboard/Leaderboard';

const LeaderboardPage = ({ onViewProfile }) => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchSeasonData = async () => {
            if (isLoadingAuth) return;
            
            setIsLoading(true);
            try {
                const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
                if (seasonDoc.exists()) {
                    setSeasonSettings(seasonDoc.data());
                }
            } catch (error) {
                console.error("Error fetching season data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSeasonData();
    }, [isLoadingAuth]);

    // Show loading state
    if (isLoadingAuth || isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading leaderboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                    {/* Page Header */}
                    <div className="text-center">
                        <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">
                            Season Leaderboard
                        </h1>
                        <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                            {seasonSettings?.name || 'Current Season'} Rankings
                        </p>
                    </div>

                    {/* Leaderboard Component */}
                    <div className="max-w-4xl mx-auto">
                        <Leaderboard onViewProfile={onViewProfile} />
                    </div>

                    {/* Season Info */}
                    {seasonSettings && (
                        <div className="max-w-2xl mx-auto bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                About This Season
                            </h3>
                            <div className="space-y-2 text-sm text-text-secondary dark:text-text-secondary-dark">
                                <div className="flex justify-between">
                                    <span>Season Type:</span>
                                    <span className="font-semibold capitalize">{seasonSettings.status?.replace('-', ' ')}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Point Cap:</span>
                                    <span className="font-semibold">{seasonSettings.currentPointCap}</span>
                                </div>
                                {seasonSettings.schedule?.startDate && (
                                    <div className="flex justify-between">
                                        <span>Started:</span>
                                        <span className="font-semibold">
                                            {seasonSettings.schedule.startDate.toDate().toLocaleDateString()}
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeaderboardPage;