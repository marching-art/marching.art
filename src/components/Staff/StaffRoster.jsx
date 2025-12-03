// src/components/Staff/StaffRoster.jsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Award, Trophy, DollarSign, Calendar, Target,
  ChevronDown, Search, X, Link as LinkIcon, Gavel
} from 'lucide-react';
import { useAuth } from '../../App';
import { useStaffMarketplace } from '../../hooks/useStaffMarketplace';
import { listStaffForAuction } from '../../firebase/functions';
import { CAPTION_OPTIONS, getCaptionColor, getCaptionLabel } from '../../utils/captionUtils';
import Portal from '../Portal';
import EmptyState from '../EmptyState';

const StaffRoster = ({ userCorps = {} }) => {
  const { user } = useAuth();
  const {
    ownedStaff,
    loading,
    getUnassignedStaff,
    getStaffByCaption,
    assignStaffToCorps,
    unassignStaff
  } = useStaffMarketplace(user?.uid);

  const [searchTerm, setSearchTerm] = useState('');
  const [captionFilter, setCaptionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all'); // all, assigned, unassigned
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [selectedCorpsClass, setSelectedCorpsClass] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Auction listing state
  const [showAuctionForm, setShowAuctionForm] = useState(false);
  const [auctionMinBid, setAuctionMinBid] = useState(100);
  const [auctionDuration, setAuctionDuration] = useState(24);
  const [listingAuction, setListingAuction] = useState(false);
  const [auctionError, setAuctionError] = useState('');

  // Get list of user's registered corps classes in hierarchy order
  const availableCorpsClasses = Object.keys(userCorps).sort((a, b) => {
    const classOrder = { worldClass: 0, openClass: 1, aClass: 2, soundSport: 3 };
    return (classOrder[a] ?? 99) - (classOrder[b] ?? 99);
  });

  const handleAssign = async () => {
    if (!selectedStaff || !selectedCorpsClass) return;

    setAssigning(true);
    try {
      await assignStaffToCorps(selectedStaff.staffId, selectedCorpsClass);
      setSelectedStaff(null);
      setSelectedCorpsClass('');
    } catch (error) {
      // Error handled in hook
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async () => {
    if (!selectedStaff) return;

    setAssigning(true);
    try {
      await unassignStaff(selectedStaff.staffId);
      setSelectedStaff(null);
    } catch (error) {
      // Error handled in hook
    } finally {
      setAssigning(false);
    }
  };

  const handleListForAuction = async () => {
    if (!selectedStaff || auctionMinBid < 1) return;

    setListingAuction(true);
    setAuctionError('');
    try {
      await listStaffForAuction({
        staffId: selectedStaff.staffId,
        minimumBid: auctionMinBid,
        durationHours: auctionDuration
      });
      setSelectedStaff(null);
      setShowAuctionForm(false);
      setAuctionMinBid(100);
      setAuctionDuration(24);
    } catch (error) {
      console.error('Failed to list for auction:', error);
      setAuctionError(error.message || 'Failed to list staff for auction');
    } finally {
      setListingAuction(false);
    }
  };

  const filteredStaff = ownedStaff.filter(staff => {
    // Search filter
    if (searchTerm && !staff.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }

    // Caption filter
    if (captionFilter !== 'all' && staff.caption !== captionFilter) {
      return false;
    }

    // Status filter
    if (statusFilter === 'assigned' && !staff.assignedTo) {
      return false;
    }
    if (statusFilter === 'unassigned' && staff.assignedTo) {
      return false;
    }

    return true;
  });

  const stats = {
    total: ownedStaff.length,
    assigned: ownedStaff.filter(s => s.assignedTo).length,
    unassigned: ownedStaff.filter(s => !s.assignedTo).length,
    totalValue: ownedStaff.reduce((sum, s) => sum + (s.currentValue || s.baseValue || 0), 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-gradient mb-2">
              My Staff Roster
            </h1>
            <p className="text-cream-300">
              Manage your DCI Hall of Fame staff members
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-charcoal-800/50 border border-stone-200 dark:border-charcoal-700 rounded-lg p-4 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/20 dark:bg-gold-500/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-amber-600 dark:text-gold-400" />
              </div>
              <div>
                <p className="text-slate-500 dark:text-cream-300 text-sm">Total Staff</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-cream-100">{stats.total}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-800/50 border border-stone-200 dark:border-charcoal-700 rounded-lg p-4 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <LinkIcon className="w-5 h-5 text-green-500 dark:text-green-400" />
              </div>
              <div>
                <p className="text-slate-500 dark:text-cream-300 text-sm">Assigned</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-cream-100">{stats.assigned}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-800/50 border border-stone-200 dark:border-charcoal-700 rounded-lg p-4 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Trophy className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-slate-500 dark:text-cream-300 text-sm">Unassigned</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-cream-100">{stats.unassigned}</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-charcoal-800/50 border border-stone-200 dark:border-charcoal-700 rounded-lg p-4 shadow-sm dark:shadow-none">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-purple-500 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-slate-500 dark:text-cream-300 text-sm">Total Value</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-cream-100">{stats.totalValue}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Status Filter */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-cream-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name..."
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-charcoal-800 border border-stone-300 dark:border-charcoal-700 rounded-lg text-slate-900 dark:text-cream-100 placeholder-slate-400 dark:placeholder-cream-400 focus:outline-none focus:border-amber-500 dark:focus:border-gold-500"
            />
          </div>

          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-charcoal-800 border border-stone-300 dark:border-charcoal-700 rounded-lg text-slate-900 dark:text-cream-100 focus:outline-none focus:border-amber-500 dark:focus:border-gold-500 appearance-none cursor-pointer"
            >
              <option value="all">All Staff</option>
              <option value="assigned">Assigned Only</option>
              <option value="unassigned">Unassigned Only</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-cream-400 pointer-events-none" />
          </div>
        </div>

        {/* Caption Filter Pills */}
        <div className="flex flex-wrap gap-2">
          {CAPTION_OPTIONS.map(option => (
            <button
              key={option.value}
              onClick={() => setCaptionFilter(option.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                captionFilter === option.value
                  ? option.value === 'all'
                    ? 'bg-gold-500 text-charcoal-900'
                    : `${option.color} text-white`
                  : 'bg-charcoal-700 text-cream-300 hover:bg-charcoal-600'
              }`}
            >
              {option.value === 'all' ? option.label : option.value}
            </button>
          ))}
        </div>
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between px-2">
        <p className="text-cream-400 text-sm">
          Showing <span className="text-cream-100 font-medium">{filteredStaff.length}</span> of {ownedStaff.length} staff member{ownedStaff.length !== 1 ? 's' : ''}
          {captionFilter !== 'all' && (
            <span> in <span className="font-medium">{getCaptionLabel(captionFilter)}</span></span>
          )}
        </p>
        {(searchTerm || captionFilter !== 'all' || statusFilter !== 'all') && (
          <button
            onClick={() => {
              setSearchTerm('');
              setCaptionFilter('all');
              setStatusFilter('all');
            }}
            className="text-sm text-gold-400 hover:text-gold-300 flex items-center gap-1"
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        )}
      </div>

      {/* Staff List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filteredStaff.length === 0 ? (
        <EmptyState
          title={ownedStaff.length === 0 ? 'NO STAFF MEMBERS' : 'NO RESULTS'}
          subtitle={ownedStaff.length === 0
            ? 'Visit the Staff Marketplace to recruit your first staff member...'
            : 'Try adjusting your filters above...'}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStaff.map((staff) => (
            <StaffRosterCard
              key={staff.staffId}
              staff={staff}
              onClick={() => setSelectedStaff(staff)}
            />
          ))}
        </div>
      )}

      {/* Staff Details Modal */}
      <AnimatePresence>
        {selectedStaff && (
          <Portal>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-6 w-full max-w-lg"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-cream-100">Staff Details</h3>
                <button
                  onClick={() => {
                    setSelectedStaff(null);
                    setShowAuctionForm(false);
                    setAuctionError('');
                  }}
                  className="p-2 text-cream-300 hover:text-cream-100 hover:bg-charcoal-700 rounded transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-charcoal-900/50 rounded-lg">
                  <div className={`w-12 h-12 ${getCaptionColor(selectedStaff.caption)}/20 rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Award className={`w-6 h-6 ${getCaptionColor(selectedStaff.caption).replace('bg-', 'text-')}`} />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-cream-100 mb-1">{selectedStaff.name}</h4>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-white ${getCaptionColor(selectedStaff.caption)}`}>
                        {selectedStaff.caption}
                      </span>
                      <span className="text-xs text-cream-400">
                        Inducted {selectedStaff.yearInducted}
                      </span>
                    </div>
                    <p className="text-sm text-cream-400">{selectedStaff.biography}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-charcoal-900/50 rounded-lg">
                    <p className="text-cream-400 text-sm mb-1">Purchase Value</p>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-gold-400" />
                      <span className="text-xl font-bold text-gold-400">{selectedStaff.baseValue || 0}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-charcoal-900/50 rounded-lg">
                    <p className="text-cream-400 text-sm mb-1">Current Value</p>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <span className="text-xl font-bold text-green-400">{selectedStaff.currentValue || selectedStaff.baseValue || 0}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-charcoal-900/50 rounded-lg">
                    <p className="text-cream-400 text-sm mb-1">Seasons Completed</p>
                    <div className="flex items-center gap-1">
                      <Trophy className="w-4 h-4 text-blue-400" />
                      <span className="text-xl font-bold text-blue-400">{selectedStaff.seasonsCompleted || 0}</span>
                    </div>
                  </div>

                  <div className="p-4 bg-charcoal-900/50 rounded-lg">
                    <p className="text-cream-400 text-sm mb-1">Acquired</p>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      <span className="text-sm font-bold text-purple-400">
                        {selectedStaff.purchaseDate?.toDate?.()?.toLocaleDateString() || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedStaff.assignedTo ? (
                  <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Target className="w-5 h-5 text-green-400" />
                      <span className="font-semibold text-green-400">Currently Assigned</span>
                    </div>
                    <p className="text-cream-300 mb-3">
                      Boosting <span className="font-semibold">{getCaptionLabel(selectedStaff.caption)}</span> for{' '}
                      <span className="font-semibold">{selectedStaff.assignedTo.corpsName || selectedStaff.assignedTo.corpsClass.replace('Class', ' Class')}</span>
                    </p>
                    <button
                      onClick={handleUnassign}
                      disabled={assigning}
                      className="w-full btn-outline text-red-400 border-red-500/30 hover:bg-red-500/10"
                    >
                      {assigning ? 'Unassigning...' : 'Unassign Staff'}
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Assign to Corps section */}
                    {availableCorpsClasses.length > 0 && !showAuctionForm && (
                      <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-3">
                          <Target className="w-5 h-5 text-blue-400" />
                          <span className="font-semibold text-blue-400">Assign to Corps</span>
                        </div>
                        <p className="text-cream-400 text-sm mb-3">
                          This staff member will boost your <span className="font-semibold text-cream-100">{getCaptionLabel(selectedStaff.caption)}</span> caption performance.
                        </p>
                        <select
                          value={selectedCorpsClass}
                          onChange={(e) => setSelectedCorpsClass(e.target.value)}
                          className="w-full px-4 py-2 mb-3 bg-white dark:bg-charcoal-800 border border-stone-300 dark:border-charcoal-700 rounded-lg text-slate-900 dark:text-cream-100 focus:outline-none focus:border-amber-500 dark:focus:border-gold-500"
                        >
                          <option value="">Select Corps...</option>
                          {availableCorpsClasses.map(corpsClass => {
                            const corpsData = userCorps[corpsClass];
                            const corpsName = corpsData?.corpsName || corpsData?.name || corpsClass;
                            return (
                              <option key={corpsClass} value={corpsClass}>
                                {corpsName}
                              </option>
                            );
                          })}
                        </select>
                        <button
                          onClick={handleAssign}
                          disabled={assigning || !selectedCorpsClass}
                          className="w-full btn-primary disabled:opacity-50"
                        >
                          {assigning ? 'Assigning...' : 'Assign to Corps'}
                        </button>
                      </div>
                    )}

                    {availableCorpsClasses.length === 0 && !showAuctionForm && (
                      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                        <p className="text-yellow-400 text-sm">
                          Register a corps first to assign staff members.
                        </p>
                      </div>
                    )}

                    {/* List for Auction section */}
                    {!showAuctionForm ? (
                      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Gavel className="w-5 h-5 text-purple-400" />
                            <span className="font-semibold text-purple-400">List for Auction</span>
                          </div>
                          <button
                            onClick={() => setShowAuctionForm(true)}
                            className="btn-outline text-purple-400 border-purple-500/30 hover:bg-purple-500/10 text-sm px-3 py-1.5"
                          >
                            Start Auction
                          </button>
                        </div>
                        <p className="text-cream-400 text-sm mt-2">
                          Put this staff member up for auction to sell to the highest bidder.
                        </p>
                      </div>
                    ) : (
                      <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-4">
                          <Gavel className="w-5 h-5 text-purple-400" />
                          <span className="font-semibold text-purple-400">Auction Settings</span>
                        </div>

                        {auctionError && (
                          <div className="mb-3 p-2 bg-red-500/20 border border-red-500/30 rounded text-red-400 text-sm">
                            {auctionError}
                          </div>
                        )}

                        <div className="space-y-3">
                          <div>
                            <label className="block text-cream-300 text-sm mb-1">Minimum Bid</label>
                            <div className="flex items-center gap-2">
                              <DollarSign className="w-4 h-4 text-gold-400" />
                              <input
                                type="number"
                                min="1"
                                value={auctionMinBid}
                                onChange={(e) => setAuctionMinBid(Math.max(1, parseInt(e.target.value) || 1))}
                                className="flex-1 px-3 py-2 bg-white dark:bg-charcoal-800 border border-stone-300 dark:border-charcoal-700 rounded-lg text-slate-900 dark:text-cream-100 focus:outline-none focus:border-amber-500 dark:focus:border-gold-500"
                              />
                            </div>
                            <p className="text-xs text-cream-400 mt-1">
                              Staff value: {selectedStaff.currentValue || selectedStaff.baseValue || 0} coins
                            </p>
                          </div>

                          <div>
                            <label className="block text-cream-300 text-sm mb-1">Duration</label>
                            <select
                              value={auctionDuration}
                              onChange={(e) => setAuctionDuration(parseInt(e.target.value))}
                              className="w-full px-3 py-2 bg-white dark:bg-charcoal-800 border border-stone-300 dark:border-charcoal-700 rounded-lg text-slate-900 dark:text-cream-100 focus:outline-none focus:border-amber-500 dark:focus:border-gold-500"
                            >
                              <option value={6}>6 hours</option>
                              <option value={12}>12 hours</option>
                              <option value={24}>24 hours</option>
                              <option value={48}>48 hours</option>
                              <option value={72}>72 hours</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-4">
                          <button
                            onClick={() => {
                              setShowAuctionForm(false);
                              setAuctionError('');
                            }}
                            className="flex-1 btn-ghost"
                            disabled={listingAuction}
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleListForAuction}
                            disabled={listingAuction || auctionMinBid < 1}
                            className="flex-1 btn-primary bg-purple-600 hover:bg-purple-700 disabled:opacity-50"
                          >
                            {listingAuction ? 'Listing...' : 'List for Auction'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="mt-6">
                <button
                  onClick={() => {
                    setSelectedStaff(null);
                    setShowAuctionForm(false);
                    setAuctionError('');
                  }}
                  className="w-full btn-ghost"
                >
                  Close
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

// Staff Roster Card Component
const StaffRosterCard = ({ staff, onClick }) => {
  const captionColor = getCaptionColor(staff.caption);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="glass rounded-xl p-4 cursor-pointer hover:border-gold-500/50 transition-all"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 ${captionColor}/20 rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Award className={`w-5 h-5 ${captionColor.replace('bg-', 'text-')}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-cream-100 mb-1 truncate text-base">{staff.name}</h3>
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-white ${captionColor}`}>
              {staff.caption}
            </span>
            <span className="text-xs text-cream-400">'{staff.yearInducted.toString().slice(-2)}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1 text-cream-400">
          <Trophy className="w-4 h-4" />
          <span>{staff.seasonsCompleted || 0} seasons</span>
        </div>
        <div className="flex items-center gap-1 text-gold-400">
          <DollarSign className="w-4 h-4" />
          <span className="font-bold">{staff.currentValue || staff.baseValue || 0}</span>
        </div>
      </div>

      {staff.assignedTo && (
        <div className="mt-3 pt-3 border-t border-charcoal-700">
          <div className="flex items-center gap-2 text-xs text-green-400">
            <Target className="w-3 h-3" />
            <span>{staff.assignedTo.corpsName || staff.assignedTo.corpsClass.replace('Class', ' Class')}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default StaffRoster;
