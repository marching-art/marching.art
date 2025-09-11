import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

// Import child components
import SeasonSignup from '../dashboard/SeasonSignup';
import LineupEditor from '../dashboard/LineupEditor';
import Leaderboard from '../dashboard/Leaderboard';
import LeagueManager from '../dashboard/LeagueManager';
import ShowSelection from '../dashboard/ShowSelection';
import LiveShowSelection from '../dashboard/LiveShowSelection'; // Import the new component

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
            <div className="text-center p-8">
                <p className="text-lg font-semibold text-brand-primary dark:text-brand-secondary-dark">Loading Season Data...</p>
            </div>
        );
    }
    
    const hasJoinedCurrentSeason = profile?.activeSeasonId === seasonSettings.seasonUid;

    const seasonStartDate = seasonSettings.schedule?.startDate?.toDate();
    let currentOffSeasonDay = 0;
    if (seasonSettings.status === 'off-season' && seasonStartDate) {
        const diff = new Date().getTime() - seasonStartDate.getTime();
        currentOffSeasonDay = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
    }

    return (
        <div className="p-4 md:p-8">
            {hasJoinedCurrentSeason ? (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-8">
                         <LineupEditor 
                            profile={profile}  
                            corpsData={corpsData}
                            pointCap={seasonSettings.currentPointCap}
                            seasonSettings={seasonSettings}
                        />
                        <Leaderboard profile={profile} />
                    </div>
                    <LeagueManager profile={profile} />

                    {/* --- CONDITIONAL RENDERING LOGIC --- */}
                    {seasonSettings.status === 'live-season' ? (
                        <LiveShowSelection
                            seasonEvents={seasonSettings.events || []}
                            profile={profile}
                            seasonStartDate={seasonStartDate}
                        />
                    ) : (
                        <ShowSelection 
                            seasonEvents={seasonSettings.events || []}
                            profile={profile}
                            currentOffSeasonDay={currentOffSeasonDay}
                        />
                    )}
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
