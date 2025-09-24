// src/components/dashboard/CorpsSelector.js - Enhanced to accept initialActiveCorps prop
import React, { useState, useEffect } from 'react';
import UniformManager from '../profile/UniformManager';
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
    const [showUniformManager, setShowUniformManager] = useState(false);
    const [uniformManagerCorpsClass, setUniformManagerCorpsClass] = useState(null);

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

    const handleUniformManager = (corpsClass) => {
        setUniformManagerCorpsClass(corpsClass);
        setShowUniformManager(true);
    };

    if (!hasAnyCorps(profile)) {
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
                    );
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
            
            {/* Uniform Designer Section */}
            {hasCorps(activeCorps) && (
                <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-theme border border-purple-200 dark:border-purple-800">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                🎨 Uniform Designer
                            </h3>
                            <p className="text-text-secondary dark:text-text-secondary-dark text-sm">
                                Create legendary uniform designs for {userCorps[activeCorps]?.corpsName}
                            </p>
                        </div>
                        <button
                            onClick={() => handleUniformManager(activeCorps)}
                            className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-bold py-3 px-6 rounded-theme transition-all transform hover:scale-105 shadow-lg"
                        >
                            <Icon path="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" className="w-5 h-5 inline mr-2" />
                            Design Uniforms
                        </button>
                    </div>
                    
                    <div className="text-sm text-purple-800 dark:text-purple-200">
                        <strong>New Feature:</strong> Create up to 4 unique uniform designs with comprehensive DCI-inspired options including legendary presets from Blue Devils, Santa Clara Vanguard, and more!
                    </div>
                </div>
            )}

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

            {/* Uniform Manager Modal */}
            {showUniformManager && (
                <UniformManager
                    userId={profile?.uid || profile?.userId}
                    corpsClass={uniformManagerCorpsClass}
                    corpsData={userCorps[uniformManagerCorpsClass]}
                    onClose={() => {
                        setShowUniformManager(false);
                        setUniformManagerCorpsClass(null);
                    }}
                />
            )}
        </div>
    );
};

export default CorpsSelector;