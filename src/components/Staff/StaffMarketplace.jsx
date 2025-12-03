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
// TRADING CARD COMPONENT - TCG Style Staff Card
// ============================================================================
const StaffTradingCard = ({ staff, owned, canAfford, onPurchase }) => {
  const rarity = getRarity(staff.baseValue);
  const CaptionIcon = CAPTION_ICONS[staff.caption] || Award;

  // Rarity-based styling
  const rarityStyles = {
    legendary: {
      border: 'rarity-legendary',
      glow: 'shadow-[0_0_30px_rgba(255,212,77,0.3)]',
      badge: 'bg-gradient-to-r from-gold-400 to-gold-600 text-charcoal-900',
      badgeText: 'LEGENDARY'
    },
    rare: {
      border: 'rarity-rare',
      glow: '',
      badge: 'bg-blue-500 text-white',
      badgeText: 'RARE'
    },
    common: {
      border: 'rarity-common',
      glow: '',
      badge: 'bg-charcoal-600 text-[#FAF6EA]/60',
      badgeText: 'COMMON'
    }
  };

  const style = rarityStyles[rarity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`card-tcg ${style.border} ${style.glow} group`}
    >
      {/* Watermark Icon */}
      <div className="watermark-icon">
        <CaptionIcon className="w-32 h-32 text-[#FAF6EA]" />
      </div>

      {/* Owned Stamp */}
      {owned && (
        <div className="stamp-badge">OWNED</div>
      )}

      {/* Card Content */}
      <div className="relative z-10 p-5">
        {/* Header Row: Name & Rarity Badge */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-display font-black text-[#FAF6EA] uppercase tracking-tight truncate">
              {staff.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-display font-bold uppercase tracking-wider text-white ${getCaptionColor(staff.caption)}`}>
                {staff.caption}
              </span>
              <span className="text-[10px] text-[#FAF6EA]/40 font-mono">
                HOF '{staff.yearInducted?.toString().slice(-2) || '??'}
              </span>
            </div>
          </div>
          <span className={`px-2 py-1 rounded text-[8px] font-display font-black uppercase tracking-widest ${style.badge}`}>
            {style.badgeText}
          </span>
        </div>

        {/* Biography */}
        <p className="text-sm text-[#FAF6EA]/60 mb-4 line-clamp-2 font-body">
          {staff.biography || 'A legendary member of the DCI Hall of Fame.'}
        </p>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-4 py-3 border-y border-[#2A2A2A]">
          <div className="text-center">
            <div className="text-lg font-mono font-bold text-gold-500">
              +{Math.round(staff.baseValue / 100)}%
            </div>
            <div className="text-[8px] text-[#FAF6EA]/40 uppercase tracking-widest">Boost</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-mono font-bold text-blue-400">
              {getCaptionLabel(staff.caption).split(' ')[0]}
            </div>
            <div className="text-[8px] text-[#FAF6EA]/40 uppercase tracking-widest">Role</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-mono font-bold text-purple-400">
              {staff.yearInducted || '----'}
            </div>
            <div className="text-[8px] text-[#FAF6EA]/40 uppercase tracking-widest">Year</div>
          </div>
        </div>

        {/* Price Tag / Buy Button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-gold-500" />
            <span className="text-2xl font-mono font-black text-gold-500">
              {staff.baseValue}
            </span>
            <span className="text-[10px] text-[#FAF6EA]/40 uppercase">CC</span>
          </div>

          {owned ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border-2 border-green-500/30 text-green-400">
              <Check className="w-5 h-5" />
              <span className="text-sm font-display font-bold uppercase">Owned</span>
            </div>
          ) : (
            <button
              onClick={onPurchase}
              disabled={!canAfford}
              className={`btn-price ${!canAfford ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {canAfford ? (
                <>
                  <ShoppingCart className="w-4 h-4 inline mr-1" />
                  Buy Now
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 inline mr-1" />
                  Locked
                </>
              )}
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
          HEADER: Title & Balance
          ====================================================================== */}
      <div className="card-brutalist p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-display font-black text-[#FAF6EA] uppercase tracking-tight">
              The Scouting Report
            </h1>
            <p className="text-[#FAF6EA]/60 font-display mt-1">
              Recruit legendary DCI Hall of Fame members to boost your corps
            </p>
          </div>

          {/* Balance Display */}
          <div className="flex items-center gap-3 px-5 py-3 rounded-xl bg-[#0D0D0D] border-2 border-gold-500/30">
            <DollarSign className="w-6 h-6 text-gold-500" />
            <div>
              <span className="text-3xl font-mono font-black text-gold-500">
                {corpsCoin.toLocaleString()}
              </span>
              <span className="text-sm text-[#FAF6EA]/40 ml-2 uppercase tracking-widest">CorpsCoin</span>
            </div>
          </div>
        </div>

        {/* Search and Sort Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FAF6EA]/40" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name..."
              className="w-full pl-12 pr-4 py-3 bg-[#0D0D0D] border-2 border-[#2A2A2A] rounded-xl text-[#FAF6EA] placeholder-[#FAF6EA]/30 focus:outline-none focus:border-gold-500 font-display transition-colors"
            />
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-4 py-3 bg-[#0D0D0D] border-2 border-[#2A2A2A] rounded-xl text-[#FAF6EA] focus:outline-none focus:border-gold-500 appearance-none cursor-pointer font-display"
            >
              <option value="newest">Newest Inductees</option>
              <option value="oldest">Oldest Inductees</option>
              <option value="cheapest">Lowest Price</option>
              <option value="expensive">Highest Price</option>
              <option value="legendary">Legendary First</option>
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#FAF6EA]/40 pointer-events-none" />
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
                    ? 'bg-gold-500 text-charcoal-900 border-gold-400 shadow-brutal-gold'
                    : `${option.color} text-white border-transparent`
                  : 'bg-[#1A1A1A] text-[#FAF6EA]/60 border-[#2A2A2A] hover:border-gold-500/50 hover:text-[#FAF6EA]'
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
          <p className="text-[#FAF6EA]/60 text-sm font-display">
            {loading ? 'Loading...' : (
              <>
                <span className="text-[#FAF6EA] font-bold">{filteredStaff.length}</span> staff available
              </>
            )}
          </p>
          {!loading && (
            <div className="flex items-center gap-3 text-xs font-display">
              <span className="flex items-center gap-1 text-gold-500">
                <Crown className="w-3 h-3" /> {legendaryCount}
              </span>
              <span className="flex items-center gap-1 text-blue-400">
                <Star className="w-3 h-3" /> {rareCount}
              </span>
              <span className="flex items-center gap-1 text-[#FAF6EA]/40">
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
            className="text-sm text-gold-500 hover:text-gold-400 flex items-center gap-1 font-display font-bold uppercase tracking-wide"
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
          <div className="w-16 h-16 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredStaff.length === 0 ? (
        <div className="card-brutalist p-12 text-center">
          <AlertCircle className="w-16 h-16 text-[#FAF6EA]/30 mx-auto mb-4" />
          <h3 className="text-2xl font-display font-black text-[#FAF6EA] uppercase mb-2">
            No Staff Found
          </h3>
          <p className="text-[#FAF6EA]/60 font-display">
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
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="card-brutalist p-6 w-full max-w-md"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-display font-black text-[#FAF6EA] uppercase tracking-tight">
                    Confirm Purchase
                  </h3>
                  <button
                    onClick={() => setSelectedStaff(null)}
                    className="p-2 text-[#FAF6EA]/60 hover:text-[#FAF6EA] hover:bg-[#2A2A2A] rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Staff Preview */}
                <div className="space-y-4 mb-6">
                  <div className="flex items-start gap-4 p-4 bg-[#0D0D0D] rounded-xl border-2 border-[#2A2A2A]">
                    <div className="w-14 h-14 bg-gold-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      {React.createElement(CAPTION_ICONS[selectedStaff.caption] || Award, {
                        className: 'w-7 h-7 text-gold-500'
                      })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-display font-black text-[#FAF6EA] uppercase tracking-tight truncate">
                        {selectedStaff.name}
                      </h4>
                      <p className="text-sm text-[#FAF6EA]/60 mb-2 line-clamp-2">
                        {selectedStaff.biography}
                      </p>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold text-white ${getCaptionColor(selectedStaff.caption)}`}>
                          {selectedStaff.caption}
                        </span>
                        <span className="text-[10px] text-[#FAF6EA]/40 font-mono">
                          HOF {selectedStaff.yearInducted}
                        </span>
                        <span className={`text-[10px] font-display font-bold uppercase ${
                          getRarity(selectedStaff.baseValue) === 'legendary' ? 'text-gold-500' :
                          getRarity(selectedStaff.baseValue) === 'rare' ? 'text-blue-400' : 'text-[#FAF6EA]/40'
                        }`}>
                          {getRarity(selectedStaff.baseValue)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="flex items-center justify-between p-4 bg-[#0D0D0D] rounded-xl border-2 border-[#2A2A2A]">
                    <span className="text-[#FAF6EA]/60 font-display uppercase tracking-wider">Cost</span>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-6 h-6 text-gold-500" />
                      <span className="text-3xl font-mono font-black text-gold-500">{selectedStaff.baseValue}</span>
                    </div>
                  </div>

                  {/* Balance */}
                  <div className="flex items-center justify-between p-4 bg-[#0D0D0D] rounded-xl border-2 border-[#2A2A2A]">
                    <span className="text-[#FAF6EA]/60 font-display uppercase tracking-wider">Your Balance</span>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-5 h-5 text-[#FAF6EA]/60" />
                      <span className="text-xl font-mono font-bold text-[#FAF6EA]">{corpsCoin}</span>
                    </div>
                  </div>

                  {/* After Purchase */}
                  {canAfford(selectedStaff.baseValue) && (
                    <div className="flex items-center justify-between p-4 bg-green-500/10 rounded-xl border-2 border-green-500/30">
                      <span className="text-green-400 font-display uppercase tracking-wider">After Purchase</span>
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        <span className="text-xl font-mono font-bold text-green-400">
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
                    className="flex-1 px-4 py-3 bg-[#2A2A2A] text-[#FAF6EA] rounded-xl hover:bg-[#3A3A3A] transition-colors font-display font-bold uppercase tracking-wide"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handlePurchase(selectedStaff)}
                    disabled={purchasing || !canAfford(selectedStaff.baseValue)}
                    className={`flex-1 px-4 py-3 rounded-xl font-display font-bold uppercase tracking-wide flex items-center justify-center gap-2 transition-all ${
                      canAfford(selectedStaff.baseValue)
                        ? 'bg-gold-500 text-charcoal-900 hover:bg-gold-400 shadow-brutal-gold'
                        : 'bg-charcoal-700 text-charcoal-400 cursor-not-allowed'
                    }`}
                  >
                    {purchasing ? (
                      <>
                        <div className="w-5 h-5 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
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
