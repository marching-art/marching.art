// =============================================================================
// ARTICLE NARRATIVE PARSER - Structured rendering for article narratives
// =============================================================================
// Parses narrative text to identify sections and renders with visual hierarchy
// Supports both fantasy_recap and dci_recap article types
//
// Fantasy Recap sections: THE BIG PICTURE, GENERAL EFFECT BREAKDOWN, VISUAL CAPTIONS,
//                         MUSIC CAPTIONS, CAPTION PICKS, SLEEPER PICK
//
// DCI Recap sections: GENERAL EFFECT, VISUAL, MUSIC, TRAJECTORY & FUTURE OUTLOOK,
//                     FANTASY RECOMMENDATIONS

import React from 'react';
import {
  Eye, Target, Music2, Palette, TrendingUp, Compass,
  ShoppingCart, Pause, TrendingDown, Sparkles, BarChart3
} from 'lucide-react';

// Section configuration with icons and styling
// Supports multiple naming variations for each section type
const SECTION_CONFIG = {
  // Fantasy Recap sections
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
  // DCI Recap sections
  'GENERAL EFFECT': {
    icon: Target,
    bgClass: 'bg-purple-500/10',
    borderClass: 'border-purple-500/30',
    iconClass: 'text-purple-400',
    titleClass: 'text-purple-400',
  },
  'VISUAL': {
    icon: Palette,
    bgClass: 'bg-cyan-500/10',
    borderClass: 'border-cyan-500/30',
    iconClass: 'text-cyan-400',
    titleClass: 'text-cyan-400',
  },
  'MUSIC': {
    icon: Music2,
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    iconClass: 'text-amber-400',
    titleClass: 'text-amber-400',
  },
  'TRAJECTORY & FUTURE OUTLOOK': {
    icon: Compass,
    bgClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/30',
    iconClass: 'text-indigo-400',
    titleClass: 'text-indigo-400',
  },
  'TRAJECTORY': {
    icon: Compass,
    bgClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/30',
    iconClass: 'text-indigo-400',
    titleClass: 'text-indigo-400',
  },
  'FUTURE OUTLOOK': {
    icon: Compass,
    bgClass: 'bg-indigo-500/10',
    borderClass: 'border-indigo-500/30',
    iconClass: 'text-indigo-400',
    titleClass: 'text-indigo-400',
  },
  'FANTASY RECOMMENDATIONS': {
    icon: ShoppingCart,
    bgClass: 'bg-green-500/10',
    borderClass: 'border-green-500/30',
    iconClass: 'text-green-400',
    titleClass: 'text-green-400',
  },
  // Analytics sections
  'ANALYSIS': {
    icon: BarChart3,
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/30',
    iconClass: 'text-blue-400',
    titleClass: 'text-blue-400',
  },
};

// Parse BUY/HOLD/SELL recommendations from text content
function parseRecommendations(content) {
  const recommendations = { buy: [], hold: [], sell: [] };

  // Match patterns for emoji-prefixed recommendations
  const buyMatch = content.match(/🟢\s*BUY[^:]*:\s*([^🟡🔴]*)/i);
  const holdMatch = content.match(/🟡\s*HOLD[^:]*:\s*([^🟢🔴]*)/i);
  const sellMatch = content.match(/🔴\s*SELL[^:]*:\s*([^🟢🟡]*)/i);

  // Also match asterisk-prefixed recommendations (from DCI articles)
  const buyMatchAlt = content.match(/\*\s*\*?\*?BUY[^:]*:\*?\*?\s*([^*]*?)(?=\*\s*\*?\*?(?:HOLD|SELL)|$)/is);
  const holdMatchAlt = content.match(/\*\s*\*?\*?HOLD[^:]*:\*?\*?\s*([^*]*?)(?=\*\s*\*?\*?(?:BUY|SELL)|$)/is);
  const sellMatchAlt = content.match(/\*\s*\*?\*?SELL[^:]*:\*?\*?\s*([^*]*?)(?=\*\s*\*?\*?(?:BUY|HOLD)|$)/is);

  const parseItems = (text) => {
    if (!text) return [];
    const items = [];
    // Match "- Corps Caption @ Score" or "Corps: reason" patterns
    const itemPattern = /-\s*([^@:\n]+?)(?:\s+(\w+))?\s*(?:@\s*([\d.]+))?\s*→?\s*-?\s*([^-\n]*)/g;
    let match;
    while ((match = itemPattern.exec(text)) !== null) {
      const corps = match[1].trim();
      if (corps.length > 2) {  // Filter out noise
        items.push({
          corps,
          caption: match[2] || '',
          score: parseFloat(match[3]) || 0,
          reason: match[4]?.trim() || '',
        });
      }
    }
    return items;
  };

  // Try emoji format first, then asterisk format
  if (buyMatch) recommendations.buy = parseItems(buyMatch[1]);
  else if (buyMatchAlt) recommendations.buy = parseItems(buyMatchAlt[1]);

  if (holdMatch) recommendations.hold = parseItems(holdMatch[1]);
  else if (holdMatchAlt) recommendations.hold = parseItems(holdMatchAlt[1]);

  if (sellMatch) recommendations.sell = parseItems(sellMatch[1]);
  else if (sellMatchAlt) recommendations.sell = parseItems(sellMatchAlt[1]);

  return recommendations;
}

// Render recommendation cards
function RecommendationList({ recs }) {
  if (!recs || (recs.buy.length === 0 && recs.hold.length === 0 && recs.sell.length === 0)) {
    return null;
  }

  return (
    <div className="space-y-4 mt-4">
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
                  {rec.score > 0 && (
                    <span className="text-xs font-data font-bold text-green-400 tabular-nums">
                      {rec.caption && `${rec.caption} @ `}{rec.score.toFixed(2)}
                    </span>
                  )}
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
                  {rec.score > 0 && (
                    <span className="text-xs font-data font-bold text-yellow-400 tabular-nums">
                      {rec.caption && `${rec.caption} @ `}{rec.score.toFixed(2)}
                    </span>
                  )}
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
                  {rec.score > 0 && (
                    <span className="text-xs font-data font-bold text-red-400 tabular-nums">
                      {rec.caption && `${rec.caption} @ `}{rec.score.toFixed(2)}
                    </span>
                  )}
                </div>
                {rec.reason && <p className="text-xs text-gray-400">{rec.reason}</p>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Render a single section with proper styling
function NarrativeSection({ title, content, isFirst }) {
  // Normalize title for config lookup
  const normalizedTitle = title.toUpperCase().trim();

  const config = SECTION_CONFIG[normalizedTitle] || {
    icon: Eye,
    bgClass: 'bg-gray-500/10',
    borderClass: 'border-gray-500/30',
    iconClass: 'text-gray-400',
    titleClass: 'text-gray-400',
  };

  const Icon = config.icon;

  // Check if this is a recommendations section
  const isRecommendationsSection =
    normalizedTitle === 'CAPTION PICKS' ||
    normalizedTitle === 'FANTASY RECOMMENDATIONS';

  if (isRecommendationsSection) {
    const recs = parseRecommendations(content);
    const hasStructuredRecs = recs.buy.length > 0 || recs.hold.length > 0 || recs.sell.length > 0;

    return (
      <div className={`${config.bgClass} border ${config.borderClass} p-5 ${!isFirst ? 'mt-6' : ''}`}>
        <div className="flex items-center gap-2 mb-4">
          <Icon className={`w-5 h-5 ${config.iconClass}`} />
          <h3 className={`text-sm font-bold uppercase tracking-wider ${config.titleClass}`}>
            {normalizedTitle}
          </h3>
        </div>

        {hasStructuredRecs ? (
          <RecommendationList recs={recs} />
        ) : (
          // Fallback to formatted text if parsing fails
          <div className="text-base text-gray-300 leading-relaxed">
            {formatContent(content)}
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
          {normalizedTitle}
        </h3>
      </div>
      <div className="text-base text-gray-300 leading-relaxed">
        {formatContent(content)}
      </div>
    </div>
  );
}

// Format content - handle paragraphs and clean up markdown artifacts
function formatContent(content) {
  if (!content) return null;

  // Clean up markdown artifacts
  let cleaned = content
    .replace(/\*\*/g, '')  // Remove bold markdown
    .replace(/\*/g, '')    // Remove italic markdown
    .trim();

  // Split into paragraphs and render
  const paragraphs = cleaned.split(/\n\n+/).filter(p => p.trim());

  if (paragraphs.length === 1) {
    return <p>{paragraphs[0]}</p>;
  }

  return (
    <div className="space-y-4">
      {paragraphs.map((para, idx) => (
        <p key={idx}>{para}</p>
      ))}
    </div>
  );
}

// Parse sections from narrative text
function parseSections(narrative) {
  const sections = [];

  // Build regex pattern for all known section headers
  const sectionHeaders = Object.keys(SECTION_CONFIG);

  // Pattern 1: Plain text headers (e.g., "THE BIG PICTURE")
  // Pattern 2: Markdown bold headers (e.g., "**GENERAL EFFECT**")
  const headerPatterns = sectionHeaders.map(h => {
    const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return `(?:\\*\\*${escaped}\\*\\*|${escaped})`;
  });

  const combinedPattern = new RegExp(
    `(${headerPatterns.join('|')})`,
    'gi'
  );

  // Find all matches
  const matches = [...narrative.matchAll(combinedPattern)];

  if (matches.length === 0) {
    return null; // No sections found
  }

  // Check for intro content before first section
  if (matches[0].index > 0) {
    const introContent = narrative.substring(0, matches[0].index).trim();
    if (introContent && introContent.length > 20) {
      sections.push({
        title: 'INTRODUCTION',
        content: introContent,
        isIntro: true,
      });
    }
  }

  // Extract each section
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const nextMatch = matches[i + 1];
    const headerEnd = match.index + match[0].length;
    const contentEnd = nextMatch ? nextMatch.index : narrative.length;

    // Clean up header (remove ** markdown)
    let title = match[0].replace(/\*\*/g, '').trim();

    // Get content between this header and next
    let content = narrative.substring(headerEnd, contentEnd).trim();

    // Clean up content - remove leading colons, newlines
    content = content.replace(/^[\n\r:]+/, '').trim();

    if (content) {
      sections.push({
        title: title.toUpperCase(),
        content,
      });
    }
  }

  return sections;
}

/**
 * ArticleNarrativeParser - Parses and renders narrative with visual sections
 * @param {string} narrative - The full narrative text
 * @param {string} summary - The article summary (shown if narrative unavailable)
 * @param {string} articleType - The article type (for type-specific handling)
 */
export default function ArticleNarrativeParser({ narrative, summary, articleType }) {
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

  // Try to parse sections
  const sections = parseSections(narrative);

  if (!sections || sections.length === 0) {
    // No sections found, render as plain paragraphs
    return (
      <div className="prose prose-invert prose-lg max-w-none">
        {narrative.split('\n\n').map((paragraph, idx) => (
          <p key={idx} className="text-base md:text-lg text-gray-300 leading-relaxed mb-6">
            {paragraph.replace(/\*\*/g, '')}
          </p>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {sections.map((section, idx) => {
        if (section.isIntro) {
          // Render intro without special styling
          return (
            <div key={idx} className="text-base text-gray-300 leading-relaxed mb-6">
              {formatContent(section.content)}
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
