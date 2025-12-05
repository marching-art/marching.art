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
// TABLE ROW COMPONENT - ~60px height, high density
// ============================================================================
const StaffTableRow = ({ staff, index, isSelected, owned, canAfford, onClick }) => {
  const CaptionIcon = CAPTION_ICONS[staff.caption] || Award;
  const boostPercent = Math.round(staff.baseValue / 100);
  const rarity = getRarity(staff.baseValue);
  const isLegendary = rarity === 'legendary';

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      className={`
        h-[60px] cursor-pointer transition-all duration-150 group
        ${index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}
        ${isSelected
          ? 'bg-gold-500/10 border-l-2 border-l-gold-500'
          : 'border-l-2 border-l-transparent hover:bg-white/5 hover:border-l-gold-500/50'
        }
        ${owned ? 'opacity-60' : ''}
      `}
    >
      {/* Name/Role Column */}
      <td className="px-3 py-2">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div className={`
            w-10 h-10 flex items-center justify-center flex-shrink-0
            ${isLegendary ? 'bg-gold-500/20 border border-gold-500/40' : 'bg-white/5 border border-white/10'}
          `}>
            <CaptionIcon className={`w-5 h-5 ${isLegendary ? 'text-gold-500' : 'text-cream/60'}`} />
          </div>

          {/* Name & Role */}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-sm text-cream truncate uppercase tracking-wide">
                {staff.name}
              </span>
              {isLegendary && (
                <Star className="w-3 h-3 text-gold-500 fill-gold-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`
                inline-flex px-1.5 py-0.5 text-[9px] font-mono font-bold uppercase
                ${getRarityColor(staff.baseValue)} border
              `}>
                {getRarityLabel(staff.baseValue)}
              </span>
              <span className="text-[10px] font-mono text-cream/40">
                {staff.caption} • {staff.yearInducted || '----'}
              </span>
            </div>
          </div>
        </div>
      </td>

      {/* Boost Column */}
      <td className="px-3 py-2 hidden md:table-cell">
        <span className={`
          inline-flex items-center gap-1 px-2 py-1 text-xs font-mono font-bold
          ${boostPercent >= 3 ? 'text-green-400 bg-green-500/15' : 'text-cream/60 bg-white/5'}
          border ${boostPercent >= 3 ? 'border-green-500/30' : 'border-white/10'}
        `}>
          <TrendingUp className="w-3 h-3" />
          +{boostPercent}%
        </span>
      </td>

      {/* Status Column */}
      <td className="px-3 py-2 hidden sm:table-cell">
        {owned ? (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold uppercase text-green-400 bg-green-500/15 border border-green-500/30">
            <Check className="w-3 h-3" />
            OWNED
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-mono font-bold uppercase text-cream/50 bg-white/5 border border-white/10">
            AVAILABLE
          </span>
        )}
      </td>

      {/* Cost Column - Right Aligned */}
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          <DollarSign className={`w-4 h-4 ${canAfford || owned ? 'text-gold-500' : 'text-red-400/60'}`} />
          <span className={`font-mono font-bold text-sm ${canAfford || owned ? 'text-gold-500' : 'text-red-400/60'}`}>
            {staff.baseValue.toLocaleString()}
          </span>
        </div>
      </td>
    </motion.tr>
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

        {/* Header Bar */}
        <div className="p-4 border-b border-cream/10 bg-black/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
            <div>
              <h1 className="font-display font-black text-xl text-cream uppercase tracking-wide">Scouting Report</h1>
              <p className="text-xs text-cream/40 font-mono mt-0.5">Recruit Hall of Fame legends to boost your corps</p>
            </div>

            {/* Balance */}
            <div className="flex items-center gap-2 px-3 py-2 bg-black/60 border border-gold-500/30">
              <DollarSign className="w-4 h-4 text-gold-500" />
              <span className="font-mono font-bold text-gold-500">{corpsCoin.toLocaleString()}</span>
              <span className="text-[10px] font-mono text-cream/40">CC</span>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/30" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name..."
                className="w-full pl-10 pr-3 py-2 bg-black/60 border-2 border-cream/10 text-cream text-sm font-mono placeholder:text-cream/30 focus:outline-none focus:border-gold-500/50"
              />
            </div>

            {/* Caption Filter */}
            <div className="relative">
              <select
                value={captionFilter}
                onChange={(e) => setCaptionFilter(e.target.value)}
                className="w-full sm:w-auto px-3 py-2 bg-black/60 border-2 border-cream/10 text-cream text-sm font-mono focus:outline-none focus:border-gold-500/50 appearance-none pr-8 cursor-pointer"
              >
                <option value="all">All Roles</option>
                {CAPTION_OPTIONS.filter(o => o.value !== 'all').map(option => (
                  <option key={option.value} value={option.value}>{option.value} - {option.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-cream/40 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Results Bar */}
        <div className="px-4 py-2 border-b border-cream/5 bg-black/20 flex items-center justify-between">
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-cream/40">
              <span className="text-cream font-bold">{filteredStaff.length}</span> staff
            </span>
            <span className="text-gold-500">
              <Crown className="w-3 h-3 inline mr-1" />{legendaryCount}
            </span>
            <span className="text-green-400">
              <Check className="w-3 h-3 inline mr-1" />{ownedCount} owned
            </span>
          </div>
          {(searchTerm || captionFilter !== 'all') && (
            <button
              onClick={() => { setSearchTerm(''); setCaptionFilter('all'); }}
              className="text-xs font-mono text-gold-500 hover:text-gold-400 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>

        {/* Data Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                <p className="text-xs font-mono text-cream/40 uppercase tracking-widest">Loading Market Data...</p>
              </div>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-8">
                <User className="w-12 h-12 text-cream/20 mx-auto mb-3" />
                <p className="font-mono text-sm text-cream/40">No staff found</p>
                <p className="font-mono text-xs text-cream/20 mt-1">Try adjusting filters</p>
              </div>
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-black/80 backdrop-blur-sm z-10">
                <tr className="text-left border-b border-cream/10">
                  <th
                    onClick={() => handleSort('name')}
                    className="px-3 py-3 font-mono text-[10px] text-cream/50 uppercase tracking-widest cursor-pointer hover:text-cream transition-colors"
                  >
                    <div className="flex items-center gap-1">
                      Name / Role <SortIcon column="name" />
                    </div>
                  </th>
                  <th
                    onClick={() => handleSort('boost')}
                    className="px-3 py-3 font-mono text-[10px] text-cream/50 uppercase tracking-widest cursor-pointer hover:text-cream transition-colors hidden md:table-cell"
                  >
                    <div className="flex items-center gap-1">
                      Boost <SortIcon column="boost" />
                    </div>
                  </th>
                  <th className="px-3 py-3 font-mono text-[10px] text-cream/50 uppercase tracking-widest hidden sm:table-cell">
                    Status
                  </th>
                  <th
                    onClick={() => handleSort('cost')}
                    className="px-3 py-3 font-mono text-[10px] text-cream/50 uppercase tracking-widest cursor-pointer hover:text-cream transition-colors text-right"
                  >
                    <div className="flex items-center justify-end gap-1">
                      Cost <SortIcon column="cost" />
                    </div>
                  </th>
                </tr>
              </thead>
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
                  />
                ))}
              </tbody>
            </table>
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
