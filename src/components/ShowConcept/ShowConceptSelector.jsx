// src/components/ShowConcept/ShowConceptSelector.jsx
// Dashboard-aligned styling: glassmorphism, compact typography, data colors
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Music, Palette, Target, Sparkles, Check, Info, ChevronDown
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import toast from 'react-hot-toast';

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

// Tag color mapping for visual consistency (matches SynergyVisualization)
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

const ShowConceptSelector = ({
  corpsClass,
  currentConcept = {},
  onSave,
  compact = false
}) => {
  const [theme, setTheme] = useState(currentConcept?.theme || '');
  const [musicSource, setMusicSource] = useState(currentConcept?.musicSource || '');
  const [drillStyle, setDrillStyle] = useState(currentConcept?.drillStyle || '');
  const [saving, setSaving] = useState(false);

  // Only sync from props when the actual values change, not the object reference
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gold-500/20">
            <Sparkles className="w-5 h-5 text-gold-400" />
          </div>
          <div>
            <h3 className="font-display font-bold text-cream uppercase tracking-wide">
              Show Concept
            </h3>
            <p className="text-[10px] text-cream-muted">Configure your show's style for synergy bonuses</p>
          </div>
        </div>
        {isComplete && !hasChanges && (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-green-500/20 border border-green-500/30">
            <Check className="w-3.5 h-3.5 text-green-400" />
            <span className="text-[10px] font-bold text-green-400 uppercase">Configured</span>
          </div>
        )}
      </div>

      {/* Selection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Theme */}
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 hover:border-white/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Music className="w-4 h-4 text-purple-400" />
            <span className="text-[10px] font-display font-bold text-cream-muted uppercase tracking-wide">Theme</span>
          </div>
          <div className="relative">
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-cream appearance-none cursor-pointer focus:outline-none focus:border-gold-500/50 transition-colors"
            >
              <option value="" className="bg-charcoal-900">Select theme...</option>
              {SHOW_THEMES.map(t => (
                <option key={t.value} value={t.value} className="bg-charcoal-900">{t.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-muted pointer-events-none" />
          </div>
          {theme && (
            <div className="mt-2 flex flex-wrap gap-1">
              {SHOW_THEMES.find(t => t.value === theme)?.tags.map(tag => (
                <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase ${TAG_COLORS[tag] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Music Source */}
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 hover:border-white/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Palette className="w-4 h-4 text-blue-400" />
            <span className="text-[10px] font-display font-bold text-cream-muted uppercase tracking-wide">Music Source</span>
          </div>
          <div className="relative">
            <select
              value={musicSource}
              onChange={(e) => setMusicSource(e.target.value)}
              className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-cream appearance-none cursor-pointer focus:outline-none focus:border-gold-500/50 transition-colors"
            >
              <option value="" className="bg-charcoal-900">Select source...</option>
              {MUSIC_SOURCES.map(s => (
                <option key={s.value} value={s.value} className="bg-charcoal-900">{s.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-muted pointer-events-none" />
          </div>
          {musicSource && (
            <div className="mt-2 flex flex-wrap gap-1">
              {MUSIC_SOURCES.find(s => s.value === musicSource)?.tags.map(tag => (
                <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase ${TAG_COLORS[tag] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Drill Style */}
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3 hover:border-white/20 transition-colors">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-green-400" />
            <span className="text-[10px] font-display font-bold text-cream-muted uppercase tracking-wide">Drill Style</span>
          </div>
          <div className="relative">
            <select
              value={drillStyle}
              onChange={(e) => setDrillStyle(e.target.value)}
              className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-lg text-sm text-cream appearance-none cursor-pointer focus:outline-none focus:border-gold-500/50 transition-colors"
            >
              <option value="" className="bg-charcoal-900">Select style...</option>
              {DRILL_STYLES.map(d => (
                <option key={d.value} value={d.value} className="bg-charcoal-900">{d.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-muted pointer-events-none" />
          </div>
          {drillStyle && (
            <div className="mt-2 flex flex-wrap gap-1">
              {DRILL_STYLES.find(d => d.value === drillStyle)?.tags.map(tag => (
                <span key={tag} className={`text-[9px] px-1.5 py-0.5 rounded border font-mono uppercase ${TAG_COLORS[tag] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}>
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Combined Synergy Tags */}
      {selectedTags.length > 0 && (
        <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-display font-bold text-cream-muted uppercase tracking-wide">
              Combined Synergy Tags
            </span>
            <span className="text-[10px] font-mono font-bold text-data-gold">
              {selectedTags.length} tags active
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedTags.map(tag => (
              <span
                key={tag}
                className={`text-[10px] px-2 py-1 rounded border font-mono uppercase ${TAG_COLORS[tag] || 'bg-gray-500/20 text-gray-400 border-gray-500/30'}`}
              >
                {tag}
              </span>
            ))}
          </div>
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
            'Save Show Concept'
          )}
        </motion.button>
      )}

      {/* Info Panel */}
      {!compact && (
        <div className="p-3 rounded-lg bg-black/40 backdrop-blur-md border border-white/10">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-cream-muted flex-shrink-0 mt-0.5" />
            <div className="text-[11px] text-cream/50">
              <span className="text-cream/70 font-medium">How synergy works:</span> Your show concept generates tags that are compared against your corps lineup. More tag matches = higher bonus points (up to +8.0 total).
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ShowConceptSelector;
