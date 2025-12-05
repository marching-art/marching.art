// src/components/Execution/TransparentGameplay/SynergyVisualization.jsx
// Synergy System Visualization - Show Concept to Corps Matching
// Exposes: theme tags, music source tags, drill style tags, per-caption bonuses

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Music, Palette, Move, ChevronDown, ChevronUp,
  CheckCircle, XCircle, Info, Tag, Zap, Star, Target
} from 'lucide-react';

// ============================================================================
// SHOW CONCEPT DATA (must match backend showConceptSynergy.js)
// ============================================================================
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

// Caption display info
const CAPTION_INFO = {
  GE1: { label: 'GE1', fullName: 'General Effect 1', icon: Zap },
  GE2: { label: 'GE2', fullName: 'General Effect 2', icon: Zap },
  VP: { label: 'VP', fullName: 'Visual Performance', icon: Star },
  VA: { label: 'VA', fullName: 'Visual Analysis', icon: Target },
  CG: { label: 'CG', fullName: 'Color Guard', icon: Star },
  B: { label: 'B', fullName: 'Brass', icon: Music },
  MA: { label: 'MA', fullName: 'Music Analysis', icon: Target },
  P: { label: 'P', fullName: 'Percussion', icon: Music }
};

// Caption order (matches CaptionSelectionModal)
const CAPTION_ORDER = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

// Tag color mapping for visual consistency
const TAG_COLORS = {
  classical: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  traditional: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  elegant: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  modern: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  bold: 'bg-red-500/20 text-red-400 border-red-500/30',
  energetic: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  innovative: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  artistic: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  dramatic: 'bg-red-500/20 text-red-400 border-red-500/30',
  emotional: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
  storytelling: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  theatrical: 'bg-fuchsia-500/20 text-fuchsia-400 border-fuchsia-500/30',
  experimental: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  precise: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  powerful: 'bg-red-500/20 text-red-400 border-red-500/30',
  vibrant: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  rhythmic: 'bg-green-500/20 text-green-400 border-green-500/30',
  cultural: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  fluid: 'bg-sky-500/20 text-sky-400 border-sky-500/30',
  dynamic: 'bg-lime-500/20 text-lime-400 border-lime-500/30',
  jazz: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  improvisational: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  unique: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
  accessible: 'bg-green-500/20 text-green-400 border-green-500/30',
  cinematic: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
  diverse: 'bg-rainbow text-white border-white/30',
};

/**
 * Tag Badge Component
 */
const TagBadge = ({ tag, isMatched = false, size = 'sm' }) => {
  const colorClass = TAG_COLORS[tag] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  const sizeClass = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-1';

  return (
    <span className={`inline-flex items-center gap-1 rounded border font-mono uppercase ${colorClass} ${sizeClass} ${isMatched ? 'ring-1 ring-green-400' : ''}`}>
      {isMatched && <CheckCircle className="w-2.5 h-2.5" />}
      {tag}
    </span>
  );
};

/**
 * Get all tags from show concept
 */
const getShowConceptTags = (showConcept) => {
  if (!showConcept || typeof showConcept !== 'object') return [];

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

  return [...new Set(tags)]; // Unique tags
};

/**
 * Get default corps tags based on era/name
 */
const getDefaultCorpsTags = (corpsName, sourceYear) => {
  const year = parseInt(sourceYear);
  const tags = [];

  if (year < 2000) {
    tags.push('traditional', 'classical');
  } else if (year < 2010) {
    tags.push('modern', 'innovative');
  } else {
    tags.push('modern', 'innovative', 'artistic');
  }

  const modernCorps = ['Blue Devils', 'Carolina Crown', 'Bluecoats', 'Santa Clara Vanguard'];
  const traditionalCorps = ['Cavaliers', 'Blue Knights', 'Madison Scouts'];
  const artisticCorps = ['Santa Clara Vanguard', 'Phantom Regiment', 'Blue Devils'];

  if (modernCorps.some(name => corpsName?.includes(name))) {
    tags.push('bold', 'energetic');
  }
  if (traditionalCorps.some(name => corpsName?.includes(name))) {
    tags.push('precise', 'powerful');
  }
  if (artisticCorps.some(name => corpsName?.includes(name))) {
    tags.push('artistic', 'dramatic');
  }

  return [...new Set(tags)];
};

/**
 * Caption Synergy Card
 */
const CaptionSynergyCard = ({ caption, corpsValue, showTags }) => {
  const [expanded, setExpanded] = useState(false);

  if (!corpsValue) return null;

  // Parse corps value: "Blue Devils|2014|20" (corpsName|sourceYear|points)
  const [corpsName, sourceYear, points] = corpsValue.split('|');
  const corpsTags = getDefaultCorpsTags(corpsName, sourceYear);

  // Calculate matching tags
  const matchingTags = showTags.filter(tag => corpsTags.includes(tag));
  const matchRatio = showTags.length > 0 ? matchingTags.length / showTags.length : 0;
  const synergyBonus = matchRatio * 1.0; // 0-1.0 bonus points

  const CaptionIcon = CAPTION_INFO[caption]?.icon || Music;

  const getMatchColor = () => {
    if (matchRatio >= 0.7) return 'green';
    if (matchRatio >= 0.4) return 'yellow';
    if (matchRatio > 0) return 'orange';
    return 'red';
  };

  const matchColor = getMatchColor();

  return (
    <motion.div
      layout
      className="glass-dark rounded-lg overflow-hidden"
    >
      <div
        className="p-3 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          {/* Caption badge */}
          <div className="flex items-center gap-2 min-w-[80px]">
            <CaptionIcon className="w-4 h-4 text-cream-muted" />
            <span className="text-xs font-mono font-bold text-cream">{caption}</span>
          </div>

          {/* Corps name */}
          <div className="flex-1 min-w-0">
            <div className="text-sm text-cream truncate">{corpsName}</div>
            <div className="text-[10px] text-cream-muted">{sourceYear}</div>
          </div>

          {/* Match indicator */}
          <div className="flex items-center gap-2">
            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg ${
              matchColor === 'green' ? 'bg-green-500/20' :
              matchColor === 'yellow' ? 'bg-yellow-500/20' :
              matchColor === 'orange' ? 'bg-orange-500/20' :
              'bg-red-500/20'
            }`}>
              <span className={`text-xs font-mono font-bold ${
                matchColor === 'green' ? 'text-green-400' :
                matchColor === 'yellow' ? 'text-yellow-400' :
                matchColor === 'orange' ? 'text-orange-400' :
                'text-red-400'
              }`}>
                {matchingTags.length}/{showTags.length}
              </span>
            </div>
            <div className={`font-mono font-bold ${synergyBonus > 0 ? 'text-gold-400' : 'text-cream-muted'}`}>
              +{synergyBonus.toFixed(2)}
            </div>
            <ChevronDown className={`w-4 h-4 text-cream-muted transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      {/* Expanded tag matching view */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 space-y-3">
              {/* Your show tags */}
              <div>
                <div className="text-[10px] text-cream-muted uppercase mb-1.5">Your Show Tags</div>
                <div className="flex flex-wrap gap-1">
                  {showTags.map(tag => (
                    <TagBadge
                      key={tag}
                      tag={tag}
                      isMatched={matchingTags.includes(tag)}
                    />
                  ))}
                </div>
              </div>

              {/* Corps tags */}
              <div>
                <div className="text-[10px] text-cream-muted uppercase mb-1.5">{corpsName} Tags</div>
                <div className="flex flex-wrap gap-1">
                  {corpsTags.map(tag => (
                    <TagBadge
                      key={tag}
                      tag={tag}
                      isMatched={matchingTags.includes(tag)}
                    />
                  ))}
                </div>
              </div>

              {/* Match summary */}
              <div className="flex items-center justify-between pt-2 border-t border-white/10">
                <span className="text-[10px] text-cream-muted">
                  {matchingTags.length} matching × {(1.0 / showTags.length).toFixed(3)} per tag
                </span>
                <span className="font-mono font-bold text-gold-400">
                  +{synergyBonus.toFixed(3)} points
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * Main Synergy Visualization Component
 */
export const SynergyVisualization = ({
  showConcept,
  lineup,
  showDetails = true
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate all synergy data
  const synergySummary = useMemo(() => {
    const showTags = getShowConceptTags(showConcept);

    if (showTags.length === 0) {
      return { showTags: [], totalBonus: 0, captionBonuses: {}, hasShowConcept: false };
    }

    const captionBonuses = {};
    let totalBonus = 0;

    for (const [caption, corpsValue] of Object.entries(lineup || {})) {
      if (!corpsValue) continue;

      const [corpsName, sourceYear] = corpsValue.split('|');
      const corpsTags = getDefaultCorpsTags(corpsName, sourceYear);
      const matchingTags = showTags.filter(tag => corpsTags.includes(tag));
      const matchRatio = showTags.length > 0 ? matchingTags.length / showTags.length : 0;
      const bonus = matchRatio * 1.0;

      captionBonuses[caption] = bonus;
      totalBonus += bonus;
    }

    return {
      showTags,
      totalBonus,
      captionBonuses,
      hasShowConcept: true
    };
  }, [showConcept, lineup]);

  // Get theme/source/style labels
  const themeName = SHOW_THEMES.find(t => t.value === showConcept?.theme)?.label || 'Not Set';
  const sourceName = MUSIC_SOURCES.find(s => s.value === showConcept?.musicSource)?.label || 'Not Set';
  const styleName = DRILL_STYLES.find(d => d.value === showConcept?.drillStyle)?.label || 'Not Set';

  if (!synergySummary.hasShowConcept) {
    return (
      <div className="glass-dark rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 rounded-lg bg-orange-500/20">
            <Sparkles className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="font-display font-bold text-cream uppercase">Show Concept Synergy</h3>
            <p className="text-xs text-cream-muted">0-8 bonus points available</p>
          </div>
        </div>
        <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
          <div className="flex items-center gap-2 text-orange-400">
            <Info className="w-4 h-4" />
            <span className="text-sm font-bold">No Show Concept Set</span>
          </div>
          <p className="text-xs text-cream-muted mt-1">
            Define your show's theme, music source, and drill style to unlock synergy bonuses with your lineup.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-dark rounded-xl overflow-hidden">
      {/* Header */}
      <div
        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gold-500/20">
              <Sparkles className="w-5 h-5 text-gold-400" />
            </div>
            <div>
              <h3 className="font-display font-bold text-cream uppercase">Show Concept Synergy</h3>
              <p className="text-xs text-cream-muted">{synergySummary.showTags.length} active tags</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-gold-400" style={{ textShadow: '0 0 15px rgba(255, 215, 0, 0.4)' }}>
                +{synergySummary.totalBonus.toFixed(2)}
              </div>
              <div className="text-[10px] text-cream-muted uppercase">Total Bonus</div>
            </div>
            <ChevronDown className={`w-5 h-5 text-cream-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Show concept summary */}
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2 rounded-lg bg-charcoal-800">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Palette className="w-3 h-3 text-purple-400" />
                    <span className="text-[9px] text-cream-muted uppercase">Theme</span>
                  </div>
                  <div className="text-xs text-cream font-medium truncate">{themeName}</div>
                </div>
                <div className="p-2 rounded-lg bg-charcoal-800">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Music className="w-3 h-3 text-blue-400" />
                    <span className="text-[9px] text-cream-muted uppercase">Music</span>
                  </div>
                  <div className="text-xs text-cream font-medium truncate">{sourceName}</div>
                </div>
                <div className="p-2 rounded-lg bg-charcoal-800">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Move className="w-3 h-3 text-green-400" />
                    <span className="text-[9px] text-cream-muted uppercase">Drill</span>
                  </div>
                  <div className="text-xs text-cream font-medium truncate">{styleName}</div>
                </div>
              </div>

              {/* Generated tags */}
              <div>
                <div className="text-[10px] text-cream-muted uppercase mb-2 flex items-center gap-1">
                  <Tag className="w-3 h-3" />
                  Your Show's Tags
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {synergySummary.showTags.map(tag => (
                    <TagBadge key={tag} tag={tag} size="md" />
                  ))}
                </div>
              </div>

              {/* Per-caption breakdown */}
              {showDetails && (
                <div className="space-y-2">
                  <div className="text-[10px] text-cream-muted uppercase">Caption Synergy Breakdown</div>
                  {CAPTION_ORDER.filter(caption => lineup?.[caption]).map(caption => (
                    <CaptionSynergyCard
                      key={caption}
                      caption={caption}
                      corpsValue={lineup[caption]}
                      showTags={synergySummary.showTags}
                    />
                  ))}
                </div>
              )}

              {/* Formula explanation */}
              <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-cream-muted">
                    <span className="text-blue-400 font-bold">How it works:</span> Each caption compares its corps' historical style tags against your show concept tags. More matches = higher bonus (up to +1.0 per caption, +8.0 total).
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SynergyVisualization;
