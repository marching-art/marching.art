// =============================================================================
// CAPTION BREAKDOWN CARDS - Visual cards for DCI article caption analysis
// =============================================================================
// Displays structured captionBreakdown data from dci_recap articles
// Each card shows GE, Visual, and Music analysis with relevant styling

import React from 'react';
import { Target, Palette, Music2 } from 'lucide-react';

// Caption breakdown configuration
const BREAKDOWN_CONFIG = {
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
    title: 'Visual',
    subtitle: 'VP, VA & Color Guard',
    icon: Palette,
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/30',
    iconClass: 'text-cyan-400',
    titleClass: 'text-cyan-400',
  },
  music: {
    title: 'Music',
    subtitle: 'Brass, MA & Percussion',
    icon: Music2,
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    iconClass: 'text-amber-400',
    titleClass: 'text-amber-400',
  },
};

// Individual breakdown card
function BreakdownCard({ type, content }) {
  const config = BREAKDOWN_CONFIG[type];
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
 * CaptionBreakdownCards - Displays DCI caption breakdown as visual cards
 * @param {Object} captionBreakdown - Object with geAnalysis, visualAnalysis, musicAnalysis
 */
export default function CaptionBreakdownCards({ captionBreakdown }) {
  if (!captionBreakdown) return null;

  const { geAnalysis, visualAnalysis, musicAnalysis } = captionBreakdown;

  // Check if we have any breakdown to display
  if (!geAnalysis && !visualAnalysis && !musicAnalysis) return null;

  return (
    <div className="mb-8">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
        <Target className="w-4 h-4 text-purple-400" />
        Caption Analysis Summary
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <BreakdownCard type="ge" content={geAnalysis} />
        <BreakdownCard type="visual" content={visualAnalysis} />
        <BreakdownCard type="music" content={musicAnalysis} />
      </div>
    </div>
  );
}
