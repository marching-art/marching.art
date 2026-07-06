// =============================================================================
// SHOW CONCEPT MODAL - per-season show design (theme / music / drill)
// =============================================================================
// Saves through the saveShowConcept callable; the nightly scorer awards
// per-caption synergy bonuses when the concept's tags match a lineup's corps
// (functions/src/helpers/showConceptSynergy.js). Concepts reset each season
// at rollover — a new season means a new show. Option lists mirror the
// backend's SHOW_THEMES / MUSIC_SOURCES / DRILL_STYLES — keep in sync.

import React, { useState } from 'react';
import { Palette, Music, Route, Sparkles, X } from 'lucide-react';
import toast from 'react-hot-toast';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { saveShowConcept } from '../../api/functions';

const SHOW_THEMES = [
  { value: 'classical', label: 'Classical / Orchestral' },
  { value: 'jazz', label: 'Jazz / Swing' },
  { value: 'rock', label: 'Rock / Modern' },
  { value: 'latin', label: 'Latin / World' },
  { value: 'cinematic', label: 'Cinematic / Film' },
  { value: 'abstract', label: 'Abstract / Conceptual' },
  { value: 'patriotic', label: 'Patriotic / Americana' },
  { value: 'electronic', label: 'Electronic / Synthesized' },
  { value: 'broadway', label: 'Broadway / Musical Theater' },
];

const MUSIC_SOURCES = [
  { value: 'original', label: 'Original Composition' },
  { value: 'arranged', label: 'Arranged Classical' },
  { value: 'popular', label: 'Popular Music' },
  { value: 'film', label: 'Film Score' },
  { value: 'mixed', label: 'Mixed / Eclectic' },
];

const DRILL_STYLES = [
  { value: 'traditional', label: 'Traditional / Symmetrical' },
  { value: 'asymmetrical', label: 'Asymmetrical / Modern' },
  { value: 'curvilinear', label: 'Curvilinear / Flowing' },
  { value: 'angular', label: 'Angular / Geometric' },
  { value: 'scatter', label: 'Scatter / Organic' },
  { value: 'dance', label: 'Dance / Movement-Heavy' },
];

const PickerGroup = ({ label, icon: Icon, options, value, onChange }) => (
  <div>
    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
      <Icon className="w-3 h-3 text-[#0057B8]" />
      {label}
    </p>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`px-2 py-2 text-[11px] text-left border transition-colors ${
            value === option.value
              ? 'border-[#0057B8] bg-[#0057B8]/10 text-white font-bold'
              : 'border-[#333] text-gray-400 hover:border-[#555] hover:text-gray-200'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  </div>
);

const ShowConceptModal = ({ onClose, corpsClass, corpsName, currentConcept }) => {
  useEscapeKey(onClose);

  // Tolerate the legacy free-text value some corps carry (a string can't
  // match the pickers, so it simply starts unselected)
  const existing = currentConcept && typeof currentConcept === 'object' ? currentConcept : {};
  const [theme, setTheme] = useState(existing.theme || null);
  const [musicSource, setMusicSource] = useState(existing.musicSource || null);
  const [drillStyle, setDrillStyle] = useState(existing.drillStyle || null);
  const [saving, setSaving] = useState(false);

  const complete = theme && musicSource && drillStyle;

  const handleSave = async () => {
    if (!complete) return;
    setSaving(true);
    try {
      await saveShowConcept({ corpsClass, showConcept: { theme, musicSource, drillStyle } });
      toast.success("Show concept saved — synergy bonuses apply at tonight's scoring!");
      onClose();
    } catch (error) {
      toast.error(error.message || 'Could not save show concept');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-show-concept"
      >
        <div
          className="w-full max-w-lg max-h-[85dvh] bg-[#1a1a1a] border border-[#333] rounded-sm flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222] flex-shrink-0">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-[#0057B8]" />
              <div>
                <h2
                  id="modal-title-show-concept"
                  className="text-xs font-bold uppercase tracking-wider text-gray-300"
                >
                  Design Your Show
                </h2>
                {corpsName && <p className="text-[10px] text-gray-500">{corpsName}</p>}
              </div>
            </div>
            <button onClick={onClose} className="p-1 text-gray-500 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            <p className="text-xs text-gray-400">
              Your show concept earns per-caption synergy bonuses at scoring when its style matches
              the corps in your lineup. It lasts one season — every new season is a new show.
            </p>
            <PickerGroup
              label="Theme"
              icon={Palette}
              options={SHOW_THEMES}
              value={theme}
              onChange={setTheme}
            />
            <PickerGroup
              label="Music Source"
              icon={Music}
              options={MUSIC_SOURCES}
              value={musicSource}
              onChange={setMusicSource}
            />
            <PickerGroup
              label="Drill Style"
              icon={Route}
              options={DRILL_STYLES}
              value={drillStyle}
              onChange={setDrillStyle}
            />
          </div>

          {/* Footer */}
          <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex items-center justify-between flex-shrink-0">
            <p className="text-[10px] text-gray-600">
              {complete ? 'Ready to take the field' : 'Pick a theme, music source, and drill style'}
            </p>
            <button
              onClick={handleSave}
              disabled={!complete || saving}
              className={`h-9 px-4 text-sm font-bold uppercase tracking-wider transition-colors ${
                complete
                  ? 'bg-[#0057B8] hover:bg-[#0066d6] text-white'
                  : 'bg-[#222] text-gray-600 cursor-not-allowed'
              }`}
            >
              {saving ? 'Saving...' : 'Save Concept'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  );
};

export default ShowConceptModal;
