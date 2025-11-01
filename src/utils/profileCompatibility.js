// utils/profileCompatibility.js
// Helper functions to handle both old and new profile structures

export const CORPS_CLASSES = {
    worldClass: { name: 'World Class', pointCap: 150, color: 'bg-yellow-500' },
    openClass: { name: 'Open Class', pointCap: 120, color: 'bg-blue-500' },
    aClass: { name: 'A Class', pointCap: 60, color: 'bg-green-500' },
    soundSport: { name: 'SoundSport', pointCap: 90, color: 'bg-purple-500' }
};

// NEW: Added an array to enforce display order.
export const CORPS_CLASS_ORDER = ['worldClass', 'openClass', 'aClass', 'soundSport'];

// Helper to get SoundSport rating based on score
export const getSoundSportRating = (score) => {
    if (score >= 80) return { rating: 'Gold', color: 'text-yellow-500' };
    if (score >= 60) return { rating: 'Silver', color: 'text-gray-400' };
    if (score >= 40) return { rating: 'Bronze', color: 'text-amber-700' };
    return { rating: 'Unrated', color: 'text-gray-500' };
};

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
