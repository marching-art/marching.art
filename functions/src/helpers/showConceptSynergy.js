// Backend Show Concept Synergy Logic
// Used in Cloud Functions for scoring calculations

const SHOW_THEMES = [
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

const MUSIC_SOURCES = [
    { value: 'original', label: 'Original Composition', tags: ['innovative', 'unique', 'artistic'] },
    { value: 'arranged', label: 'Arranged Classical', tags: ['traditional', 'classical', 'elegant'] },
    { value: 'popular', label: 'Popular Music', tags: ['modern', 'accessible', 'energetic'] },
    { value: 'film', label: 'Film Score', tags: ['cinematic', 'emotional', 'dramatic'] },
    { value: 'mixed', label: 'Mixed/Eclectic', tags: ['diverse', 'innovative', 'bold'] }
];

const DRILL_STYLES = [
    { value: 'traditional', label: 'Traditional/Symmetrical', tags: ['traditional', 'precise', 'elegant'] },
    { value: 'asymmetrical', label: 'Asymmetrical/Modern', tags: ['modern', 'innovative', 'artistic'] },
    { value: 'curvilinear', label: 'Curvilinear/Flowing', tags: ['fluid', 'elegant', 'artistic'] },
    { value: 'angular', label: 'Angular/Geometric', tags: ['bold', 'precise', 'dramatic'] },
    { value: 'scatter', label: 'Scatter/Organic', tags: ['innovative', 'dynamic', 'experimental'] },
    { value: 'dance', label: 'Dance/Movement-Heavy', tags: ['theatrical', 'energetic', 'vibrant'] }
];

/**
 * Default corps synergy tags based on historical era and corps characteristics
 * These provide baseline tags when specific corps data isn't available
 */
const getDefaultCorpsTags = (corpsName, sourceYear) => {
    const year = parseInt(sourceYear);
    const tags = [];
    
    // Era-based tags
    if (year < 2000) {
        tags.push('traditional', 'classical');
    } else if (year < 2010) {
        tags.push('modern', 'innovative');
    } else {
        tags.push('modern', 'innovative', 'artistic');
    }
    
    // Corps-specific characteristics (simplified baseline)
    const modernCorps = ['Blue Devils', 'Carolina Crown', 'Bluecoats', 'Santa Clara Vanguard'];
    const traditionalCorps = ['Cavaliers', 'Blue Knights', 'Madison Scouts'];
    const artisticCorps = ['Santa Clara Vanguard', 'Phantom Regiment', 'Blue Devils'];
    
    if (modernCorps.some(name => corpsName.includes(name))) {
        tags.push('bold', 'energetic');
    }
    if (traditionalCorps.some(name => corpsName.includes(name))) {
        tags.push('precise', 'powerful');
    }
    if (artisticCorps.some(name => corpsName.includes(name))) {
        tags.push('artistic', 'dramatic');
    }
    
    return [...new Set(tags)]; // Remove duplicates
};

/**
 * Get all tags from a show concept selection
 */
function getShowConceptTags(showConcept) {
    if (!showConcept || typeof showConcept !== 'object') {
        return [];
    }
    
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
    
    return [...new Set(tags)]; // Return unique tags
}

/**
 * Calculate synergy bonus for a single caption
 * @param {Array} showTags - Tags from user's show concept
 * @param {String} corpsName - Name of the corps
 * @param {String} sourceYear - Year of the corps
 * @param {Object} corpsSynergyData - Optional: Specific corps synergy data from database
 * @returns {Number} - Bonus points (0-2.0)
 */
function calculateCaptionSynergyBonus(showTags, corpsName, sourceYear, corpsSynergyData = null) {
    if (!showTags || showTags.length === 0) {
        return 0;
    }
    
    // Get corps tags from database or use defaults
    let corpsTags;
    if (corpsSynergyData && corpsSynergyData[`${corpsName}|${sourceYear}`]) {
        corpsTags = corpsSynergyData[`${corpsName}|${sourceYear}`];
    } else {
        corpsTags = getDefaultCorpsTags(corpsName, sourceYear);
    }
    
    if (!corpsTags || corpsTags.length === 0) {
        return 0;
    }
    
    // Calculate matching tags
    const matchingTags = showTags.filter(tag => corpsTags.includes(tag));
    const matchRatio = matchingTags.length / showTags.length;
    
    // Scale: 0 matches = 0 bonus, all matches = 1.0 bonus points
    // Reduced from 2.0 to ensure 100 is extremely rare
    return parseFloat((matchRatio * 1.0).toFixed(3));
}

/**
 * Calculate total synergy bonus for an entire lineup
 * @param {Object} showConcept - User's show concept {theme, musicSource, drillStyle}
 * @param {Object} lineup - User's lineup {GE1: 'Blue Devils|20|2014', ...}
 * @param {Object} corpsSynergyData - Optional: Corps-specific synergy data
 * @returns {Object} - { totalBonus, captionBonuses: {...} }
 */
function calculateLineupSynergyBonus(showConcept, lineup, corpsSynergyData = null) {
    const showTags = getShowConceptTags(showConcept);
    
    if (showTags.length === 0) {
        return { totalBonus: 0, captionBonuses: {} };
    }
    
    const captionBonuses = {};
    let totalBonus = 0;
    
    // Calculate bonus for each caption
    for (const [caption, corpsValue] of Object.entries(lineup || {})) {
        if (!corpsValue) continue;
        
        // Parse corps value: "Blue Devils|20|2014"
        const [corpsName, _points, sourceYear] = corpsValue.split('|');
        
        const bonus = calculateCaptionSynergyBonus(showTags, corpsName, sourceYear, corpsSynergyData);
        captionBonuses[caption] = bonus;
        totalBonus += bonus;
    }
    
    return {
        totalBonus: parseFloat(totalBonus.toFixed(3)),
        captionBonuses
    };
}

module.exports = {
    getShowConceptTags,
    calculateCaptionSynergyBonus,
    calculateLineupSynergyBonus,
    getDefaultCorpsTags,
    SHOW_THEMES,
    MUSIC_SOURCES,
    DRILL_STYLES
};
