// =============================================================================
// CAPTION INSIGHTS CARDS - Visual cards for GE, Visual, and Music insights
// =============================================================================
// Displays structured caption insights from fantasy_recap articles
// Each card shows insight text with relevant icon and color coding

import React from 'react';
import { Target, Palette, Music2 } from 'lucide-react';

// Caption insight configuration
const INSIGHT_CONFIG = {
  ge: {
    title: 'General Effect',
    subtitle: 'GE1 & GE2',
    icon: Target,
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    iconClass: 'text-purple-400',
    titleClass: 'text-purple-400',
  },
  visual: {
    title: 'Visual Captions',
    subtitle: 'VP, VA & CG',
    icon: Palette,
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/30',
    iconClass: 'text-cyan-400',
    titleClass: 'text-cyan-400',
  },
  music: {
    title: 'Music Captions',
    subtitle: 'Brass, MA & Percussion',
    icon: Music2,
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    iconClass: 'text-amber-400',
    titleClass: 'text-amber-400',
  },
};

// Individual insight card
function InsightCard({ type, content }) {
  const config = INSIGHT_CONFIG[type];
  if (!config || !content) return null;

  const Icon = config.icon;

  return (
    <div className={`${config.bgClass} border ${config.borderClass} p-4 rounded-sm`}>
      <div className="flex items-start gap-3">
        <div className={`p-2 ${config.bgClass} rounded-sm`}>
          <Icon className={`w-5 h-5 ${config.iconClass}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 mb-2">
            <h4 className={`text-sm font-bold ${config.titleClass}`}>
              {config.title}
            </h4>
            <span className="text-xs text-gray-500">
              {config.subtitle}
            </span>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed">
            {content}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * CaptionInsightsCards - Displays caption insights as visual cards
 * @param {Object} captionInsights - Object with geInsight, visualInsight, musicInsight
 */
export default function CaptionInsightsCards({ captionInsights }) {
  if (!captionInsights) return null;

  const { geInsight, visualInsight, musicInsight } = captionInsights;

  // Check if we have any insights to display
  if (!geInsight && !visualInsight && !musicInsight) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Target className="w-4 h-4 text-purple-400" />
        Caption Analysis
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <InsightCard type="ge" content={geInsight} />
        <InsightCard type="visual" content={visualInsight} />
        <InsightCard type="music" content={musicInsight} />
      </div>
    </div>
  );
}
