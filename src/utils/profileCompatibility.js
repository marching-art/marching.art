// utils/profileCompatibility.js
// Helper functions to handle both old and new profile structures including SoundSport

// utils/profileCompatibility.js
// Helper functions to handle both old and new profile structures including SoundSport

export const CORPS_CLASSES = {
    soundSport: { name: 'SoundSport', pointCap: 90, color: 'bg-orange-500' },
    aClass: { name: 'A Class', pointCap: 60, color: 'bg-green-500' },
    openClass: { name: 'Open Class', pointCap: 120, color: 'bg-blue-500' },
    worldClass: { name: 'World Class', pointCap: 150, color: 'bg-yellow-500' }
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

export const canCreateCorps = (profile, corpsClass) => {
    // SoundSport is always available
    if (corpsClass === 'soundSport') return true;
    
    // Other classes based on existing logic
    const userLevel = profile?.level || 1;
    const unlockLevels = {
        aClass: 1,
        openClass: 5,
        worldClass: 10
    };
    
    return userLevel >= (unlockLevels[corpsClass] || 1);
};