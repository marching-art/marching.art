// utils/profileCompatibility.js
// Helper functions to handle both old and new profile structures

export const CORPS_CLASSES = {
    worldClass: { name: 'World Class', pointCap: 150, color: 'bg-yellow-500' },
    openClass: { name: 'Open Class', pointCap: 120, color: 'bg-blue-500' },
    aClass: { name: 'A Class', pointCap: 60, color: 'bg-green-500' }
};

// NEW: Added an array to enforce display order.
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
    return profile?.corps 
        ? Object.keys(profile.corps).some(key => profile.corps[key]?.corpsName) 
        : !!profile?.corpsName;
};

export const hasJoinedSeason = (profile, seasonUid) => {
    if (!profile || !seasonUid) return false;
    
    // Check if user has any corps in the current season
    if (profile.corps) {
        return Object.values(profile.corps).some(corps => 
            corps.corpsName && profile.activeSeasonId === seasonUid
        );
    }
    
    // Backward compatibility
    return profile.activeSeasonId === seasonUid && profile.corpsName;
};

export const ensureProfileCompatibility = (profileData) => {
    if (!profileData) return profileData;
    
    // If profile already has the new corps structure, return as-is
    if (profileData.corps) {
        return profileData;
    }
    
    // Convert old single-corps structure to new multi-corps structure
    if (profileData.corpsName) {
        return {
            ...profileData,
            corps: {
                worldClass: {
                    corpsName: profileData.corpsName,
                    lineup: profileData.lineup || {},
                    totalSeasonScore: profileData.totalSeasonScore || 0,
                    selectedShows: profileData.selectedShows || {},
                    weeklyTrades: profileData.weeklyTrades || { used: 0 },
                    lastScoredDay: profileData.lastScoredDay || 0,
                    lineupKey: profileData.lineupKey
                }
            }
        };
    }
    
    return profileData;
};