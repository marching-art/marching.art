import React, { useState, useEffect } from 'react';
import LineupEditor from './LineupEditor';
import { CORPS_CLASSES, getAllUserCorps, hasAnyCorps } from '../../utils/profileCompatibility';

const CorpsSelector = ({ profile, corpsData, seasonSettings }) => {
    const [activeCorps, setActiveCorps] = useState('worldClass');
    const [userCorps, setUserCorps] = useState({});

    useEffect(() => {
        // Get all user's corps using compatibility helper
        const allCorps = getAllUserCorps(profile);
        setUserCorps(allCorps);
        
        // Set active corps to first one they have, or worldClass as default
        const firstCorpsKey = Object.keys(allCorps)[0] || 'worldClass';
        setActiveCorps(firstCorpsKey);
    }, [profile]);

    const hasCorps = (corpsClass) => {
        return userCorps[corpsClass] && userCorps[corpsClass].corpsName;
    };

    const getCorpsDisplayName = (corpsClass) => {
        const corps = userCorps[corpsClass];
        if (corps && corps.corpsName) {
            return corps.corpsName;
        }
        return `Create ${CORPS_CLASSES[corpsClass].name}`;
    };

    const handleCorpsCreated = (corpsClass, newCorpsData) => {
        setUserCorps(prev => ({
            ...prev,
            [corpsClass]: newCorpsData
        }));
    };

    if (!hasAnyCorps(profile)) {
        // User hasn't joined the season yet - show season signup
        return null; // Let DashboardPage handle SeasonSignup
    }

    return (
        <div className="space-y-6">
            {/* Corps Class Tabs */}
            <div className="flex flex-wrap gap-2 border-b-theme border-accent dark:border-accent-dark pb-4">
                {Object.entries(CORPS_CLASSES).map(([key, classInfo]) => (
                    <button
                        key={key}
                        onClick={() => setActiveCorps(key)}
                        className={`relative px-4 py-2 rounded-theme font-semibold transition-all ${
                            activeCorps === key
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
                        }`}
                    >
                        <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${classInfo.color} ${
                            hasCorps(key) ? 'opacity-100' : 'opacity-30'
                        }`}></div>
                        <span className="block text-sm">{classInfo.name}</span>
                        <span className="block text-xs opacity-75">{classInfo.pointCap} pts</span>
                        {hasCorps(key) && (
                            <span className="block text-xs mt-1 truncate max-w-24">
                                {userCorps[key].corpsName}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Active Corps Editor */}
            <div className="min-h-96">
                <LineupEditor
                    profile={userCorps[activeCorps]}
                    corpsData={corpsData}
                    pointCap={CORPS_CLASSES[activeCorps].pointCap}
                    seasonSettings={seasonSettings}
                    corpsClass={activeCorps}
                    corpsClassName={CORPS_CLASSES[activeCorps].name}
                    onCorpsCreated={(newCorpsData) => handleCorpsCreated(activeCorps, newCorpsData)}
                />
            </div>

            {/* Summary Stats */}
            <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border-theme border-accent dark:border-accent-dark">
                <h3 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">Your Corps Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    {Object.entries(CORPS_CLASSES).map(([key, classInfo]) => (
                        <div key={key} className="text-center">
                            <div className={`inline-block w-3 h-3 rounded-full ${classInfo.color} mb-1`}></div>
                            <div className="font-semibold">{classInfo.name}</div>
                            <div className="text-text-secondary dark:text-text-secondary-dark">
                                {hasCorps(key) ? (
                                    <>
                                        <div>{userCorps[key].corpsName}</div>
                                        <div>{userCorps[key].totalSeasonScore || 0} pts</div>
                                    </>
                                ) : (
                                    <div>Not Created</div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default CorpsSelector;