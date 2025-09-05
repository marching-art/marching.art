import React, { useState, useEffect } from 'react';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../../firebase';
import LineupEditor from '../dashboard/LineupEditor';
import SeasonSignup from '../dashboard/SeasonSignup';
import Leaderboard from '../dashboard/Leaderboard';

const DashboardPage = ({ profile }) => {
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [corpsData, setCorpsData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // Fetches the main game settings to determine the current season status.
    useEffect(() => {
        const settingsRef = doc(db, 'game-settings', 'season');
        const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
            if (docSnap.exists()) {
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

    // Fetches the correct set of corps data based on the season type (live or off-season).
    useEffect(() => {
        // Don't proceed if season settings haven't loaded yet.
        if (!seasonSettings) {
            // If settings are confirmed to be null (no season), stop loading.
            if (seasonSettings === null) setIsLoading(false);
            return;
        };

        const fetchData = async () => {
            let dataDocId;
            // For an off-season, use the unique data document ID.
            if (seasonSettings.status === 'off-season') {
                dataDocId = seasonSettings.dataDocId; // e.g., 'off-season-2025-aug'
            } 
            // For a live season, use the year.
            else if (seasonSettings.status === 'live-season') {
                dataDocId = String(seasonSettings.seasonYear); // e.g., '2025'
            }

            if (!dataDocId) {
                console.log("No data document ID found for the current season.");
                setIsLoading(false);
                return;
            }

            const docRef = doc(db, 'dci-data', dataDocId);
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setCorpsData(docSnap.data().corpsValues || []);
                } else {
                    console.log(`Corps data document not found: ${dataDocId}`);
                    setCorpsData([]); // Explicitly set to empty if not found
                }
            } catch (error) {
                console.error("Error fetching corps data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [seasonSettings]); // Rerun this effect when season settings change.

    // --- Render Logic ---

    if (isLoading) {
        return (
            <div className="p-4 md:p-8 text-center">
                <h1 className="text-3xl md:text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6">Manager Dashboard</h1>
                <p className="text-lg">Loading game data...</p>
            </div>
        );
    }

    if (!seasonSettings || seasonSettings.status === 'inactive') {
        return (
            <div className="p-4 md:p-8 text-center">
                <h1 className="text-3xl md:text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6">Manager Dashboard</h1>
                <p className="text-lg">The season is currently inactive. Please check back later!</p>
            </div>
        )
    }

    const hasJoinedCurrentSeason = profile?.activeSeasonId === seasonSettings.id;

    if (!hasJoinedCurrentSeason) {
        // If there's no corps data, the user can't sign up.
        if (corpsData.length === 0) {
            return (
                <div className="p-4 md:p-8 text-center">
                    <h1 className="text-3xl md:text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6">Join the Season</h1>
                    <p className="text-lg">The season is being prepared. Please check back shortly to create your corps.</p>
                </div>
            );
        }
        return (
            <div className="p-4 md:p-8">
                <h1 className="text-3xl md:text-4xl font-bold text-yellow-800 dark:text-yellow-300 mb-6 text-center">Join the Season</h1>
                <SeasonSignup 
                    profile={profile} 
                    userId={auth.currentUser?.uid} 
                    seasonSettings={seasonSettings} 
                    corpsData={corpsData} 
                />
            </div>
        );
    }

    // User has joined, show the main dashboard.
    return (
        <Leaderboard />
    );
};

export default DashboardPage;
