import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/userStore';

// Import your components
import LeagueManager from '../components/dashboard/LeagueManager';
import Leaderboard from '../components/leagues/Leaderboard';
import MatchupsDisplay from '../components/leagues/MatchupsDisplay';

const LeaguePage = ({ setPage, onViewLeague }) => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [currentWeek, setCurrentWeek] = useState(1);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLeagueData = async () => {
            if (isLoadingAuth) return;
            
            setIsLoading(true);
            try {
                // Fetch season settings to get current week
                const seasonDoc = await getDoc(doc(db, 'game-settings', 'season'));
                if (seasonDoc.exists()) {
                    const seasonData = seasonDoc.data();
                    setSeasonSettings(seasonData);

                    // Calculate current week
                    if (seasonData.schedule?.startDate) {
                        const startDate = seasonData.schedule.startDate.toDate();
                        const diffInMillis = new Date().getTime() - startDate.getTime();
                        const currentDay = Math.floor(diffInMillis / (1000 * 60 * 60 * 24)) + 1;
                        const week = Math.ceil(currentDay / 7);
                        setCurrentWeek(Math.max(1, week));
                    }
                }
            } catch (error) {
                console.error("Error fetching league data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeagueData();
    }, [isLoadingAuth]);

    // Handle viewing a profile
    const handleViewProfile = (userId) => {
        setPage('profile', { userId });
    };

    // Handle viewing a league detail
    const handleViewLeague = (leagueId) => {
        if (onViewLeague) {
            onViewLeague(leagueId);
        }
    };

    // Show loading state
    if (isLoadingAuth || isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading leagues...</p>
                </div>
            </div>
        );
    }

    // Show error state if no profile
    if (!loggedInProfile) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Profile Not Found</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">Unable to load your profile. Please try refreshing the page.</p>
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
                            Fantasy Leagues
                        </h1>
                        <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                            Compete with friends in private leagues
                        </p>
                    </div>

                    {/* League Manager */}
                    <LeagueManager profile={loggedInProfile} />

                    {/* Global Leaderboard */}
                    <Leaderboard onViewProfile={handleViewProfile} />

                    {/* Matchups Display */}
                    {loggedInProfile.leagueIds && loggedInProfile.leagueIds.length > 0 && (
                        <div className="space-y-6">
                            {loggedInProfile.leagueIds.map(leagueId => (
                                <MatchupsDisplay
                                    key={leagueId}
                                    league={{ id: leagueId }}
                                    currentWeek={currentWeek}
                                    onViewProfile={handleViewProfile}
                                    season={seasonSettings}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeaguePage;