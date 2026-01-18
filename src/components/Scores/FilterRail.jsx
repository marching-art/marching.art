// src/components/Scores/FilterRail.jsx
// Left sidebar filter rail for the Competitive Analytics Terminal

import React, { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Archive,
  Globe,
  Award,
  Star,
  Eye,
  Music,
  Sparkles,
  Search,
  ChevronDown,
  Filter,
  X
} from 'lucide-react';

// Section header component
const SectionHeader = ({ icon: Icon, title, collapsed, onToggle }) => (
  <button
    onClick={onToggle}
    className="w-full flex items-center justify-between px-3 py-2 hover:bg-charcoal-800/50 transition-colors"
  >
    <div className="flex items-center gap-2">
      <Icon className="w-4 h-4 text-gold-400" />
      <span className="text-xs font-display font-bold text-cream-300 uppercase tracking-wide">
        {title}
      </span>
    </div>
    {collapsed !== undefined && (
      <ChevronDown className={`w-4 h-4 text-cream-500/40 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
    )}
  </button>
);

// Toggle button component
const ToggleButton = ({ active, onClick, children, color = 'gold' }) => {
  const colorClasses = {
    gold: active ? 'bg-gold-500 text-charcoal-900' : 'bg-charcoal-800 text-cream-400 hover:bg-charcoal-700',
    purple: active ? 'bg-purple-500 text-white' : 'bg-charcoal-800 text-cream-400 hover:bg-charcoal-700',
    blue: active ? 'bg-blue-500 text-white' : 'bg-charcoal-800 text-cream-400 hover:bg-charcoal-700',
    green: active ? 'bg-green-500 text-white' : 'bg-charcoal-800 text-cream-400 hover:bg-charcoal-700'
  };

  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-2 text-xs font-display font-bold uppercase tracking-wide
        border border-cream-500/10 rounded transition-all
        ${colorClasses[color]}
      `}
    >
      {children}
    </button>
  );
};

// Checkbox component
const Checkbox = ({ checked, onChange, label, icon: Icon }) => (
  <label className="flex items-center gap-2 px-3 py-2 hover:bg-charcoal-800/30 cursor-pointer transition-colors">
    <div
      className={`
        w-4 h-4 rounded border-2 flex items-center justify-center transition-colors
        ${checked ? 'bg-gold-500 border-gold-500' : 'bg-transparent border-cream-500/30'}
      `}
    >
      {checked && (
        <m.svg
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="w-3 h-3 text-charcoal-900"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
        >
          <polyline points="20 6 9 17 4 12" />
        </m.svg>
      )}
    </div>
    {Icon && <Icon className={`w-3.5 h-3.5 ${checked ? 'text-gold-400' : 'text-cream-500/60'}`} />}
    <span className={`text-xs ${checked ? 'text-cream-100' : 'text-cream-500/60'}`}>
      {label}
    </span>
  </label>
);

// The actual content of the filter rail
const FilterRailContent = ({
  selectedSeason,
  onSeasonChange,
  archivedSeasons,
  activeClass,
  onClassChange,
  enabledCaptions,
  onCaptionToggle,
  searchQuery,
  onSearchChange,
  onClose,
  showCloseButton,
  collapsedSections,
  toggleSection,
  classOptions
}) => (
  <>
    {/* Header */}
    <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-cream-500/10">
      <div className="flex items-center gap-2">
        <Filter className="w-5 h-5 text-gold-400" />
        <span className="font-display font-bold text-cream-100 uppercase tracking-wide">
          Filter Rail
        </span>
      </div>
      {showCloseButton && (
        <button
          onClick={onClose}
          className="p-2 hover:bg-charcoal-800 rounded transition-colors"
        >
          <X className="w-5 h-5 text-cream-500/60" />
        </button>
      )}
    </div>

    {/* Search */}
    <div className="flex-shrink-0 p-3 border-b border-cream-500/10">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream-500/40" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Find Corps/Director..."
          className="w-full pl-9 pr-3 py-2 bg-charcoal-900 border border-cream-500/10 rounded text-sm text-cream-100 placeholder-cream-500/40 focus:outline-none focus:border-gold-500/50"
        />
      </div>
    </div>

    {/* Scrollable Content */}
    <div className="flex-1 overflow-y-auto hud-scroll">
      {/* Season Selector */}
      <div className="border-b border-cream-500/10">
        <SectionHeader
          icon={Calendar}
          title="Season"
          collapsed={collapsedSections.season}
          onToggle={() => toggleSection('season')}
        />
        <AnimatePresence>
          {!collapsedSections.season && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 pb-3"
            >
              <select
                value={selectedSeason || 'current'}
                onChange={(e) => onSeasonChange(e.target.value === 'current' ? null : e.target.value)}
                className="w-full px-3 py-2.5 bg-charcoal-900 border border-cream-500/10 rounded text-sm text-cream-100 focus:outline-none focus:border-gold-500/50"
              >
                <option value="current">Current Season</option>
                <optgroup label="Archives">
                  {archivedSeasons.map(season => (
                    <option key={season.id} value={season.id}>
                      {season.seasonName?.replace(/_/g, ' ') || season.id}
                    </option>
                  ))}
                </optgroup>
              </select>

              {/* Archive indicator */}
              {selectedSeason && (
                <m.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 flex items-center gap-2 px-2 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded text-xs text-amber-400"
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span className="font-mono uppercase tracking-wide">Historical Data</span>
                </m.div>
              )}
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* Class Filter */}
      <div className="border-b border-cream-500/10">
        <SectionHeader
          icon={Globe}
          title="Class"
          collapsed={collapsedSections.class}
          onToggle={() => toggleSection('class')}
        />
        <AnimatePresence>
          {!collapsedSections.class && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 pb-3"
            >
              <div className="grid grid-cols-2 gap-2">
                {classOptions.map(opt => (
                  <ToggleButton
                    key={opt.id}
                    active={activeClass === opt.id}
                    onClick={() => onClassChange(opt.id)}
                    color={opt.color}
                  >
                    {opt.label}
                  </ToggleButton>
                ))}
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* Caption Toggles */}
      <div className="border-b border-cream-500/10">
        <SectionHeader
          icon={Eye}
          title="Columns"
          collapsed={collapsedSections.captions}
          onToggle={() => toggleSection('captions')}
        />
        <AnimatePresence>
          {!collapsedSections.captions && (
            <m.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
            >
              <Checkbox
                checked={enabledCaptions.ge}
                onChange={() => onCaptionToggle('ge')}
                label="General Effect (GE)"
                icon={Sparkles}
              />
              <Checkbox
                checked={enabledCaptions.vis}
                onChange={() => onCaptionToggle('vis')}
                label="Visual (VIS)"
                icon={Eye}
              />
              <Checkbox
                checked={enabledCaptions.mus}
                onChange={() => onCaptionToggle('mus')}
                label="Music (MUS)"
                icon={Music}
              />
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>

    {/* Footer */}
    <div className="flex-shrink-0 p-3 border-t border-cream-500/10 bg-charcoal-950/50">
      <div className="flex items-center justify-between text-[9px] font-mono text-cream-500/30 uppercase tracking-widest">
        <span>Analytics Terminal</span>
        <span>v2.0</span>
      </div>
    </div>
  </>
);

// Main FilterRail component
const FilterRail = ({
  selectedSeason,
  onSeasonChange,
  archivedSeasons = [],
  activeClass,
  onClassChange,
  enabledCaptions,
  onCaptionToggle,
  searchQuery,
  onSearchChange,
  isVisible = true,
  onToggleVisibility,
  isMobile = false
}) => {
  const [collapsedSections, setCollapsedSections] = useState({
    season: false,
    class: false,
    captions: false
  });

  const toggleSection = (section) => {
    setCollapsedSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const classOptions = [
    { id: 'all', label: 'All', icon: Globe, color: 'gold' },
    { id: 'world', label: 'World', icon: Star, color: 'gold' },
    { id: 'open', label: 'Open', icon: Award, color: 'purple' },
    { id: 'a', label: 'A Class', icon: Award, color: 'blue' }
  ];

  // For mobile mode: render FAB button and animated panel
  if (isMobile) {
    return (
      <>
        {/* Mobile: Filter Toggle FAB Button */}
        {!isVisible && (
          <div className="fixed bottom-4 left-4 z-30">
            <m.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onToggleVisibility}
              className="flex items-center gap-2 px-4 py-2 bg-[#0057B8] text-white rounded-sm font-bold uppercase tracking-wide text-xs"
            >
              <Filter className="w-4 h-4" />
              Filters
            </m.button>
          </div>
        )}

        {/* Mobile: Animated Sidebar Panel */}
        <AnimatePresence>
          {isVisible && (
            <>
              {/* Backdrop */}
              <m.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onToggleVisibility}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              />

              {/* Sidebar */}
              <m.div
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                onClick={(e) => e.stopPropagation()}
                className="fixed top-0 left-0 h-full w-[280px] bg-charcoal-950 border-r border-cream-500/10 flex flex-col z-50"
              >
                <FilterRailContent
                  selectedSeason={selectedSeason}
                  onSeasonChange={onSeasonChange}
                  archivedSeasons={archivedSeasons}
                  activeClass={activeClass}
                  onClassChange={onClassChange}
                  enabledCaptions={enabledCaptions}
                  onCaptionToggle={onCaptionToggle}
                  searchQuery={searchQuery}
                  onSearchChange={onSearchChange}
                  onClose={onToggleVisibility}
                  showCloseButton={true}
                  collapsedSections={collapsedSections}
                  toggleSection={toggleSection}
                  classOptions={classOptions}
                />
              </m.div>
            </>
          )}
        </AnimatePresence>
      </>
    );
  }

  // For desktop mode: render static sidebar (always visible)
  return (
    <div className="h-full w-full bg-charcoal-950 border-r border-cream-500/10 flex flex-col">
      <FilterRailContent
        selectedSeason={selectedSeason}
        onSeasonChange={onSeasonChange}
        archivedSeasons={archivedSeasons}
        activeClass={activeClass}
        onClassChange={onClassChange}
        enabledCaptions={enabledCaptions}
        onCaptionToggle={onCaptionToggle}
        searchQuery={searchQuery}
        onSearchChange={onSearchChange}
        showCloseButton={false}
        collapsedSections={collapsedSections}
        toggleSection={toggleSection}
        classOptions={classOptions}
      />
    </div>
  );
};

export default FilterRail;
