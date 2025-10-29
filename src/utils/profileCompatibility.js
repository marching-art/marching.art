// utils/profileCompatibility.js
// Helper functions to handle both old and new profile structures

export const CORPS_CLASSES = {
    worldClass: { name: 'World Class', pointCap: 150, color: 'bg-yellow-500' },
    openClass: { name: 'Open Class', pointCap: 120, color: 'bg-blue-500' },
    aClass: { name: 'A Class', pointCap: 60, color: 'bg-green-500' }
};

// Array to enforce display order
export const CORPS_CLASS_ORDER = ['worldClass', 'openClass', 'aClass'];

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
    // Check new structure
    if (profile?.corps) {
        return Object.keys(profile.corps).some(key => profile.corps[key]?.corpsName);
    }
    
    // Check old structure
    return !!profile?.corpsName;
};

export const getCorpsCount = (profile) => {
    return Object.keys(getAllUserCorps(profile)).length;
};

export const canCreateMoreCorps = (profile) => {
    return getCorpsCount(profile) < Object.keys(CORPS_CLASSES).length;
};

export const getAvailableCorpsClasses = (profile) => {
    const existingCorps = getAllUserCorps(profile);
    return Object.keys(CORPS_CLASSES).filter(key => !existingCorps[key]);
};