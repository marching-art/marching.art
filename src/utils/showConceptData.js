// Show Concept Data - Themes, Music Sources, Drill Styles with Synergy Tags
// Each selection has synergy tags that match with historical corps characteristics

export const SHOW_THEMES = [
    { value: 'classical', label: 'Classical/Orchestral', tags: ['classical', 'traditional', 'elegant'] },
    { value: 'jazz', label: 'Jazz/Swing', tags: ['jazz', 'improvisational', 'energetic'] },
    { value: 'rock', label: 'Rock/Modern', tags: ['modern', 'bold', 'energetic'] },
    { value: 'latin', label: 'Latin/World', tags: ['cultural', 'rhythmic', 'vibrant'] },
    { value: 'cinematic', label: 'Cinematic/Film', tags: ['emotional', 'dramatic', 'storytelling'] },
    { value: 'abstract', label: 'Abstract/Conceptual', tags: ['innovative', 'artistic', 'experimental'] },
    { value: 'patriotic', label: 'Patriotic/Americana', tags: ['traditional', 'powerful', 'emotional'] },
    { value: 'electronic', label: 'Electronic/Synthesized', tags: ['modern', 'innovative', 'bold'] },
    { value: 'broadway', label: 'Broadway/Musical Theater', tags: ['theatrical', 'storytelling', 'dramatic'] }
];

export const MUSIC_SOURCES = [
    { value: 'original', label: 'Original Composition', tags: ['innovative', 'unique', 'artistic'] },
    { value: 'arranged', label: 'Arranged Classical', tags: ['traditional', 'classical', 'elegant'] },
    { value: 'popular', label: 'Popular Music', tags: ['modern', 'accessible', 'energetic'] },
    { value: 'film', label: 'Film Score', tags: ['cinematic', 'emotional', 'dramatic'] },
    { value: 'mixed', label: 'Mixed/Eclectic', tags: ['diverse', 'innovative', 'bold'] }
];

export const DRILL_STYLES = [
    { value: 'traditional', label: 'Traditional/Symmetrical', tags: ['traditional', 'precise', 'elegant'] },
    { value: 'asymmetrical', label: 'Asymmetrical/Modern', tags: ['modern', 'innovative', 'artistic'] },
    { value: 'curvilinear', label: 'Curvilinear/Flowing', tags: ['fluid', 'elegant', 'artistic'] },
    { value: 'angular', label: 'Angular/Geometric', tags: ['bold', 'precise', 'dramatic'] },
    { value: 'scatter', label: 'Scatter/Organic', tags: ['innovative', 'dynamic', 'experimental'] },
    { value: 'dance', label: 'Dance/Movement-Heavy', tags: ['theatrical', 'energetic', 'vibrant'] }
];

// Historical corps synergy tags - maps corps/year combos to their characteristics
// This data would ideally be stored in Firestore under dci-data/{seasonId}/corpsSynergy
// For now, defining the structure here
export const CORPS_SYNERGY_TAGS = {
    // Example format: 'Blue Devils|2014': ['modern', 'innovative', 'artistic', 'bold']
    // This would be populated from historical analysis or manually curated
};

/**
 * Calculate synergy bonus based on matching tags
 * @param {Array} showTags - Tags from user's show concept selections
 * @param {Array} corpsTags - Tags from historical corps selection
 * @returns {Number} - Synergy bonus points (0-2 points per caption)
 */
export const calculateSynergyBonus = (showTags, corpsTags) => {
    if (!showTags || !corpsTags || showTags.length === 0 || corpsTags.length === 0) {
        return 0;
    }
    
    const matchingTags = showTags.filter(tag => corpsTags.includes(tag));
    const matchRatio = matchingTags.length / showTags.length;
    
    // Scale: 0 matches = 0 bonus, all matches = 2.0 bonus
    return parseFloat((matchRatio * 2.0).toFixed(3));
};

/**
 * Get all tags from a show concept selection
 * @param {Object} showConcept - { theme, musicSource, drillStyle }
 * @returns {Array} - Combined array of all tags
 */
export const getShowConceptTags = (showConcept) => {
    const tags = [];
    
    if (showConcept.theme) {
        const theme = SHOW_THEMES.find(t => t.value === showConcept.theme);
        if (theme) tags.push(...theme.tags);
    }
    
    if (showConcept.musicSource) {
        const source = MUSIC_SOURCES.find(s => s.value === showConcept.musicSource);
        if (source) tags.push(...source.tags);
    }
    
    if (showConcept.drillStyle) {
        const style = DRILL_STYLES.find(d => d.value === showConcept.drillStyle);
        if (style) tags.push(...style.tags);
    }
    
    // Return unique tags only
    return [...new Set(tags)];
};
