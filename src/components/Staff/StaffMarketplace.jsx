// src/components/Staff/StaffMarketplace.jsx
// "The Trading Floor" - High-Density Data Table with Master-Detail View
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, DollarSign, Award, Search, X,
  ChevronDown, ChevronUp, Trophy, Check, Lock,
  Music, Eye, Flag, Drum, Sparkles, Star, Crown,
  ArrowUpDown, User, TrendingUp, Calendar, FileText
} from 'lucide-react';
import { useAuth } from '../../App';
import { useStaffMarketplace } from '../../hooks/useStaffMarketplace';
import { CAPTION_OPTIONS, getCaptionColor, getCaptionLabel } from '../../utils/captionUtils';
import toast from 'react-hot-toast';

// ============================================================================
// CAPTION ICONS MAPPING
// ============================================================================
const CAPTION_ICONS = {
  GE1: Crown,
  GE2: Award,
  VP: Eye,
  VA: Eye,
  CG: Flag,
  B: Music,
  MA: Sparkles,
  P: Drum,
};

// Rarity determination based on base value
const getRarity = (baseValue) => {
  if (baseValue >= 300) return 'legendary';
  if (baseValue >= 150) return 'rare';
  return 'common';
};

const getRarityLabel = (baseValue) => {
  const rarity = getRarity(baseValue);
  return rarity === 'legendary' ? 'HOF' : rarity === 'rare' ? 'RARE' : 'STD';
};

const getRarityColor = (baseValue) => {
  const rarity = getRarity(baseValue);
  if (rarity === 'legendary') return 'text-gold-500 bg-gold-500/20 border-gold-500/40';
  if (rarity === 'rare') return 'text-blue-400 bg-blue-500/20 border-blue-500/40';
  return 'text-cream/50 bg-white/5 border-white/10';
};

// ============================================================================
// TABLE ROW COMPONENT - ~44px height, maximum density
// Monospaced fonts for all numerical values, zebra striping, fixed action column
// ============================================================================
const StaffTableRow = ({ staff, index, isSelected, owned, canAfford, onClick, onRecruit }) => {
  const CaptionIcon = CAPTION_ICONS[staff.caption] || Award;
  const boostPercent = Math.round(staff.baseValue / 100);
  const rarity = getRarity(staff.baseValue);
  const isLegendary = rarity === 'legendary';

  return (
    <tr
      onClick={onClick}
      className={`
        h-[44px] cursor-pointer transition-colors duration-100 group
        ${index % 2 === 0 ? 'bg-white/5' : 'bg-transparent'}
        ${isSelected ? 'bg-gold-500/15' : 'hover:bg-white/[0.08]'}
        ${owned ? 'opacity-50' : ''}
      `}
    >
      {/* Name/Role Column - Compact */}
      <td className="py-1 px-2">
        <div className="flex items-center gap-2">
          {/* Icon - Smaller */}
          <div className={`
            w-7 h-7 flex items-center justify-center flex-shrink-0 rounded
            ${isLegendary ? 'bg-gold-500/20' : 'bg-white/5'}
          `}>
            <CaptionIcon className={`w-4 h-4 ${isLegendary ? 'text-gold-500' : 'text-cream/50'}`} />
          </div>

          {/* Name & Role - Compact */}
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-display font-bold text-xs text-cream truncate uppercase tracking-wide">
                {staff.name}
              </span>
              {isLegendary && (
                <Star className="w-2.5 h-2.5 text-gold-500 fill-gold-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[8px] font-mono font-bold uppercase ${
                isLegendary ? 'text-gold-500' : rarity === 'rare' ? 'text-blue-400' : 'text-cream/40'
              }`}>
                {getRarityLabel(staff.baseValue)}
              </span>
              <span className="text-[9px] font-mono text-cream/30">
                {staff.caption}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Year Column - Monospace */}
      <td className="py-1 px-2 hidden lg:table-cell">
        <span className="font-mono text-xs text-cream/50">{staff.yearInducted || '----'}</span>
      </td>

      {/* Boost Column - Monospace */}
      <td className="py-1 px-2 hidden md:table-cell">
        <span className={`font-mono text-xs font-bold ${boostPercent >= 3 ? 'text-green-400' : 'text-cream/50'}`}>
          +{boostPercent}%
        </span>
      </td>

      {/* Status Column */}
      <td className="py-1 px-2 hidden sm:table-cell">
        {owned ? (
          <span className="text-[9px] font-mono font-bold text-green-400 uppercase">Owned</span>
        ) : (
          <span className="text-[9px] font-mono text-cream/40 uppercase">Avail</span>
        )}
      </td>

      {/* Cost Column - Monospace, Right Aligned */}
      <td className="py-1 px-2 text-right">
        <span className={`font-mono text-xs font-bold ${canAfford || owned ? 'text-gold-400' : 'text-red-400/60'}`}>
          {staff.baseValue.toLocaleString()}
        </span>
      </td>

      {/* Action Column - Fixed Right */}
      <td className="py-1 px-2 text-right sticky right-0 bg-inherit">
        {owned ? (
          <Check className="w-4 h-4 text-green-400 ml-auto" />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onRecruit(staff); }}
            disabled={!canAfford}
            className={`
              px-2 py-1 text-[9px] font-mono font-bold uppercase tracking-wide rounded
              transition-colors
              ${canAfford
                ? 'bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 border border-gold-500/30'
                : 'bg-white/5 text-cream/30 cursor-not-allowed border border-white/10'
              }
            `}
          >
            Recruit
          </button>
        )}
      </td>
    </tr>
  );
};

// ============================================================================
// DETAIL PANEL COMPONENT - Scouting Report
// ============================================================================
const DetailPanel = ({ staff, owned, canAfford, corpsCoin, purchasing, onPurchase, onClose }) => {
  const CaptionIcon = CAPTION_ICONS[staff.caption] || Award;
  const boostPercent = Math.round(staff.baseValue / 100);
  const rarity = getRarity(staff.baseValue);
  const isLegendary = rarity === 'legendary';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="h-full flex flex-col bg-black/60 backdrop-blur-xl border-l border-cream/10 overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-cream/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gold-500" />
          <span className="font-mono text-xs text-gold-500 uppercase tracking-widest">Scouting Report</span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-cream/40 hover:text-cream hover:bg-white/10 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Profile Header */}
        <div className="flex items-start gap-4">
          <div className={`
            w-16 h-16 flex items-center justify-center flex-shrink-0
            ${isLegendary ? 'bg-gold-500/20 border-2 border-gold-500/40' : 'bg-white/5 border-2 border-white/10'}
          `}>
            <CaptionIcon className={`w-8 h-8 ${isLegendary ? 'text-gold-500' : 'text-cream/60'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-black text-lg text-cream uppercase tracking-wide">
              {staff.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`
                inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-mono font-bold uppercase
                ${getRarityColor(staff.baseValue)} border
              `}>
                {isLegendary && <Star className="w-2.5 h-2.5 fill-current" />}
                {getRarityLabel(staff.baseValue)}
              </span>
              <span className="text-[10px] font-mono text-cream/40">
                {getCaptionLabel(staff.caption)}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 bg-black/40 border border-cream/5">
            <p className="text-[10px] font-mono text-cream/40 uppercase tracking-wider mb-1">Caption</p>
            <p className="font-mono font-bold text-cream">{staff.caption}</p>
          </div>
          <div className="p-3 bg-black/40 border border-cream/5">
            <p className="text-[10px] font-mono text-cream/40 uppercase tracking-wider mb-1">Inducted</p>
            <p className="font-mono font-bold text-cream">{staff.yearInducted || 'N/A'}</p>
          </div>
          <div className="p-3 bg-black/40 border border-cream/5">
            <p className="text-[10px] font-mono text-cream/40 uppercase tracking-wider mb-1">Boost</p>
            <p className="font-mono font-bold text-green-400">+{boostPercent}%</p>
          </div>
          <div className="p-3 bg-black/40 border border-cream/5">
            <p className="text-[10px] font-mono text-cream/40 uppercase tracking-wider mb-1">Rarity</p>
            <p className={`font-mono font-bold ${isLegendary ? 'text-gold-500' : rarity === 'rare' ? 'text-blue-400' : 'text-cream/60'}`}>
              {rarity.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Biography */}
        <div className="p-3 bg-black/40 border border-cream/5">
          <p className="text-[10px] font-mono text-cream/40 uppercase tracking-wider mb-2">Biography</p>
          <p className="text-xs text-cream/70 leading-relaxed">
            {staff.biography || 'A legendary member of the DCI Hall of Fame. Their contributions to the activity have shaped the modern marching arts.'}
          </p>
        </div>

        {/* Effectiveness */}
        <div className="p-3 bg-black/40 border border-cream/5">
          <p className="text-[10px] font-mono text-cream/40 uppercase tracking-wider mb-2">Effectiveness</p>
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-mono text-cream/60">Score Impact</span>
                <span className="font-mono text-green-400">+{boostPercent}%</span>
              </div>
              <div className="h-2 bg-black/60 border border-cream/10">
                <div
                  className="h-full bg-gradient-to-r from-green-500 to-green-400"
                  style={{ width: `${Math.min(boostPercent * 10, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Footer */}
      <div className="p-4 border-t border-cream/10 bg-black/40 space-y-3">
        {/* Price Display */}
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-cream/40 uppercase tracking-wider">Cost</span>
          <div className="flex items-center gap-1">
            <DollarSign className="w-5 h-5 text-gold-500" />
            <span className="font-mono font-black text-xl text-gold-500">{staff.baseValue.toLocaleString()}</span>
          </div>
        </div>

        {/* Balance Display */}
        <div className="flex items-center justify-between text-xs">
          <span className="font-mono text-cream/40 uppercase tracking-wider">Your Balance</span>
          <span className={`font-mono font-bold ${canAfford ? 'text-cream' : 'text-red-400'}`}>
            {corpsCoin.toLocaleString()} CC
          </span>
        </div>

        {/* Purchase Button */}
        {owned ? (
          <button
            disabled
            className="w-full py-3 flex items-center justify-center gap-2 bg-green-500/20 border-2 border-green-500/40 text-green-400 font-mono text-xs uppercase tracking-widest"
          >
            <Check className="w-4 h-4" />
            Already Owned
          </button>
        ) : (
          <button
            onClick={() => onPurchase(staff)}
            disabled={purchasing || !canAfford}
            className={`
              w-full py-3 flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-widest
              border-2 transition-all duration-150
              ${canAfford
                ? 'bg-gold-500 border-gold-400 text-black hover:bg-gold-400 shadow-[0_0_20px_rgba(234,179,8,0.3)]'
                : 'bg-charcoal-800 border-cream/10 text-cream/40 cursor-not-allowed'
              }
              disabled:opacity-50
            `}
          >
            {purchasing ? (
              <>
                <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : !canAfford ? (
              <>
                <Lock className="w-4 h-4" />
                Insufficient Funds
              </>
            ) : (
              <>
                <ShoppingCart className="w-4 h-4" />
                Purchase Staff
              </>
            )}
          </button>
        )}
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
  const [sortDirection, setSortDirection] = useState('desc');
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);

  useEffect(() => {
    fetchMarketplace(captionFilter === 'all' ? null : captionFilter);
  }, [captionFilter]);

  useEffect(() => {
    filterAndSortStaff();
  }, [marketplace, searchTerm, sortBy, sortDirection]);

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
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'newest':
          comparison = (b.yearInducted || 0) - (a.yearInducted || 0);
          break;
        case 'cost':
          comparison = a.baseValue - b.baseValue;
          break;
        case 'boost':
          comparison = a.baseValue - b.baseValue;
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    setFilteredStaff(filtered);
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const handlePurchase = async (staff) => {
    if (ownsStaff(staff.id)) {
      toast.error('You already own this staff member');
      return;
    }

    if (!canAfford(staff.baseValue)) {
      toast.error(`Need ${staff.baseValue - corpsCoin} more CorpsCoin`);
      return;
    }

    try {
      await purchaseStaff(staff.id);
      setSelectedStaff(null);
    } catch (error) {
      // Error handled in hook
    }
  };

  // Count stats
  const legendaryCount = filteredStaff.filter(s => getRarity(s.baseValue) === 'legendary').length;
  const ownedCount = filteredStaff.filter(s => ownsStaff(s.id)).length;

  const SortIcon = ({ column }) => {
    if (sortBy !== column) return <ArrowUpDown className="w-3 h-3 text-cream/30" />;
    return sortDirection === 'asc'
      ? <ChevronUp className="w-3 h-3 text-gold-500" />
      : <ChevronDown className="w-3 h-3 text-gold-500" />;
  };

  return (
    <div className="h-full flex flex-col lg:flex-row overflow-hidden">

      {/* Main List Panel */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Header Bar - Compact */}
        <div className="shrink-0 p-2 border-b border-white/10 bg-black/40">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-3">
              <h1 className="font-display font-bold text-sm text-cream uppercase tracking-wide">Staff Market</h1>
              <div className="flex items-center gap-2 text-[9px] font-mono">
                <span className="text-cream/40"><span className="text-cream font-bold">{filteredStaff.length}</span> staff</span>
                <span className="text-gold-500"><Crown className="w-2.5 h-2.5 inline" /> {legendaryCount}</span>
                <span className="text-green-400"><Check className="w-2.5 h-2.5 inline" /> {ownedCount}</span>
              </div>
            </div>

            {/* Balance */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black/60 border border-gold-500/30 rounded">
              <DollarSign className="w-3 h-3 text-gold-500" />
              <span className="font-mono text-xs font-bold text-gold-500">{corpsCoin.toLocaleString()}</span>
            </div>
          </div>

          {/* Search & Filters - Single row */}
          <div className="flex gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-cream/30" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-2 py-1.5 bg-black/60 border border-white/10 rounded text-cream text-xs font-mono placeholder:text-cream/30 focus:outline-none focus:border-gold-500/50"
              />
            </div>

            {/* Caption Filter */}
            <div className="relative">
              <select
                value={captionFilter}
                onChange={(e) => setCaptionFilter(e.target.value)}
                className="w-full sm:w-auto px-2 py-1.5 bg-black/60 border border-white/10 rounded text-cream text-xs font-mono focus:outline-none focus:border-gold-500/50 appearance-none pr-6 cursor-pointer"
              >
                <option value="all">All</option>
                {CAPTION_OPTIONS.filter(o => o.value !== 'all').map(option => (
                  <option key={option.value} value={option.value}>{option.value}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-cream/40 pointer-events-none" />
            </div>

            {/* Clear filters */}
            {(searchTerm || captionFilter !== 'all') && (
              <button
                onClick={() => { setSearchTerm(''); setCaptionFilter('all'); }}
                className="px-2 py-1.5 text-[9px] font-mono text-gold-400 hover:text-gold-300 border border-gold-500/30 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* ================================================================
            DATA TABLE: High-density with sticky header and internal scroll
            ================================================================ */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-[10px] font-mono text-cream/40 uppercase tracking-widest">Loading...</p>
              </div>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-4">
                <User className="w-8 h-8 text-cream/20 mx-auto mb-2" />
                <p className="font-mono text-xs text-cream/40">No staff found</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              {/* Table with sticky header */}
              <table className="w-full table-fixed">
                <thead className="sticky top-0 z-10 bg-black/90 backdrop-blur-sm">
                  <tr className="border-b border-white/10">
                    <th
                      onClick={() => handleSort('name')}
                      className="py-1 px-2 font-mono text-[9px] text-cream/50 uppercase tracking-wide cursor-pointer hover:text-cream transition-colors text-left w-[40%]"
                    >
                      <div className="flex items-center gap-1">
                        Name <SortIcon column="name" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('newest')}
                      className="py-1 px-2 font-mono text-[9px] text-cream/50 uppercase tracking-wide cursor-pointer hover:text-cream transition-colors text-left hidden lg:table-cell w-[10%]"
                    >
                      <div className="flex items-center gap-1">
                        Year <SortIcon column="newest" />
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('boost')}
                      className="py-1 px-2 font-mono text-[9px] text-cream/50 uppercase tracking-wide cursor-pointer hover:text-cream transition-colors text-left hidden md:table-cell w-[10%]"
                    >
                      <div className="flex items-center gap-1">
                        Boost <SortIcon column="boost" />
                      </div>
                    </th>
                    <th className="py-1 px-2 font-mono text-[9px] text-cream/50 uppercase tracking-wide text-left hidden sm:table-cell w-[10%]">
                      Status
                    </th>
                    <th
                      onClick={() => handleSort('cost')}
                      className="py-1 px-2 font-mono text-[9px] text-cream/50 uppercase tracking-wide cursor-pointer hover:text-cream transition-colors text-right w-[15%]"
                    >
                      <div className="flex items-center justify-end gap-1">
                        Cost <SortIcon column="cost" />
                      </div>
                    </th>
                    <th className="py-1 px-2 font-mono text-[9px] text-cream/50 uppercase tracking-wide text-right sticky right-0 bg-black/90 w-[15%]">
                      Action
                    </th>
                  </tr>
                </thead>
              </table>

              {/* Scrollable tbody container */}
              <div className="overflow-y-auto hud-scroll" style={{ height: 'calc(100% - 28px)' }}>
                <table className="w-full table-fixed">
                  <tbody>
                    {filteredStaff.map((staff, index) => (
                      <StaffTableRow
                        key={staff.id}
                        staff={staff}
                        index={index}
                        isSelected={selectedStaff?.id === staff.id}
                        owned={ownsStaff(staff.id)}
                        canAfford={canAfford(staff.baseValue)}
                        onClick={() => setSelectedStaff(staff)}
                        onRecruit={handlePurchase}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel - Right Side */}
      <AnimatePresence>
        {selectedStaff && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 320 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden lg:block h-full overflow-hidden"
          >
            <DetailPanel
              staff={selectedStaff}
              owned={ownsStaff(selectedStaff.id)}
              canAfford={canAfford(selectedStaff.baseValue)}
              corpsCoin={corpsCoin}
              purchasing={purchasing}
              onPurchase={handlePurchase}
              onClose={() => setSelectedStaff(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Detail Modal */}
      <AnimatePresence>
        {selectedStaff && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm"
            onClick={() => setSelectedStaff(null)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-0 left-0 right-0 max-h-[80vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <DetailPanel
                staff={selectedStaff}
                owned={ownsStaff(selectedStaff.id)}
                canAfford={canAfford(selectedStaff.baseValue)}
                corpsCoin={corpsCoin}
                purchasing={purchasing}
                onPurchase={handlePurchase}
                onClose={() => setSelectedStaff(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffMarketplace;
