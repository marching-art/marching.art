import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, getDoc } from 'firebase/firestore';
import { db } from '../firebase';

import SeasonSignup from '../components/dashboard/SeasonSignup';
import LeagueManager from '../components/dashboard/LeagueManager';
import CorpsSelector from '../components/dashboard/CorpsSelector';
import MyStatus from '../components/dashboard/MyStatus'; // NEW IMPORT

import { hasJoinedSeason } from '../utils/profileCompatibility';

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
    
    const hasJoinedCurrentSeason = hasJoinedSeason(profile, seasonSettings.seasonUid);

    const seasonStartDate = seasonSettings.schedule?.startDate?.toDate();
    let currentOffSeasonDay = 0;
    if (seasonSettings.status === 'off-season' && seasonStartDate) {
        const logicalNow = new Date();
        logicalNow.setHours(logicalNow.getHours() - 24);
        const todayForLogic = new Date(logicalNow.getFullYear(), logicalNow.getMonth(), logicalNow.getDate());
        const startDayForLogic = new Date(seasonStartDate.getFullYear(), seasonStartDate.getMonth(), seasonStartDate.getDate());
        const diff = todayForLogic.getTime() - startDayForLogic.getTime();
        currentOffSeasonDay = Math.round(diff / (1000 * 60 * 60 * 24)) + 1;
    }

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
            {hasJoinedCurrentSeason ? (
                <>
                    {/* New Status Header */}
                    <MyStatus username={profile.username} profile={profile} />

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        {/* Main Hub: Corps & Show Management */}
                        <div className="lg:col-span-2 bg-surface dark:bg-surface-dark p-4 sm:p-6 rounded-theme border-theme border-accent dark:border-accent-dark shadow-theme">
                            <h2 className="text-2xl font-bold text-primary dark:text-primary-dark mb-4">Manage Your Corps</h2>
                            <CorpsSelector 
                                profile={profile}  
                                corpsData={corpsData}
                                seasonSettings={seasonSettings}
                                seasonEvents={seasonSettings.events || []}
                                currentOffSeasonDay={currentOffSeasonDay}
                                seasonStartDate={seasonStartDate}
                            />
                        </div>

                        {/* Side Column: Leagues and other modules */}
                        <div className="space-y-8">
                             <LeagueManager profile={profile} />
                             {/* You can add more summary modules here in the future */}
                        </div>
                    </div>
                </>
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
