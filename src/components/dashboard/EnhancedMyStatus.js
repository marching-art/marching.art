// components/dashboard/EnhancedMyStatus.js
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useUserStore } from '../../store/userStore';
import { DCI_HALL_OF_FAME_STAFF, calculateStaffMultiplier } from '../../data/dciHallOfFameStaff';
import { CORPS_CLASSES } from '../../utils/profileCompatibility';
import Icon from '../ui/Icon';

const EnhancedMyStatus = ({ profile, seasonSettings }) => {
    const { loggedInProfile } = useUserStore();
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');
    const [showStaffDetails, setShowStaffDetails] = useState(false);

    const userCorps = loggedInProfile?.corps || {};
    const hasAnyCorps = Object.keys(userCorps).length > 0;

    // Calculate staff bonuses for selected corps
    const getStaffBonuses = (corpsClass) => {
        const corps = userCorps[corpsClass];
        if (!corps?.staffLineup) return null;

        const bonuses = {};
        let totalBonus = 0;
        let staffCount = 0;

        Object.entries(corps.staffLineup).forEach(([caption, staffId]) => {
            if (staffId) {
                const staff = DCI_HALL_OF_FAME_STAFF[caption]?.find(s => s.id === staffId);
                if (staff) {
                    const multiplier = calculateStaffMultiplier(staff);
                    const bonusPercent = (multiplier - 1) * 100;
                    bonuses[caption] = {
                        staffName: staff.name,
                        multiplier,
                        bonusPercent: bonusPercent.toFixed(1)
                    };
                    totalBonus += bonusPercent;
                    staffCount++;
                }
            }
        });

        return {
            bonuses,
            averageBonus: staffCount > 0 ? (totalBonus / staffCount).toFixed(1) : '0.0',
            staffCount
        };
    };

    const staffData = getStaffBonuses(selectedCorpsClass);

    if (!hasAnyCorps) {
        return (
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
                <div className="text-center py-8">
                    <div className="text-6xl mb-4">🎺</div>
                    <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                        Ready to Start Your Journey?
                    </h3>
                    <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                        Create your first fantasy drum corps and begin competing!
                    </p>
                    <button className="bg-primary text-on-primary px-6 py-3 rounded-theme font-semibold hover:bg-primary/90 transition-colors">
                        Create Your First Corps
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
            <div className="flex justify-between items-start mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                        My Corps Status
                    </h2>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        {seasonSettings?.name || 'Current Season'} Performance
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <select
                        value={selectedCorpsClass}
                        onChange={(e) => setSelectedCorpsClass(e.target.value)}
                        className="bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded-theme p-2 text-sm"
                    >
                        {Object.entries(userCorps).map(([corpsClass, corps]) => (
                            <option key={corpsClass} value={corpsClass}>
                                {CORPS_CLASSES[corpsClass]?.name || corpsClass}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {userCorps[selectedCorpsClass] && (
                <div className="space-y-6">
                    {/* Corps Overview */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                            <div className="flex items-center gap-3 mb-2">
                                <span className={`w-3 h-3 rounded-full ${CORPS_CLASSES[selectedCorpsClass]?.color}`}></span>
                                <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                                    {userCorps[selectedCorpsClass].corpsName}
                                </h4>
                            </div>
                            <div className="text-2xl font-bold text-primary dark:text-primary-dark">
                                {userCorps[selectedCorpsClass].totalSeasonScore?.toFixed(2) || '0.00'}
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Season Score
                            </div>
                        </div>

                        <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                            <div className="flex items-center gap-2 mb-2">
                                <Icon path="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z" className="w-4 h-4 text-text-primary dark:text-text-primary-dark" />
                                <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                                    Staff Status
                                </h4>
                            </div>
                            <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                                {staffData?.staffCount || 0}/8
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Staff Hired
                            </div>
                        </div>

                        <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                            <div className="flex items-center gap-2 mb-2">
                                <Icon path="M13 10V3L4 14h7v7l9-11h-7z" className="w-4 h-4 text-text-primary dark:text-text-primary-dark" />
                                <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                                    Staff Bonus
                                </h4>
                            </div>
                            <div className={`text-2xl font-bold ${
                                parseFloat(staffData?.averageBonus || '0') >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                                {staffData?.averageBonus >= 0 ? '+' : ''}{staffData?.averageBonus || '0.0'}%
                            </div>
                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                Avg Multiplier
                            </div>
                        </div>
                    </div>

                    {/* Staff Details Toggle */}
                    {staffData && staffData.staffCount > 0 && (
                        <div>
                            <button
                                onClick={() => setShowStaffDetails(!showStaffDetails)}
                                className="flex items-center gap-2 text-primary dark:text-primary-dark hover:text-primary/80 transition-colors"
                            >
                                <Icon path={showStaffDetails ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} className="w-4 h-4" />
                                {showStaffDetails ? 'Hide' : 'Show'} Staff Details
                            </button>

                            {showStaffDetails && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3"
                                >
                                    {Object.entries(staffData.bonuses).map(([caption, bonus]) => (
                                        <div key={caption} className="bg-background dark:bg-background-dark p-3 rounded-theme">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="font-semibold text-text-primary dark:text-text-primary-dark">
                                                    {caption}
                                                </div>
                                                <div className={`text-sm font-bold ${
                                                    parseFloat(bonus.bonusPercent) >= 0 ? 'text-green-500' : 'text-red-500'
                                                }`}>
                                                    {bonus.bonusPercent >= 0 ? '+' : ''}{bonus.bonusPercent}%
                                                </div>
                                            </div>
                                            <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                                {bonus.staffName}
                                            </div>
                                        </div>
                                    ))}
                                </motion.div>
                            )}
                        </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex flex-wrap gap-3">
                        <button className="bg-primary text-on-primary px-4 py-2 rounded-theme font-semibold hover:bg-primary/90 transition-colors">
                            Update Lineup
                        </button>
                        <button className="bg-secondary text-on-secondary px-4 py-2 rounded-theme font-semibold hover:bg-secondary/90 transition-colors">
                            Manage Staff
                        </button>
                        <button className="border border-accent dark:border-accent-dark text-text-primary dark:text-text-primary-dark px-4 py-2 rounded-theme font-semibold hover:bg-accent/10 transition-colors">
                            View Performance
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

// components/dashboard/StaffInsights.js
const StaffInsights = ({ userCorps }) => {
    const [selectedCorpsClass, setSelectedCorpsClass] = useState('worldClass');

    const getStaffAnalytics = () => {
        const analytics = {
            totalStaffHired: 0,
            averageStaffValue: 0,
            bestStaffMember: null,
            weakestCaption: null,
            strongestCaption: null,
            totalMultiplierBonus: 0,
            staffByEra: {},
            recentAcquisitions: []
        };

        Object.entries(userCorps).forEach(([corpsClass, corps]) => {
            const staffLineup = corps.staffLineup || {};
            
            Object.entries(staffLineup).forEach(([caption, staffId]) => {
                if (staffId) {
                    const staff = DCI_HALL_OF_FAME_STAFF[caption]?.find(s => s.id === staffId);
                    if (staff) {
                        analytics.totalStaffHired++;
                        analytics.averageStaffValue += staff.currentValue;
                        
                        // Track by era
                        if (!analytics.staffByEra[staff.era]) {
                            analytics.staffByEra[staff.era] = 0;
                        }
                        analytics.staffByEra[staff.era]++;

                        // Calculate multiplier
                        const multiplier = calculateStaffMultiplier(staff);
                        analytics.totalMultiplierBonus += (multiplier - 1) * 100;

                        // Track best staff
                        if (!analytics.bestStaffMember || staff.currentValue > analytics.bestStaffMember.currentValue) {
                            analytics.bestStaffMember = { ...staff, caption };
                        }
                    }
                }
            });
        });

        if (analytics.totalStaffHired > 0) {
            analytics.averageStaffValue = analytics.averageStaffValue / analytics.totalStaffHired;
            analytics.averageMultiplierBonus = analytics.totalMultiplierBonus / analytics.totalStaffHired;
        }

        return analytics;
    };

    const analytics = getStaffAnalytics();

    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
            <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                Staff Insights
            </h3>

            {analytics.totalStaffHired === 0 ? (
                <div className="text-center py-6">
                    <div className="text-4xl mb-3">👨‍🏫</div>
                    <p className="text-text-secondary dark:text-text-secondary-dark">
                        No staff hired yet. Add DCI Hall of Fame staff members to boost your performance!
                    </p>
                    <button className="mt-3 bg-primary text-on-primary px-4 py-2 rounded-theme font-semibold hover:bg-primary/90 transition-colors">
                        Browse Staff
                    </button>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div className="text-center p-3 bg-background dark:bg-background-dark rounded-theme">
                            <div className="text-xl font-bold text-primary dark:text-primary-dark">
                                {analytics.totalStaffHired}
                            </div>
                            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                Staff Hired
                            </div>
                        </div>

                        <div className="text-center p-3 bg-background dark:bg-background-dark rounded-theme">
                            <div className="text-xl font-bold text-primary dark:text-primary-dark">
                                {analytics.averageStaffValue.toFixed(0)}
                            </div>
                            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                Avg Value
                            </div>
                        </div>

                        <div className="text-center p-3 bg-background dark:bg-background-dark rounded-theme">
                            <div className={`text-xl font-bold ${
                                analytics.averageMultiplierBonus >= 0 ? 'text-green-500' : 'text-red-500'
                            }`}>
                                {analytics.averageMultiplierBonus >= 0 ? '+' : ''}{analytics.averageMultiplierBonus?.toFixed(1)}%
                            </div>
                            <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                Avg Bonus
                            </div>
                        </div>
                    </div>

                    {/* Best Staff Member */}
                    {analytics.bestStaffMember && (
                        <div className="bg-background dark:bg-background-dark p-4 rounded-theme">
                            <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                Top Staff Member
                            </h4>
                            <div className="flex justify-between items-center">
                                <div>
                                    <div className="font-medium text-text-primary dark:text-text-primary-dark">
                                        {analytics.bestStaffMember.name}
                                    </div>
                                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                        {analytics.bestStaffMember.caption} • {analytics.bestStaffMember.specialty}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-primary dark:text-primary-dark">
                                        {analytics.bestStaffMember.currentValue}/100
                                    </div>
                                    <div className="text-xs text-text-secondary dark:text-text-secondary-dark">
                                        Value
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Era Distribution */}
                    {Object.keys(analytics.staffByEra).length > 0 && (
                        <div>
                            <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                                Staff by Era
                            </h4>
                            <div className="space-y-2">
                                {Object.entries(analytics.staffByEra).map(([era, count]) => (
                                    <div key={era} className="flex justify-between text-sm">
                                        <span className="text-text-secondary dark:text-text-secondary-dark">{era}</span>
                                        <span className="text-text-primary dark:text-text-primary-dark font-medium">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// components/dashboard/ClassProgressionWidget.js
const ClassProgressionWidget = () => {
    const { loggedInProfile } = useUserStore();
    const [showDetails, setShowDetails] = useState(false);

    const userLevel = loggedInProfile?.level || 1;
    const userXP = loggedInProfile?.experience || 0;
    const unlockedClasses = loggedInProfile?.unlockedClasses || {};

    const CORPS_CLASS_PROGRESSION = {
        aClass: {
            name: 'A Class',
            unlockLevel: 1,
            unlockXP: 0,
            color: 'bg-green-500',
            description: 'Perfect for learning the game'
        },
        openClass: {
            name: 'Open Class', 
            unlockLevel: 5,
            unlockXP: 1000,
            color: 'bg-blue-500',
            description: 'Competitive intermediate level'
        },
        worldClass: {
            name: 'World Class',
            unlockLevel: 10,
            unlockXP: 2500,
            color: 'bg-yellow-500',
            description: 'Elite competition - ultimate challenge'
        }
    };

    const getProgressToNextClass = () => {
        const availableClasses = Object.entries(CORPS_CLASS_PROGRESSION)
            .filter(([key, classData]) => !unlockedClasses[key])
            .sort((a, b) => a[1].unlockLevel - b[1].unlockLevel);

        if (availableClasses.length === 0) return null;

        const [nextClassKey, nextClass] = availableClasses[0];
        const levelProgress = Math.min(100, (userLevel / nextClass.unlockLevel) * 100);
        const xpProgress = Math.min(100, (userXP / nextClass.unlockXP) * 100);

        return {
            key: nextClassKey,
            class: nextClass,
            levelProgress,
            xpProgress,
            overallProgress: Math.min(levelProgress, xpProgress)
        };
    };

    const nextClassProgress = getProgressToNextClass();

    return (
        <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
                    Class Progression
                </h3>
                <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-primary dark:text-primary-dark hover:text-primary/80 transition-colors"
                >
                    <Icon path={showDetails ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} className="w-4 h-4" />
                </button>
            </div>

            {/* Current Level */}
            <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                    <span className="text-text-secondary dark:text-text-secondary-dark">Current Level</span>
                    <span className="font-bold text-text-primary dark:text-text-primary-dark">
                        Level {userLevel}
                    </span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-text-secondary dark:text-text-secondary-dark">Experience</span>
                    <span className="font-bold text-text-primary dark:text-text-primary-dark">
                        {userXP.toLocaleString()} XP
                    </span>
                </div>
            </div>

            {/* Unlocked Classes */}
            <div className="space-y-2 mb-4">
                {Object.entries(CORPS_CLASS_PROGRESSION).map(([key, classData]) => {
                    const isUnlocked = unlockedClasses[key] || key === 'aClass';
                    const canUnlock = userLevel >= classData.unlockLevel && userXP >= classData.unlockXP;

                    return (
                        <div key={key} className={`flex items-center justify-between p-3 rounded-theme ${
                            isUnlocked 
                                ? 'bg-green-500/20 border border-green-500'
                                : canUnlock
                                    ? 'bg-yellow-500/20 border border-yellow-500'
                                    : 'bg-background dark:bg-background-dark border border-accent dark:border-accent-dark'
                        }`}>
                            <div className="flex items-center gap-3">
                                <span className={`w-3 h-3 rounded-full ${classData.color}`}></span>
                                <span className="font-medium text-text-primary dark:text-text-primary-dark">
                                    {classData.name}
                                </span>
                            </div>
                            <div className="text-right">
                                {isUnlocked ? (
                                    <span className="text-green-500 font-semibold">Unlocked</span>
                                ) : canUnlock ? (
                                    <span className="text-yellow-500 font-semibold">Ready!</span>
                                ) : (
                                    <span className="text-text-secondary dark:text-text-secondary-dark text-sm">
                                        Lvl {classData.unlockLevel}
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Next Class Progress */}
            {nextClassProgress && (
                <div>
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                        Next: {nextClassProgress.class.name}
                    </h4>
                    <div className="space-y-2">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-text-secondary dark:text-text-secondary-dark">Level Progress</span>
                                <span className="text-text-primary dark:text-text-primary-dark">
                                    {userLevel}/{nextClassProgress.class.unlockLevel}
                                </span>
                            </div>
                            <div className="w-full bg-accent dark:bg-accent-dark rounded-full h-2">
                                <div 
                                    className="bg-primary h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${nextClassProgress.levelProgress}%` }}
                                ></div>
                            </div>
                        </div>
                        
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-text-secondary dark:text-text-secondary-dark">XP Progress</span>
                                <span className="text-text-primary dark:text-text-primary-dark">
                                    {userXP.toLocaleString()}/{nextClassProgress.class.unlockXP.toLocaleString()}
                                </span>
                            </div>
                            <div className="w-full bg-accent dark:bg-accent-dark rounded-full h-2">
                                <div 
                                    className="bg-secondary h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${nextClassProgress.xpProgress}%` }}
                                ></div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showDetails && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 p-4 bg-background dark:bg-background-dark rounded-theme"
                >
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                        How to Unlock Classes
                    </h4>
                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark space-y-1">
                        <p>• Complete daily challenges for XP</p>
                        <p>• Update lineups and manage staff</p>
                        <p>• Participate in leagues and competitions</p>
                        <p>• Trade with other directors</p>
                        <p>• Achieve high scores and rankings</p>
                    </div>
                </motion.div>
            )}
        </div>
    );
};

export { EnhancedMyStatus, StaffInsights, ClassProgressionWidget };