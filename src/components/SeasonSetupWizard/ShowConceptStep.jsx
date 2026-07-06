// Season setup — Show Design step. Every season is a new show: concepts
// reset at rollover, so setup is the natural moment to name and style this
// season's program. Optional (skippable) — the concept stays editable from
// the season scorecard menu. Saves via the saveShowConcept callable; design
// bonuses are CorpsCoin-only and never touch competitive scores.

import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, ChevronRight, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { saveShowConcept } from '../../api/functions';
import {
  SHOW_THEMES,
  MUSIC_SOURCES,
  DRILL_STYLES,
  isStructuredConcept,
} from '../../utils/showConcept';
import { ALL_CLASSES, getCorpsClassName } from './constants';

const PickerRow = ({ label, options, value, onChange }) => (
  <div>
    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
      {label}
    </label>
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

const ShowConceptStep = ({ localUserProfile, onContinue }) => {
  // Every named corps can get a concept; default to the highest class
  const namedCorps = useMemo(
    () =>
      ALL_CLASSES.filter((classId) => localUserProfile?.corps?.[classId]?.corpsName).map(
        (classId) => ({ classId, corps: localUserProfile.corps[classId] })
      ),
    [localUserProfile]
  );

  const [selectedClass, setSelectedClass] = useState(namedCorps[0]?.classId || null);
  // Per-class draft state so switching corps doesn't lose picks
  const [drafts, setDrafts] = useState(() => {
    const initial = {};
    namedCorps.forEach(({ classId, corps }) => {
      const existing = isStructuredConcept(corps.showConcept) ? corps.showConcept : {};
      initial[classId] = {
        showName: existing.showName || '',
        theme: existing.theme || null,
        musicSource: existing.musicSource || null,
        drillStyle: existing.drillStyle || null,
        saved: isStructuredConcept(corps.showConcept),
      };
    });
    return initial;
  });
  const [saving, setSaving] = useState(false);

  const draft = drafts[selectedClass] || {};
  const complete =
    (draft.showName || '').trim().length >= 2 &&
    draft.theme &&
    draft.musicSource &&
    draft.drillStyle;
  const updateDraft = (patch) =>
    setDrafts((prev) => ({
      ...prev,
      [selectedClass]: { ...prev[selectedClass], ...patch, saved: false },
    }));

  const handleSave = async () => {
    if (!complete || !selectedClass) return;
    setSaving(true);
    try {
      await saveShowConcept({
        corpsClass: selectedClass,
        showConcept: {
          showName: draft.showName.trim(),
          theme: draft.theme,
          musicSource: draft.musicSource,
          drillStyle: draft.drillStyle,
        },
      });
      setDrafts((prev) => ({
        ...prev,
        [selectedClass]: { ...prev[selectedClass], saved: true },
      }));
      toast.success(`"${draft.showName.trim()}" is ready to take the field!`);
    } catch (error) {
      toast.error(error.message || 'Could not save show concept');
    } finally {
      setSaving(false);
    }
  };

  // No corps to design for — advance automatically (effect, not render-time)
  useEffect(() => {
    if (namedCorps.length === 0) onContinue();
  }, [namedCorps.length, onContinue]);
  if (namedCorps.length === 0) return null;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm">
      <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#0057B8]" />
          Design This Season&apos;s Show
        </h2>
      </div>
      <div className="p-4 space-y-4">
        <p className="text-xs text-gray-400">
          New season, new program. Name your show and pick its style — matching your concept to the
          corps in your lineup earns nightly CorpsCoin design bonuses, and marching.art&apos;s daily
          coverage may feature your program. Concepts never affect competitive scores. You can also
          do this later from your dashboard.
        </p>

        {/* Corps selector when the director runs more than one */}
        {namedCorps.length > 1 && (
          <div className="flex gap-1.5 flex-wrap">
            {namedCorps.map(({ classId, corps }) => (
              <button
                key={classId}
                type="button"
                onClick={() => setSelectedClass(classId)}
                className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors flex items-center gap-1 ${
                  selectedClass === classId
                    ? 'border-[#0057B8] bg-[#0057B8]/10 text-white'
                    : 'border-[#333] text-gray-500 hover:border-[#555]'
                }`}
              >
                {drafts[classId]?.saved && <Check className="w-3 h-3 text-green-400" />}
                {corps.corpsName} ({getCorpsClassName(classId)})
              </button>
            ))}
          </div>
        )}

        <div>
          <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
            Show Title
          </label>
          <input
            type="text"
            value={draft.showName || ''}
            onChange={(e) => updateDraft({ showName: e.target.value })}
            placeholder={'e.g., "Beneath the Surface"'}
            maxLength={60}
            className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
          />
        </div>

        <PickerRow
          label="Theme"
          options={SHOW_THEMES}
          value={draft.theme}
          onChange={(v) => updateDraft({ theme: v })}
        />
        <PickerRow
          label="Music Source"
          options={MUSIC_SOURCES}
          value={draft.musicSource}
          onChange={(v) => updateDraft({ musicSource: v })}
        />
        <PickerRow
          label="Drill Style"
          options={DRILL_STYLES}
          value={draft.drillStyle}
          onChange={(v) => updateDraft({ drillStyle: v })}
        />
      </div>

      <div className="px-4 py-3 border-t border-[#333] flex items-center justify-between">
        <button
          type="button"
          onClick={onContinue}
          className="h-10 px-4 border border-[#333] text-gray-400 font-bold text-sm uppercase tracking-wider hover:border-[#444] hover:text-white"
        >
          Skip for now
        </button>
        <div className="flex gap-2">
          {!draft.saved ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={!complete || saving}
              className="h-10 px-4 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#0066d6]"
            >
              {saving ? 'Saving...' : 'Save Concept'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onContinue}
              className="h-10 px-6 bg-[#0057B8] text-white font-bold text-sm uppercase tracking-wider flex items-center hover:bg-[#0066d6]"
            >
              Continue
              <ChevronRight className="w-4 h-4 ml-1" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShowConceptStep;
