// =============================================================================
// ARTICLE NARRATIVE PARSER - Structured rendering for fantasy recap articles
// =============================================================================
// Parses narrative text to identify sections and renders with visual hierarchy
// Sections: THE BIG PICTURE, GENERAL EFFECT BREAKDOWN, VISUAL CAPTIONS,
//           MUSIC CAPTIONS, CAPTION PICKS, SLEEPER PICK

import React from 'react';
import {
  Eye, Target, Music2, Palette, TrendingUp,
  ShoppingCart, Pause, TrendingDown, Sparkles
} from 'lucide-react';

// Section configuration with icons and styling
const SECTION_CONFIG = {
  'THE BIG PICTURE': {
    icon: Eye,
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    iconClass: 'text-blue-400',
    titleClass: 'text-blue-400',
  },
  'GENERAL EFFECT BREAKDOWN': {
    icon: Target,
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    iconClass: 'text-purple-400',
    titleClass: 'text-purple-400',
  },
  'VISUAL CAPTIONS': {
    icon: Palette,
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/30',
    iconClass: 'text-cyan-400',
    titleClass: 'text-cyan-400',
  },
  'MUSIC CAPTIONS': {
    icon: Music2,
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    iconClass: 'text-amber-400',
    titleClass: 'text-amber-400',
  },
  'CAPTION PICKS': {
    icon: ShoppingCart,
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/30',
    iconClass: 'text-green-400',
    titleClass: 'text-green-400',
  },
  'SLEEPER PICK': {
    icon: Sparkles,
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/30',
    iconClass: 'text-orange-400',
    titleClass: 'text-orange-400',
  },
};

// Parse BUY/HOLD/SELL recommendations from CAPTION PICKS section
function parseRecommendations(content) {
  const recommendations = { buy: [], hold: [], sell: [] };

  // Match patterns like "🟢 BUY (Add these to your lineup): - Corps Caption @ Score"
  const buyMatch = content.match(/🟢\s*BUY[^:]*:\s*([^🟡🔴]*)/i);
  const holdMatch = content.match(/🟡\s*HOLD[^:]*:\s*([^🟢🔴]*)/i);
  const sellMatch = content.match(/🔴\s*SELL[^:]*:\s*([^🟢🟡]*)/i);

  const parseItems = (text) => {
    if (!text) return [];
    // Match "- Corps Caption @ Score" patterns
    const items = [];
    const itemPattern = /-\s*([^@\n]+?)(?:\s+(\w+))?\s*@\s*([\d.]+)\s*→?\s*-?\s*([^-\n]*)/g;
    let match;
    while ((match = itemPattern.exec(text)) !== null) {
      items.push({
        corps: match[1].trim(),
        caption: match[2] || '',
        score: parseFloat(match[3]) || 0,
        reason: match[4]?.trim() || '',
      });
    }
    return items;
  };

  if (buyMatch) recommendations.buy = parseItems(buyMatch[1]);
  if (holdMatch) recommendations.hold = parseItems(holdMatch[1]);
  if (sellMatch) recommendations.sell = parseItems(sellMatch[1]);

  return recommendations;
}

// Render a single section with proper styling
function NarrativeSection({ title, content, isFirst }) {
  const config = SECTION_CONFIG[title] || {
    icon: Eye,
    bgClass: 'bg-gray-500/10',
    borderClass: 'border-gray-500/30',
    iconClass: 'text-gray-400',
    titleClass: 'text-gray-400',
  };

  const Icon = config.icon;

  // Special handling for CAPTION PICKS - show structured recommendations
  if (title === 'CAPTION PICKS') {
    const recs = parseRecommendations(content);
    const hasStructuredRecs = recs.buy.length > 0 || recs.hold.length > 0 || recs.sell.length > 0;

    return (
      <div className={`${config.bgClass} border ${config.borderClass} p-5 ${!isFirst ? 'mt-6' : ''}`}>
        <div className="flex items-center gap-2 mb-4">
          <Icon className={`w-5 h-5 ${config.iconClass}`} />
          <h3 className={`text-sm font-bold uppercase tracking-wider ${config.titleClass}`}>
            {title}
          </h3>
        </div>

        {hasStructuredRecs ? (
          <div className="space-y-4">
            {/* BUY Recommendations */}
            {recs.buy.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-xs font-bold text-green-500 uppercase">
                    BUY - Add to lineup
                  </span>
                </div>
                <div className="space-y-2">
                  {recs.buy.map((rec, idx) => (
                    <div key={idx} className="bg-green-500/10 border border-green-500/20 p-3 rounded-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-white">{rec.corps}</span>
                        <span className="text-xs font-data font-bold text-green-400 tabular-nums">
                          {rec.caption && `${rec.caption} @ `}{rec.score > 0 ? rec.score.toFixed(2) : ''}
                        </span>
                      </div>
                      {rec.reason && <p className="text-xs text-gray-400">{rec.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HOLD Recommendations */}
            {recs.hold.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Pause className="w-4 h-4 text-yellow-500" />
                  <span className="text-xs font-bold text-yellow-500 uppercase">
                    HOLD - Keep if you have them
                  </span>
                </div>
                <div className="space-y-2">
                  {recs.hold.map((rec, idx) => (
                    <div key={idx} className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-white">{rec.corps}</span>
                        <span className="text-xs font-data font-bold text-yellow-400 tabular-nums">
                          {rec.caption && `${rec.caption} @ `}{rec.score > 0 ? rec.score.toFixed(2) : ''}
                        </span>
                      </div>
                      {rec.reason && <p className="text-xs text-gray-400">{rec.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SELL Recommendations */}
            {recs.sell.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="w-4 h-4 text-red-500" />
                  <span className="text-xs font-bold text-red-500 uppercase">
                    SELL - Consider dropping
                  </span>
                </div>
                <div className="space-y-2">
                  {recs.sell.map((rec, idx) => (
                    <div key={idx} className="bg-red-500/10 border border-red-500/20 p-3 rounded-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-bold text-white">{rec.corps}</span>
                        <span className="text-xs font-data font-bold text-red-400 tabular-nums">
                          {rec.caption && `${rec.caption} @ `}{rec.score > 0 ? rec.score.toFixed(2) : ''}
                        </span>
                      </div>
                      {rec.reason && <p className="text-xs text-gray-400">{rec.reason}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Fallback to plain text if parsing fails
          <div className="text-base text-gray-300 leading-relaxed whitespace-pre-line">
            {content}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`${config.bgClass} border ${config.borderClass} p-5 ${!isFirst ? 'mt-6' : ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-5 h-5 ${config.iconClass}`} />
        <h3 className={`text-sm font-bold uppercase tracking-wider ${config.titleClass}`}>
          {title}
        </h3>
      </div>
      <div className="text-base text-gray-300 leading-relaxed whitespace-pre-line">
        {content}
      </div>
    </div>
  );
}

/**
 * ArticleNarrativeParser - Parses and renders narrative with visual sections
 * @param {string} narrative - The full narrative text
 * @param {string} summary - The article summary (shown if narrative unavailable)
 */
export default function ArticleNarrativeParser({ narrative, summary }) {
  if (!narrative || typeof narrative !== 'string') {
    // Fallback to summary if no narrative
    if (summary) {
      return (
        <div className="text-base md:text-lg text-gray-300 leading-relaxed">
          {summary}
        </div>
      );
    }
    return null;
  }

  // Parse narrative into sections
  // Look for section headers like "THE BIG PICTURE", "GENERAL EFFECT BREAKDOWN", etc.
  const sectionHeaders = Object.keys(SECTION_CONFIG);
  const headerPattern = new RegExp(
    `(${sectionHeaders.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`,
    'gi'
  );

  const sections = [];
  let lastIndex = 0;
  let lastHeader = null;

  // Find all section boundaries
  const matches = [...narrative.matchAll(new RegExp(headerPattern, 'gi'))];

  if (matches.length === 0) {
    // No sections found, render as plain text
    return (
      <div className="prose prose-invert prose-lg max-w-none">
        {narrative.split('\n\n').map((paragraph, idx) => (
          <p key={idx} className="text-base md:text-lg text-gray-300 leading-relaxed mb-6">
            {paragraph}
          </p>
        ))}
      </div>
    );
  }

  // Extract sections
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const nextMatch = matches[i + 1];
    const headerEnd = match.index + match[0].length;
    const contentEnd = nextMatch ? nextMatch.index : narrative.length;

    // Get content between this header and next (or end)
    let content = narrative.substring(headerEnd, contentEnd).trim();

    // Clean up content - remove leading newlines and colons
    content = content.replace(/^[\n\r:]+/, '').trim();

    sections.push({
      title: match[0].toUpperCase(),
      content,
    });
  }

  // Check if there's intro content before first section
  if (matches.length > 0 && matches[0].index > 0) {
    const introContent = narrative.substring(0, matches[0].index).trim();
    if (introContent) {
      sections.unshift({
        title: 'INTRODUCTION',
        content: introContent,
        isIntro: true,
      });
    }
  }

  return (
    <div className="space-y-0">
      {sections.map((section, idx) => {
        if (section.isIntro) {
          // Render intro without special styling
          return (
            <div key={idx} className="text-base text-gray-300 leading-relaxed mb-6">
              {section.content}
            </div>
          );
        }
        return (
          <NarrativeSection
            key={idx}
            title={section.title}
            content={section.content}
            isFirst={idx === 0 || (idx === 1 && sections[0]?.isIntro)}
          />
        );
      })}
    </div>
  );
}
