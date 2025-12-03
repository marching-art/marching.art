// src/components/Staff/StaffMarketplace.jsx
// UI/UX Overhaul: "Refined Brutalism meets Luxury Sports Analytics"
// Trading Card Game (TCG) Interface for Staff Marketplace
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, DollarSign, Award, Search, X,
  ChevronDown, Trophy, Check, Lock, AlertCircle,
  Music, Eye, Flag, Drum, Sparkles, Star, Crown
} from 'lucide-react';
import { useAuth } from '../../App';
import { useStaffMarketplace } from '../../hooks/useStaffMarketplace';
import { CAPTION_OPTIONS, getCaptionColor, getCaptionLabel } from '../../utils/captionUtils';
import toast from 'react-hot-toast';
import Portal from '../Portal';

// ============================================================================
// CAPTION ICONS MAPPING - For watermarks on cards
// ============================================================================
const CAPTION_ICONS = {
  GE1: Crown,      // Directors & Program Coordinators
  GE2: Award,      // Judges & Administrators
  VP: Eye,         // Visual Performance / Drill Designers
  VA: Eye,         // Visual Analysis
  CG: Flag,        // Color Guard
  B: Music,        // Brass
  MA: Sparkles,    // Music Analysis / Front Ensemble
  P: Drum,         // Percussion / Battery
};

// Rarity determination based on base value
const getRarity = (baseValue) => {
  if (baseValue >= 300) return 'legendary';
  if (baseValue >= 150) return 'rare';
  return 'common';
};

// ============================================================================
// ROLE BADGE COLORS - Map caption to colored badges
// ============================================================================
const ROLE_BADGE_STYLES = {
  GE1: 'bg-purple-500 text-white',    // Program Coordinator
  GE2: 'bg-purple-400 text-white',    // Admin
  VP: 'bg-blue-500 text-white',       // Visual Performance
  VA: 'bg-blue-400 text-white',       // Visual Analysis
  CG: 'bg-pink-500 text-white',       // Color Guard
  B: 'bg-yellow-500 text-[#0D0D0D]',  // Brass
  MA: 'bg-teal-500 text-white',       // Music Analysis
  P: 'bg-orange-500 text-white',      // Percussion
};

// ============================================================================
// COMPACT TRADING CARD COMPONENT - Tactical Luxury Style
// ============================================================================
const StaffTradingCard = ({ staff, owned, canAfford, onPurchase }) => {
  const rarity = getRarity(staff.baseValue);
  const CaptionIcon = CAPTION_ICONS[staff.caption] || Award;

  // Rarity-based styling for light/dark
  const rarityStyles = {
    legendary: {
      border: 'border-amber-500 dark:border-gold-500',
      glow: 'shadow-[0_0_20px_rgba(217,163,0,0.15)] dark:shadow-[0_0_20px_rgba(255,212,77,0.25)]',
      badge: 'bg-amber-500 dark:bg-gold-500 text-white dark:text-[#0D0D0D]',
    },
    rare: {
      border: 'border-blue-500/60',
      glow: '',
      badge: 'bg-blue-500 text-white',
    },
    common: {
      border: 'border-stone-200 dark:border-[#3A3A3A]',
      glow: '',
      badge: 'bg-stone-200 dark:bg-[#3A3A3A] text-slate-600 dark:text-[#FAF6EA]/70',
    }
  };

  const style = rarityStyles[rarity];
  const roleBadge = ROLE_BADGE_STYLES[staff.caption] || 'bg-gray-500 text-white';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`compact-card ${style.border} ${style.glow} group min-h-[180px]`}
    >
      {/* Watermark Icon - Larger, positioned better */}
      <div className="absolute right-0 bottom-0 opacity-[0.04] dark:opacity-[0.06] pointer-events-none overflow-hidden">
        <CaptionIcon className="w-40 h-40 text-slate-900 dark:text-[#FAF6EA] translate-x-6 translate-y-6" />
      </div>

      {/* Owned Overlay */}
      {owned && (
        <div className="absolute inset-0 bg-green-500/10 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-green-500/90 text-white dark:text-[#0D0D0D] px-4 py-2 rounded-lg font-display font-bold uppercase tracking-wider text-sm transform -rotate-6">
            Owned
          </div>
        </div>
      )}

      {/* Card Content - Compact Padding */}
      <div className="relative z-10 p-4 flex flex-col h-full">
        {/* Header: Rarity + Year */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <span className={`px-2 py-0.5 rounded text-[9px] font-display font-bold uppercase tracking-widest ${style.badge}`}>
            {rarity}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-[#FAF6EA]/40 font-mono">
            HOF {staff.yearInducted || '----'}
          </span>
        </div>

        {/* Name - Dark in light mode, White in dark */}
        <h3 className="text-lg font-display font-bold text-slate-900 dark:text-white uppercase tracking-wide truncate mb-1">
          {staff.name}
        </h3>

        {/* Role Badge - Colored */}
        <div className="mb-3">
          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-display font-bold uppercase tracking-wide ${roleBadge}`}>
            {getCaptionLabel(staff.caption).split(' ')[0]}
          </span>
        </div>

        {/* Biography - Compact */}
        <p className="text-xs text-slate-500 dark:text-[#FAF6EA]/50 mb-4 line-clamp-2 font-body flex-1">
          {staff.biography || 'A legendary member of the DCI Hall of Fame.'}
        </p>

        {/* Bottom Row: Boost + Price Anchor */}
        <div className="flex items-end justify-between mt-auto">
          <div className="text-xs text-slate-500 dark:text-[#FAF6EA]/50 font-display">
            <span className="text-green-600 dark:text-green-400 font-bold">+{Math.round(staff.baseValue / 100)}%</span> boost
          </div>

          {/* Price Tag - Anchored with sticker style */}
          {owned ? (
            <div className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-600 dark:text-green-400 text-xs font-display font-bold">
              <Check className="w-3.5 h-3.5" />
              Owned
            </div>
          ) : (
            <button
              onClick={onPurchase}
              disabled={!canAfford}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-br-lg rounded-tl-lg font-display font-bold text-sm uppercase tracking-wide transition-all shadow-sm ${
                canAfford
                  ? 'bg-slate-900 dark:bg-gold-500 text-amber-500 dark:text-[#0D0D0D] hover:bg-slate-800 dark:hover:bg-gold-400 shadow-md hover:shadow-lg'
                  : 'bg-stone-200 dark:bg-[#2A2A2A] text-slate-400 dark:text-[#FAF6EA]/40 cursor-not-allowed'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              <span className="font-mono font-bold">{staff.baseValue}</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

// ============================================================================
// MAIN MARKETPLACE COMPONENT
// ============================================================================
const StaffMarketplace = () => {
  const { user } = useAuth();
  const {
    marketplace,
    corpsCoin,
    loading,
    purchasing,
    fetchMarketplace,
    purchaseStaff,
    ownsStaff,
    canAfford
  } = useStaffMarketplace(user?.uid);

  const [searchTerm, setSearchTerm] = useState('');
  const [captionFilter, setCaptionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);

  useEffect(() => {
    fetchMarketplace(captionFilter === 'all' ? null : captionFilter);
  }, [captionFilter]);

  useEffect(() => {
    filterAndSortStaff();
  }, [marketplace, searchTerm, sortBy]);

  const filterAndSortStaff = () => {
    let filtered = [...marketplace];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(staff =>
        staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.biography?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return b.yearInducted - a.yearInducted;
        case 'oldest':
          return a.yearInducted - b.yearInducted;
        case 'cheapest':
          return a.baseValue - b.baseValue;
        case 'expensive':
          return b.baseValue - a.baseValue;
        case 'legendary':
          return getRarity(b.baseValue) === 'legendary' ? 1 : getRarity(a.baseValue) === 'legendary' ? -1 : 0;
        default:
          return 0;
      }
    });

    setFilteredStaff(filtered);
  };

  const handlePurchase = async (staff) => {
    if (ownsStaff(staff.id)) {
      toast.error('You already own this staff member');
      return;
    }

    if (!canAfford(staff.baseValue)) {
      toast.error(
        <div>
          <p className="font-bold">Insufficient CorpsCoin</p>
          <p className="text-sm">Need {staff.baseValue - corpsCoin} more CorpsCoin</p>
        </div>
      );
      return;
    }

    try {
      await purchaseStaff(staff.id);
      setSelectedStaff(null);
    } catch (error) {
      // Error already handled in hook
    }
  };

  // Count by rarity
  const legendaryCount = filteredStaff.filter(s => getRarity(s.baseValue) === 'legendary').length;
  const rareCount = filteredStaff.filter(s => getRarity(s.baseValue) === 'rare').length;
  const commonCount = filteredStaff.filter(s => getRarity(s.baseValue) === 'common').length;

  return (
    <div className="space-y-6">
      {/* ======================================================================
          HEADER: Title & Balance - Stadium Banner Style (Theme Aware)
          ====================================================================== */}
      <div className="stadium-banner p-5 md:p-6">
        <div className="stadium-overlay" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="sports-header text-2xl md:text-3xl text-slate-900 dark:text-white">
              Scouting Report
            </h1>
            <p className="text-slate-500 dark:text-white/50 font-body text-sm mt-1">
              Recruit Hall of Fame legends to boost your corps
            </p>
          </div>

          {/* Balance Display - Score Bug Style */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-stone-100 dark:bg-[#0D0D0D]/80 border border-amber-500/40 dark:border-gold-500/40 backdrop-blur-sm">
            <DollarSign className="w-5 h-5 text-amber-600 dark:text-gold-500" />
            <div className="flex items-baseline gap-1">
              <span className="text-2xl md:text-3xl font-mono font-bold text-amber-600 dark:text-gold-500">
                {corpsCoin.toLocaleString()}
              </span>
              <span className="text-xs text-slate-400 dark:text-white/40 font-display uppercase tracking-wider">CC</span>
            </div>
          </div>
        </div>

        {/* Search and Sort Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name..."
              className="w-full pl-12 pr-4 py-3 bg-stone-50 dark:bg-[#0D0D0D] border-2 border-stone-300 dark:border-white/20 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-white/30 focus:outline-none focus:border-amber-500 dark:focus:border-gold-500 font-display transition-colors"
            />
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 dark:bg-[#0D0D0D] border-2 border-stone-300 dark:border-white/20 rounded-xl text-slate-900 dark:text-white focus:outline-none focus:border-amber-500 dark:focus:border-gold-500 appearance-none cursor-pointer font-display"
            >
              <option value="newest">Newest Inductees</option>
              <option value="oldest">Oldest Inductees</option>
              <option value="cheapest">Lowest Price</option>
              <option value="expensive">Highest Price</option>
              <option value="legendary">Legendary First</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-white/40 pointer-events-none" />
          </div>
        </div>

        {/* Caption Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {CAPTION_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setCaptionFilter(option.value)}
              className={`px-4 py-2 rounded-lg text-sm font-display font-bold uppercase tracking-wide transition-all border-2 ${
                captionFilter === option.value
                  ? option.value === 'all'
                    ? 'bg-slate-900 dark:bg-gold-500 text-amber-500 dark:text-charcoal-900 border-slate-800 dark:border-gold-400 shadow-md dark:shadow-brutal-gold'
                    : `${option.color} text-white border-transparent`
                  : 'bg-stone-100 dark:bg-[#1A1A1A] text-slate-500 dark:text-white/60 border-stone-300 dark:border-white/20 hover:border-amber-500/50 dark:hover:border-gold-500/50 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {option.value === 'all' ? 'All' : option.value}
            </button>
          ))}
        </div>
      </div>

      {/* ======================================================================
          RESULTS INFO BAR
          ====================================================================== */}
      <div className="flex flex-wrap items-center justify-between gap-4 px-2">
        <div className="flex items-center gap-4">
          <p className="text-slate-500 dark:text-[#FAF6EA]/60 text-sm font-display">
            {loading ? 'Loading...' : (
              <>
                <span className="text-slate-900 dark:text-[#FAF6EA] font-bold">{filteredStaff.length}</span> staff available
              </>
            )}
          </p>
          {!loading && (
            <div className="flex items-center gap-3 text-xs font-display">
              <span className="flex items-center gap-1 text-amber-600 dark:text-gold-500">
                <Crown className="w-3 h-3" /> {legendaryCount}
              </span>
              <span className="flex items-center gap-1 text-blue-600 dark:text-blue-400">
                <Star className="w-3 h-3" /> {rareCount}
              </span>
              <span className="flex items-center gap-1 text-slate-400 dark:text-[#FAF6EA]/40">
                {commonCount}
              </span>
            </div>
          )}
        </div>

        {(searchTerm || captionFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setCaptionFilter('all');
            }}
            className="text-sm text-amber-600 dark:text-gold-500 hover:text-amber-500 dark:hover:text-gold-400 flex items-center gap-1 font-display font-bold uppercase tracking-wide"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* ======================================================================
          STAFF CARD GRID - TCG Layout
          ====================================================================== */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-16 h-16 border-4 border-amber-500 dark:border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="card-brutalist p-12 text-center">
          <AlertCircle className="w-16 h-16 text-slate-300 dark:text-[#FAF6EA]/30 mx-auto mb-4" />
          <h3 className="text-2xl font-display font-black text-slate-900 dark:text-[#FAF6EA] uppercase mb-2">
            No Staff Found
          </h3>
          <p className="text-slate-500 dark:text-[#FAF6EA]/60 font-display">
            {searchTerm || captionFilter !== 'all'
              ? 'Try adjusting your search or filter'
              : 'No staff members available at this time'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStaff.map((staff) => (
            <StaffTradingCard
              key={staff.id}
              staff={staff}
              owned={ownsStaff(staff.id)}
              canAfford={canAfford(staff.baseValue)}
              onPurchase={() => setSelectedStaff(staff)}
            />
          ))}
        </div>
      )}

      {/* ======================================================================
          PURCHASE CONFIRMATION MODAL
          ====================================================================== */}
      <AnimatePresence>
        {selectedStaff && (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="card-brutalist p-6 w-full max-w-md"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-display font-black text-slate-900 dark:text-[#FAF6EA] uppercase tracking-tight">
                    Confirm Purchase
                  </h3>
                  <button
                    onClick={() => setSelectedStaff(null)}
                    className="p-2 text-slate-500 dark:text-[#FAF6EA]/60 hover:text-slate-700 dark:hover:text-[#FAF6EA] hover:bg-stone-100 dark:hover:bg-[#2A2A2A] rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Staff Preview */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-4 p-4 bg-stone-50 dark:bg-[#0D0D0D] rounded-xl border border-stone-200 dark:border-2 dark:border-[#2A2A2A]">
                    <div className="w-14 h-14 bg-amber-500/20 dark:bg-gold-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      {React.createElement(CAPTION_ICONS[selectedStaff.caption] || Award, {
                        className: 'w-7 h-7 text-amber-600 dark:text-gold-500'
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-black text-slate-900 dark:text-[#FAF6EA] uppercase tracking-tight truncate">
                        {selectedStaff.name}
                      </h4>
                      <p className="text-sm text-slate-500 dark:text-[#FAF6EA]/60 mb-2 line-clamp-2">
                        {selectedStaff.biography}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-white ${getCaptionColor(selectedStaff.caption)}`}>
                          {selectedStaff.caption}
                        </span>
                        <span className="text-[10px] text-slate-400 dark:text-[#FAF6EA]/40 font-mono">
                          HOF {selectedStaff.yearInducted}
                        </span>
                        <span className={`text-[10px] font-display font-bold uppercase ${
                          getRarity(selectedStaff.baseValue) === 'legendary' ? 'text-amber-600 dark:text-gold-500' :
                          getRarity(selectedStaff.baseValue) === 'rare' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-[#FAF6EA]/40'
                        }`}>
                          {getRarity(selectedStaff.baseValue)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-[#0D0D0D] rounded-xl border border-stone-200 dark:border-2 dark:border-[#2A2A2A]">
                    <span className="text-slate-500 dark:text-[#FAF6EA]/60 font-display uppercase tracking-wider">Cost</span>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-6 h-6 text-amber-600 dark:text-gold-500" />
                      <span className="text-3xl font-mono font-black text-amber-600 dark:text-gold-500">{selectedStaff.baseValue}</span>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="flex items-center justify-between p-4 bg-stone-50 dark:bg-[#0D0D0D] rounded-xl border border-stone-200 dark:border-2 dark:border-[#2A2A2A]">
                    <span className="text-slate-500 dark:text-[#FAF6EA]/60 font-display uppercase tracking-wider">Your Balance</span>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-slate-400 dark:text-[#FAF6EA]/60" />
                      <span className="text-xl font-mono font-bold text-slate-900 dark:text-[#FAF6EA]">{corpsCoin}</span>
                    </div>
                  </div>

                  {/* After Purchase */}
                  {canAfford(selectedStaff.baseValue) && (
                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-500/10 rounded-xl border border-green-200 dark:border-2 dark:border-green-500/30">
                      <span className="text-green-600 dark:text-green-400 font-display uppercase tracking-wider">After Purchase</span>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <span className="text-xl font-mono font-bold text-green-600 dark:text-green-400">
                          {corpsCoin - selectedStaff.baseValue}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={() => setSelectedStaff(null)}
                    className="flex-1 px-4 py-3 bg-stone-200 dark:bg-[#2A2A2A] text-slate-700 dark:text-[#FAF6EA] rounded-xl hover:bg-stone-300 dark:hover:bg-[#3A3A3A] transition-colors font-display font-bold uppercase tracking-wide"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handlePurchase(selectedStaff)}
                    disabled={purchasing || !canAfford(selectedStaff.baseValue)}
                    className={`flex-1 px-4 py-3 rounded-xl font-display font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${
                      canAfford(selectedStaff.baseValue)
                        ? 'bg-slate-900 dark:bg-gold-500 text-amber-500 dark:text-charcoal-900 hover:bg-slate-800 dark:hover:bg-gold-400 shadow-md dark:shadow-brutal-gold'
                        : 'bg-stone-200 dark:bg-charcoal-700 text-slate-400 dark:text-charcoal-400 cursor-not-allowed'
                    }`}
                  >
                    {purchasing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-amber-500 dark:border-charcoal-900 border-t-transparent rounded-full animate-spin" />
                        Processing...
                      </>
                    ) : !canAfford(selectedStaff.baseValue) ? (
                      <>
                        <Lock className="w-5 h-5" />
                        Insufficient
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5" />
                        Purchase
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          </Portal>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffMarketplace;
