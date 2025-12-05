// src/components/ShowConcept/ShowConceptSelector.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Music, Palette, Target, Sparkles, Check, Info
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import toast from 'react-hot-toast';
import InfoTooltip from '../InfoTooltip';

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
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={compact ? "card p-4" : "card p-6"}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-gold-500" />
          <h3 className={`font-display font-bold text-cream-100 ${compact ? 'text-lg' : 'text-xl'}`}>
            Show Concept
          </h3>
          <InfoTooltip
            content="Design your show concept to earn synergy bonuses. When your selections match your corps' strengths, you'll score higher!"
            title="Show Concept Synergy"
          />
        </div>
        {isComplete && !hasChanges && (
          <span className="flex items-center gap-1 text-sm text-green-500">
            <Check className="w-4 h-4" />
            Configured
          </span>
        )}
      </div>

      <div className={`grid gap-4 ${compact ? 'grid-cols-1' : 'md:grid-cols-3'}`}>
        {/* Theme */}
        <div>
          <label className="flex items-center gap-2 text-sm text-cream-500/60 mb-2">
            <Music className="w-4 h-4" />
            Theme
          </label>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
            className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
          >
            <option value="">Select theme...</option>
            {SHOW_THEMES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Music Source */}
        <div>
          <label className="flex items-center gap-2 text-sm text-cream-500/60 mb-2">
            <Palette className="w-4 h-4" />
            Music Source
          </label>
          <select
            value={musicSource}
            onChange={(e) => setMusicSource(e.target.value)}
            className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
          >
            <option value="">Select source...</option>
            {MUSIC_SOURCES.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        {/* Drill Style */}
        <div>
          <label className="flex items-center gap-2 text-sm text-cream-500/60 mb-2">
            <Target className="w-4 h-4" />
            Drill Style
          </label>
          <select
            value={drillStyle}
            onChange={(e) => setDrillStyle(e.target.value)}
            className="w-full px-3 py-2 bg-charcoal-800 border border-charcoal-700 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500"
          >
            <option value="">Select style...</option>
            {DRILL_STYLES.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Synergy Tags Preview */}
      {selectedTags.length > 0 && (
        <div className="mt-4 p-3 bg-charcoal-900/50 rounded-lg">
          <p className="text-xs text-cream-500/60 mb-2">Synergy Tags (match with corps for bonuses):</p>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map(tag => (
              <span
                key={tag}
                className="px-2 py-1 bg-gold-500/20 border border-gold-500/30 rounded text-xs text-gold-400"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Save Button */}
      {hasChanges && (
        <div className="mt-4">
          <button
            onClick={handleSave}
            disabled={saving || !isComplete}
            className="w-full btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Show Concept'}
          </button>
        </div>
      )}

      {/* Info */}
      {!compact && (
        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-blue-400 mt-0.5" />
            <p className="text-xs text-cream-300">
              Your show concept creates synergy tags. When these tags match your selected corps' characteristics,
              you'll earn bonus points on each caption score. Choose wisely to maximize your performance!
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default ShowConceptSelector;
