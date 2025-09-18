import React, { useState, useEffect } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useUserStore } from '../store/userStore';
import Leaderboard from '../components/dashboard/Leaderboard';
import MatchupsDisplay from '../components/leagues/MatchupsDisplay';

const LeagueDetailPage = ({ leagueId, setPage, onViewProfile }) => {
    const { loggedInProfile, isLoadingAuth } = useUserStore();
    const [league, setLeague] = useState(null);
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [currentWeek, setCurrentWeek] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchLeagueData = async () => {
            if (isLoadingAuth) return;
            
            setIsLoading(true);
            setError(null);
            
            try {
                // Fetch league and season data in parallel
                const [leagueDoc, seasonDoc] = await Promise.all([
                    getDoc(doc(db, 'leagues', leagueId)),
                    getDoc(doc(db, 'game-settings', 'season'))
                ]);

                if (!leagueDoc.exists()) {
                    setError('League not found');
                    return;
                }

                const leagueData = { id: leagueDoc.id, ...leagueDoc.data() };
                setLeague(leagueData);

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
            } catch (err) {
                console.error("Error fetching league data:", err);
                setError('Failed to load league data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchLeagueData();
    }, [leagueId, isLoadingAuth]);

    // Check if user is a member of this league
    const isMember = league?.members?.includes(loggedInProfile?.userId);

    // Show loading state
    if (isLoadingAuth || isLoading) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary dark:border-primary-dark"></div>
                    <p className="mt-4 text-text-secondary dark:text-text-secondary-dark">Loading league...</p>
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-600 mb-4">League Error</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-4">{error}</p>
                    <button 
                        onClick={() => setPage('leagues')}
                        className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme"
                    >
                        Back to Leagues
                    </button>
                </div>
            </div>
        );
    }

    // Not a member state
    if (league && !isMember && !loggedInProfile?.isAdmin) {
        return (
            <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Private League</h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                        You don't have access to view this league.
                    </p>
                    <button 
                        onClick={() => setPage('leagues')}
                        className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme"
                    >
                        Back to Leagues
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background dark:bg-background-dark">
            <div className="container mx-auto px-4 py-8">
                <div className="space-y-8">
                    {/* Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-bold text-primary dark:text-primary-dark">
                                {league.name}
                            </h1>
                            <p className="text-text-secondary dark:text-text-secondary-dark mt-2">
                                {league.members?.length || 0} members • {seasonSettings?.name || 'Current Season'}
                            </p>
                        </div>
                        <button 
                            onClick={() => setPage('leagues')}
                            className="bg-secondary hover:opacity-90 text-on-secondary font-bold py-2 px-4 rounded-theme"
                        >
                            ← Back to Leagues
                        </button>
                    </div>

                    {/* League Info */}
                    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center">
                                <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                    {league.members?.length || 0}
                                </p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Members</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                    {league.inviteCode}
                                </p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Invite Code</p>
                            </div>
                            <div className="text-center">
                                <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                    Week {currentWeek}
                                </p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Current Week</p>
                            </div>
                        </div>
                    </div>

                    {/* League Leaderboard */}
                    <div>
                        <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            League Standings
                        </h2>
                        <Leaderboard 
                            onViewProfile={onViewProfile} 
                            initialLeague={league}
                        />
                    </div>

                    {/* Current Week Matchups */}
                    <div>
                        <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                            This Week's Matchups
                        </h2>
                        <MatchupsDisplay
                            league={league}
                            currentWeek={currentWeek}
                            onViewProfile={onViewProfile}
                            season={seasonSettings}
                        />
                    </div>

                    {/* League Champions (if any) */}
                    {league.champions && league.champions.length > 0 && (
                        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                                League Champions
                            </h3>
                            <div className="space-y-3">
                                {league.champions.map((champion, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-background dark:bg-background-dark rounded-theme">
                                        <div>
                                            <p className="font-bold text-text-primary dark:text-text-primary-dark">
                                                {champion.winnerUsername}
                                            </p>
                                            <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                {champion.winnerCorpsName} • {champion.seasonName}
                                            </p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-bold text-primary dark:text-primary-dark">
                                                {champion.score?.toFixed(3) || 'N/A'}
                                            </p>
                                            <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                                {champion.archivedAt?.toDate?.()?.toLocaleDateString?.() || 'Unknown'}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default LeagueDetailPage;