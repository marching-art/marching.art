// src/components/dashboard/CorpsSelector.js - UPDATED: Uniform builder removed, moved to main dashboard
import React, { useState, useEffect } from 'react';
import Icon from '../ui/Icon';
import LineupEditor from './LineupEditor';
import ShowSelection from './ShowSelection';
import { CORPS_CLASSES, getAllUserCorps, hasAnyCorps, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';

const CorpsSelector = ({ 
  profile, 
  corpsData, 
  seasonSettings, 
  seasonEvents, 
  currentOffSeasonDay, 
  seasonStartDate,
  initialActiveCorps = null // New prop to set which tab opens initially
}) => {
    const [activeCorps, setActiveCorps] = useState('worldClass');
    const [userCorps, setUserCorps] = useState({});
    const [hasInitialized, setHasInitialized] = useState(false);

    useEffect(() => {
        const allCorps = getAllUserCorps(profile);
        setUserCorps(allCorps);
    }, [profile]);

    // Only use initialActiveCorps on the first load, then maintain independent state
    useEffect(() => {
        if (!hasInitialized && profile) {
            if (initialActiveCorps) {
                setActiveCorps(initialActiveCorps);
            } else if (Object.keys(getAllUserCorps(profile)).length === 0) {
                setActiveCorps('worldClass');
            }
            setHasInitialized(true);
        }
    }, [profile, initialActiveCorps, hasInitialized]);

    const hasCorps = (corpsClass) => {
        return userCorps[corpsClass] && userCorps[corpsClass].corpsName;
    };

    const handleCorpsCreated = (corpsClass, newCorpsData) => {
        setUserCorps(prev => ({
            ...prev,
            [corpsClass]: newCorpsData
        }));
    };

    if (!hasAnyCorps(profile)) {
        return null; // Let DashboardPage handle SeasonSignup
    }

    const activeCorpsProfile = userCorps[activeCorps];

    return (
        <div className="space-y-6">
            {/* Corps Class Tabs */}
            <div className="flex flex-wrap gap-2 border-b-theme border-accent dark:border-accent-dark pb-4">
                {CORPS_CLASS_ORDER.map(key => {
                    const classInfo = CORPS_CLASSES[key];
                    return (
                        <button
                            key={key}
                            onClick={() => setActiveCorps(key)}
                            className={`relative px-3 py-2 text-left rounded-theme font-semibold transition-all w-32 ${
                                activeCorps === key
                                    ? 'bg-primary text-on-primary shadow-md transform scale-105' 
                                    : 'bg-surface dark:bg-surface-dark hover:bg-accent dark:hover:bg-accent-dark/20 text-text-primary dark:text-text-primary-dark'
                            }`}
                        >
                            <div className={`absolute top-1 right-1 w-3 h-3 rounded-full transition-opacity ${
                                classInfo?.color || 'bg-gray-400'
                            } ${
                                activeCorps === key ? 'opacity-100' : 'opacity-30'
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
                    );
                })}
            </div>

            {/* Lineup Editor */}
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

            {/* Show Selection */}
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