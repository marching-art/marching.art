import React, { useState, useEffect } from 'react';
import LineupEditor from './LineupEditor';
import ShowSelection from './ShowSelection';
import { useUserStore } from '../../store/userStore';
import { CORPS_CLASSES, getAllUserCorps, hasAnyCorps, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';

// CORRECTED: The component's props are now explicitly listed.
const CorpsSelector = ({ corpsData, seasonSettings, seasonEvents, currentOffSeasonDay, seasonStartDate }) => {
    const { loggedInProfile: profile } = useUserStore();
    const [activeCorps, setActiveCorps] = useState('worldClass');
    const [userCorps, setUserCorps] = useState({});

    useEffect(() => {
        const allCorps = getAllUserCorps(profile);
        setUserCorps(allCorps);
    
        if (Object.keys(allCorps).length === 0) {
            setActiveCorps('worldClass');
        }
    }, [profile]);

    const hasCorps = (corpsClass) => {
        return userCorps[corpsClass] && userCorps[corpsClass].corpsName;
    };

    const handleCorpsCreated = (corpsClass, newCorpsData) => {
        setUserCorps(prev => ({
            ...prev,
            [corpsClass]: newCorpsData
        }));
    };

    if (!profile || !hasAnyCorps(profile)) {
        return null; // Let DashboardPage handle SeasonSignup
    }

    const activeCorpsProfile = userCorps[activeCorps];

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2 border-b-theme border-accent dark:border-accent-dark pb-4">
                {CORPS_CLASS_ORDER.map(key => {
                    const classInfo = CORPS_CLASSES[key];
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveCorps(key)}
                            className={`relative px-3 py-2 text-left rounded-theme font-semibold transition-all w-32 ${
                                activeCorps === key
                                    ? 'bg-primary text-on-primary shadow-lg'
                                    : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                            }`}
                        >
                            <div className={`absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full ${classInfo.color} ${
                                hasCorps(key) ? 'opacity-100' : 'opacity-30'
                            }`}></div>
                            <span className="block text-sm">{classInfo.name}</span>
                            {hasCorps(key) ? (
                                <span className="block text-xs font-normal mt-1 truncate">
                                    {userCorps[key].corpsName}
                                </span>
                            ) : (
                                 <span className="block text-xs font-normal mt-1 opacity-75">
                                    + Create New
                                </span>
                            )}
                        </button>
                    )
                })}
            </div>

            <div>
                <LineupEditor
                    profile={activeCorpsProfile}
                    corpsData={corpsData}
                    pointCap={CORPS_CLASSES[activeCorps].pointCap}
                    seasonSettings={seasonSettings}
                    corpsClass={activeCorps}
                    corpsClassName={CORPS_CLASSES[activeCorps].name}
                    onCorpsCreated={(newCorpsData) => handleCorpsCreated(activeCorps, newCorpsData)}
                />
            </div>
            
            <div className="border-t-2 border-dashed border-accent dark:border-accent-dark my-8"></div>

            <div>
                <ShowSelection
                    seasonMode={seasonSettings.status === 'live-season' ? 'live' : 'off'}
                    seasonEvents={seasonEvents}
                    corpsProfile={activeCorpsProfile}
                    corpsClass={activeCorps}
                    currentDay={currentOffSeasonDay}
                    seasonStartDate={seasonStartDate}
                />
            </div>
        </div>
    );
};

export default CorpsSelector;