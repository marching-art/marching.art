import React, { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase';

// Import child components
import SeasonSignup from '../dashboard/SeasonSignup';
import LineupEditor from '../dashboard/LineupEditor';
import Leaderboard from '../dashboard/Leaderboard';

const DashboardPage = ({ profile }) => {
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // New loading state

    useEffect(() => {
        const seasonSettingsRef = doc(db, 'game-settings', 'season');
        const unsubscribe = onSnapshot(seasonSettingsRef, (docSnap) => {
            if (docSnap.exists()) {
                setSeasonSettings({ id: docSnap.id, ...docSnap.data() });
            } else {
                setSeasonSettings(null); // Handle case where settings don't exist
            }
            setIsLoading(false); // Set loading to false once settings are fetched
        }, (error) => {
            console.error("Error fetching season settings:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    if (isLoading || !profile) { // Wait for both profile and seasonSettings to be loaded
        return (
            <div className="text-center">
                <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">Loading Dashboard...</p>
            </div>
        );
    }
    
    if (!seasonSettings) {
        return (
             <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-red-500 shadow-lg text-center">
                <h2 className="text-2xl font-bold text-red-700 dark:text-red-400">Game Season Not Active</h2>
                <p className="mt-4">The game administrator has not configured the current season. Please check back later.</p>
            </div>
        )
    }

    const hasJoinedCurrentSeason = profile?.activeSeasonId === seasonSettings.id;

    return (
        <div>
            {hasJoinedCurrentSeason ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <LineupEditor 
                        profile={profile} 
                        corpsData={[]} // Note: This will need to be populated
                        pointCap={seasonSettings.currentPointCap}
                    />
                    <Leaderboard />
                </div>
            ) : (
                <SeasonSignup
                    profile={profile}
                    userId={profile.userId} // Assuming userId is on profile
                    seasonSettings={seasonSettings}
                    corpsData={[]} // Note: This will need to be populated
                />
            )}
        </div>
    );
};

export default DashboardPage;