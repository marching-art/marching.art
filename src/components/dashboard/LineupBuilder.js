import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { doc, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { db, dataNamespace } from '../../firebase';
import { useUserStore } from '../../store/userStore';
import { CORPS_CLASSES } from '../../utils/profileCompatibility';
import { DCI_HALL_OF_FAME_STAFF, calculateStaffMultiplier } from '../../data/dciHallOfFameStaff';
import { motion, AnimatePresence } from 'framer-motion';
import Icon from '../ui/Icon';
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
    const [activeTab, setActiveTab] = useState('corps'); // 'corps' or 'staff'
    const [selectedCaption, setSelectedCaption] = useState('GE1');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('points');
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [showStaffPreview, setShowStaffPreview] = useState(false);

    const classDetails = CORPS_CLASSES[corpsClass];
    const pointCap = classDetails?.pointCap || 150;
    const isNewCorps = initialData === null;

    // Performance optimization - memoized calculations
    const totalPoints = useMemo(() => {
        return Object.values(lineup).reduce((sum, selection) => {
            if (selection) {
                const [, points] = selection.split('|');
                return sum + parseInt(points || 0);
            }
            return sum;
        }, 0);
    }, [lineup]);

    const filteredCorpsData = useMemo(() => {
        let filtered = corpsData.filter(corps => corps.points <= pointCap);
        
        if (searchTerm) {
            filtered = filtered.filter(corps => 
                corps.corpsName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                corps.sourceYear.toString().includes(searchTerm)
            );
        }

        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'points':
                    return b.points - a.points;
                case 'name':
                    return a.corpsName.localeCompare(b.corpsName);
                case 'year':
                    return b.sourceYear - a.sourceYear;
                default:
                    return 0;
            }
        });
    }, [corpsData, pointCap, searchTerm, sortBy]);

    const staffForCaption = useMemo(() => {
        return DCI_HALL_OF_FAME_STAFF[selectedCaption] || [];
    }, [selectedCaption]);

    const isLineupComplete = Object.keys(lineup).length === 8 && Object.values(lineup).every(Boolean);
    const isStaffComplete = Object.keys(staffLineup).length === 8 && Object.values(staffLineup).every(Boolean);
    const budgetRemaining = pointCap - totalPoints;

    // Staff bonus calculations
    const staffBonusPreview = useMemo(() => {
        const bonuses = {};
        Object.entries(staffLineup).forEach(([caption, staffId]) => {
            if (staffId) {
                const staff = DCI_HALL_OF_FAME_STAFF[caption]?.find(s => s.id === staffId);
                if (staff) {
                    const multiplier = calculateStaffMultiplier(staff);
                    bonuses[caption] = {
                        multiplier,
                        percentBonus: ((multiplier - 1) * 100).toFixed(1)
                    };
                }
            }
        });
        return bonuses;
    }, [staffLineup]);

    // Initialize from existing data
    useEffect(() => {
        if (initialData) {
            setLineup(initialData.lineup || {});
            setStaffLineup(initialData.staffLineup || {});
            setCorpsName(initialData.corpsName || '');
        }
    }, [initialData]);

    const handleCorpsSelection = useCallback((caption, selection) => {
        const [corpsName, points] = selection.split('|');
        const newPoints = parseInt(points);

        // Check budget constraint
        const currentTotal = Object.entries(lineup).reduce((sum, [cap, sel]) => {
            if (cap !== caption && sel) {
                const [, pts] = sel.split('|');
                return sum + parseInt(pts || 0);
            }
            return sum;
        }, 0);

        if (currentTotal + newPoints > pointCap) {
            toast.error(`This selection would exceed your ${pointCap} point budget!`);
            return;
        }

        setLineup(prev => ({
            ...prev,
            [caption]: selection
        }));

        setMessage('');
    }, [lineup, pointCap]);

    const handleStaffSelection = useCallback((caption, staffId) => {
        setStaffLineup(prev => ({
            ...prev,
            [caption]: staffId
        }));

        // Show preview of staff bonus
        const staff = DCI_HALL_OF_FAME_STAFF[caption]?.find(s => s.id === staffId);
        if (staff) {
            const multiplier = calculateStaffMultiplier(staff);
            const bonusPercent = ((multiplier - 1) * 100).toFixed(1);
            toast.success(`${staff.name} assigned! ${bonusPercent >= 0 ? '+' : ''}${bonusPercent}% bonus`);
        }

        setMessage('');
    }, []);

    const handleSave = async () => {
        if (!user || !loggedInProfile) return;

        if (isNewCorps && (!corpsName.trim() || corpsName.trim().length < 3)) {
            setMessage('Corps name must be at least 3 characters long.');
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
                    staffLineup: staffLineup, // Include staff lineup
                    totalSeasonScore: initialData?.totalSeasonScore || 0,
                    selectedShows: initialData?.selectedShows || {},
                    weeklyTrades: initialData?.weeklyTrades || { used: 0 },
                    lastScoredDay: initialData?.lastScoredDay || 0,
                    lineupKey: `${user.uid}_${corpsClass}_${Date.now()}`,
                    lastUpdated: new Date(),
                    staffBonusesActive: isStaffComplete
                }
            };

            await updateDoc(profileRef, updateData);

            // Award experience for lineup completion
            let experienceAwarded = 0;
            if (isNewCorps) {
                experienceAwarded = isStaffComplete ? 300 : 200; // Bonus for complete staff
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
    };

    const handleAutoFillStaff = () => {
        if (!window.confirm('Auto-fill empty staff positions with recommended staff members?')) {
            return;
        }

        const newStaffLineup = { ...staffLineup };
        
        CAPTIONS.forEach(caption => {
            if (!newStaffLineup[caption]) {
                const availableStaff = DCI_HALL_OF_FAME_STAFF[caption];
                if (availableStaff && availableStaff.length > 0) {
                    // Select highest value staff member not already used
                    const usedStaff = Object.values(newStaffLineup);
                    const unused = availableStaff.filter(staff => !usedStaff.includes(staff.id));
                    if (unused.length > 0) {
                        const bestStaff = unused.sort((a, b) => b.currentValue - a.currentValue)[0];
                        newStaffLineup[caption] = bestStaff.id;
                    }
                }
            }
        });

        setStaffLineup(newStaffLineup);
        toast.success('Staff positions auto-filled!');
    };

    const tabs = [
        { id: 'corps', label: 'Corps Lineup', icon: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z' },
        { id: 'staff', label: 'Staff Lineup', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z' }
    ];

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header */}
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark flex items-center gap-2">
                            <span className={`w-4 h-4 rounded-full ${classDetails.color}`}></span>
                            {classDetails.name} Builder
                        </h2>
                        {isNewCorps ? (
                            <input
                                type="text"
                                value={corpsName}
                                onChange={(e) => setCorpsName(e.target.value)}
                                placeholder={`Enter your ${classDetails.name} corps name`}
                                className="mt-2 w-full lg:w-auto bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-text-primary dark:text-text-primary-dark focus:ring-2 focus:ring-primary focus:border-primary"
                                maxLength={50}
                            />
                        ) : (
                            <p className="text-lg font-semibold text-secondary dark:text-secondary-dark mt-1">
                                {corpsName}
                            </p>
                        )}
                    </div>
                    
                    {/* Budget & Staff Display */}
                    <div className="flex flex-col lg:flex-row gap-4">
                        <div className={`text-center p-3 rounded-theme ${
                            totalPoints > pointCap ? 'bg-red-500/20 border border-red-500' : 'bg-primary/20 border border-primary'
                        }`}>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Budget</div>
                            <div className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                {totalPoints} / {pointCap}
                            </div>
                        </div>
                        
                        <div className={`text-center p-3 rounded-theme ${
                            isStaffComplete ? 'bg-green-500/20 border border-green-500' : 'bg-yellow-500/20 border border-yellow-500'
                        }`}>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Staff</div>
                            <div className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                {Object.keys(staffLineup).length}/8
                            </div>
                        </div>

                        {isStaffComplete && (
                            <button
                                onClick={() => setShowStaffPreview(!showStaffPreview)}
                                className="text-center p-3 rounded-theme bg-blue-500/20 border border-blue-500 hover:bg-blue-500/30 transition-colors"
                            >
                                <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Bonuses</div>
                                <div className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                                    {showStaffPreview ? 'Hide' : 'Show'}
                                </div>
                            </button>
                        )}
                    </div>
                </div>

                {/* Staff Bonus Preview */}
                <AnimatePresence>
                    {showStaffPreview && isStaffComplete && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2"
                        >
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
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-theme font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-primary text-on-primary'
                                : 'bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark hover:border-primary'
                        }`}
                    >
                        <Icon path={tab.icon} className="w-4 h-4" />
                        {tab.label}
                        {tab.id === 'corps' && !isLineupComplete && (
                            <span className="bg-yellow-500 text-white text-xs rounded-full px-2 py-1">
                                {8 - Object.keys(lineup).length}
                            </span>
                        )}
                        {tab.id === 'staff' && !isStaffComplete && (
                            <span className="bg-yellow-500 text-white text-xs rounded-full px-2 py-1">
                                {8 - Object.keys(staffLineup).length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.2 }}
                >
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
                            budgetRemaining={budgetRemaining}
                            pointCap={pointCap}
                        />
                    )}

                    {activeTab === 'staff' && (
                        <StaffLineupBuilder
                            staffLineup={staffLineup}
                            selectedCaption={selectedCaption}
                            setSelectedCaption={setSelectedCaption}
                            staffForCaption={staffForCaption}
                            onStaffSelection={handleStaffSelection}
                            onAutoFill={handleAutoFillStaff}
                            staffBonusPreview={staffBonusPreview}
                        />
                    )}
                </motion.div>
            </AnimatePresence>

            {/* Save Controls */}
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark">
                <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                    <div className="flex-1">
                        {message && (
                            <div className={`text-sm font-semibold p-3 rounded ${
                                message.toLowerCase().includes('success') 
                                    ? 'text-green-600 bg-green-100 dark:bg-green-900/20' 
                                    : 'text-red-600 bg-red-100 dark:bg-red-900/20'
                            }`}>
                                {message}
                            </div>
                        )}
                    </div>
                    
                    <div className="flex gap-4">
                        <button
                            onClick={() => {
                                setLineup({});
                                setStaffLineup({});
                                toast.success('Lineups cleared');
                            }}
                            className="bg-red-500 text-white px-4 py-2 rounded-theme font-semibold hover:bg-red-600 transition-colors"
                        >
                            Clear All
                        </button>
                        
                        <button
                            onClick={handleSave}
                            disabled={
                                isLoading || 
                                totalPoints > pointCap || 
                                !isLineupComplete || 
                                (isNewCorps && !corpsName.trim())
                            }
                            className="bg-primary text-on-primary font-bold px-6 py-2 rounded-theme disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
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
    budgetRemaining,
    pointCap
}) => {
    return (
        <div className="space-y-6">
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
                                className={`p-3 rounded-theme font-medium transition-all ${
                                    selectedCaption === caption
                                        ? 'bg-primary text-on-primary'
                                        : lineup[caption]
                                            ? 'bg-green-500/20 text-green-500 border border-green-500'
                                            : 'bg-background dark:bg-background-dark border border-accent dark:border-accent-dark hover:border-primary'
                                }`}
                            >
                                {caption}
                                {lineup[caption] && (
                                    <div className="text-xs mt-1 opacity-75">
                                        {lineup[caption].split('|')[0].substring(0, 8)}...
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
                    </h3>
                    <div className="max-h-96 overflow-y-auto space-y-2">
                        {filteredCorpsData.slice(0, 50).map(corps => {
                            const uniqueValue = `${corps.corpsName}|${corps.points}|${corps.sourceYear}`;
                            const isSelected = lineup[selectedCaption] === uniqueValue;
                            const isUsed = Object.values(lineup).includes(uniqueValue);
                            const canAfford = corps.points <= budgetRemaining + (isSelected ? corps.points : 0);

                            return (
                                <button
                                    key={uniqueValue}
                                    onClick={() => onCorpsSelection(selectedCaption, uniqueValue)}
                                    disabled={isUsed && !isSelected || !canAfford}
                                    className={`w-full p-3 rounded-theme text-left transition-all ${
                                        isSelected
                                            ? 'bg-primary text-on-primary'
                                            : isUsed
                                                ? 'bg-accent/20 text-text-secondary cursor-not-allowed'
                                                : !canAfford
                                                    ? 'bg-red-500/10 text-red-500 cursor-not-allowed'
                                                    : 'bg-background dark:bg-background-dark border border-accent dark:border-accent-dark hover:border-primary hover:bg-accent/10'
                                    }`}
                                >
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <div className="font-semibold">
                                                {corps.corpsName} ({corps.sourceYear})
                                            </div>
                                            {corps.avgScore && (
                                                <div className="text-sm opacity-75">
                                                    Avg Score: {corps.avgScore.toFixed(2)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold">
                                                {corps.points} pts
                                            </div>
                                            {!canAfford && !isSelected && (
                                                <div className="text-xs text-red-500">
                                                    Over budget
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
    selectedCaption,
    setSelectedCaption,
    staffForCaption,
    onStaffSelection,
    onAutoFill,
    staffBonusPreview
}) => {
    return (
        <div className="space-y-6">
            {/* Staff Controls */}
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 border border-accent dark:border-accent-dark">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark">
                        Staff Management
                    </h3>
                    <button
                        onClick={onAutoFill}
                        className="bg-green-500 text-white px-4 py-2 rounded-theme font-semibold hover:bg-green-600 transition-colors"
                    >
                        Auto-Fill Staff
                    </button>
                </div>
                
                {/* Caption Selector */}
                <div className="grid grid-cols-4 gap-2 mb-4">
                    {CAPTIONS.map(caption => (
                        <button
                            key={caption}
                            onClick={() => setSelectedCaption(caption)}
                            className={`p-2 rounded-theme font-medium transition-all ${
                                selectedCaption === caption
                                    ? 'bg-primary text-on-primary'
                                    : staffLineup[caption]
                                        ? 'bg-green-500/20 text-green-500 border border-green-500'
                                        : 'bg-background dark:bg-background-dark border border-accent dark:border-accent-dark hover:border-primary'
                            }`}
                        >
                            {caption}
                            {staffBonusPreview[caption] && (
                                <div className="text-xs mt-1">
                                    {staffBonusPreview[caption].percentBonus >= 0 ? '+' : ''}
                                    {staffBonusPreview[caption].percentBonus}%
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Staff Selection */}
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 border border-accent dark:border-accent-dark">
                <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">
                    DCI Hall of Fame Staff - {selectedCaption}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {staffForCaption.map(staff => {
                        const isSelected = staffLineup[selectedCaption] === staff.id;
                        const isUsed = Object.values(staffLineup).includes(staff.id);
                        const multiplier = calculateStaffMultiplier(staff);
                        const bonusPercent = ((multiplier - 1) * 100).toFixed(1);

                        return (
                            <button
                                key={staff.id}
                                onClick={() => onStaffSelection(selectedCaption, staff.id)}
                                disabled={isUsed && !isSelected}
                                className={`p-4 rounded-theme text-left transition-all ${
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
                                            Value: {staff.currentValue}/100
                                        </div>
                                        <div className={`text-sm font-bold ${
                                            bonusPercent >= 0 ? 'text-green-500' : 'text-red-500'
                                        }`}>
                                            {bonusPercent >= 0 ? '+' : ''}{bonusPercent}%
                                        </div>
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default LineupBuilder;