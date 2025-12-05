// src/components/Staff/StaffMarketplace.jsx
// "The Trading Floor" - Tactical List Layout with Master-Detail View
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, DollarSign, Award, Search, X,
  ChevronDown, ChevronUp, Trophy, Check, Lock,
  Music, Eye, Flag, Drum, Sparkles, Star, Crown,
  ArrowUpDown, User, TrendingUp, FileText
} from 'lucide-react';
import FilterRack from './FilterRack';
import { useAuth } from '../../App';
import { useStaffMarketplace } from '../../hooks/useStaffMarketplace';
import { CAPTION_OPTIONS, getCaptionLabel } from '../../utils/captionUtils';
import { SystemLoader, ConsoleEmptyState } from '../ui/CommandConsole';
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

const getRarityBorderClass = (baseValue) => {
  const rarity = getRarity(baseValue);
  if (rarity === 'legendary') return 'rarity-legendary border-2';
  if (rarity === 'rare') return 'rarity-rare border-2';
  return 'rarity-common border';
};

// ============================================================================
// MINI STAT BAR - Ultra compact progress indicator
// ============================================================================
const MiniStatBar = ({ value, max = 100, color = 'gold' }) => {
  const percent = Math.min((value / max) * 100, 100);
  const colorClasses = {
    gold: 'bg-gold-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
  };

  return (
    <div className="mini-stat-bar">
      <div
        className={`mini-stat-bar-fill ${colorClasses[color]}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

// ============================================================================
// TACTICAL STAFF ROW - h-12 max, high-density layout
// Avatar | Name/Role | Stats Grid | Cost | Action
// ============================================================================
const TacticalStaffRow = ({ staff, index, isSelected, owned, canAfford, onClick, onRecruit }) => {
  const CaptionIcon = CAPTION_ICONS[staff.caption] || Award;
  const boostPercent = Math.round(staff.baseValue / 100);
  const rarity = getRarity(staff.baseValue);
  const isLegendary = rarity === 'legendary';

  // Simulate stat values based on caption (in a real app these would come from staff data)
  const stats = {
    brass: staff.caption === 'B' ? 85 : staff.caption === 'MA' ? 60 : 40,
    perc: staff.caption === 'P' ? 85 : staff.caption === 'MA' ? 60 : 40,
    visual: ['VP', 'VA', 'CG'].includes(staff.caption) ? 85 : 40,
  };

  return (
    <div
      onClick={onClick}
      className={`
        tactical-row h-12 flex items-center gap-2 px-2 cursor-pointer border-b border-white/5
        ${index % 2 === 0 ? 'bg-white/[0.02]' : 'bg-transparent'}
        ${isSelected ? 'bg-gold-500/10 border-l-2 border-l-gold-500' : ''}
        ${owned ? 'opacity-50' : ''}
      `}
    >
      {/* Avatar - w-8 h-8 with rarity border */}
      <div className={`
        w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-lg
        ${getRarityBorderClass(staff.baseValue)}
        ${isLegendary ? 'bg-gold-500/20' : 'bg-white/5'}
      `}>
        <CaptionIcon className={`w-4 h-4 ${isLegendary ? 'text-gold-500' : 'text-cream/50'}`} />
      </div>

      {/* Name & Role - Stacked tightly */}
      <div className="min-w-0 w-32 flex-shrink-0">
        <div className="flex items-center gap-1">
          <span className="font-display font-bold text-sm text-cream truncate uppercase tracking-wide">
            {staff.name}
          </span>
          {isLegendary && (
            <Star className="w-2.5 h-2.5 text-gold-500 fill-gold-500 flex-shrink-0" />
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] uppercase ${
            isLegendary ? 'text-data-gold' : rarity === 'rare' ? 'text-data-blue' : 'text-data-muted'
          }`}>
            {staff.caption}
          </span>
          <span className="text-[9px] text-cream/30">
            '{staff.yearInducted?.toString().slice(-2) || '--'}
          </span>
        </div>
      </div>

      {/* Stats Grid - Mini sparklines/bars */}
      <div className="hidden md:flex flex-1 items-center gap-4 px-2">
        {/* Brass */}
        <div className="flex-1 max-w-16">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[8px] text-cream/40 uppercase">Brs</span>
            <span className="text-[9px] text-data-blue">{stats.brass}</span>
          </div>
          <MiniStatBar value={stats.brass} color="blue" />
        </div>
        {/* Percussion */}
        <div className="flex-1 max-w-16">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[8px] text-cream/40 uppercase">Per</span>
            <span className="text-[9px] text-data-purple">{stats.perc}</span>
          </div>
          <MiniStatBar value={stats.perc} color="purple" />
        </div>
        {/* Visual */}
        <div className="flex-1 max-w-16">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[8px] text-cream/40 uppercase">Vis</span>
            <span className="text-[9px] text-data-success">{stats.visual}</span>
          </div>
          <MiniStatBar value={stats.visual} color="green" />
        </div>
      </div>

      {/* Boost - Compact */}
      <div className="hidden sm:block w-12 text-center flex-shrink-0">
        <span className={`text-xs font-bold ${boostPercent >= 3 ? 'text-data-success' : 'text-data-muted'}`}>
          +{boostPercent}%
        </span>
      </div>

      {/* Cost - Right aligned, text-data gold */}
      <div className="w-16 text-right flex-shrink-0">
        <span className={`text-sm font-bold ${canAfford || owned ? 'text-data-gold' : 'text-data-error'}`}>
          {staff.baseValue.toLocaleString()}
        </span>
      </div>

      {/* Action - Compact button */}
      <div className="w-16 flex-shrink-0 flex justify-end">
        {owned ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onRecruit(staff); }}
            disabled={!canAfford}
            className={`
              px-2 py-1 text-[9px] font-bold uppercase tracking-wide rounded
              transition-colors
              ${canAfford
                ? 'bg-gold-500/20 text-gold-400 hover:bg-gold-500/30 border border-gold-500/30'
                : 'bg-white/5 text-cream/30 cursor-not-allowed border border-white/10'
              }
            `}
          >
            Buy
          </button>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// DOSSIER PANEL - Staff Detail Side Panel
// ============================================================================
const DossierPanel = ({ staff, owned, canAfford, corpsCoin, purchasing, onPurchase, onClose }) => {
  const CaptionIcon = CAPTION_ICONS[staff.caption] || Award;
  const boostPercent = Math.round(staff.baseValue / 100);
  const rarity = getRarity(staff.baseValue);
  const isLegendary = rarity === 'legendary';

  // Stats for display
  const stats = {
    brass: staff.caption === 'B' ? 85 : staff.caption === 'MA' ? 60 : 40,
    perc: staff.caption === 'P' ? 85 : staff.caption === 'MA' ? 60 : 40,
    visual: ['VP', 'VA', 'CG'].includes(staff.caption) ? 85 : 40,
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.2 }}
      className="h-full flex flex-col bg-black/60 backdrop-blur-xl border-l border-cream/10 overflow-hidden"
    >
      {/* Header */}
      <div className="shrink-0 p-3 border-b border-cream/10 flex items-center justify-between bg-black/40">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gold-500" />
          <span className="text-[10px] text-data-gold uppercase tracking-widest">Dossier</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-cream/40 hover:text-cream hover:bg-white/10 rounded transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto hud-scroll p-3 space-y-3">
        {/* Profile Header */}
        <div className="flex items-start gap-3">
          <div className={`
            w-14 h-14 flex items-center justify-center flex-shrink-0 rounded-lg
            ${getRarityBorderClass(staff.baseValue)}
            ${isLegendary ? 'bg-gold-500/20' : 'bg-white/5'}
          `}>
            <CaptionIcon className={`w-7 h-7 ${isLegendary ? 'text-gold-500' : 'text-cream/60'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-black text-lg text-cream uppercase tracking-wide truncate">
              {staff.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className={`
                inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase rounded
                ${isLegendary ? 'bg-gold-500/20 text-gold-400' : rarity === 'rare' ? 'bg-blue-500/20 text-blue-400' : 'bg-white/10 text-cream/50'}
              `}>
                {isLegendary && <Star className="w-2.5 h-2.5 fill-current" />}
                {getRarityLabel(staff.baseValue)}
              </span>
              <span className="text-[10px] text-data-muted">
                {getCaptionLabel(staff.caption)}
              </span>
            </div>
          </div>
        </div>

        {/* Stats Bars */}
        <div className="bg-black/40 border border-cream/5 rounded-lg p-3 space-y-2">
          <p className="text-[9px] text-data-muted uppercase tracking-wider mb-2">Performance Stats</p>
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-cream/60">Brass</span>
                <span className="text-xs text-data-blue font-bold">{stats.brass}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${stats.brass}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-cream/60">Percussion</span>
                <span className="text-xs text-data-purple font-bold">{stats.perc}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full" style={{ width: `${stats.perc}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-cream/60">Visual</span>
                <span className="text-xs text-data-success font-bold">{stats.visual}</span>
              </div>
              <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full" style={{ width: `${stats.visual}%` }} />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 gap-2">
          <div className="p-2 bg-black/40 border border-cream/5 rounded">
            <p className="text-[9px] text-data-muted uppercase mb-0.5">Caption</p>
            <p className="text-sm font-bold text-data">{staff.caption}</p>
          </div>
          <div className="p-2 bg-black/40 border border-cream/5 rounded">
            <p className="text-[9px] text-data-muted uppercase mb-0.5">Inducted</p>
            <p className="text-sm font-bold text-data">{staff.yearInducted || 'N/A'}</p>
          </div>
          <div className="p-2 bg-black/40 border border-cream/5 rounded">
            <p className="text-[9px] text-data-muted uppercase mb-0.5">Boost</p>
            <p className="text-sm font-bold text-data-success">+{boostPercent}%</p>
          </div>
          <div className="p-2 bg-black/40 border border-cream/5 rounded">
            <p className="text-[9px] text-data-muted uppercase mb-0.5">Rarity</p>
            <p className={`text-sm font-bold ${isLegendary ? 'text-data-gold' : rarity === 'rare' ? 'text-data-blue' : 'text-data-muted'}`}>
              {rarity.toUpperCase()}
            </p>
          </div>
        </div>

        {/* Biography */}
        <div className="p-2 bg-black/40 border border-cream/5 rounded">
          <p className="text-[9px] text-data-muted uppercase mb-1">Biography</p>
          <p className="text-xs text-cream/70 leading-relaxed">
            {staff.biography || 'A legendary member of the DCI Hall of Fame. Their contributions to the activity have shaped the modern marching arts.'}
          </p>
        </div>
      </div>

      {/* Purchase Footer */}
      <div className="shrink-0 p-3 border-t border-cream/10 bg-black/60 space-y-2">
        {/* Price Display */}
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-data-muted uppercase">Cost</span>
          <div className="flex items-center gap-1">
            <DollarSign className="w-4 h-4 text-gold-500" />
            <span className="text-lg font-bold text-data-gold">{staff.baseValue.toLocaleString()}</span>
          </div>
        </div>

        {/* Balance */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-data-muted uppercase">Balance</span>
          <span className={`font-bold ${canAfford ? 'text-data' : 'text-data-error'}`}>
            {corpsCoin.toLocaleString()} CC
          </span>
        </div>

        {/* Purchase Button */}
        {owned ? (
          <button
            disabled
            className="w-full py-2.5 flex items-center justify-center gap-2 bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-bold uppercase tracking-wide rounded"
          >
            <Check className="w-4 h-4" />
            Owned
          </button>
        ) : (
          <button
            onClick={() => onPurchase(staff)}
            disabled={purchasing || !canAfford}
            className={`
              w-full py-2.5 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide rounded
              border transition-all duration-150
              ${canAfford
                ? 'bg-gold-500 border-gold-400 text-black hover:bg-gold-400 shadow-gold-glow-sm'
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
                Purchase
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
  const [minCost, setMinCost] = useState('');
  const [maxCost, setMaxCost] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [sortDirection, setSortDirection] = useState('desc');
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);

  useEffect(() => {
    fetchMarketplace(captionFilter === 'all' ? null : captionFilter);
  }, [captionFilter]);

  useEffect(() => {
    filterAndSortStaff();
  }, [marketplace, searchTerm, minCost, maxCost, sortBy, sortDirection]);

  const filterAndSortStaff = () => {
    let filtered = [...marketplace];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(staff =>
        staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        staff.biography?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply cost range filter
    if (minCost) {
      const min = parseInt(minCost, 10);
      if (!isNaN(min)) {
        filtered = filtered.filter(staff => staff.baseValue >= min);
      }
    }
    if (maxCost) {
      const max = parseInt(maxCost, 10);
      if (!isNaN(max)) {
        filtered = filtered.filter(staff => staff.baseValue <= max);
      }
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

  // Check if any filters are active
  const hasActiveFilters = searchTerm || captionFilter !== 'all' || minCost || maxCost;

  // Clear all filters
  const handleClearFilters = () => {
    setSearchTerm('');
    setCaptionFilter('all');
    setMinCost('');
    setMaxCost('');
  };

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

        {/* Header Bar - Compact stats and balance */}
        <div className="shrink-0 p-2 border-b border-white/10 bg-black/40">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <h1 className="font-display font-bold text-sm text-cream uppercase tracking-wide">Staff Market</h1>
              <div className="flex items-center gap-2 text-[9px]">
                <span className="text-data-muted"><span className="text-data font-bold">{filteredStaff.length}</span> staff</span>
                <span className="text-data-gold"><Crown className="w-2.5 h-2.5 inline" /> {legendaryCount}</span>
                <span className="text-data-success"><Check className="w-2.5 h-2.5 inline" /> {ownedCount}</span>
              </div>
            </div>

            {/* Balance */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black/60 border border-gold-500/30 rounded">
              <DollarSign className="w-3 h-3 text-gold-500" />
              <span className="text-xs font-bold text-data-gold">{corpsCoin.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Filter Rack - Responsive filter controls */}
        <FilterRack
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          captionFilter={captionFilter}
          onCaptionChange={setCaptionFilter}
          minCost={minCost}
          maxCost={maxCost}
          onMinCostChange={setMinCost}
          onMaxCostChange={setMaxCost}
          onClearFilters={handleClearFilters}
          hasActiveFilters={hasActiveFilters}
        />

        {/* Column Headers */}
        <div className="shrink-0 h-8 flex items-center gap-2 px-2 border-b border-white/10 bg-black/60 text-[9px] text-data-muted uppercase">
          <div className="w-8 flex-shrink-0" /> {/* Avatar spacer */}
          <button onClick={() => handleSort('name')} className="w-32 flex-shrink-0 flex items-center gap-1 hover:text-cream">
            Name <SortIcon column="name" />
          </button>
          <div className="hidden md:flex flex-1 items-center gap-4 px-2">
            <span className="flex-1 max-w-16">Stats</span>
          </div>
          <button onClick={() => handleSort('boost')} className="hidden sm:flex w-12 items-center justify-center gap-1 hover:text-cream">
            Boost <SortIcon column="boost" />
          </button>
          <button onClick={() => handleSort('cost')} className="w-16 flex items-center justify-end gap-1 hover:text-cream">
            Cost <SortIcon column="cost" />
          </button>
          <div className="w-16 flex-shrink-0 text-right">Action</div>
        </div>

        {/* Staff List - Scrollable */}
        <div className="flex-1 overflow-y-auto hud-scroll">
          {loading ? (
            <div className="flex items-center justify-center h-full py-8">
              <SystemLoader
                messages={[
                  'SCANNING PERSONNEL DATABASE...',
                  'RETRIEVING STAFF PROFILES...',
                  'LOADING MARKETPLACE DATA...',
                ]}
                showProgress={true}
              />
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="flex items-center justify-center h-full p-4">
              <ConsoleEmptyState
                variant="minimal"
                title="LOADING STAFF"
                subtitle="Please wait while personnel data is being retrieved."
              />
            </div>
          ) : (
            filteredStaff.map((staff, index) => (
              <TacticalStaffRow
                key={staff.id}
                staff={staff}
                index={index}
                isSelected={selectedStaff?.id === staff.id}
                owned={ownsStaff(staff.id)}
                canAfford={canAfford(staff.baseValue)}
                onClick={() => setSelectedStaff(staff)}
                onRecruit={handlePurchase}
              />
            ))
          )}
        </div>
      </div>

      {/* Dossier Panel - Right Side (Desktop) */}
      <AnimatePresence>
        {selectedStaff && (
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: 300 }}
            exit={{ width: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden lg:block h-full overflow-hidden"
          >
            <DossierPanel
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

      {/* Mobile Dossier Modal */}
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
              <DossierPanel
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
