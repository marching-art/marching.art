// src/components/Landing/fallbackNewsData.js
// Fallback news data - only loaded when API is unavailable
// This file is lazy-loaded to reduce initial bundle size

export const FALLBACK_NEWS = [
  {
    id: 'fallback-1',
    category: 'dci',
    headline: 'Blue Devils +0.425: VP Surge Extends Lead at San Antonio',
    summary: 'BD extends their lead with a commanding 97.850 performance. Their Visual Proficiency jumped 0.35 points, the largest single-show VP gain of the season.',
    fullStory: 'The Blue Devils continue to assert their dominance in the 2024 DCI season with an impressive performance at the San Antonio regional. Their Visual Proficiency score saw a remarkable increase of 0.35 points, marking the most significant single-show VP improvement this season.',
    fantasyImpact: 'Directors rostering Blue Devils Brass saw +3.8 points (11.2% ROI). Bluecoats percussion emerging as a buy-low opportunity.',
    fantasyMetrics: {
      topROI: { corps: 'Blue Devils', caption: 'Brass', pointsGained: 3.8, roiPercent: 11.2 },
      buyLow: [{ corps: 'Bluecoats', reason: 'Percussion undervalued after drill change', projectedGain: 2.1 }],
      sellHigh: [{ corps: 'Phantom Regiment', reason: 'GE regression likely', riskLevel: 'medium' }],
    },
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    trendingCorps: [
      { corps: 'Blue Devils', direction: 'up', reason: 'VP +0.35, largest of season', weeklyChange: 0.425, fantasyValue: 'hold' },
      { corps: 'Bluecoats', direction: 'up', reason: 'Visual Analysis breakout', weeklyChange: 0.31, fantasyValue: 'buy' },
    ],
  },
  {
    id: 'fallback-2',
    category: 'fantasy',
    headline: 'Crown Brass +0.8: The Breakout Caption of Week 4',
    summary: 'Carolina Crown\'s brass section posted 18.7 in Music Analysis, their highest mark since 2019. ROI leaders this week.',
    fullStory: 'In a stunning display of musical excellence, Carolina Crown\'s brass section has emerged as the standout performer of Week 4. Their Music Analysis score of 18.7 represents their strongest showing in five years.',
    fantasyImpact: 'Crown Brass delivered +4.2 points (12.3% ROI). SCV Guard up 8.1% ROI. Lock them in if available.',
    fantasyMetrics: {
      topROI: { corps: 'Carolina Crown', caption: 'Brass', pointsGained: 4.2, roiPercent: 12.3 },
      buyLow: [{ corps: 'Cadets', reason: 'New show design underperforming', projectedGain: 1.8 }],
      sellHigh: [],
    },
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    trendingCorps: [
      { corps: 'Carolina Crown', direction: 'up', reason: 'Brass +0.8, best since 2019', weeklyChange: 0.62, fantasyValue: 'buy' },
    ],
  },
  {
    id: 'fallback-3',
    category: 'analysis',
    headline: 'Week 4 Power Rankings: Who\'s Positioned for Finals?',
    summary: 'Our comprehensive analysis breaks down the trajectory of all World Class corps heading into the crucial second half of the season.',
    fullStory: 'As we approach the midpoint of the 2024 DCI season, clear patterns are emerging in the race for finals placement. Our statistical models, combined with caption-by-caption analysis, reveal some surprising trends.',
    fantasyImpact: 'Top 6 corps showing consistency. Consider diversifying rosters with Open Class breakouts for higher upside.',
    fantasyMetrics: {
      topROI: { corps: 'Colts', caption: 'Overall', pointsGained: 2.1, roiPercent: 15.8 },
      buyLow: [{ corps: 'Blue Stars', reason: 'Visual design clicking, underowned', projectedGain: 2.4 }],
      sellHigh: [],
    },
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
    trendingCorps: [
      { corps: 'Blue Stars', direction: 'up', reason: 'Visual redesign paying dividends', weeklyChange: 0.38, fantasyValue: 'buy' },
      { corps: 'Colts', direction: 'up', reason: 'Consistent week-over-week gains', weeklyChange: 0.29, fantasyValue: 'buy' },
    ],
  },
  {
    id: 'fallback-4',
    category: 'dci',
    headline: 'Crown Visual +0.45: New Closer Pays Immediate Dividends',
    summary: 'Crown debuts reimagined finale. Visual Proficiency jumped from 18.1 to 18.55, with Color Guard posting season-high 9.4.',
    fullStory: 'Carolina Crown\'s decision to redesign their closing impact paid immediate dividends at the Atlanta regional. The Color Guard, in particular, delivered a breakthrough performance.',
    fantasyImpact: 'Crown Visual captions spiked +2.9 points (9.7% ROI). Directors should consider adding Crown Guard before Week 5.',
    fantasyMetrics: {
      topROI: { corps: 'Carolina Crown', caption: 'Guard', pointsGained: 2.9, roiPercent: 9.7 },
      buyLow: [{ corps: 'Boston Crusaders', reason: 'Percussion trending up, underowned', projectedGain: 1.5 }],
      sellHigh: [],
    },
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    trendingCorps: [
      { corps: 'Carolina Crown', direction: 'up', reason: 'Visual +0.45, new closer impact', weeklyChange: 0.45, fantasyValue: 'buy' },
    ],
  },
  {
    id: 'fallback-5',
    category: 'fantasy',
    headline: 'Waiver Wire: 5 Under-the-Radar Pickups for Week 5',
    summary: 'These under-owned captions are primed for breakout performances. Get ahead of the crowd before roster locks.',
    fullStory: 'Fantasy directors looking to gain an edge should consider these five under-rostered options heading into Week 5. Our projections show significant upside potential.',
    fantasyImpact: 'Boston Percussion (12% owned), Blue Stars Guard (8% owned), and Phantom Brass (15% owned) top our list.',
    fantasyMetrics: {
      topROI: { corps: 'Boston Crusaders', caption: 'Percussion', pointsGained: 1.8, roiPercent: 8.5 },
      buyLow: [
        { corps: 'Boston Crusaders', reason: 'Percussion trending, only 12% owned', projectedGain: 2.2 },
        { corps: 'Blue Stars', reason: 'Guard breakout incoming', projectedGain: 1.9 },
      ],
      sellHigh: [{ corps: 'Mandarins', reason: 'Peaked early, regression expected', riskLevel: 'high' }],
    },
    createdAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(),
    trendingCorps: [
      { corps: 'Boston Crusaders', direction: 'up', reason: 'Percussion consistency', weeklyChange: 0.22, fantasyValue: 'buy' },
    ],
  },
];
