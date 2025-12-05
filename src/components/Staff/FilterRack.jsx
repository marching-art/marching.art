// src/components/Staff/FilterRack.jsx
// Responsive "Synthesizer-Style" Filter Control Panel
// Mobile: Collapsible accordion | Desktop: Always visible horizontal strip

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, ChevronDown, ChevronUp, SlidersHorizontal,
  Music, Eye, Flag, Drum, Sparkles, Crown, Award
} from 'lucide-react';
import { CAPTION_OPTIONS } from '../../utils/captionUtils';

// ============================================================================
// CAPTION TOGGLE BUTTON - Role filter with icon
// ============================================================================
const CaptionToggle = ({ caption, icon: Icon, isActive, onClick, compact = false }) => (
  <button
    onClick={onClick}
    className={`
      flex items-center justify-center gap-1 transition-all duration-150
      ${compact ? 'px-2 py-1.5' : 'px-3 py-2'}
      ${isActive
        ? 'bg-gold-500/20 border-gold-500/50 text-gold-400'
        : 'bg-black/40 border-white/10 text-cream/50 hover:text-cream hover:border-white/20'
      }
      border rounded text-[10px] font-bold uppercase tracking-wide
    `}
  >
    <Icon className={`${compact ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} />
    {!compact && <span>{caption}</span>}
  </button>
);

// ============================================================================
// DIGITAL READOUT INPUT - Monospace numeric input with dark styling
// ============================================================================
const DigitalInput = ({ label, value, onChange, min = 0, max = 999, placeholder = "0" }) => (
  <div className="flex flex-col gap-1">
    <label className="text-[8px] text-cream/40 uppercase tracking-widest">{label}</label>
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={min}
      max={max}
      placeholder={placeholder}
      className="
        w-16 px-2 py-1.5 bg-black/80 border border-white/10 rounded
        font-mono text-sm text-data-gold text-center tracking-tight
        placeholder:text-cream/20
        focus:outline-none focus:border-gold-500/50 focus:bg-black
        [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
      "
    />
  </div>
);

// ============================================================================
// COST RANGE SLIDER - Dual input for min/max cost
// ============================================================================
const CostRangeControl = ({ minCost, maxCost, onMinChange, onMaxChange }) => (
  <div className="flex items-end gap-2">
    <DigitalInput
      label="Min Cost"
      value={minCost}
      onChange={onMinChange}
      placeholder="0"
    />
    <span className="text-cream/30 text-xs pb-2">—</span>
    <DigitalInput
      label="Max Cost"
      value={maxCost}
      onChange={onMaxChange}
      placeholder="999"
    />
  </div>
);

// ============================================================================
// CAPTION ICONS MAPPING
// ============================================================================
const CAPTION_ICONS = {
  all: Award,
  GE1: Crown,
  GE2: Award,
  VP: Eye,
  VA: Eye,
  CG: Flag,
  B: Music,
  MA: Sparkles,
  P: Drum,
};

// ============================================================================
// FILTER RACK COMPONENT
// ============================================================================
const FilterRack = ({
  searchTerm,
  onSearchChange,
  captionFilter,
  onCaptionChange,
  minCost,
  maxCost,
  onMinCostChange,
  onMaxCostChange,
  onClearFilters,
  hasActiveFilters
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Count active filters for badge
  const activeFilterCount = [
    searchTerm,
    captionFilter !== 'all',
    minCost,
    maxCost
  ].filter(Boolean).length;

  // Caption options for toggles (excluding 'all')
  const captionOptions = CAPTION_OPTIONS.filter(o => o.value !== 'all');

  return (
    <div className="shrink-0 border-b border-white/10">
      {/* ================================================================
          MOBILE VIEW: Collapsible Accordion
          ================================================================ */}
      <div className="lg:hidden">
        {/* Always Visible: Search Bar + Expand Toggle */}
        <div className="p-2 bg-charcoal-900">
          <div className="flex gap-2">
            {/* Search Input - Always visible */}
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cream/30" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search staff..."
                className="
                  w-full pl-8 pr-3 py-2 bg-black/60 border border-white/10 rounded
                  text-cream text-xs placeholder:text-cream/30
                  focus:outline-none focus:border-gold-500/50
                "
              />
              {searchTerm && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-cream/40 hover:text-cream"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Expand/Collapse Toggle */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className={`
                flex items-center gap-1.5 px-3 py-2 rounded border transition-all
                ${isExpanded || activeFilterCount > 0
                  ? 'bg-gold-500/10 border-gold-500/30 text-gold-400'
                  : 'bg-black/40 border-white/10 text-cream/50 hover:text-cream'
                }
              `}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span className="text-[10px] font-bold uppercase tracking-wide">
                Filter{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </span>
              {isExpanded ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Expandable Filter Panel */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden bg-charcoal-900 border-t border-white/5"
            >
              <div className="p-3 space-y-4">
                {/* Role Toggles - Grid layout on mobile */}
                <div>
                  <label className="block text-[9px] text-cream/40 uppercase tracking-widest mb-2">
                    Filter by Role
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    <CaptionToggle
                      caption="ALL"
                      icon={Award}
                      isActive={captionFilter === 'all'}
                      onClick={() => onCaptionChange('all')}
                      compact
                    />
                    {captionOptions.map(option => {
                      const Icon = CAPTION_ICONS[option.value] || Award;
                      return (
                        <CaptionToggle
                          key={option.value}
                          caption={option.value}
                          icon={Icon}
                          isActive={captionFilter === option.value}
                          onClick={() => onCaptionChange(option.value)}
                          compact
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Cost Range */}
                <div>
                  <label className="block text-[9px] text-cream/40 uppercase tracking-widest mb-2">
                    Cost Range
                  </label>
                  <CostRangeControl
                    minCost={minCost}
                    maxCost={maxCost}
                    onMinChange={onMinCostChange}
                    onMaxChange={onMaxCostChange}
                  />
                </div>

                {/* Clear Filters Button */}
                {hasActiveFilters && (
                  <button
                    onClick={onClearFilters}
                    className="
                      w-full py-2 flex items-center justify-center gap-2
                      bg-red-500/10 border border-red-500/30 rounded
                      text-red-400 text-xs font-bold uppercase tracking-wide
                      hover:bg-red-500/20 transition-colors
                    "
                  >
                    <X className="w-3.5 h-3.5" />
                    Clear All Filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ================================================================
          DESKTOP VIEW: Always Visible Horizontal Control Panel
          Synthesizer-style strip with all controls side-by-side
          ================================================================ */}
      <div className="hidden lg:block bg-charcoal-900">
        <div className="flex items-center gap-4 px-3 py-2">
          {/* Section Label */}
          <div className="flex items-center gap-2 pr-3 border-r border-white/10">
            <SlidersHorizontal className="w-4 h-4 text-gold-500" />
            <span className="text-[10px] text-data-gold uppercase tracking-widest font-bold">
              Filter Ops
            </span>
          </div>

          {/* Search */}
          <div className="relative w-48">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cream/30" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search..."
              className="
                w-full pl-8 pr-8 py-1.5 bg-black/60 border border-white/10 rounded
                text-cream text-xs placeholder:text-cream/30
                focus:outline-none focus:border-gold-500/50
              "
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-cream/40 hover:text-cream"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-white/10" />

          {/* Role Toggles - Horizontal row */}
          <div className="flex items-center gap-1">
            <span className="text-[8px] text-cream/40 uppercase tracking-widest mr-2">Role</span>
            <CaptionToggle
              caption="ALL"
              icon={Award}
              isActive={captionFilter === 'all'}
              onClick={() => onCaptionChange('all')}
              compact
            />
            {captionOptions.map(option => {
              const Icon = CAPTION_ICONS[option.value] || Award;
              return (
                <CaptionToggle
                  key={option.value}
                  caption={option.value}
                  icon={Icon}
                  isActive={captionFilter === option.value}
                  onClick={() => onCaptionChange(option.value)}
                  compact
                />
              );
            })}
          </div>

          {/* Divider */}
          <div className="h-6 w-px bg-white/10" />

          {/* Cost Range - Inline */}
          <div className="flex items-center gap-2">
            <span className="text-[8px] text-cream/40 uppercase tracking-widest">Cost</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={minCost}
                onChange={(e) => onMinCostChange(e.target.value)}
                placeholder="Min"
                className="
                  w-14 px-2 py-1 bg-black/80 border border-white/10 rounded
                  font-mono text-xs text-data-gold text-center
                  placeholder:text-cream/20 placeholder:font-sans
                  focus:outline-none focus:border-gold-500/50
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                "
              />
              <span className="text-cream/30 text-xs">—</span>
              <input
                type="number"
                value={maxCost}
                onChange={(e) => onMaxCostChange(e.target.value)}
                placeholder="Max"
                className="
                  w-14 px-2 py-1 bg-black/80 border border-white/10 rounded
                  font-mono text-xs text-data-gold text-center
                  placeholder:text-cream/20 placeholder:font-sans
                  focus:outline-none focus:border-gold-500/50
                  [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                "
              />
            </div>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Clear Filters - Only shown when filters active */}
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="
                flex items-center gap-1.5 px-2.5 py-1.5 rounded border
                bg-red-500/10 border-red-500/30 text-red-400
                text-[10px] font-bold uppercase tracking-wide
                hover:bg-red-500/20 transition-colors
              "
            >
              <X className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default FilterRack;
