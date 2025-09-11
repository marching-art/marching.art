import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// Import child components
import SeasonSignup from '../dashboard/SeasonSignup';
import LineupEditor from '../dashboard/LineupEditor';
import Leaderboard from '../dashboard/Leaderboard';
import ShowSelection from '../dashboard/ShowSelection'; // NEW IMPORT

const DashboardPage = ({ profile, userId }) => {
    const [seasonSettings, setSeasonSettings] = useState(null);
    const [corpsData, setCorpsData] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const seasonSettingsRef = doc(db, 'game-settings', 'season');
        
        const unsubscribe = onSnapshot(seasonSettingsRef, async (docSnap) => {
            if (docSnap.exists()) {
                const settings = { id: docSnap.id, ...docSnap.data() };
                setSeasonSettings(settings);

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

    if (isLoading || !seasonSettings) {
        return (
            <div className="text-center">
                <p className="text-lg font-semibold text-yellow-600 dark:text-yellow-400">Loading Season Data...</p>
            </div>
        );
    }
    
    // Check if the user has joined the current season
    const hasJoinedCurrentSeason = profile?.activeSeasonId === seasonSettings.seasonUid;

    // Calculate the current day of the off-season
    const seasonStartDate = seasonSettings.schedule?.startDate?.toDate();
    let currentOffSeasonDay = 0;
    if (seasonStartDate) {
        const diff = new Date().getTime() - seasonStartDate.getTime();
        currentOffSeasonDay = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    }

    return (
        <div>
            {hasJoinedCurrentSeason ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-8">
                         <LineupEditor 
                            profile={profile} 
                            corpsData={corpsData}
                            pointCap={seasonSettings.currentPointCap}
                            seasonSettings={seasonSettings} // Add this prop
                        />
                        <Leaderboard />
                    </div>
                    {/* NEW: ShowSelection component takes up the full width below */}
                    <ShowSelection 
                        seasonEvents={seasonSettings.events || []}
                        profile={profile}
                        currentOffSeasonDay={currentOffSeasonDay}
                    />
                </div>
            ) : (
                <SeasonSignup
                    profile={profile}
                    userId={userId}
                    seasonSettings={seasonSettings}
                    corpsData={corpsData}
                />
            )}
        </div>
    );
};

export default DashboardPage;