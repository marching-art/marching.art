// src/components/dashboard/CorpsSelector.js
import React, { useState, useEffect } from 'react';
import LineupEditor from './LineupEditor';
import ShowSelection from './ShowSelection';
import { CORPS_CLASSES, getAllUserCorps, hasAnyCorps, CORPS_CLASS_ORDER } from '../../utils/profileCompatibility';
import Icon from '../ui/Icon';

const CorpsSelector = ({ profile, corpsData, seasonSettings, seasonEvents, currentOffSeasonDay, seasonStartDate }) => {
    const [activeCorps, setActiveCorps] = useState('worldClass');
    const [userCorps, setUserCorps] = useState({});
    const [activeTab, setActiveTab] = useState('lineup'); // 'lineup' or 'shows'
    const [showCreateCorpsModal, setShowCreateCorpsModal] = useState(false);
    const [selectedCorpsClassToCreate, setSelectedCorpsClassToCreate] = useState(null);

    useEffect(() => {
        const allCorps = getAllUserCorps(profile);
        setUserCorps(allCorps);
    
        // Auto-select first available corps or stay on worldClass
        if (Object.keys(allCorps).length > 0) {
            const firstAvailable = CORPS_CLASS_ORDER.find(key => allCorps[key]?.corpsName);
            if (firstAvailable && !allCorps[activeCorps]?.corpsName) {
                setActiveCorps(firstAvailable);
            }
        }
    }, [profile, activeCorps]);

    const hasCorps = (corpsClass) => {
        return userCorps[corpsClass] && userCorps[corpsClass].corpsName;
    };

    const handleCorpsCreated = (corpsClass, newCorpsData) => {
        setUserCorps(prev => ({
            ...prev,
            [corpsClass]: newCorpsData
        }));
        setActiveCorps(corpsClass);
        setShowCreateCorpsModal(false);
        setActiveTab('lineup'); // Switch to lineup tab after creation
    };

    const handleCreateCorps = (corpsClass) => {
        setSelectedCorpsClassToCreate(corpsClass);
        setShowCreateCorpsModal(true);
    };

    if (!hasAnyCorps(profile)) {
        return null; // Let DashboardPage handle SeasonSignup
    }

    const activeCorpsProfile = userCorps[activeCorps];
    const canCreateMore = Object.keys(userCorps).length < 3; // Limit to 3 corps classes

    // Calculate completion status for each corps
    const getCorpsStatus = (corpsClass) => {
        const corps = userCorps[corpsClass];
        if (!corps) return { status: 'empty', message: 'Not created' };
        
        const hasLineup = corps.lineup && Object.keys(corps.lineup).length === 8;
        const hasShows = corps.selectedShows && Object.keys(corps.selectedShows).length > 0;
        
        if (!hasLineup) return { status: 'incomplete', message: 'Needs lineup' };
        if (!hasShows && seasonSettings?.status === 'live-season') return { status: 'incomplete', message: 'Needs shows' };
        return { status: 'complete', message: 'Ready to compete' };
    };

    return (
        <div className="space-y-6">
            {/* Corps Class Tabs */}
            <div className="border-b border-accent dark:border-accent-dark">
                <div className="flex flex-wrap gap-2 pb-4">
                    {CORPS_CLASS_ORDER.map(key => {
                        const classInfo = CORPS_CLASSES[key];
                        const corpsStatus = getCorpsStatus(key);
                        const isActive = activeCorps === key;
                        
                        return (
                            <button
                                key={key}
                                onClick={() => hasCorps(key) ? setActiveCorps(key) : handleCreateCorps(key)}
                                className={`relative px-4 py-3 text-left rounded-theme font-semibold transition-all min-w-[140px] ${
                                    isActive && hasCorps(key)
                                        ? 'bg-primary text-on-primary shadow-lg scale-105'
                                        : hasCorps(key)
                                        ? 'bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark/20'
                                        : canCreateMore
                                        ? 'bg-background dark:bg-background-dark border-2 border-dashed border-accent dark:border-accent-dark text-text-secondary dark:text-text-secondary-dark hover:border-primary dark:hover:border-primary-dark hover:text-primary dark:hover:text-primary-dark'
                                        : 'bg-background dark:bg-background-dark border border-accent dark:border-accent-dark text-text-secondary dark:text-text-secondary-dark opacity-50 cursor-not-allowed'
                                }`}
                                disabled={!hasCorps(key) && !canCreateMore}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${classInfo.color}`}></div>
                                            <span className="text-sm font-bold">{classInfo.name}</span>
                                        </div>
                                        {hasCorps(key) ? (
                                            <span className="text-xs opacity-75 block mt-1 truncate max-w-[120px]">
                                                {userCorps[key].corpsName}
                                            </span>
                                        ) : (
                                            <span className="text-xs opacity-75 flex items-center gap-1 mt-1">
                                                <Icon path="M12 4.5v15m7.5-7.5h-15" className="w-3 h-3" />
                                                Create Corps
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Active Corps Management */}
            {activeCorpsProfile ? (
                <div className="space-y-6">
                    {/* Corps Header with Stats */}
                    <div className="bg-background dark:bg-background-dark p-4 rounded-theme border-theme border-accent dark:border-accent-dark">
                        <div className="flex justify-between items-start mb-3">
                            <div>
                                <h3 className="text-xl font-bold text-primary dark:text-primary-dark">
                                    {activeCorpsProfile.corpsName}
                                </h3>
                                <p className="text-text-secondary dark:text-text-secondary-dark">
                                    {CORPS_CLASSES[activeCorps]?.name} • {CORPS_CLASSES[activeCorps]?.pointCap} pts max
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-bold text-primary dark:text-primary-dark">
                                    {activeCorpsProfile.totalSeasonScore?.toFixed(1) || '0.0'}
                                </p>
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">Season Score</p>
                            </div>
                        </div>

                        {/* Quick Stats Row */}
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                    {Object.keys(activeCorpsProfile.lineup || {}).length}/8
                                </p>
                                <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Lineup Set</p>
                            </div>
                            <div>
                                <p className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                    {Object.keys(activeCorpsProfile.selectedShows || {}).length}
                                </p>
                                <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Shows Selected</p>
                            </div>
                            <div>
                                <p className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                                    {activeCorpsProfile.weeklyTrades?.used || 0}
                                </p>
                                <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Trades Used</p>
                            </div>
                        </div>
                    </div>

                    {/* Management Tabs */}
                    <div className="border-b border-accent dark:border-accent-dark">
                        <nav className="-mb-px flex space-x-8">
                            <button
                                onClick={() => setActiveTab('lineup')}
                                className={`whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-sm ${
                                    activeTab === 'lineup' 
                                        ? 'border-primary dark:border-primary-dark text-primary dark:text-primary-dark' 
                                        : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:border-accent dark:hover:border-accent-dark'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Icon path="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" className="w-4 h-4" />
                                    Lineup Editor
                                </div>
                            </button>
                            
                            {seasonSettings?.status === 'live-season' && (
                                <button
                                    onClick={() => setActiveTab('shows')}
                                    className={`whitespace-nowrap pb-2 px-1 border-b-2 font-medium text-sm ${
                                        activeTab === 'shows' 
                                            ? 'border-primary dark:border-primary-dark text-primary dark:text-primary-dark' 
                                            : 'border-transparent text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark hover:border-accent dark:hover:border-accent-dark'
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Icon path="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" className="w-4 h-4" />
                                        Show Selection
                                    </div>
                                </button>
                            )}
                        </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="min-h-[400px]">
                        {activeTab === 'lineup' ? (
                            <LineupEditor 
                                profile={activeCorpsProfile}
                                corpsData={corpsData}
                                pointCap={CORPS_CLASSES[activeCorps]?.pointCap || 150}
                                seasonSettings={seasonSettings}
                                corpsClass={activeCorps}
                                corpsClassName={CORPS_CLASSES[activeCorps]?.name}
                                onCorpsCreated={handleCorpsCreated}
                            />
                        ) : (
                            <ShowSelection
                                seasonEvents={seasonEvents}
                                corpsProfile={activeCorpsProfile}
                                corpsClass={activeCorps}
                                seasonStartDate={seasonStartDate}
                            />
                        )}
                    </div>
                </div>
            ) : (
                /* Create New Corps Interface */
                <div className="text-center py-12 bg-background dark:bg-background-dark rounded-theme border-theme border-accent dark:border-accent-dark">
                    <div className="mb-6">
                        <div className={`w-16 h-16 mx-auto mb-4 rounded-full ${CORPS_CLASSES[activeCorps]?.color} flex items-center justify-center`}>
                            <Icon path="M12 4.5v15m7.5-7.5h-15" className="w-8 h-8 text-white" />
                        </div>
                        <h3 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                            Create Your {CORPS_CLASSES[activeCorps]?.name} Corps
                        </h3>
                        <p className="text-text-secondary dark:text-text-secondary-dark max-w-md mx-auto">
                            Build a {CORPS_CLASSES[activeCorps]?.name} corps with a {CORPS_CLASSES[activeCorps]?.pointCap}-point lineup. 
                            Select from legendary performances to create your ultimate competition team.
                        </p>
                    </div>
                    
                    <button
                        onClick={() => handleCreateCorps(activeCorps)}
                        disabled={!canCreateMore}
                        className="bg-primary hover:opacity-90 text-on-primary font-bold py-3 px-8 rounded-theme transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {canCreateMore ? `Create ${CORPS_CLASSES[activeCorps]?.name} Corps` : 'Corps Limit Reached'}
                    </button>
                    
                    {!canCreateMore && (
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-2">
                            You can manage up to 3 corps (one per class)
                        </p>
                    )}
                </div>
            )}

            {/* Create Corps Modal */}
            {showCreateCorpsModal && selectedCorpsClassToCreate && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex justify-center items-center z-50 p-4">
                    <div className="bg-surface dark:bg-surface-dark max-w-2xl w-full rounded-theme border-theme border-accent dark:border-accent-dark shadow-xl">
                        <div className="p-6 border-b border-accent dark:border-accent-dark">
                            <div className="flex items-center justify-between">
                                <h3 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                                    Create {CORPS_CLASSES[selectedCorpsClassToCreate]?.name} Corps
                                </h3>
                                <button
                                    onClick={() => setShowCreateCorpsModal(false)}
                                    className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
                                >
                                    <Icon path="M6 18L18 6M6 6l12 12" className="w-6 h-6" />
                                </button>
                            </div>
                        </div>
                        <div className="p-6">
                            <LineupEditor 
                                profile={null} // New corps
                                corpsData={corpsData}
                                pointCap={CORPS_CLASSES[selectedCorpsClassToCreate]?.pointCap || 150}
                                seasonSettings={seasonSettings}
                                corpsClass={selectedCorpsClassToCreate}
                                corpsClassName={CORPS_CLASSES[selectedCorpsClassToCreate]?.name}
                                onCorpsCreated={handleCorpsCreated}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CorpsSelector;