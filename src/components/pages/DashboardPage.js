import React, { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import LineupEditor from '../dashboard/LineupEditor';
import SeasonSignup from '../dashboard/SeasonSignup'; // Import the new component

const DashboardPage = ({ profile }) => {
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [corpsData, setCorpsData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // This effect now fetches the global game settings first.
    useEffect(() => {
        const settingsRef = doc(db, 'game-settings', 'season');
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
                // Store the season settings, including its ID for later checks
                setSeasonSettings({ id: docSnap.id, ...docSnap.data() });
            } else {
                setSeasonSettings(null); // No active season
            }
        }, (error) => {
            console.error("Error fetching season settings:", error);
            setSeasonSettings(null);
        });

        return () => unsubscribe();
    }, []);

    // This effect fetches the necessary corps data once we know the season settings.
    useEffect(() => {
        if (!seasonSettings || !seasonSettings.seasonYear) {
            if (seasonSettings === null) setIsLoading(false); // Stop loading if no season
            return;
        };

        const fetchData = async () => {
            const docRef = doc(db, 'dci-data', String(seasonSettings.seasonYear));
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setCorpsData(docSnap.data().corpsValues || []);
                } else {
                    console.log(`No corps data found for year ${seasonSettings.seasonYear}`);
                    setCorpsData([]);
                }
            } catch (error) {
                console.error("Error fetching corps data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [seasonSettings]); // Rerun when seasonSettings are loaded

    // Main render logic
    if (isLoading) {
        return (
            <div className="p-4 md:p-8 text-center">
                <h1 className="text-3xl md:text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6">Manager Dashboard</h1>
                <p className="text-lg">Loading game data...</p>
            </div>
        );
    }

    // SCENARIO 1: No season is currently active.
    if (!seasonSettings || seasonSettings.status === 'inactive') {
        return (
            <div className="p-4 md:p-8 text-center">
                <h1 className="text-3xl md:text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6">Manager Dashboard</h1>
                <p className="text-lg">The season is currently inactive. Please check back later for information on the next season!</p>
            </div>
        )
    }

    // SCENARIO 2: A season is active, but the user has not joined it yet.
    // We check if their profile's activeSeasonId matches the current season's ID.
    const hasJoinedCurrentSeason = profile?.activeSeasonId === seasonSettings.id;

    if (!hasJoinedCurrentSeason) {
        return (
            <div className="p-4 md:p-8">
                <h1 className="text-3xl md:text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6 text-center">Join the Season</h1>
                <SeasonSignup profile={profile} userId={auth.currentUser?.uid} seasonSettings={seasonSettings} />
            </div>
        );
    }

    // SCENARIO 3: User has joined the season, show the lineup editor.
    return (
        <div className="p-4 md:p-8">
            <h1 className="text-3xl md:text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6">Manager Dashboard</h1>
            <div className="grid lg:grid-cols-3 gap-8">
                <LineupEditor profile={profile} corpsData={corpsData} pointCap={seasonSettings.currentPointCap} />
                <div className="bg-white dark:bg-gray-800 p-6 rounded-md border-2 border-yellow-500 shadow-lg">
                    <h2 className="text-2xl font-bold text-yellow-700 dark:text-yellow-400 mb-4">League Standings</h2>
                    {/* Placeholder for standings */}
                    <ol className="list-decimal list-inside space-y-2 text-gray-700 dark:text-yellow-300">
                        <li><span className="font-bold text-black dark:text-white">{profile.corpsName}</span> (You) - 0.00 pts</li>
                    </ol>
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
