// src/components/ShowConcept/ShowConceptSelector.jsx
// Configuration Terminal style: Compact tiles, synergy output, manual accordion
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Music, Palette, Target, Sparkles, Check, Info, ChevronRight,
  Zap, Star
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import toast from 'react-hot-toast';

const SHOW_THEMES = [
  { value: 'classical', label: 'Classical/Orchestral', shortLabel: 'Classical', tags: ['classical', 'traditional', 'elegant'] },
  { value: 'jazz', label: 'Jazz/Swing', shortLabel: 'Jazz', tags: ['jazz', 'improvisational', 'energetic'] },
  { value: 'rock', label: 'Rock/Modern', shortLabel: 'Rock', tags: ['modern', 'bold', 'energetic'] },
  { value: 'latin', label: 'Latin/World', shortLabel: 'Latin', tags: ['cultural', 'rhythmic', 'vibrant'] },
  { value: 'cinematic', label: 'Cinematic/Film', shortLabel: 'Cinematic', tags: ['emotional', 'dramatic', 'storytelling'] },
  { value: 'abstract', label: 'Abstract/Conceptual', shortLabel: 'Abstract', tags: ['innovative', 'artistic', 'experimental'] },
  { value: 'patriotic', label: 'Patriotic/Americana', shortLabel: 'Patriotic', tags: ['traditional', 'powerful', 'emotional'] },
  { value: 'electronic', label: 'Electronic/Synthesized', shortLabel: 'Electronic', tags: ['modern', 'innovative', 'bold'] },
  { value: 'broadway', label: 'Broadway/Musical Theater', shortLabel: 'Broadway', tags: ['theatrical', 'storytelling', 'dramatic'] }
];

const MUSIC_SOURCES = [
  { value: 'original', label: 'Original Composition', shortLabel: 'Original', tags: ['innovative', 'unique', 'artistic'] },
  { value: 'arranged', label: 'Arranged Classical', shortLabel: 'Arranged', tags: ['traditional', 'classical', 'elegant'] },
  { value: 'popular', label: 'Popular Music', shortLabel: 'Popular', tags: ['modern', 'accessible', 'energetic'] },
  { value: 'film', label: 'Film Score', shortLabel: 'Film', tags: ['cinematic', 'emotional', 'dramatic'] },
  { value: 'mixed', label: 'Mixed/Eclectic', shortLabel: 'Mixed', tags: ['diverse', 'innovative', 'bold'] }
];

const DRILL_STYLES = [
  { value: 'traditional', label: 'Traditional/Symmetrical', shortLabel: 'Traditional', tags: ['traditional', 'precise', 'elegant'] },
  { value: 'asymmetrical', label: 'Asymmetrical/Modern', shortLabel: 'Asymmetric', tags: ['modern', 'innovative', 'artistic'] },
  { value: 'curvilinear', label: 'Curvilinear/Flowing', shortLabel: 'Curvilinear', tags: ['fluid', 'elegant', 'artistic'] },
  { value: 'angular', label: 'Angular/Geometric', shortLabel: 'Angular', tags: ['bold', 'precise', 'dramatic'] },
  { value: 'scatter', label: 'Scatter/Organic', shortLabel: 'Scatter', tags: ['innovative', 'dynamic', 'experimental'] },
  { value: 'dance', label: 'Dance/Movement-Heavy', shortLabel: 'Dance', tags: ['theatrical', 'energetic', 'vibrant'] }
];

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
  diverse: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

// Caption info for synergy breakdown
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

const CAPTION_ORDER = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

// Get default corps tags based on era/name
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
 * Selectable Tile Component
 */
const SelectableTile = ({ item, selected, onClick, icon: Icon, iconColor }) => (
  <button
    onClick={onClick}
    className={`p-2 rounded-lg border text-left transition-all ${
      selected
        ? 'border-gold-500 text-gold-400 bg-gold-500/10'
        : 'border-white/10 text-cream/40 hover:border-white/20 hover:text-cream/60'
    }`}
  >
    <div className="flex items-center gap-1.5">
      {selected && <Check className="w-3 h-3 text-gold-400" />}
      <span className="text-xs font-mono font-medium truncate">{item.shortLabel}</span>
    </div>
  </button>
);

/**
 * Caption Synergy Row Component
 */
const CaptionSynergyRow = ({ caption, corpsValue, showTags, captionBonus }) => {
  if (!corpsValue) return null;

  const [corpsName, sourceYear] = corpsValue.split('|');
  const corpsTags = getDefaultCorpsTags(corpsName, sourceYear);
  const matchingTags = showTags.filter(tag => corpsTags.includes(tag));
  const matchRatio = showTags.length > 0 ? matchingTags.length / showTags.length : 0;

  const getMatchColor = () => {
    if (matchRatio >= 0.7) return 'green';
    if (matchRatio >= 0.4) return 'yellow';
    if (matchRatio > 0) return 'orange';
    return 'red';
  };

  const matchColor = getMatchColor();
  const CaptionIcon = CAPTION_INFO[caption]?.icon || Music;

  return (
    <div className="flex items-center gap-2 py-1.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-1.5 w-12">
        <CaptionIcon className="w-3 h-3 text-cream/40" />
        <span className="text-[10px] font-mono font-bold text-cream/60">{caption}</span>
      </div>
      <div className="flex-1 min-w-0">
        <span className="text-[10px] text-cream/50 truncate block">{corpsName}</span>
      </div>
      <div className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
        matchColor === 'green' ? 'bg-green-500/20 text-green-400' :
        matchColor === 'yellow' ? 'bg-yellow-500/20 text-yellow-400' :
        matchColor === 'orange' ? 'bg-orange-500/20 text-orange-400' :
        'bg-red-500/20 text-red-400'
      }`}>
        {matchingTags.length}/{showTags.length}
      </div>
      <span className={`text-xs font-mono font-bold w-12 text-right ${captionBonus > 0 ? 'text-gold-400' : 'text-cream/30'}`}>
        +{captionBonus.toFixed(2)}
      </span>
    </div>
  );
};

const ShowConceptSelector = ({
  corpsClass,
  currentConcept = {},
  lineup = {},
  onSave,
  compact = false
}) => {
  const [theme, setTheme] = useState(currentConcept?.theme || '');
  const [musicSource, setMusicSource] = useState(currentConcept?.musicSource || '');
  const [drillStyle, setDrillStyle] = useState(currentConcept?.drillStyle || '');
  const [saving, setSaving] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);

  // Only sync from props when the actual values change
  useEffect(() => {
    if (currentConcept?.theme) setTheme(currentConcept.theme);
    if (currentConcept?.musicSource) setMusicSource(currentConcept.musicSource);
    if (currentConcept?.drillStyle) setDrillStyle(currentConcept.drillStyle);
  }, [currentConcept?.theme, currentConcept?.musicSource, currentConcept?.drillStyle]);

  // Get all unique tags from current selections
  const getSelectedTags = () => {
    const tags = new Set();

    if (theme) {
      const themeData = SHOW_THEMES.find(t => t.value === theme);
      themeData?.tags.forEach(tag => tags.add(tag));
    }

    if (musicSource) {
      const sourceData = MUSIC_SOURCES.find(s => s.value === musicSource);
      sourceData?.tags.forEach(tag => tags.add(tag));
    }

    if (drillStyle) {
      const styleData = DRILL_STYLES.find(d => d.value === drillStyle);
      styleData?.tags.forEach(tag => tags.add(tag));
    }

    return [...tags];
  };

  // Calculate synergy breakdown
  const synergySummary = useMemo(() => {
    const showTags = getSelectedTags();

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
  }, [theme, musicSource, drillStyle, lineup]);

  const handleSave = async () => {
    if (!theme || !musicSource || !drillStyle) {
      toast.error('Please select all three show concept options');
      return;
    }

    setSaving(true);
    try {
      const saveShowConcept = httpsCallable(functions, 'saveShowConcept');
      await saveShowConcept({
        corpsClass,
        showConcept: { theme, musicSource, drillStyle }
      });

      toast.success('Show concept saved! Synergy bonuses will apply to your scores.');

      if (onSave) {
        onSave({ theme, musicSource, drillStyle });
      }
    } catch (error) {
      console.error('Error saving show concept:', error);
      toast.error('Failed to save show concept');
    } finally {
      setSaving(false);
    }
  };

  const isComplete = theme && musicSource && drillStyle;
  const hasChanges = theme !== (currentConcept.theme || '') ||
                     musicSource !== (currentConcept.musicSource || '') ||
                     drillStyle !== (currentConcept.drillStyle || '');
  const selectedTags = getSelectedTags();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1.0] }}
      className="space-y-4"
    >
      {/* Synergy Output Section */}
      <div className="glass-slot">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold-400" />
            <span className="section-label mb-0">Synergy Output</span>
          </div>
          {isComplete && !hasChanges && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/20 border border-green-500/30">
              <Check className="w-3 h-3 text-green-400" />
              <span className="text-[9px] font-bold text-green-400 uppercase">Saved</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div className="text-[10px] text-cream/50">Total Caption Bonus</div>
          <div className="text-2xl font-mono font-bold text-gold-400" style={{ textShadow: '0 0 15px rgba(255, 215, 0, 0.4)' }}>
            +{synergySummary.totalBonus.toFixed(2)}
          </div>
        </div>
        {/* Caption Breakdown */}
        {Object.keys(lineup || {}).length > 0 && selectedTags.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-[9px] text-cream/40 uppercase mb-2">Caption Breakdown</div>
            <div className="space-y-0">
              {CAPTION_ORDER.filter(caption => lineup?.[caption]).map(caption => (
                <CaptionSynergyRow
                  key={caption}
                  caption={caption}
                  corpsValue={lineup[caption]}
                  showTags={selectedTags}
                  captionBonus={synergySummary.captionBonuses[caption] || 0}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Theme Selector - Grid Tiles */}
      <div className="glass-slot">
        <div className="flex items-center gap-2 mb-2">
          <Music className="w-3.5 h-3.5 text-purple-400" />
          <span className="section-label mb-0">Theme</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {SHOW_THEMES.map(t => (
            <SelectableTile
              key={t.value}
              item={t}
              selected={theme === t.value}
              onClick={() => setTheme(t.value)}
              icon={Music}
              iconColor="text-purple-400"
            />
          ))}
        </div>
      </div>

      {/* Music Source Selector - Grid Tiles */}
      <div className="glass-slot">
        <div className="flex items-center gap-2 mb-2">
          <Palette className="w-3.5 h-3.5 text-blue-400" />
          <span className="section-label mb-0">Music Source</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MUSIC_SOURCES.map(s => (
            <SelectableTile
              key={s.value}
              item={s}
              selected={musicSource === s.value}
              onClick={() => setMusicSource(s.value)}
              icon={Palette}
              iconColor="text-blue-400"
            />
          ))}
        </div>
      </div>

      {/* Drill Style Selector - Grid Tiles */}
      <div className="glass-slot">
        <div className="flex items-center gap-2 mb-2">
          <Target className="w-3.5 h-3.5 text-green-400" />
          <span className="section-label mb-0">Drill Style</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {DRILL_STYLES.map(d => (
            <SelectableTile
              key={d.value}
              item={d}
              selected={drillStyle === d.value}
              onClick={() => setDrillStyle(d.value)}
              icon={Target}
              iconColor="text-green-400"
            />
          ))}
        </div>
      </div>

      {/* Active Tags - Compact Row */}
      {selectedTags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] text-cream/40 uppercase">Tags:</span>
          {selectedTags.map(tag => (
            <span
              key={tag}
              className={`text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase ${TAG_COLORS[tag] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Save Button */}
      {hasChanges && (
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={handleSave}
          disabled={saving || !isComplete}
          whileHover={!saving && isComplete ? { scale: 1.01 } : {}}
          whileTap={!saving && isComplete ? { scale: 0.99 } : {}}
          className={`
            w-full py-3 rounded-lg font-display font-bold uppercase tracking-wide
            transition-all duration-200
            ${saving || !isComplete
              ? 'bg-white/10 text-cream/40 cursor-not-allowed'
              : 'bg-gold-500 text-charcoal-900 hover:bg-gold-400 shadow-gold-glow-sm'
            }
          `}
        >
          {saving ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
              Saving...
            </span>
          ) : (
            'Save Configuration'
          )}
        </motion.button>
      )}

      {/* Manual Accordion - Help Text */}
      {!compact && (
        <div className="accordion-section">
          <button
            onClick={() => setManualOpen(!manualOpen)}
            className="accordion-header"
          >
            <span>Manual</span>
            <ChevronRight className={`accordion-chevron ${manualOpen ? 'open' : ''}`} />
          </button>
          <AnimatePresence>
            {manualOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="p-3 border-t border-white/5">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-cream/40 flex-shrink-0 mt-0.5" />
                    <div className="text-[11px] text-cream/50 leading-relaxed">
                      <span className="text-cream/70 font-medium">How synergy works:</span> Your show concept generates tags that are compared against your corps lineup. Each caption compares its corps' historical style tags against your show concept tags. More tag matches = higher bonus (up to +1.0 per caption, +8.0 total).
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
};

export default ShowConceptSelector;
