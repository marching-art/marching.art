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

  // Match patterns for emoji-prefixed recommendations (capture until next emoji or end)
  const buyMatch = content.match(/🟢\s*BUY[^:]*:?\s*([\s\S]*?)(?=🟡|🔴|$)/i);
  const holdMatch = content.match(/🟡\s*HOLD[^:]*:?\s*([\s\S]*?)(?=🟢|🔴|$)/i);
  const sellMatch = content.match(/🔴\s*SELL[^:]*:?\s*([\s\S]*?)(?=🟢|🟡|$)/i);

  const parseItems = (text) => {
    if (!text) return [];
    const items = [];

    // Pattern: "- Corps Caption @ Score ↑/↓/→ - Reason"
    // Example: "- Music City GE1 @ 14.80 ↑ - Music City has shown..."
    const lines = text.split(/(?=\s*-\s+[A-Z])/);

    for (const line of lines) {
      // Match: - Corps Caption @ Score (optional arrow) - Reason
      const match = line.match(/^-\s*([A-Za-z][A-Za-z\s]+?)(?:\s+([A-Z]{1,3}\d?))\s*@\s*([\d.]+)\s*[↑↓→]?\s*(?:-\s*)?(.*)$/s);

      if (match) {
        const corps = match[1].trim();
        const caption = match[2]?.trim() || '';
        const score = parseFloat(match[3]) || 0;
        const reason = match[4]?.trim().replace(/^-\s*/, '') || '';

        if (corps.length > 2) {
          items.push({ corps, caption, score, reason });
        }
      }
    }
    return items;
  };

  if (buyMatch) recommendations.buy = parseItems(buyMatch[1]);
  if (holdMatch) recommendations.hold = parseItems(holdMatch[1]);
  if (sellMatch) recommendations.sell = parseItems(sellMatch[1]);

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

// Render a single section with proper styling (Fantasy style - colored boxes)
function FantasyNarrativeSection({ title, content, isFirst }) {
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

// Parse sections from narrative text - ONLY for fantasy articles
function parseSections(narrative) {
  const sections = [];

  // Only use fantasy-specific headers (DCI articles use editorial style, no parsing)
  const fantasyHeaders = [
    'THE BIG PICTURE',
    'GENERAL EFFECT BREAKDOWN',
    'VISUAL CAPTIONS',
    'MUSIC CAPTIONS',
    'CAPTION PICKS',
    'SLEEPER PICK',
  ];

  // Build pattern that matches headers at start of line
  const headerPatterns = fantasyHeaders.map(h => {
    const escaped = h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return escaped;
  });

  // Match headers that appear at start of a line (after newline or start of string)
  const combinedPattern = new RegExp(
    `(?:^|\\n)\\s*(${headerPatterns.join('|')})\\s*(?:\\n|$)`,
    'gim'
  );

  // Find all matches
  const matches = [...narrative.matchAll(combinedPattern)];

  if (matches.length === 0) {
    return null; // No sections found
  }

  // Check for intro content before first section
  if (matches[0].index > 0) {
    let introContent = narrative.substring(0, matches[0].index).trim();
    // Clean up markdown headers like "## Title"
    introContent = introContent.replace(/^#+\s+.*$/gm, '').trim();
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

    // Get the actual header name from capture group
    let title = match[1].trim().toUpperCase();

    // Get content between this header and next
    let content = narrative.substring(headerEnd, contentEnd).trim();

    // Clean up content - remove leading colons, newlines
    content = content.replace(/^[\n\r:]+/, '').trim();

    if (content && content.length > 10) {
      sections.push({
        title,
        content,
      });
    }
  }

  return sections.length > 0 ? sections : null;
}

// Check if article type is a DCI article (editorial style)
function isDCIArticle(articleType) {
  return ['dci_recap', 'dci_daily', 'dci_feature'].includes(articleType);
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

  // DCI articles use clean editorial style - no section parsing, just clean prose
  if (isDCIArticle(articleType)) {
    return (
      <div className="prose prose-invert prose-lg max-w-none">
        {formatEditorialContent(narrative)}
      </div>
    );
  }

  // Fantasy articles get section parsing with colorful boxes
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
          // Render intro without special styling, clean up any markdown headers
          const cleanedIntro = section.content.replace(/^#+\s+.*$/gm, '').trim();
          if (!cleanedIntro) return null;
          return (
            <div key={idx} className="text-base text-gray-300 leading-relaxed mb-6">
              {formatContent(cleanedIntro)}
            </div>
          );
        }
        return (
          <FantasyNarrativeSection
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

// Format editorial content - clean paragraphs with styled inline headers
function formatEditorialContent(narrative) {
  // Clean up markdown
  let cleaned = narrative
    .replace(/\*\*/g, '')  // Remove bold markdown
    .replace(/\*/g, '')    // Remove italic markdown
    .trim();

  // Split into paragraphs
  const paragraphs = cleaned.split(/\n\n+/).filter(p => p.trim());

  return paragraphs.map((para, idx) => (
    <p key={idx} className="text-base md:text-lg text-gray-300 leading-relaxed mb-6">
      {para}
    </p>
  ));
}
