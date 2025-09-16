import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';

import SeasonSignup from '../dashboard/SeasonSignup';
import LineupEditor from '../dashboard/LineupEditor';
import LeagueManager from '../dashboard/LeagueManager';
import ShowSelection from '../dashboard/ShowSelection';
import LiveShowSelection from '../dashboard/LiveShowSelection';

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
                <p className="text-lg font-semibold text-primary dark:text-primary-dark">Loading Season Data...</p>
            </div>
        );
    }
    
    const hasJoinedCurrentSeason = profile?.activeSeasonId === seasonSettings.seasonUid;

    const seasonStartDate = seasonSettings.schedule?.startDate?.toDate();
    let currentOffSeasonDay = 0;
    if (seasonSettings.status === 'off-season' && seasonStartDate) {
        // CORRECTED LOGIC: Create a "logical" date by subtracting 6 hours.
        // This makes the daily rollover happen at 6 AM instead of midnight, allowing for early morning selections.
        const logicalNow = new Date();
        logicalNow.setHours(logicalNow.getHours() - 6);

        // Use this logical date to determine "today" for selection purposes
        const todayForLogic = new Date(logicalNow.getFullYear(), logicalNow.getMonth(), logicalNow.getDate());
        
        const startDayForLogic = new Date(seasonStartDate.getFullYear(), seasonStartDate.getMonth(), seasonStartDate.getDate());
        const diff = todayForLogic.getTime() - startDayForLogic.getTime();
        currentOffSeasonDay = Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto">
            {hasJoinedCurrentSeason ? (
                <div className="flex flex-col gap-8">
                    {/* Row 1: Lineup Editor & League Manager (2 Columns) */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                        <div className="bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                             <LineupEditor 
                                profile={profile}  
                                corpsData={corpsData}
                                pointCap={seasonSettings.currentPointCap}
                                seasonSettings={seasonSettings}
                            />
                        </div>
                        <div className="bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                             <LeagueManager profile={profile} />
                        </div>
                    </div>

                    {/* Row 2: Show Selection (Full Width) */}
                    <div className="bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
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
                                seasonStartDate={seasonStartDate}
                            />
                        )}
                    </div>
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