// =============================================================================
// UNIFORM DESIGN MODAL - Director Customization for Corps Appearance
// =============================================================================
// Allows directors to design their fantasy corps uniform appearance
// Used by AI to generate accurate images for news articles and avatars

import React, { useState, useEffect } from 'react';
import { X, Palette, Sparkles, Save, Loader2, Copy, ChevronDown, User, RefreshCw } from 'lucide-react';
import Portal from '../Portal';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import type { CorpsUniformDesign, CorpsClass } from '../../types';

// =============================================================================
// TYPES
// =============================================================================

interface CorpsOption {
  classKey: CorpsClass;
  corpsName: string;
  uniformDesign?: CorpsUniformDesign;
}

interface UniformDesignModalProps {
  onClose: () => void;
  onSubmit: (design: CorpsUniformDesign, corpsClass: CorpsClass, copyToClasses?: CorpsClass[]) => Promise<void>;
  currentDesign?: CorpsUniformDesign;
  corpsName: string;
  // New props for multi-corps support
  allCorps?: CorpsOption[];
  initialCorpsClass?: CorpsClass;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CLASS_DISPLAY: Record<CorpsClass, { name: string; color: string }> = {
  world: { name: 'World Class', color: 'text-purple-400' },
  open: { name: 'Open Class', color: 'text-blue-400' },
  aClass: { name: 'A Class', color: 'text-green-400' },
  soundSport: { name: 'SoundSport', color: 'text-orange-400' },
};

const UNIFORM_STYLES = [
  { value: 'traditional', label: 'Traditional', description: 'Classic military-inspired with structured lines' },
  { value: 'contemporary', label: 'Contemporary', description: 'Modern design with clean aesthetics' },
  { value: 'theatrical', label: 'Theatrical', description: 'Dramatic costumes with show-themed elements' },
  { value: 'athletic', label: 'Athletic', description: 'Streamlined performance wear' },
  { value: 'avant-garde', label: 'Avant-Garde', description: 'Experimental and boundary-pushing' },
] as const;

const HELMET_STYLES = [
  { value: 'shako', label: 'Shako', description: 'Tall cylindrical military cap with plume' },
  { value: 'aussie', label: 'Aussie', description: 'Wide-brimmed campaign hat' },
  { value: 'modern', label: 'Modern', description: 'Streamlined contemporary headwear' },
  { value: 'themed', label: 'Themed', description: 'Show-specific custom design' },
  { value: 'none', label: 'None', description: 'No headwear' },
] as const;

const VENUE_OPTIONS = [
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'indoor', label: 'Indoor' },
  { value: 'both', label: 'Both' },
] as const;

const AVATAR_STYLES = [
  { value: 'logo', label: 'Team Logo', description: 'Emblem/badge style avatar' },
  { value: 'performer', label: 'Performer', description: 'Section member portrait' },
] as const;

const AVATAR_SECTIONS = [
  { value: 'drumMajor', label: 'Drum Major', description: 'Leader with mace/baton' },
  { value: 'hornline', label: 'Hornline', description: 'Brass player with horn' },
  { value: 'drumline', label: 'Drumline', description: 'Percussionist with drums' },
  { value: 'colorGuard', label: 'Color Guard', description: 'Guard with flag/rifle' },
] as const;

const COLOR_SUGGESTIONS = [
  'crimson red', 'midnight blue', 'emerald green', 'royal purple', 'burnt orange',
  'deep navy', 'forest green', 'burgundy', 'charcoal gray', 'pearl white',
  'gold', 'silver', 'bronze', 'copper', 'platinum',
  'obsidian black', 'arctic white', 'sunset orange', 'ocean teal', 'storm gray',
];

// =============================================================================
// COMPONENT
// =============================================================================

const UniformDesignModal: React.FC<UniformDesignModalProps> = ({
  onClose,
  onSubmit,
  currentDesign,
  corpsName,
  allCorps,
  initialCorpsClass,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Selected corps class
  const [selectedCorpsClass, setSelectedCorpsClass] = useState<CorpsClass>(
    initialCorpsClass || (allCorps?.[0]?.classKey) || 'soundSport'
  );

  // Copy to other corps
  const [copyToClasses, setCopyToClasses] = useState<CorpsClass[]>([]);

  // Get the selected corps data
  const selectedCorps = allCorps?.find(c => c.classKey === selectedCorpsClass);
  const selectedDesign = selectedCorps?.uniformDesign || currentDesign;
  const selectedCorpsName = selectedCorps?.corpsName || corpsName;

  // Other corps available for copying
  const otherCorps = allCorps?.filter(c => c.classKey !== selectedCorpsClass) || [];

  const [formData, setFormData] = useState<CorpsUniformDesign>({
    primaryColor: selectedDesign?.primaryColor || '',
    secondaryColor: selectedDesign?.secondaryColor || '',
    accentColor: selectedDesign?.accentColor || '',
    style: selectedDesign?.style || 'contemporary',
    helmetStyle: selectedDesign?.helmetStyle || 'modern',
    plumeDescription: selectedDesign?.plumeDescription || '',
    brassDescription: selectedDesign?.brassDescription || '',
    percussionDescription: selectedDesign?.percussionDescription || '',
    guardDescription: selectedDesign?.guardDescription || '',
    mascotOrEmblem: selectedDesign?.mascotOrEmblem || '',
    themeKeywords: selectedDesign?.themeKeywords || [],
    venuePreference: selectedDesign?.venuePreference || 'outdoor',
    performanceStyle: selectedDesign?.performanceStyle || '',
    additionalNotes: selectedDesign?.additionalNotes || '',
    avatarStyle: selectedDesign?.avatarStyle || 'logo',
    avatarSection: selectedDesign?.avatarSection || 'hornline',
  });

  // Update form when selected corps changes
  useEffect(() => {
    const newDesign = selectedCorps?.uniformDesign;
    if (newDesign) {
      setFormData({
        primaryColor: newDesign.primaryColor || '',
        secondaryColor: newDesign.secondaryColor || '',
        accentColor: newDesign.accentColor || '',
        style: newDesign.style || 'contemporary',
        helmetStyle: newDesign.helmetStyle || 'modern',
        plumeDescription: newDesign.plumeDescription || '',
        brassDescription: newDesign.brassDescription || '',
        percussionDescription: newDesign.percussionDescription || '',
        guardDescription: newDesign.guardDescription || '',
        mascotOrEmblem: newDesign.mascotOrEmblem || '',
        themeKeywords: newDesign.themeKeywords || [],
        venuePreference: newDesign.venuePreference || 'outdoor',
        performanceStyle: newDesign.performanceStyle || '',
        additionalNotes: newDesign.additionalNotes || '',
        avatarStyle: newDesign.avatarStyle || 'logo',
        avatarSection: newDesign.avatarSection || 'hornline',
      });
    }
    // Reset copy selections when changing corps
    setCopyToClasses([]);
  }, [selectedCorpsClass, selectedCorps]);

  const [keywordInput, setKeywordInput] = useState('');

  useEscapeKey(onClose);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate required fields
    if (!formData.primaryColor.trim()) {
      setError('Primary color is required');
      return;
    }
    if (!formData.secondaryColor.trim()) {
      setError('Secondary color is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSubmit(formData, selectedCorpsClass, copyToClasses.length > 0 ? copyToClasses : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save uniform design');
      setIsSaving(false);
    }
  };

  const addKeyword = () => {
    const keyword = keywordInput.trim().toLowerCase();
    if (keyword && !formData.themeKeywords?.includes(keyword)) {
      setFormData({
        ...formData,
        themeKeywords: [...(formData.themeKeywords || []), keyword],
      });
      setKeywordInput('');
    }
  };

  const removeKeyword = (keyword: string) => {
    setFormData({
      ...formData,
      themeKeywords: formData.themeKeywords?.filter(k => k !== keyword) || [],
    });
  };

  const handleKeywordKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addKeyword();
    }
  };

  const toggleCopyToClass = (classKey: CorpsClass) => {
    setCopyToClasses(prev =>
      prev.includes(classKey)
        ? prev.filter(c => c !== classKey)
        : [...prev, classKey]
    );
  };

  return (
    <Portal>
      <div
        className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4"
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title-uniform-design"
      >
        <div
          className="w-full max-w-2xl bg-[#1a1a1a] border border-[#333] rounded-sm max-h-[90vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] bg-[#222] flex-shrink-0">
            <h2
              id="modal-title-uniform-design"
              className="text-xs font-bold uppercase tracking-wider text-[#0057B8] flex items-center gap-2"
            >
              <Palette className="w-4 h-4" />
              Uniform Design
            </h2>
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-white"
              disabled={isSaving}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body - Scrollable */}
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4 space-y-6 overflow-y-auto flex-1">

              {/* Corps Selector - Only show if multiple corps */}
              {allCorps && allCorps.length > 1 && (
                <div className="space-y-2">
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Select Ensemble
                  </label>
                  <div className="relative">
                    <select
                      value={selectedCorpsClass}
                      onChange={(e) => setSelectedCorpsClass(e.target.value as CorpsClass)}
                      className="w-full h-11 px-3 pr-10 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white focus:outline-none focus:border-[#0057B8] appearance-none cursor-pointer"
                    >
                      {allCorps.map((corps) => (
                        <option key={corps.classKey} value={corps.classKey}>
                          {corps.corpsName} ({CLASS_DISPLAY[corps.classKey].name})
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Single corps display */}
              {(!allCorps || allCorps.length <= 1) && (
                <div className="bg-[#222] border border-[#333] px-3 py-2 flex items-center gap-2">
                  <span className="text-xs text-gray-400">Designing for:</span>
                  <span className="text-sm font-bold text-white">{selectedCorpsName}</span>
                </div>
              )}

              {/* AI Generation Notice */}
              <div className="bg-[#0057B8]/10 border border-[#0057B8]/30 p-3 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-[#0057B8] mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-[#0057B8] font-bold uppercase mb-1">
                    AI-Powered Imagery
                  </p>
                  <p className="text-xs text-gray-400">
                    Your uniform design will be used by AI to generate authentic images
                    of your corps for news articles and create a unique avatar icon.
                  </p>
                </div>
              </div>

              {/* SECTION: Colors */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#333] pb-1">
                  Colors
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Primary Color */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Primary Color *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., crimson red"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      maxLength={30}
                      className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                    />
                  </div>

                  {/* Secondary Color */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Secondary Color *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., gold"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      maxLength={30}
                      className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                    />
                  </div>

                  {/* Accent Color */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Accent Color
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., black trim"
                      value={formData.accentColor || ''}
                      onChange={(e) => setFormData({ ...formData, accentColor: e.target.value })}
                      maxLength={30}
                      className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                    />
                  </div>
                </div>

                {/* Color Suggestions */}
                <div className="flex flex-wrap gap-1">
                  {COLOR_SUGGESTIONS.slice(0, 10).map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => {
                        if (!formData.primaryColor) {
                          setFormData({ ...formData, primaryColor: color });
                        } else if (!formData.secondaryColor) {
                          setFormData({ ...formData, secondaryColor: color });
                        } else if (!formData.accentColor) {
                          setFormData({ ...formData, accentColor: color });
                        }
                      }}
                      className="px-2 py-0.5 text-[10px] bg-[#222] border border-[#333] text-gray-400 hover:text-white hover:border-[#0057B8] rounded-sm"
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              {/* SECTION: Style */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#333] pb-1">
                  Uniform Style
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Uniform Style */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Style
                    </label>
                    <select
                      value={formData.style}
                      onChange={(e) => setFormData({ ...formData, style: e.target.value as CorpsUniformDesign['style'] })}
                      className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white focus:outline-none focus:border-[#0057B8]"
                    >
                      {UNIFORM_STYLES.map((style) => (
                        <option key={style.value} value={style.value}>
                          {style.label} — {style.description}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Helmet Style */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Headwear
                    </label>
                    <select
                      value={formData.helmetStyle}
                      onChange={(e) => setFormData({ ...formData, helmetStyle: e.target.value as CorpsUniformDesign['helmetStyle'] })}
                      className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white focus:outline-none focus:border-[#0057B8]"
                    >
                      {HELMET_STYLES.map((style) => (
                        <option key={style.value} value={style.value}>
                          {style.label} — {style.description}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Plume Description - Only show if not "none" */}
                {formData.helmetStyle !== 'none' && (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Plume/Headwear Details
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., tall white horsehair plume, flame-shaped red feathers"
                      value={formData.plumeDescription || ''}
                      onChange={(e) => setFormData({ ...formData, plumeDescription: e.target.value })}
                      maxLength={100}
                      className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                    />
                  </div>
                )}
              </div>

              {/* SECTION: Section Details */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#333] pb-1">
                  Section Details <span className="text-gray-600 font-normal">(Optional - AI will generate if blank)</span>
                </h3>

                {/* Brass */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Brass Section
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., silver horns with gold bell engravings, dragon-themed valve caps"
                    value={formData.brassDescription || ''}
                    onChange={(e) => setFormData({ ...formData, brassDescription: e.target.value })}
                    maxLength={150}
                    className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                  />
                </div>

                {/* Percussion */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Percussion Section
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., red drums with gold tribal graphics, black hardware"
                    value={formData.percussionDescription || ''}
                    onChange={(e) => setFormData({ ...formData, percussionDescription: e.target.value })}
                    maxLength={150}
                    className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                  />
                </div>

                {/* Color Guard */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Color Guard
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., flowing crimson gowns with wing-shaped capes, silver flags"
                    value={formData.guardDescription || ''}
                    onChange={(e) => setFormData({ ...formData, guardDescription: e.target.value })}
                    maxLength={150}
                    className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                  />
                </div>
              </div>

              {/* SECTION: Identity */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#333] pb-1">
                  Corps Identity
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Mascot/Emblem */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Mascot or Emblem
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., phoenix, dragon, crossed swords"
                      value={formData.mascotOrEmblem || ''}
                      onChange={(e) => setFormData({ ...formData, mascotOrEmblem: e.target.value })}
                      maxLength={50}
                      className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                    />
                  </div>

                  {/* Performance Style */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Performance Style
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., high-energy explosive, elegant and refined"
                      value={formData.performanceStyle || ''}
                      onChange={(e) => setFormData({ ...formData, performanceStyle: e.target.value })}
                      maxLength={50}
                      className="w-full h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                    />
                  </div>
                </div>

                {/* Theme Keywords */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Theme Keywords
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a keyword (press Enter)"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      onKeyDown={handleKeywordKeyDown}
                      maxLength={20}
                      className="flex-1 h-10 px-3 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8]"
                    />
                    <button
                      type="button"
                      onClick={addKeyword}
                      className="px-3 h-10 bg-[#222] border border-[#333] text-gray-400 text-sm hover:text-white hover:border-[#0057B8]"
                    >
                      Add
                    </button>
                  </div>
                  {formData.themeKeywords && formData.themeKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {formData.themeKeywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="px-2 py-1 text-xs bg-[#0057B8]/20 text-[#0057B8] border border-[#0057B8]/30 rounded-sm flex items-center gap-1"
                        >
                          {keyword}
                          <button
                            type="button"
                            onClick={() => removeKeyword(keyword)}
                            className="text-[#0057B8] hover:text-white"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-gray-600 mt-1">
                    Keywords help AI match your corps to appropriate imagery (e.g., fire, ice, power, ancient)
                  </p>
                </div>

                {/* Venue Preference */}
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                    Venue Preference
                  </label>
                  <div className="flex gap-2">
                    {VENUE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, venuePreference: option.value })}
                        className={`
                          px-4 py-2 text-xs font-bold uppercase tracking-wider border rounded-sm
                          ${formData.venuePreference === option.value
                            ? 'bg-[#0057B8] border-[#0057B8] text-white'
                            : 'bg-[#0a0a0a] border-[#333] text-gray-400 hover:border-[#0057B8] hover:text-white'
                          }
                        `}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* SECTION: Avatar Options */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#333] pb-1 flex items-center gap-2">
                  <User className="w-3 h-3" />
                  Profile Avatar Style
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Avatar Style */}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                      Avatar Type
                    </label>
                    <div className="space-y-2">
                      {AVATAR_STYLES.map((style) => (
                        <label
                          key={style.value}
                          className={`flex items-center gap-3 p-2 border cursor-pointer transition-all ${
                            formData.avatarStyle === style.value
                              ? 'bg-[#0057B8]/10 border-[#0057B8]/50'
                              : 'bg-[#0a0a0a] border-[#333] hover:border-[#444]'
                          }`}
                        >
                          <input
                            type="radio"
                            name="avatarStyle"
                            value={style.value}
                            checked={formData.avatarStyle === style.value}
                            onChange={(e) => setFormData({ ...formData, avatarStyle: e.target.value as 'logo' | 'performer' })}
                            className="w-4 h-4 accent-[#0057B8]"
                          />
                          <div>
                            <div className="text-sm text-white font-bold">{style.label}</div>
                            <div className="text-[10px] text-gray-500">{style.description}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Section Selection - Only show for performer style */}
                  {formData.avatarStyle === 'performer' && (
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Featured Section
                      </label>
                      <div className="space-y-2">
                        {AVATAR_SECTIONS.map((section) => (
                          <label
                            key={section.value}
                            className={`flex items-center gap-3 p-2 border cursor-pointer transition-all ${
                              formData.avatarSection === section.value
                                ? 'bg-[#0057B8]/10 border-[#0057B8]/50'
                                : 'bg-[#0a0a0a] border-[#333] hover:border-[#444]'
                            }`}
                          >
                            <input
                              type="radio"
                              name="avatarSection"
                              value={section.value}
                              checked={formData.avatarSection === section.value}
                              onChange={(e) => setFormData({ ...formData, avatarSection: e.target.value as 'drumMajor' | 'hornline' | 'drumline' | 'colorGuard' })}
                              className="w-4 h-4 accent-[#0057B8]"
                            />
                            <div>
                              <div className="text-sm text-white font-bold">{section.label}</div>
                              <div className="text-[10px] text-gray-500">{section.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-[10px] text-gray-500">
                  Your avatar will be automatically generated when you save. Change the style or section to generate a new avatar.
                </p>
              </div>

              {/* SECTION: Additional Notes */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#333] pb-1">
                  Additional Visual Notes
                </h3>

                <div>
                  <textarea
                    placeholder="Any additional details for AI image generation (e.g., LED elements in helmet, capes that detach mid-show, specific fabric textures)"
                    value={formData.additionalNotes || ''}
                    onChange={(e) => setFormData({ ...formData, additionalNotes: e.target.value })}
                    maxLength={300}
                    className="w-full h-24 px-3 py-2 bg-[#0a0a0a] border border-[#333] rounded-sm text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#0057B8] resize-none"
                  />
                  <p className="text-[10px] text-gray-600 mt-1">
                    {(formData.additionalNotes || '').length}/300
                  </p>
                </div>
              </div>

              {/* SECTION: Copy to Other Ensembles */}
              {otherCorps.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#333] pb-1 flex items-center gap-2">
                    <Copy className="w-3 h-3" />
                    Copy Design to Other Ensembles
                  </h3>
                  <p className="text-[10px] text-gray-500">
                    Apply this uniform design to your other corps as well.
                  </p>
                  <div className="space-y-2">
                    {otherCorps.map((corps) => (
                      <label
                        key={corps.classKey}
                        className="flex items-center gap-3 p-2 bg-[#0a0a0a] border border-[#333] hover:border-[#444] cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={copyToClasses.includes(corps.classKey)}
                          onChange={() => toggleCopyToClass(corps.classKey)}
                          className="w-4 h-4 bg-[#0a0a0a] border border-[#333] rounded-sm accent-[#0057B8]"
                        />
                        <div className="flex-1">
                          <span className="text-sm text-white">{corps.corpsName}</span>
                          <span className={`ml-2 text-[10px] ${CLASS_DISPLAY[corps.classKey].color}`}>
                            {CLASS_DISPLAY[corps.classKey].name}
                          </span>
                        </div>
                        {corps.uniformDesign && (
                          <span className="text-[9px] text-yellow-500 uppercase">Has Design</span>
                        )}
                      </label>
                    ))}
                  </div>
                  {copyToClasses.length > 0 && (
                    <p className="text-[10px] text-yellow-500">
                      This will overwrite existing designs for {copyToClasses.length} ensemble{copyToClasses.length > 1 ? 's' : ''}.
                    </p>
                  )}
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 p-3">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-[#333] bg-[#111] flex justify-between gap-2 flex-shrink-0">
              <p className="text-[10px] text-gray-600 self-center">
                * Required fields
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSaving}
                  className="h-9 px-4 border border-[#333] text-gray-400 text-sm font-bold uppercase tracking-wider hover:border-[#444] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="h-9 px-4 bg-[#0057B8] text-white text-sm font-bold uppercase tracking-wider hover:bg-[#0066d6] disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Save Design{copyToClasses.length > 0 ? ` (${copyToClasses.length + 1})` : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </Portal>
  );
};

export default UniformDesignModal;
