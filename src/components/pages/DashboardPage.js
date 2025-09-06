import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// Import child components
import SeasonSignup from '../dashboard/SeasonSignup';
import LineupEditor from '../dashboard/LineupEditor';
import Leaderboard from '../dashboard/Leaderboard';

const DashboardPage = ({ profile, userId }) => { // Accept userId as a prop
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [corpsData, setCorpsData] = useState([]); // State for the corps list
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const seasonSettingsRef = doc(db, 'game-settings', 'season');
        
        // This listener fetches season settings and then fetches the corps data
        const unsubscribe = onSnapshot(seasonSettingsRef, async (docSnap) => {
            if (docSnap.exists()) {
                const settings = { id: docSnap.id, ...docSnap.data() };
                setSeasonSettings(settings);

                // --- NEW LOGIC ---
                // Once we have the settings, use the dataDocId to fetch the corps list
                if (settings.dataDocId) {
                    const corpsDataRef = doc(db, 'dci-data', settings.dataDocId);
                    const corpsDocSnap = await getDoc(corpsDataRef);
                    if (corpsDocSnap.exists()) {
                        setCorpsData(corpsDocSnap.data().corpsValues || []);
                    } else {
                        console.error(`Corps data document not found: ${settings.dataDocId}`);
                        setCorpsData([]);
                    }
                }
                // --- END NEW LOGIC ---

            } else {
                setSeasonSettings(null);
            }
            setIsLoading(false);
        }, (error) => {
            console.error("Error fetching season settings:", error);
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Updated loading state to be more robust
    if (isLoading || !seasonSettings) {
        return (
            <div className="text-center">
                <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">Loading Season Data...</p>
            </div>
        );
    }
    
    // Check if the user has joined the current season
    const hasJoinedCurrentSeason = profile?.activeSeasonId === seasonSettings.id;

    return (
        <div>
            {hasJoinedCurrentSeason ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <LineupEditor 
                        profile={profile} 
                        corpsData={corpsData} // Pass the fetched corps data
                        pointCap={seasonSettings.currentPointCap}
                    />
                    <Leaderboard />
                </div>
            ) : (
                <SeasonSignup
                    profile={profile}
                    userId={userId} // Pass the userId prop down
                    seasonSettings={seasonSettings}
                    corpsData={corpsData} // Pass the fetched corps data
                />
            )}
        </div>
    );
};

export default DashboardPage;