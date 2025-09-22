// utils/authenticSoundSportSystem.js - Authentic SoundSport per DCI Rulebook
// Surface experience matches official DCI SoundSport, underlying scoring remains consistent

// ===============================
// OFFICIAL DCI SOUNDSPORT CONFIGURATION
// ===============================

export const SOUNDSPORT_OFFICIAL_CONFIG = {
  name: 'SoundSport',
  subtitle: 'Challenge Class',
  pointCap: 90, // Internal fantasy point cap (hidden from users)
  
  // Official DCI SoundSport rating system
  ratingSystem: {
    type: 'medal', // Gold, Silver, Bronze (not numerical)
    displayScores: false, // Numerical scores not announced per rulebook
    thresholds: {
      Bronze: { min: 60.0, max: 69.9, label: 'Sometimes' },
      Silver: { min: 70.0, max: 84.9, label: 'Consistently' }, 
      Gold: { min: 85.0, max: 100.0, label: 'Always' }
    }
  },

  // Official judging criteria from DCI rulebook
  judgingCriteria: [
    {
      id: 'audience_engagement',
      name: 'Audience Engagement',
      description: 'The team engages the audience throughout the performance',
      weight: 20
    },
    {
      id: 'effect_entertainment', 
      name: 'Effect and Entertainment',
      description: 'The team is effective and entertaining',
      weight: 20
    },
    {
      id: 'concept_coordination',
      name: 'Concept and Coordination', 
      description: 'The team has a clearly developed and coordinated concept',
      weight: 20
    },
    {
      id: 'technical_proficiency',
      name: 'Technical and Artistic Proficiency',
      description: 'The team demonstrates technical and artistic proficiency', 
      weight: 20
    },
    {
      id: 'creativity_innovation',
      name: 'Creativity and Innovation',
      description: 'The program demonstrates creativity and innovation',
      weight: 20
    }
  ],

  // Performance requirements per rulebook
  performanceRequirements: {
    minDuration: 5, // 5 minutes minimum
    maxDuration: 7, // 7 minutes maximum  
    minMembers: 5, // 5+ members required
    ageClasses: ['Cadet', 'Youth', 'All-Age'],
    openRegistration: true, // Always open per rulebook
    allowsAllInstruments: true,
    allowsAmplification: true
  },

  // Visual identity
  color: 'bg-orange-500',
  icon: '🎉',
  difficulty: 'Recreational'
};

// ===============================
// SOUNDSPORT SCORING TRANSLATION LAYER
// ===============================

export class SoundSportScoringSystem {
  constructor() {
    this.criteria = SOUNDSPORT_OFFICIAL_CONFIG.judgingCriteria;
    this.thresholds = SOUNDSPORT_OFFICIAL_CONFIG.ratingSystem.thresholds;
  }

  // Convert internal fantasy score to SoundSport rating
  calculateSoundSportRating(internalScore, performanceFactors = {}) {
    // Internal score is 0-90 (point cap), convert to 0-100 for rating calculation
    let adjustedScore = (internalScore / 90) * 100;
    
    // Apply SoundSport-specific performance factors per rulebook criteria
    adjustedScore += this.calculatePerformanceBonus(performanceFactors);
    
    // Ensure score stays within bounds
    adjustedScore = Math.max(0, Math.min(100, adjustedScore));
    
    // Determine rating based on official DCI thresholds
    let rating = 'Bronze';
    let ratingData = this.thresholds.Bronze;
    
    if (adjustedScore >= this.thresholds.Gold.min) {
      rating = 'Gold';
      ratingData = this.thresholds.Gold;
    } else if (adjustedScore >= this.thresholds.Silver.min) {
      rating = 'Silver'; 
      ratingData = this.thresholds.Silver;
    }

    return {
      rating,
      label: ratingData.label,
      internalScore, // Keep for fantasy calculations
      adjustedScore: Math.round(adjustedScore * 100) / 100,
      hideNumericalScore: true, // Per rulebook - scores not announced
      feedback: this.generateOfficialFeedback(rating, performanceFactors),
      criteriaBreakdown: this.generateCriteriaFeedback(adjustedScore, performanceFactors)
    };
  }

  // Calculate performance bonus based on official judging criteria
  calculatePerformanceBonus(factors) {
    let bonus = 0;
    
    // Audience Engagement bonus
    if (factors.audienceEngagement === 'high') bonus += 3;
    else if (factors.audienceEngagement === 'medium') bonus += 1.5;
    
    // Entertainment Value bonus  
    if (factors.entertainment === 'exceptional') bonus += 3;
    else if (factors.entertainment === 'good') bonus += 1.5;
    
    // Concept Clarity bonus
    if (factors.conceptClarity === 'clear') bonus += 2;
    else if (factors.conceptClarity === 'developing') bonus += 1;
    
    // Technical Proficiency bonus
    if (factors.technicalProficiency === 'high') bonus += 2;
    else if (factors.technicalProficiency === 'medium') bonus += 1;
    
    // Creativity and Innovation bonus
    if (factors.creativity === 'innovative') bonus += 3;
    else if (factors.creativity === 'creative') bonus += 1.5;
    
    // Deduct for any penalties or issues
    if (factors.penalties) bonus -= factors.penalties;
    if (factors.timingIssues) bonus -= 1;
    
    return bonus;
  }

  // Generate official feedback matching DCI SoundSport style
  generateOfficialFeedback(rating, factors) {
    const feedbackTemplates = {
      Gold: [
        "Outstanding performance with excellent execution and strong audience connection!",
        "Exceptional entertainment value with innovative concepts beautifully executed.",
        "Superb technical proficiency combined with highly engaging presentation.",
        "Exemplary performance demonstrating mastery across all judging criteria."
      ],
      Silver: [
        "Solid performance with good technical execution and clear concept development.",
        "Effective entertainment with consistent execution throughout the performance.", 
        "Well-coordinated performance with good audience engagement and concept clarity.",
        "Strong technical foundation with developing artistic expression."
      ],
      Bronze: [
        "Developing performance with clear potential for growth and improvement.",
        "Good foundation with opportunities to enhance concept development and execution.",
        "Promising performance with room to strengthen technical and artistic elements.",
        "Solid effort with clear areas for continued development and refinement."
      ]
    };

    const templates = feedbackTemplates[rating];
    return templates[Math.floor(Math.random() * templates.length)];
  }

  // Generate criteria-specific feedback per official judging guidelines
  generateCriteriaFeedback(score, factors) {
    return this.criteria.map(criterion => ({
      name: criterion.name,
      description: criterion.description,
      assessment: this.getCriterionAssessment(criterion.id, score, factors),
      suggestions: this.getCriterionSuggestions(criterion.id, score)
    }));
  }

  getCriterionAssessment(criterionId, score, factors) {
    const level = score >= 85 ? 'strong' : score >= 70 ? 'developing' : 'emerging';
    
    const assessments = {
      audience_engagement: {
        strong: "Excellent audience connection with engaging performance energy",
        developing: "Good audience awareness with opportunities for stronger connection", 
        emerging: "Basic audience interaction with room for enhanced engagement"
      },
      effect_entertainment: {
        strong: "Highly entertaining with strong emotional impact and memorable moments",
        developing: "Entertaining performance with good effect and audience appeal",
        emerging: "Shows entertainment potential with opportunities for stronger impact"
      },
      concept_coordination: {
        strong: "Clear, well-developed concept with excellent coordination throughout",
        developing: "Solid concept with good coordination and clear artistic intent",
        emerging: "Developing concept with basic coordination, room for refinement"
      },
      technical_proficiency: {
        strong: "Excellent technical execution with strong artistic expression",
        developing: "Good technical foundation with developing artistic elements",
        emerging: "Basic technical skills with opportunities for improvement"
      },
      creativity_innovation: {
        strong: "Highly innovative with creative elements that enhance the performance",
        developing: "Creative elements present with good use of innovative concepts",
        emerging: "Shows creative potential with opportunities for more innovation"
      }
    };

    return assessments[criterionId]?.[level] || "Assessment pending";
  }

  getCriterionSuggestions(criterionId, score) {
    if (score >= 85) return "Continue building on these strong foundations";
    
    const suggestions = {
      audience_engagement: "Consider adding more interactive moments and visual appeal",
      effect_entertainment: "Explore dynamic contrasts and memorable musical/visual moments", 
      concept_coordination: "Strengthen thematic consistency and ensemble coordination",
      technical_proficiency: "Focus on precision, blend, and artistic expression",
      creativity_innovation: "Experiment with unique arrangements or performance elements"
    };

    return suggestions[criterionId] || "Continue developing this area";
  }
}

// ===============================
// SOUNDSPORT UI DISPLAY COMPONENTS
// ===============================

export const SoundSportDisplay = {
  // Format rating for display (no numerical scores shown)
  formatRating: (ratingResult) => ({
    primaryDisplay: `${ratingResult.rating}`,
    secondaryDisplay: ratingResult.label,
    colorClass: {
      Gold: 'text-yellow-500 bg-yellow-50 border-yellow-200',
      Silver: 'text-gray-500 bg-gray-50 border-gray-200', 
      Bronze: 'text-orange-600 bg-orange-50 border-orange-200'
    }[ratingResult.rating],
    icon: {
      Gold: '🥇',
      Silver: '🥈', 
      Bronze: '🥉'
    }[ratingResult.rating],
    hideScore: true, // Per DCI rulebook
    feedback: ratingResult.feedback
  }),

  // Generate performance summary per DCI style
  generatePerformanceSummary: (ratingResult) => ({
    title: `${ratingResult.rating} Performance`,
    subtitle: ratingResult.label,
    description: ratingResult.feedback,
    criteriaBreakdown: ratingResult.criteriaBreakdown,
    officialNote: "Numerical scores are not announced in SoundSport per DCI guidelines",
    encouragement: "Focus on creativity, entertainment, and audience engagement!"
  }),

  // Create judge's comments format
  formatJudgeComments: (ratingResult) => ({
    overallImpression: ratingResult.feedback,
    criteriaComments: ratingResult.criteriaBreakdown.map(criterion => ({
      area: criterion.name,
      comment: criterion.assessment,
      suggestion: criterion.suggestions
    })),
    rating: ratingResult.rating,
    encouragement: "SoundSport celebrates creativity and community music-making!"
  })
};

// ===============================
// INTEGRATION WITH EXISTING SYSTEM
// ===============================

export class SoundSportGameIntegration {
  constructor(existingScoringSystem) {
    this.soundSportScoring = new SoundSportScoringSystem();
    this.existingSystem = existingScoringSystem;
  }

  // Process SoundSport performance maintaining consistency with other classes
  processPerformance(userLineup, performanceDate, seasonYear) {
    // Use existing scoring system for internal calculations
    const internalResult = this.existingSystem.calculateFantasyScore(
      userLineup, 
      performanceDate, 
      seasonYear
    );

    // Convert to SoundSport rating for display
    const soundSportRating = this.soundSportScoring.calculateSoundSportRating(
      internalResult.totalFantasyScore,
      this.extractPerformanceFactors(internalResult)
    );

    return {
      // Internal data (for fantasy calculations and XP)
      internalScore: internalResult.totalFantasyScore,
      fantasyBreakdown: internalResult.breakdown,
      
      // SoundSport display data (what users see)
      soundSportRating,
      displayData: SoundSportDisplay.formatRating(soundSportRating),
      performanceSummary: SoundSportDisplay.generatePerformanceSummary(soundSportRating),
      judgeComments: SoundSportDisplay.formatJudgeComments(soundSportRating),
      
      // Meta information
      officialCompliance: true,
      rulebaseAlignment: "2025 DCI SoundSport Challenge Class Rulebook"
    };
  }

  // Extract performance factors from fantasy result for SoundSport bonus calculation
  extractPerformanceFactors(fantasyResult) {
    const avgScore = fantasyResult.totalFantasyScore;
    
    return {
      audienceEngagement: avgScore >= 75 ? 'high' : avgScore >= 50 ? 'medium' : 'low',
      entertainment: avgScore >= 80 ? 'exceptional' : avgScore >= 60 ? 'good' : 'developing',
      conceptClarity: avgScore >= 70 ? 'clear' : 'developing',
      technicalProficiency: avgScore >= 75 ? 'high' : avgScore >= 50 ? 'medium' : 'low',
      creativity: avgScore >= 80 ? 'innovative' : avgScore >= 60 ? 'creative' : 'developing'
    };
  }
}

// ===============================
// EXPORT CONFIGURATION
// ===============================

export default {
  SOUNDSPORT_OFFICIAL_CONFIG,
  SoundSportScoringSystem,
  SoundSportDisplay,
  SoundSportGameIntegration
};