// components/LineupBuilder.js
// Complete LineupBuilder for Fantasy Drum Corps Game
// No framer-motion - using CSS animations instead

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../firebase';
import { useUserStore } from '../store/userStore';
import { CORPS_CLASSES } from '../utils/profileCompatibility';
import { DCI_HALL_OF_FAME_STAFF, calculateStaffMultiplier } from '../data/dciHallOfFameStaff';
import Icon from './ui/Icon';
import toast from 'react-hot-toast';

const CAPTIONS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

const LineupBuilder = ({ 
    corpsClass = 'worldClass', 
    corpsData = [], 
    seasonSettings,
    onSave,
    initialData = null 
}) => {
    const { user, loggedInProfile, updateProfile, updateUserExperience } = useUserStore();
    
    // Core lineup state
    const [lineup, setLineup] = useState({});
    const [staffLineup, setStaffLineup] = useState({});
    const [corpsName, setCorpsName] = useState('');
    
    // UI state
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [activeTab, setActiveTab] = useState('corps');
    const [selectedCaption, setSelectedCaption] = useState('GE1');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('points');
    const [showStaffPreview, setShowStaffPreview] = useState(false);
    const [showAIRecommendations, setShowAIRecommendations] = useState(false);

    // Premium features state
    const [recommendations, setRecommendations] = useState({});
    const [historicalMode, setHistoricalMode] = useState(false);

    const classDetails = CORPS_CLASSES[corpsClass];
    const pointCap = classDetails?.pointCap || 150;
    const isNewCorps = initialData === null;

    // User level and premium features
    const userLevel = loggedInProfile?.level || 1;
    const premiumFeatures = useMemo(() => ({
        advancedAnalytics: userLevel >= 5,
        staffTrading: userLevel >= 3,
        multipleCorps: userLevel >= 10,
        aiRecommendations: userLevel >= 15,
        historicalSimulation: userLevel >= 20,
        autoOptimization: userLevel >= 25
    }), [userLevel]);

    // Performance optimization - memoized calculations
    const totalPoints = useMemo(() => {
        return Object.values(lineup).reduce((sum, selection) => {
            if (!selection) return sum;
            const [, points] = selection.split('|');
            return sum + (parseInt(points) || 0);
        }, 0);
    }, [lineup]);

    const budgetRemaining = useMemo(() => {
        return pointCap - totalPoints;
    }, [pointCap, totalPoints]);

    const isLineupComplete = useMemo(() => {
        return CAPTIONS.every(caption => lineup[caption]);
    }, [lineup]);

    const isStaffComplete = useMemo(() => {
        return Object.keys(staffLineup).length >= 4;
    }, [staffLineup]);

    // Staff bonus calculations
    const staffBonusPreview = useMemo(() => {
        if (!isStaffComplete) return {};
        
        const bonuses = {};
        CAPTIONS.forEach(caption => {
            const relevantStaff = Object.values(staffLineup).filter(staffId => {
                const staff = DCI_HALL_OF_FAME_STAFF.find(s => s.id === staffId);
                return staff && staff.specialty.includes(caption);
            });
            
            let totalBonus = 0;
            relevantStaff.forEach(staffId => {
                const staff = DCI_HALL_OF_FAME_STAFF.find(s => s.id === staffId);
                if (staff) {
                    totalBonus += calculateStaffMultiplier(staff) - 1;
                }
            });
            
            bonuses[caption] = {
                percentBonus: (totalBonus * 100).toFixed(1),
                staffCount: relevantStaff.length
            };
        });
        
        return bonuses;
    }, [staffLineup, isStaffComplete]);

    // Filtered and sorted corps data
    const filteredCorpsData = useMemo(() => {
        let filtered = corpsData.filter(corps => {
            const searchMatch = !searchTerm || 
                corps.corpsName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                corps.sourceYear?.toString().includes(searchTerm);
            
            const points = corps.points || corps.totalScore || 0;
            const withinBudget = points <= budgetRemaining + (lineup[selectedCaption] ? 
                parseInt(lineup[selectedCaption].split('|')[1]) || 0 : 0);
            
            return searchMatch && withinBudget && points > 0;
        });

        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'points':
                    return (b.points || b.totalScore || 0) - (a.points || a.totalScore || 0);
                case 'name':
                    return (a.corpsName || '').localeCompare(b.corpsName || '');
                case 'year':
                    return (b.sourceYear || 0) - (a.sourceYear || 0);
                default:
                    return 0;
            }
        });
    }, [corpsData, searchTerm, budgetRemaining, lineup, selectedCaption, sortBy]);

    // Initialize component with existing data
    useEffect(() => {
        if (initialData) {
            setLineup(initialData.lineup || {});
            setStaffLineup(initialData.staffLineup || {});
            setCorpsName(initialData.corpsName || '');
        }
    }, [initialData]);

    const handleCorpsSelection = useCallback((corps, caption) => {
        const uniqueValue = `${corps.corpsName}|${corps.points || corps.totalScore}|${corps.sourceYear}`;
        
        setLineup(prev => {
            const newLineup = { ...prev };
            Object.keys(newLineup).forEach(key => {
                if (newLineup[key] === uniqueValue && key !== caption) {
                    delete newLineup[key];
                }
            });
            
            newLineup[caption] = uniqueValue;
            return newLineup;
        });

        // Auto-advance to next empty caption
        const currentIndex = CAPTIONS.indexOf(caption);
        for (let i = currentIndex + 1; i < CAPTIONS.length; i++) {
            if (!lineup[CAPTIONS[i]]) {
                setSelectedCaption(CAPTIONS[i]);
                break;
            }
        }

        setMessage('');
        toast.success(`${corps.corpsName} added to ${caption}!`, { duration: 2000 });
    }, [lineup]);

    const handleStaffSelection = useCallback((staffId, position) => {
        setStaffLineup(prev => ({
            ...prev,
            [position]: staffId
        }));
        
        toast.success('Staff member added!', { duration: 2000 });
    }, []);

    const removeCorpsFromLineup = useCallback((caption) => {
        setLineup(prev => {
            const newLineup = { ...prev };
            delete newLineup[caption];
            return newLineup;
        });
        
        toast.success(`Removed corps from ${caption}`, { duration: 2000 });
    }, []);

    const removeStaffFromLineup = useCallback((position) => {
        setStaffLineup(prev => {
            const newLineup = { ...prev };
            delete newLineup[position];
            return newLineup;
        });
        
        toast.success('Staff member removed', { duration: 2000 });
    }, []);

    // Auto-fill staff recommendations
    const handleAutoFillStaff = useCallback(() => {
        if (!window.confirm('Auto-fill empty staff positions with recommended staff members?')) {
            return;
        }

        const emptyPositions = ['director', 'designer', 'instructor', 'arranger'].filter(
            pos => !staffLineup[pos]
        );

        if (emptyPositions.length === 0) {
            toast.info('All staff positions are already filled!');
            return;
        }

        const newStaffLineup = { ...staffLineup };
        
        // Simple recommendation: pick highest-rated available staff
        const availableStaff = DCI_HALL_OF_FAME_STAFF.filter(staff => 
            !Object.values(staffLineup).includes(staff.id)
        ).sort((a, b) => (b.currentValue || 50) - (a.currentValue || 50));

        emptyPositions.forEach((position, index) => {
            if (availableStaff[index]) {
                newStaffLineup[position] = availableStaff[index].id;
            }
        });

        setStaffLineup(newStaffLineup);
        toast.success(`Auto-filled ${emptyPositions.length} staff positions!`);
    }, [staffLineup]);

    // Save lineup with validation
    const handleSaveLineup = useCallback(async () => {
        if (!user) {
            toast.error('Please log in to save your lineup.');
            return;
        }

        if (totalPoints > pointCap) {
            setMessage(`Total points (${totalPoints}) exceed the ${pointCap} point cap.`);
            return;
        }

        if (!isLineupComplete) {
            setMessage('Please fill all 8 caption positions before saving.');
            return;
        }

        setIsLoading(true);
        try {
            const profileRef = doc(db, `artifacts/${dataNamespace}/users/${user.uid}/profile/data`);
            const finalCorpsName = corpsName.trim() || `${classDetails.name} Corps`;

            const updateData = {
                [`corps.${corpsClass}`]: {
                    corpsName: finalCorpsName,
                    lineup: lineup,
                    staffLineup: staffLineup,
                    totalSeasonScore: initialData?.totalSeasonScore || 0,
                    selectedShows: initialData?.selectedShows || {},
                    weeklyTrades: initialData?.weeklyTrades || { used: 0 },
                    lastScoredDay: initialData?.lastScoredDay || 0,
                    lineupKey: `${user.uid}_${corpsClass}_${Date.now()}`,
                    lastUpdated: new Date(),
                    staffBonusesActive: isStaffComplete,
                    premiumFeaturesUsed: {
                        aiRecommendations: showAIRecommendations,
                        historicalMode: historicalMode
                    }
                }
            };

            await updateDoc(profileRef, updateData);

            let experienceAwarded = 0;
            if (isNewCorps) {
                experienceAwarded = isStaffComplete ? 300 : 200;
                toast.success(`🎉 ${finalCorpsName} created successfully! +${experienceAwarded} XP`);
            } else {
                experienceAwarded = 50;
                toast.success(`✅ ${finalCorpsName} lineup updated! +${experienceAwarded} XP`);
            }

            await updateUserExperience(experienceAwarded);

            if (onSave) onSave(corpsClass, finalCorpsName);
            setMessage('');

        } catch (error) {
            console.error('Error saving lineup:', error);
            toast.error('Failed to save lineup. Please try again.');
        } finally {
            setIsLoading(false);
        }
    }, [user, totalPoints, pointCap, isLineupComplete, corpsName, classDetails, lineup, staffLineup, isStaffComplete, initialData, corpsClass, updateUserExperience, onSave, isNewCorps, showAIRecommendations, historicalMode]);

    const tabs = [
        { id: 'corps', label: 'Corps Selection', icon: 'music', count: Object.keys(lineup).length },
        { id: 'staff', label: 'Staff Selection', icon: 'users', count: Object.keys(staffLineup).length }
    ];

    return (
        <div className="space-y-6">
            {/* Header Section with Budget and Progress */}
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark slide-in-up">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
                    <div>
                        <input
                            type="text"
                            value={corpsName}
                            onChange={(e) => setCorpsName(e.target.value)}
                            placeholder={`Enter your ${classDetails.name.toLowerCase()} corps name...`}
                            className="text-2xl font-bold bg-transparent border-none outline-none text-text-primary dark:text-text-primary-dark placeholder-text-secondary dark:placeholder-text-secondary-dark w-full"
                            maxLength={50}
                        />
                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                            {classDetails.name} • Point Cap: {pointCap}
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                        {/* Budget Display */}
                        <div className="text-right">
                            <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                                {budgetRemaining} / {pointCap}
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Points Remaining
                            </div>
                        </div>

                        {/* Progress Ring */}
                        <div className="relative w-16 h-16">
                            <svg className="w-16 h-16 transform -rotate-90" viewBox="0 0 100 100">
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="none"
                                    className="text-accent dark:text-accent-dark"
                                />
                                <circle
                                    cx="50"
                                    cy="50"
                                    r="45"
                                    stroke="currentColor"
                                    strokeWidth="8"
                                    fill="none"
                                    strokeDasharray={`${(Object.keys(lineup).length / 8) * 283} 283`}
                                    className="text-primary"
                                />
                            </svg>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-sm font-bold text-text-primary dark:text-text-primary-dark">
                                    {Object.keys(lineup).length}/8
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Premium Features Indicator */}
                {userLevel >= 5 && (
                    <div className="flex flex-wrap items-center gap-3 p-3 bg-gradient-to-r from-yellow-500/10 to-yellow-600/10 rounded-theme border border-yellow-500/20 fade-in">
                        <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                            <Icon name="star" size={16} />
                            <span className="font-medium">Premium Features Active</span>
                        </div>
                        <div className="flex gap-2 text-xs">
                            {premiumFeatures.aiRecommendations && (
                                <button
                                    onClick={() => setShowAIRecommendations(!showAIRecommendations)}
                                    className={`px-3 py-1 rounded-full transition-colors ${
                                        showAIRecommendations 
                                            ? 'bg-yellow-500 text-yellow-900' 
                                            : 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/30'
                                    }`}
                                >
                                    🤖 AI Tips
                                </button>
                            )}
                            {premiumFeatures.historicalSimulation && (
                                <button
                                    onClick={() => setHistoricalMode(!historicalMode)}
                                    className={`px-3 py-1 rounded-full transition-colors ${
                                        historicalMode 
                                            ? 'bg-purple-500 text-purple-900' 
                                            : 'bg-purple-500/20 text-purple-600 dark:text-purple-400 hover:bg-purple-500/30'
                                    }`}
                                >
                                    📅 Historical
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Staff Bonus Summary */}
                {isStaffComplete && (
                    <div className="mt-4 flex items-center justify-between">
                        <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            Staff bonuses are active for all captions
                        </div>
                        {Object.keys(staffLineup).length >= 4 && (
                            <button
                                onClick={() => setShowStaffPreview(!showStaffPreview)}
                                className="text-sm text-primary hover:text-primary-hover transition-colors flex items-center gap-1"
                            >
                                <Icon name="eye" size={14} />
                                {showStaffPreview ? 'Hide' : 'Show'} Bonus Preview
                            </button>
                        )}
                    </div>
                )}

                {/* Staff Bonus Preview */}
                {showStaffPreview && isStaffComplete && (
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 fade-in">
                        {CAPTIONS.map(caption => (
                            <div key={caption} className="text-center p-2 bg-background dark:bg-background-dark rounded-theme">
                                <div className="text-xs font-semibold text-text-primary dark:text-text-primary-dark">
                                    {caption}
                                </div>
                                <div className={`text-sm font-bold ${
                                    staffBonusPreview[caption]?.percentBonus >= 0 ? 'text-green-500' : 'text-red-500'
                                }`}>
                                    {staffBonusPreview[caption]?.percentBonus >= 0 ? '+' : ''}
                                    {staffBonusPreview[caption]?.percentBonus || '0.0'}%
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2 slide-in-left">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface dark:bg-surface-dark text-text-primary dark:text-text-primary-dark border border-accent dark:border-accent-dark hover:bg-accent/10'
                        }`}
                    >
                        <Icon name={tab.icon} size={16} />
                        <span>{tab.label}</span>
                        {tab.count > 0 && (
                            <span className={`text-xs px-2 py-1 rounded-full ${
                                activeTab === tab.id
                                    ? 'bg-on-primary/20 text-on-primary'
                                    : 'bg-accent dark:bg-accent-dark text-text-secondary dark:text-text-secondary-dark'
                            }`}>
                                {tab.count}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <div className={`transition-opacity duration-300 ${activeTab === 'corps' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute'}`}>
                {activeTab === 'corps' && (
                    <CorpsLineupBuilder
                        lineup={lineup}
                        selectedCaption={selectedCaption}
                        setSelectedCaption={setSelectedCaption}
                        filteredCorpsData={filteredCorpsData}
                        searchTerm={searchTerm}
                        setSearchTerm={setSearchTerm}
                        sortBy={sortBy}
                        setSortBy={setSortBy}
                        onCorpsSelection={handleCorpsSelection}
                        onRemoveCorps={removeCorpsFromLineup}
                        budgetRemaining={budgetRemaining}
                        pointCap={pointCap}
                        recommendations={recommendations}
                        showAIRecommendations={showAIRecommendations}
                        historicalMode={historicalMode}
                    />
                )}
            </div>

            <div className={`transition-opacity duration-300 ${activeTab === 'staff' ? 'opacity-100' : 'opacity-0 pointer-events-none absolute'}`}>
                {activeTab === 'staff' && (
                    <StaffLineupBuilder
                        staffLineup={staffLineup}
                        onStaffSelection={handleStaffSelection}
                        onRemoveStaff={removeStaffFromLineup}
                        onAutoFill={handleAutoFillStaff}
                        premiumFeatures={premiumFeatures}
                    />
                )}
            </div>

            {/* Error Message */}
            {message && (
                <div className="bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 p-4 rounded-theme fade-in">
                    {message}
                </div>
            )}

            {/* Action Buttons */}
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark slide-in-up">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-text-secondary dark:text-text-secondary-dark">Total Points:</span>
                                <span className={`font-bold ${totalPoints > pointCap ? 'text-red-500' : 'text-text-primary dark:text-text-primary-dark'}`}>
                                    {totalPoints}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary dark:text-text-secondary-dark">Completed:</span>
                                <span className="font-bold text-text-primary dark:text-text-primary-dark">
                                    {Object.keys(lineup).length}/8
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary dark:text-text-secondary-dark">Staff:</span>
                                <span className="font-bold text-text-primary dark:text-text-primary-dark">
                                    {Object.keys(staffLineup).length}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-text-secondary dark:text-text-secondary-dark">Bonuses:</span>
                                <span className={`font-bold ${isStaffComplete ? 'text-green-500' : 'text-text-secondary dark:text-text-secondary-dark'}`}>
                                    {isStaffComplete ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={handleSaveLineup}
                            disabled={isLoading || !isLineupComplete || totalPoints > pointCap}
                            className="bg-primary text-on-primary px-6 py-3 rounded-theme font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center gap-2">
                                    <div className="animate-spin h-4 w-4 border-2 border-on-primary border-t-transparent rounded-full"></div>
                                    Saving...
                                </div>
                            ) : (
                                `${isNewCorps ? 'Create' : 'Update'} Corps`
                            )}
                        </button>
                    </div>
                </div>
                
                <div className="text-xs text-text-secondary dark:text-text-secondary-dark text-center mt-4">
                    Corps lineups lock each Saturday at 12:00 PM EST • Staff can be changed during the first week of each season
                </div>
            </div>
        </div>
    );
};

// Corps Lineup Builder Component
const CorpsLineupBuilder = ({
    lineup,
    selectedCaption,
    setSelectedCaption,
    filteredCorpsData,
    searchTerm,
    setSearchTerm,
    sortBy,
    setSortBy,
    onCorpsSelection,
    onRemoveCorps,
    budgetRemaining,
    pointCap,
    recommendations,
    showAIRecommendations,
    historicalMode
}) => {
    return (
        <div className="space-y-6 slide-in-right">
            {/* Search and Filters */}
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 border border-accent dark:border-accent-dark">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search corps by name or year..."
                            className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                        <option value="points">Sort by Points</option>
                        <option value="name">Sort by Name</option>
                        <option value="year">Sort by Year</option>
                    </select>
                </div>
            </div>

            {/* AI Recommendations */}
            {showAIRecommendations && recommendations[selectedCaption] && (
                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-theme p-4 border border-blue-500/20 fade-in">
                    <div className="flex items-center gap-2 mb-3">
                        <Icon name="brain" size={16} />
                        <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                            AI Recommendations for {selectedCaption}
                        </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {recommendations[selectedCaption].map((corps, index) => (
                            <button
                                key={`${corps.corpsName}-${corps.sourceYear}`}
                                onClick={() => onCorpsSelection(corps, selectedCaption)}
                                className="text-left p-3 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark hover:border-primary transition-colors"
                            >
                                <div className="font-medium text-sm">{corps.corpsName}</div>
                                <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                    {corps.sourceYear} • {corps.points || corps.totalScore} pts
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Caption Grid and Corps Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Caption Selector */}
                <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 border border-accent dark:border-accent-dark">
                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">
                        Select Caption
                    </h3>
                    <div className="grid grid-cols-2 gap-2">
                        {CAPTIONS.map(caption => (
                            <button
                                key={caption}
                                onClick={() => setSelectedCaption(caption)}
                                className={`p-3 rounded-theme font-medium transition-all relative ${
                                    selectedCaption === caption
                                        ? 'bg-primary text-on-primary'
                                        : lineup[caption]
                                            ? 'bg-green-500/20 text-green-500 border border-green-500'
                                            : 'bg-background dark:bg-background-dark border border-accent dark:border-accent-dark hover:border-primary'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{caption}</span>
                                    {lineup[caption] && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveCorps(caption);
                                            }}
                                            className="ml-1 text-xs opacity-70 hover:opacity-100"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                                {lineup[caption] && (
                                    <div className="text-xs mt-1 opacity-75 truncate">
                                        {lineup[caption].split('|')[0].substring(0, 12)}...
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Corps Selection */}
                <div className="lg:col-span-2 bg-surface dark:bg-surface-dark rounded-theme p-4 border border-accent dark:border-accent-dark">
                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">
                        Available Corps for {selectedCaption}
                        {filteredCorpsData.length > 0 && (
                            <span className="text-sm font-normal text-text-secondary dark:text-text-secondary-dark ml-2">
                                ({filteredCorpsData.length} available)
                            </span>
                        )}
                    </h3>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                        {filteredCorpsData.slice(0, 50).map(corps => {
                            const uniqueValue = `${corps.corpsName}|${corps.points || corps.totalScore}|${corps.sourceYear}`;
                            const isSelected = lineup[selectedCaption] === uniqueValue;
                            const isUsed = Object.values(lineup).includes(uniqueValue);
                            const canAfford = (corps.points || corps.totalScore) <= budgetRemaining + (isSelected ? 
                                parseInt(lineup[selectedCaption]?.split('|')[1]) || 0 : 0);

                            return (
                                <button
                                    key={`${corps.corpsName}-${corps.sourceYear}`}
                                    onClick={() => canAfford && !isUsed ? onCorpsSelection(corps, selectedCaption) : null}
                                    disabled={!canAfford || (isUsed && !isSelected)}
                                    className={`w-full text-left p-4 rounded-theme transition-all ${
                                        isSelected
                                            ? 'bg-primary text-on-primary'
                                            : isUsed
                                                ? 'bg-accent/20 text-text-secondary cursor-not-allowed'
                                                : canAfford
                                                    ? 'bg-background dark:bg-background-dark border border-accent dark:border-accent-dark hover:border-primary hover:bg-accent/10'
                                                    : 'bg-red-500/10 text-red-500 cursor-not-allowed border border-red-500/20'
                                    }`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="font-bold">{corps.corpsName}</div>
                                            <div className="text-sm opacity-75">
                                                {corps.sourceYear} • {corps.location || 'DCI'}
                                            </div>
                                            {historicalMode && corps.placement && (
                                                <div className="text-xs opacity-60 mt-1">
                                                    Placement: #{corps.placement}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold">
                                                {corps.points || corps.totalScore} pts
                                            </div>
                                            {!canAfford && !isSelected && (
                                                <div className="text-xs text-red-500">
                                                    Over budget
                                                </div>
                                            )}
                                            {isUsed && !isSelected && (
                                                <div className="text-xs">
                                                    Already used
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Staff Lineup Builder Component
const StaffLineupBuilder = ({
    staffLineup,
    onStaffSelection,
    onRemoveStaff,
    onAutoFill,
    premiumFeatures
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPosition, setSelectedPosition] = useState('director');
    const [sortBy, setSortBy] = useState('value');

    const positions = [
        { id: 'director', label: 'Director', description: 'Overall corps leadership' },
        { id: 'designer', label: 'Designer', description: 'Visual and show design' },
        { id: 'instructor', label: 'Instructor', description: 'Technical instruction' },
        { id: 'arranger', label: 'Arranger', description: 'Music arrangement' }
    ];

    const filteredStaff = useMemo(() => {
        const allStaff = Object.values(DCI_HALL_OF_FAME_STAFF).flat();
        let filtered = allStaff.filter(staff => {
            const searchMatch = !searchTerm || 
                staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                staff.specialty.toLowerCase().includes(searchTerm.toLowerCase()) ||
                staff.era.toLowerCase().includes(searchTerm.toLowerCase());
            
            const notAlreadySelected = !Object.values(staffLineup).includes(staff.id);
            
            return searchMatch && notAlreadySelected;
        });

        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'value':
                    return (b.currentValue || 50) - (a.currentValue || 50);
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'year':
                    return (b.hallOfFameYear || 0) - (a.hallOfFameYear || 0);
                default:
                    return 0;
            }
        });
    }, [searchTerm, staffLineup, sortBy]);

    return (
        <div className="space-y-6 slide-in-left">
            {/* Staff Selection Header */}
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 border border-accent dark:border-accent-dark">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                    <div>
                        <h3 className="font-bold text-text-primary dark:text-text-primary-dark">
                            Hall of Fame Staff Selection
                        </h3>
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                            Select legendary drum corps staff to boost your corps performance
                        </p>
                    </div>
                    
                    <button
                        onClick={onAutoFill}
                        className="bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark px-4 py-2 rounded-theme hover:bg-accent-hover dark:hover:bg-accent-hover transition-colors flex items-center gap-2"
                    >
                        <Icon name="zap" size={16} />
                        Auto-Fill
                    </button>
                </div>

                {/* Search and Sort */}
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search staff by name, specialty, or era..."
                            className="w-full bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                        />
                    </div>
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                    >
                        <option value="value">Sort by Value</option>
                        <option value="name">Sort by Name</option>
                        <option value="year">Sort by HOF Year</option>
                    </select>
                </div>
            </div>

            {/* Staff Positions and Selection */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Position Selector */}
                <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 border border-accent dark:border-accent-dark">
                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">
                        Staff Positions
                    </h3>
                    <div className="space-y-2">
                        {positions.map(position => (
                            <button
                                key={position.id}
                                onClick={() => setSelectedPosition(position.id)}
                                className={`w-full text-left p-3 rounded-theme transition-all ${
                                    selectedPosition === position.id
                                        ? 'bg-primary text-on-primary'
                                        : staffLineup[position.id]
                                            ? 'bg-green-500/20 text-green-500 border border-green-500'
                                            : 'bg-background dark:bg-background-dark border border-accent dark:border-accent-dark hover:border-primary'
                                }`}
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <div className="font-medium">{position.label}</div>
                                        <div className="text-xs opacity-75">{position.description}</div>
                                    </div>
                                    {staffLineup[position.id] && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onRemoveStaff(position.id);
                                            }}
                                            className="text-xs opacity-70 hover:opacity-100"
                                        >
                                            ×
                                        </button>
                                    )}
                                </div>
                                {staffLineup[position.id] && (
                                    <div className="text-xs mt-1 opacity-75">
                                        {filteredStaff.find(s => s.id === staffLineup[position.id])?.name}
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Staff Selection */}
                <div className="lg:col-span-2 bg-surface dark:bg-surface-dark rounded-theme p-4 border border-accent dark:border-accent-dark">
                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">
                        Available Staff for {positions.find(p => p.id === selectedPosition)?.label}
                        {filteredStaff.length > 0 && (
                            <span className="text-sm font-normal text-text-secondary dark:text-text-secondary-dark ml-2">
                                ({filteredStaff.length} available)
                            </span>
                        )}
                    </h3>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                        {filteredStaff.slice(0, 30).map(staff => {
                            const isSelected = staffLineup[selectedPosition] === staff.id;
                            const isUsed = Object.values(staffLineup).includes(staff.id);
                            const bonusPercent = (calculateStaffMultiplier(staff) - 1) * 100;

                            return (
                                <button
                                    key={staff.id}
                                    onClick={() => !isUsed ? onStaffSelection(staff.id, selectedPosition) : null}
                                    disabled={isUsed && !isSelected}
                                    className={`w-full text-left p-4 rounded-theme transition-all ${
                                        isSelected
                                            ? 'bg-primary text-on-primary'
                                            : isUsed
                                                ? 'bg-accent/20 text-text-secondary cursor-not-allowed'
                                                : 'bg-background dark:bg-background-dark border border-accent dark:border-accent-dark hover:border-primary hover:bg-accent/10'
                                    }`}
                                >
                                    <div className="space-y-2">
                                        <div>
                                            <div className="font-bold">{staff.name}</div>
                                            <div className="text-sm opacity-75">{staff.specialty}</div>
                                            <div className="text-xs opacity-60">
                                                HOF {staff.hallOfFameYear} • {staff.era}
                                            </div>
                                        </div>
                                        
                                        <div className="flex justify-between items-center">
                                            <div className="text-sm">
                                                Value: {staff.currentValue || 50}/100
                                            </div>
                                            <div className={`text-sm font-bold ${
                                                bonusPercent >= 0 ? 'text-green-500' : 'text-red-500'
                                            }`}>
                                                {bonusPercent >= 0 ? '+' : ''}{bonusPercent.toFixed(1)}%
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default LineupBuilder;