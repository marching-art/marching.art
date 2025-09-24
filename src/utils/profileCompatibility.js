// src/utils/profileCompatibility.js
// Helper functions to handle both old and new profile structures including SoundSport
// UPDATED: Added registration cutoff logic

export const CORPS_CLASSES = {
    // SoundSport integrated from soundSportSystem
    soundSport: { name: 'SoundSport', pointCap: 90, color: 'bg-orange-500', registrationCutoff: 0 },
    aClass: { name: 'A Class', pointCap: 60, color: 'bg-green-500', registrationCutoff: 4 },
    openClass: { name: 'Open Class', pointCap: 120, color: 'bg-blue-500', registrationCutoff: 5 },
    worldClass: { name: 'World Class', pointCap: 150, color: 'bg-yellow-500', registrationCutoff: 6 }
};

// Updated order to include SoundSport first (always available)
export const CORPS_CLASS_ORDER = ['soundSport', 'aClass', 'openClass', 'worldClass'];

export const getCorpsData = (profile, corpsClass = 'worldClass') => {
    // New multi-corps structure
    if (profile?.corps?.[corpsClass]) {
        return profile.corps[corpsClass];
    }
    
    // Backward compatibility with old single-corps structure
    if (corpsClass === 'worldClass' && profile?.corpsName) {
        return {
            corpsName: profile.corpsName,
            lineup: profile.lineup || {},
            totalSeasonScore: profile.totalSeasonScore || 0,
            selectedShows: profile.selectedShows || {},
            weeklyTrades: profile.weeklyTrades || { used: 0 },
            lastScoredDay: profile.lastScoredDay || 0,
            lineupKey: profile.lineupKey
        };
    }
    
    // No corps data found
    return null;
};

export const getAllUserCorps = (profile) => {
    const corps = {};
    
    // New structure
    if (profile?.corps) {
        Object.keys(profile.corps).forEach(corpsClass => {
            if (profile.corps[corpsClass]?.corpsName) {
                corps[corpsClass] = profile.corps[corpsClass];
            }
        });
    }
    
    // Backward compatibility - convert old structure to worldClass
    if (Object.keys(corps).length === 0 && profile?.corpsName) {
        corps.worldClass = {
            corpsName: profile.corpsName,
            lineup: profile.lineup || {},
            totalSeasonScore: profile.totalSeasonScore || 0,
            selectedShows: profile.selectedShows || {},
            weeklyTrades: profile.weeklyTrades || { used: 0 },
            lastScoredDay: profile.lastScoredDay || 0,
            lineupKey: profile.lineupKey
        };
    }
    
    return corps;
};

export const hasAnyCorps = (profile) => {
    return profile?.corps ? Object.keys(profile.corps).some(key => profile.corps[key]?.corpsName) : !!profile?.corpsName;
};

export const hasJoinedSeason = (profile, seasonUid) => {
    return profile?.activeSeasonId === seasonUid;
};

// SoundSport specific helpers
export const isSoundSportCorps = (corpsClass) => {
    return corpsClass === 'soundSport';
};

export const getSoundSportScore = (corps) => {
    // SoundSport uses same scoring internally but displays as medals
    return corps?.totalSeasonScore || 0;
};

// UPDATED: Registration cutoff logic
export const calculateWeeksRemaining = (seasonEndDate) => {
    if (!seasonEndDate) return 0;
    
    const now = new Date();
    const endDate = seasonEndDate.toDate ? seasonEndDate.toDate() : new Date(seasonEndDate);
    
    if (isNaN(endDate.getTime())) return 0;
    
    const diffInMillis = endDate.getTime() - now.getTime();
    const weeksRemaining = Math.ceil(diffInMillis / (1000 * 60 * 60 * 24 * 7));
    
    return Math.max(0, weeksRemaining);
};

export const canCreateCorps = (profile, corpsClass, seasonEndDate) => {
    // Check if user already has this corps class (updates always allowed)
    const existingCorps = getAllUserCorps(profile);
    if (existingCorps[corpsClass]) {
        return { canCreate: true, isUpdate: true };
    }
    
    // SoundSport is always available
    if (corpsClass === 'soundSport') {
        return { canCreate: true, isUpdate: false };
    }
    
    // Check registration cutoffs for new corps creation
    const weeksRemaining = calculateWeeksRemaining(seasonEndDate);
    const classConfig = CORPS_CLASSES[corpsClass];
    const requiredWeeks = classConfig?.registrationCutoff || 0;
    
    if (weeksRemaining >= requiredWeeks) {
        return { 
            canCreate: true, 
            isUpdate: false,
            weeksRemaining,
            requiredWeeks 
        };
    }
    
    return { 
        canCreate: false, 
        isUpdate: false,
        reason: `Registration closed. ${classConfig.name} requires ${requiredWeeks} weeks remaining, but only ${weeksRemaining} weeks remain.`,
        weeksRemaining,
        requiredWeeks 
    };
};

export const getRegistrationDeadline = (corpsClass, seasonEndDate) => {
    const classConfig = CORPS_CLASSES[corpsClass];
    if (!classConfig || !seasonEndDate) return null;
    
    if (corpsClass === 'soundSport') {
        return { 
            deadline: 'Always Open',
            weeksRequired: 0,
            hasDeadline: false 
        };
    }
    
    const endDate = seasonEndDate.toDate ? seasonEndDate.toDate() : new Date(seasonEndDate);
    const deadlineDate = new Date(endDate.getTime() - (classConfig.registrationCutoff * 7 * 24 * 60 * 60 * 1000));
    
    return {
        deadline: deadlineDate,
        weeksRequired: classConfig.registrationCutoff,
        hasDeadline: true,
        isPast: new Date() > deadlineDate
    };
};