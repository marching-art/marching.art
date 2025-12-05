// src/components/Staff/StaffRoster.jsx
// "My Roster" - Tactical List Layout with Master-Detail View
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Award, Trophy, DollarSign, Calendar, Target,
  ChevronDown, Search, X, Link as LinkIcon, Gavel,
  Music, Eye, Flag, Drum, Sparkles, Star, Crown,
  Check, ArrowUpDown, ChevronUp, FileText
} from 'lucide-react';
import { useAuth } from '../../App';
import { useStaffMarketplace } from '../../hooks/useStaffMarketplace';
import { listStaffForAuction } from '../../firebase/functions';
import { CAPTION_OPTIONS, getCaptionColor, getCaptionLabel } from '../../utils/captionUtils';
import Portal from '../Portal';

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
// TACTICAL ROSTER ROW - h-12 max, high-density layout
// ============================================================================
const TacticalRosterRow = ({ staff, index, isSelected, onClick }) => {
  const CaptionIcon = CAPTION_ICONS[staff.caption] || Award;
  const rarity = getRarity(staff.baseValue || 0);
  const isLegendary = rarity === 'legendary';
  const isAssigned = !!staff.assignedTo;

  // Simulate stat values based on caption
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
      `}
    >
      {/* Avatar - w-8 h-8 with rarity border */}
      <div className={`
        w-8 h-8 flex items-center justify-center flex-shrink-0 rounded-lg
        ${getRarityBorderClass(staff.baseValue || 0)}
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

      {/* Stats Grid - Mini bars */}
      <div className="hidden md:flex flex-1 items-center gap-4 px-2">
        <div className="flex-1 max-w-16">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[8px] text-cream/40 uppercase">Brs</span>
            <span className="text-[9px] text-data-blue">{stats.brass}</span>
          </div>
          <MiniStatBar value={stats.brass} color="blue" />
        </div>
        <div className="flex-1 max-w-16">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[8px] text-cream/40 uppercase">Per</span>
            <span className="text-[9px] text-data-purple">{stats.perc}</span>
          </div>
          <MiniStatBar value={stats.perc} color="purple" />
        </div>
        <div className="flex-1 max-w-16">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[8px] text-cream/40 uppercase">Vis</span>
            <span className="text-[9px] text-data-success">{stats.visual}</span>
          </div>
          <MiniStatBar value={stats.visual} color="green" />
        </div>
      </div>

      {/* Seasons */}
      <div className="hidden sm:block w-12 text-center flex-shrink-0">
        <span className="text-xs font-bold text-data-blue">{staff.seasonsCompleted || 0}</span>
        <div className="text-[8px] text-cream/30">Seasons</div>
      </div>

      {/* Value - text-data gold */}
      <div className="w-16 text-right flex-shrink-0">
        <span className="text-sm font-bold text-data-gold">
          {(staff.currentValue || staff.baseValue || 0).toLocaleString()}
        </span>
      </div>

      {/* Status */}
      <div className="w-20 flex-shrink-0 flex justify-end">
        {isAssigned ? (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-green-500/20 text-green-400 text-[9px] font-bold uppercase">
            <Target className="w-3 h-3" />
            Active
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded bg-white/5 text-cream/40 text-[9px] font-bold uppercase">
            Idle
          </span>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// DOSSIER PANEL - Staff Detail Side Panel (Roster Version)
// ============================================================================
const RosterDossierPanel = ({
  staff,
  userCorps,
  onAssign,
  onUnassign,
  onListAuction,
  assigning,
  onClose
}) => {
  const CaptionIcon = CAPTION_ICONS[staff.caption] || Award;
  const rarity = getRarity(staff.baseValue || 0);
  const isLegendary = rarity === 'legendary';
  const isAssigned = !!staff.assignedTo;

  const [selectedCorpsClass, setSelectedCorpsClass] = useState('');
  const [showAuctionForm, setShowAuctionForm] = useState(false);
  const [auctionMinBid, setAuctionMinBid] = useState(staff.currentValue || staff.baseValue || 100);
  const [auctionDuration, setAuctionDuration] = useState(24);

  const availableCorpsClasses = Object.keys(userCorps).sort((a, b) => {
    const classOrder = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };
    return (classOrder[a] ?? 99) - (classOrder[b] ?? 99);
  });

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
          <span className="text-[10px] text-data-gold uppercase tracking-widest">Staff Dossier</span>
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
            ${getRarityBorderClass(staff.baseValue || 0)}
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
            <p className="text-[9px] text-data-muted uppercase mb-0.5">Purchase Value</p>
            <p className="text-sm font-bold text-data-gold">{(staff.baseValue || 0).toLocaleString()}</p>
          </div>
          <div className="p-2 bg-black/40 border border-cream/5 rounded">
            <p className="text-[9px] text-data-muted uppercase mb-0.5">Current Value</p>
            <p className="text-sm font-bold text-data-success">{(staff.currentValue || staff.baseValue || 0).toLocaleString()}</p>
          </div>
          <div className="p-2 bg-black/40 border border-cream/5 rounded">
            <p className="text-[9px] text-data-muted uppercase mb-0.5">Seasons</p>
            <p className="text-sm font-bold text-data-blue">{staff.seasonsCompleted || 0}</p>
          </div>
          <div className="p-2 bg-black/40 border border-cream/5 rounded">
            <p className="text-[9px] text-data-muted uppercase mb-0.5">Acquired</p>
            <p className="text-xs font-bold text-data-purple">
              {staff.purchaseDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
            </p>
          </div>
        </div>

        {/* Assignment Status / Actions */}
        {isAssigned ? (
          <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-green-400" />
              <span className="text-xs font-bold text-green-400 uppercase">Currently Assigned</span>
            </div>
            <p className="text-[10px] text-cream/60 mb-3">
              Boosting <span className="text-cream font-bold">{getCaptionLabel(staff.caption)}</span> for{' '}
              <span className="text-cream font-bold">{staff.assignedTo.corpsName || staff.assignedTo.corpsClass}</span>
            </p>
            <button
              onClick={() => onUnassign(staff)}
              disabled={assigning}
              className="w-full py-2 text-[10px] font-bold uppercase tracking-wide rounded border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
            >
              {assigning ? 'Unassigning...' : 'Unassign Staff'}
            </button>
          </div>
        ) : (
          <>
            {/* Assign to Corps */}
            {availableCorpsClasses.length > 0 && !showAuctionForm && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Target className="w-4 h-4 text-blue-400" />
                  <span className="text-xs font-bold text-blue-400 uppercase">Assign to Corps</span>
                </div>
                <p className="text-[10px] text-cream/60 mb-2">
                  Boosts <span className="text-cream">{getCaptionLabel(staff.caption)}</span> performance
                </p>
                <select
                  value={selectedCorpsClass}
                  onChange={(e) => setSelectedCorpsClass(e.target.value)}
                  className="w-full px-2 py-1.5 mb-2 bg-black/60 border border-white/10 rounded text-cream text-xs focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">Select Corps...</option>
                  {availableCorpsClasses.map(corpsClass => {
                    const corpsData = userCorps[corpsClass];
                    return (
                      <option key={corpsClass} value={corpsClass}>
                        {corpsData?.corpsName || corpsData?.name || corpsClass}
                      </option>
                    );
                  })}
                </select>
                <button
                  onClick={() => onAssign(staff, selectedCorpsClass)}
                  disabled={assigning || !selectedCorpsClass}
                  className="w-full py-2 text-[10px] font-bold uppercase tracking-wide rounded bg-blue-500 text-white hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {assigning ? 'Assigning...' : 'Assign to Corps'}
                </button>
              </div>
            )}

            {/* Auction Form */}
            {showAuctionForm ? (
              <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Gavel className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-purple-400 uppercase">Auction Settings</span>
                </div>
                <div className="space-y-2 mb-3">
                  <div>
                    <label className="text-[9px] text-cream/60 uppercase mb-1 block">Min Bid</label>
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3 h-3 text-gold-400" />
                      <input
                        type="number"
                        min="1"
                        value={auctionMinBid}
                        onChange={(e) => setAuctionMinBid(Math.max(1, parseInt(e.target.value) || 1))}
                        className="flex-1 px-2 py-1.5 bg-black/60 border border-white/10 rounded text-cream text-xs focus:outline-none focus:border-purple-500/50"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] text-cream/60 uppercase mb-1 block">Duration</label>
                    <select
                      value={auctionDuration}
                      onChange={(e) => setAuctionDuration(parseInt(e.target.value))}
                      className="w-full px-2 py-1.5 bg-black/60 border border-white/10 rounded text-cream text-xs focus:outline-none focus:border-purple-500/50"
                    >
                      <option value={6}>6 hours</option>
                      <option value={12}>12 hours</option>
                      <option value={24}>24 hours</option>
                      <option value={48}>48 hours</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowAuctionForm(false)}
                    className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wide rounded border border-white/10 text-cream/60 hover:bg-white/5"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => onListAuction(staff, auctionMinBid, auctionDuration)}
                    className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wide rounded bg-purple-500 text-white hover:bg-purple-400"
                  >
                    List
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAuctionForm(true)}
                className="w-full p-3 bg-purple-500/10 border border-purple-500/30 rounded-lg flex items-center justify-between hover:bg-purple-500/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Gavel className="w-4 h-4 text-purple-400" />
                  <span className="text-xs font-bold text-purple-400 uppercase">List for Auction</span>
                </div>
                <ChevronDown className="w-4 h-4 text-purple-400" />
              </button>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

// ============================================================================
// MAIN ROSTER COMPONENT
// ============================================================================
const StaffRoster = ({ userCorps = {} }) => {
  const { user } = useAuth();
  const {
    ownedStaff,
    loading,
    assignStaffToCorps,
    unassignStaff
  } = useStaffMarketplace(user?.uid);

  const [searchTerm, setSearchTerm] = useState('');
  const [captionFilter, setCaptionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [assigning, setAssigning] = useState(false);

  const handleAssign = async (staff, corpsClass) => {
    if (!staff || !corpsClass) return;
    setAssigning(true);
    try {
      await assignStaffToCorps(staff.staffId, corpsClass);
      setSelectedStaff(null);
    } catch (error) {
      // Error handled in hook
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async (staff) => {
    if (!staff) return;
    setAssigning(true);
    try {
      await unassignStaff(staff.staffId);
      setSelectedStaff(null);
    } catch (error) {
      // Error handled in hook
    } finally {
      setAssigning(false);
    }
  };

  const handleListAuction = async (staff, minBid, duration) => {
    try {
      await listStaffForAuction({
        staffId: staff.staffId,
        minimumBid: minBid,
        durationHours: duration
      });
      setSelectedStaff(null);
    } catch (error) {
      console.error('Failed to list for auction:', error);
    }
  };

  // Filter and sort staff
  const filteredStaff = ownedStaff
    .filter(staff => {
      if (searchTerm && !staff.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
      if (captionFilter !== 'all' && staff.caption !== captionFilter) return false;
      if (statusFilter === 'assigned' && !staff.assignedTo) return false;
      if (statusFilter === 'unassigned' && staff.assignedTo) return false;
      return true;
    })
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'value':
          comparison = (a.currentValue || a.baseValue || 0) - (b.currentValue || b.baseValue || 0);
          break;
        case 'seasons':
          comparison = (a.seasonsCompleted || 0) - (b.seasonsCompleted || 0);
          break;
        default:
          comparison = 0;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

  const stats = {
    total: ownedStaff.length,
    assigned: ownedStaff.filter(s => s.assignedTo).length,
    unassigned: ownedStaff.filter(s => !s.assignedTo).length,
    totalValue: ownedStaff.reduce((sum, s) => sum + (s.currentValue || s.baseValue || 0), 0)
  };

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
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

        {/* Header Bar - Compact Stats */}
        <div className="shrink-0 p-2 border-b border-white/10 bg-black/40">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-3">
              <h1 className="font-display font-bold text-sm text-cream uppercase tracking-wide">My Roster</h1>
              <div className="flex items-center gap-3 text-[9px]">
                <span className="text-data-muted">
                  <Users className="w-3 h-3 inline mr-0.5" />
                  <span className="text-data font-bold">{stats.total}</span>
                </span>
                <span className="text-data-success">
                  <Target className="w-3 h-3 inline mr-0.5" />
                  {stats.assigned}
                </span>
                <span className="text-data-muted">
                  <span className="text-cream/40">{stats.unassigned} idle</span>
                </span>
              </div>
            </div>

            {/* Total Value */}
            <div className="flex items-center gap-1.5 px-2 py-1 bg-black/60 border border-gold-500/30 rounded">
              <DollarSign className="w-3 h-3 text-gold-500" />
              <span className="text-xs font-bold text-data-gold">{stats.totalValue.toLocaleString()}</span>
            </div>
          </div>

          {/* Search & Filters */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-cream/30" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full pl-7 pr-2 py-1.5 bg-black/60 border border-white/10 rounded text-cream text-xs placeholder:text-cream/30 focus:outline-none focus:border-gold-500/50"
              />
            </div>

            <div className="relative">
              <select
                value={captionFilter}
                onChange={(e) => setCaptionFilter(e.target.value)}
                className="px-2 py-1.5 bg-black/60 border border-white/10 rounded text-cream text-xs focus:outline-none focus:border-gold-500/50 appearance-none pr-6 cursor-pointer"
              >
                <option value="all">All</option>
                {CAPTION_OPTIONS.filter(o => o.value !== 'all').map(option => (
                  <option key={option.value} value={option.value}>{option.value}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-cream/40 pointer-events-none" />
            </div>

            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2 py-1.5 bg-black/60 border border-white/10 rounded text-cream text-xs focus:outline-none focus:border-gold-500/50 appearance-none pr-6 cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Idle</option>
              </select>
              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-cream/40 pointer-events-none" />
            </div>

            {(searchTerm || captionFilter !== 'all' || statusFilter !== 'all') && (
              <button
                onClick={() => { setSearchTerm(''); setCaptionFilter('all'); setStatusFilter('all'); }}
                className="px-2 py-1.5 text-gold-400 hover:text-gold-300 border border-gold-500/30 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Column Headers */}
        <div className="shrink-0 h-8 flex items-center gap-2 px-2 border-b border-white/10 bg-black/60 text-[9px] text-data-muted uppercase">
          <div className="w-8 flex-shrink-0" />
          <button onClick={() => handleSort('name')} className="w-32 flex-shrink-0 flex items-center gap-1 hover:text-cream">
            Name <SortIcon column="name" />
          </button>
          <div className="hidden md:flex flex-1 items-center gap-4 px-2">
            <span className="flex-1 max-w-16">Stats</span>
          </div>
          <button onClick={() => handleSort('seasons')} className="hidden sm:flex w-12 items-center justify-center gap-1 hover:text-cream">
            Szns <SortIcon column="seasons" />
          </button>
          <button onClick={() => handleSort('value')} className="w-16 flex items-center justify-end gap-1 hover:text-cream">
            Value <SortIcon column="value" />
          </button>
          <div className="w-20 flex-shrink-0 text-right">Status</div>
        </div>

        {/* Staff List */}
        <div className="flex-1 overflow-y-auto hud-scroll">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-6 h-6 border-2 border-gold-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-[10px] text-data-muted uppercase tracking-widest">Loading...</p>
              </div>
            </div>
          ) : filteredStaff.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center p-4">
                <Users className="w-8 h-8 text-cream/20 mx-auto mb-2" />
                <p className="text-xs text-data-muted">
                  {ownedStaff.length === 0 ? 'No staff owned yet' : 'No matching staff'}
                </p>
                {ownedStaff.length === 0 && (
                  <p className="text-[10px] text-cream/40 mt-1">Visit the Market to recruit staff</p>
                )}
              </div>
            </div>
          ) : (
            filteredStaff.map((staff, index) => (
              <TacticalRosterRow
                key={staff.staffId}
                staff={staff}
                index={index}
                isSelected={selectedStaff?.staffId === staff.staffId}
                onClick={() => setSelectedStaff(staff)}
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
            <RosterDossierPanel
              staff={selectedStaff}
              userCorps={userCorps}
              onAssign={handleAssign}
              onUnassign={handleUnassign}
              onListAuction={handleListAuction}
              assigning={assigning}
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
              className="absolute bottom-0 left-0 right-0 max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <RosterDossierPanel
                staff={selectedStaff}
                userCorps={userCorps}
                onAssign={handleAssign}
                onUnassign={handleUnassign}
                onListAuction={handleListAuction}
                assigning={assigning}
                onClose={() => setSelectedStaff(null)}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StaffRoster;
