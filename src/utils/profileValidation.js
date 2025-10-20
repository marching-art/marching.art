/**
 * Validates if a user profile is complete and has all required fields
 */
export const validateProfile = (profile) => {
    const missingFields = [];
    
    // Required fields
    if (!profile) {
        return { isValid: false, missingFields: ['profile'] };
    }

    if (!profile.username || profile.username.trim() === '') {
        missingFields.push('username');
    }

    if (!profile.createdAt) {
        missingFields.push('createdAt');
    }

    // Check if uniform exists and has required structure
    if (!profile.uniform || typeof profile.uniform !== 'object') {
        missingFields.push('uniform');
    }

    // Check if trophies structure exists
    if (!profile.trophies || typeof profile.trophies !== 'object') {
        missingFields.push('trophies');
    }

    return {
        isValid: missingFields.length === 0,
        missingFields
    };
};

/**
 * Returns a default profile structure with all required fields
 */
export const getDefaultProfileStructure = () => ({
    username: '',
    createdAt: new Date(),
    lastActive: new Date(),
    bio: 'Welcome to my marching.art profile!',
    isPublic: true,
    uniform: {
        skinTone: '#d8aa7c',
        headwear: { style: 'shako', colors: { hat: '#1a1a1a', trim: '#ffffff' } },
        plume: { style: 'fountain', colors: { plume: '#ff0000' } },
        jacket: { style: 'sash', colors: { base: '#000080', accent: '#ffffff', trim: '#ffd700' } },
        pants: { style: 'stripe', colors: { base: '#ffffff', stripe: '#000080' } },
        shoes: { style: 'white' },
    },
    trophies: {
        championships: [],
        regionals: [],
        finalistMedals: []
    },
    achievements: [],
    seasons: [],
    corps: {}
});