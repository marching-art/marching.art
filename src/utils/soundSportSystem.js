// src/utils/soundSportSystem.js
// Official DCI SoundSport Challenge Class Implementation
// FIXED: Compatible with existing marching.art DashboardPage imports

export const SOUNDSPORT_OFFICIAL_CONFIG = {
  name: 'SoundSport',
  pointCap: 90, // Points for lineup building, but scores displayed as medals
  unlockLevel: 1,
  color: 'bg-orange-500',
  icon: '🎺',
  difficulty: 'All Ages',
  ratingSystem: { 
    type: 'medal', 
    displayScores: false, // Scores not announced per official rulebook
    medals: ['Gold', 'Silver', 'Bronze']
  },
  registrationCutoffWeeks: null, // Always open per official rulebook
  alwaysOpen: true,
  officialCriteria: [
    'Audience Engagement',
    'Effectiveness & Entertainment', 
    'Concept Development',
    'Technical & Artistic Proficiency',
    'Creativity & Innovation'
  ],
  performanceRequirements: {
    minDuration: '5:00',
    maxDuration: '7:00',
    minMembers: 5,
    amplificationAllowed: true,
    allInstruments: true,
    allAges: true
  },
  ageClasses: ['Cadet', 'Youth', 'All-Age']
};

export const SoundSportDisplay = {
  // Convert numerical score to medal rating per official rules
  scoreToMedal: (score) => {
    if (score >= 85) return 'Gold';
    if (score >= 70) return 'Silver';
    return 'Bronze';
  },

  formatRating: (score) => {
    const medal = SoundSportDisplay.scoreToMedal(score);
    
    const ratingConfigs = {
      'Gold': {
        primaryDisplay: 'Gold Medal',
        secondaryDisplay: 'Outstanding Performance',
        icon: '🥇',
        colorClass: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
        label: 'Exceptional achievement in all judging criteria',
        description: 'Demonstrates excellence across all evaluation areas'
      },
      'Silver': {
        primaryDisplay: 'Silver Medal', 
        secondaryDisplay: 'Excellent Performance',
        icon: '🥈',
        colorClass: 'border-gray-400 bg-gray-50 dark:bg-gray-900/20',
        label: 'Strong performance with areas for continued growth',
        description: 'Shows solid proficiency with room for development'
      },
      'Bronze': {
        primaryDisplay: 'Bronze Medal',
        secondaryDisplay: 'Good Performance', 
        icon: '🥉',
        colorClass: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20',
        label: 'Solid foundation with clear improvement opportunities',
        description: 'Demonstrates good fundamentals and creative potential'
      }
    };

    return ratingConfigs[medal] || {
      primaryDisplay: 'Awaiting Rating',
      secondaryDisplay: 'Performance Under Review',
      icon: '⏳',
      colorClass: 'border-gray-300 bg-gray-50 dark:bg-gray-800/20',
      label: 'Rating pending official judging panel review',
      description: 'Evaluation in progress'
    };
  },

  generatePerformanceFeedback: (score) => {
    const medal = SoundSportDisplay.scoreToMedal(score);
    
    const feedbackTemplates = {
      'Gold': [
        'Outstanding audience engagement throughout the performance',
        'Exceptional creativity and innovative concept execution', 
        'Technical and artistic proficiency at the highest level',
        'Highly effective and thoroughly entertaining presentation'
      ],
      'Silver': [
        'Strong audience connection with excellent moments',
        'Well-developed concept with good coordination',
        'Solid technical proficiency with minor areas for refinement',
        'Effective entertainment value with creative elements'
      ],
      'Bronze': [
        'Good foundational performance with audience appeal',
        'Creative concept shows promise and potential',
        'Technical elements developing well with room for polish',
        'Entertaining presentation with clear artistic direction'
      ]
    };

    const templates = feedbackTemplates[medal] || ['Performance shows dedication and effort'];
    return templates[Math.floor(Math.random() * templates.length)];
  },

  // Create sample performance data for display
  createSamplePerformance: (corpsName, score = null) => {
    const finalScore = score || (75 + Math.random() * 20); // Random score 75-95
    const medal = SoundSportDisplay.scoreToMedal(finalScore);
    
    return {
      id: `ss-${Date.now()}`,
      corpsName,
      competition: 'DCI SoundSport Challenge',
      venue: 'Community Music Festival',
      date: new Date().toISOString(),
      score: finalScore,
      medal: medal,
      feedback: SoundSportDisplay.generatePerformanceFeedback(finalScore),
      criteria: {
        'Audience Engagement': SoundSportDisplay.scoreToMedal(finalScore + (Math.random() - 0.5) * 10),
        'Effectiveness & Entertainment': SoundSportDisplay.scoreToMedal(finalScore + (Math.random() - 0.5) * 10),
        'Concept Development': SoundSportDisplay.scoreToMedal(finalScore + (Math.random() - 0.5) * 10),
        'Technical & Artistic Proficiency': SoundSportDisplay.scoreToMedal(finalScore + (Math.random() - 0.5) * 10),
        'Creativity & Innovation': SoundSportDisplay.scoreToMedal(finalScore + (Math.random() - 0.5) * 10)
      },
      officialNotes: 'Per DCI SoundSport Challenge Class evaluation guidelines',
      ageClass: 'All-Age' // Default age class
    };
  }
};

// FIXED: Export CORPS_CLASSES that matches DashboardPage import expectations
export const CORPS_CLASSES = {
  soundSport: SOUNDSPORT_OFFICIAL_CONFIG
};

// Default export for compatibility
export default {
  SOUNDSPORT_OFFICIAL_CONFIG,
  SoundSportDisplay,
  CORPS_CLASSES
};