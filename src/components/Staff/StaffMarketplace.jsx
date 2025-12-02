// src/components/Staff/StaffMarketplace.jsx
import React, { useState, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShoppingCart, DollarSign, Award, Filter, Search, X,
  ChevronDown, Trophy, Check, Lock, AlertCircle, RefreshCw, Loader2
} from 'lucide-react';
import { useAuth } from '../../App';
import { useStaffMarketplace } from '../../hooks/useStaffMarketplace';
import toast from 'react-hot-toast';
import Portal from '../Portal';

const CAPTION_OPTIONS = [
  { value: 'all', label: 'All Captions', color: 'bg-gray-500' },
  { value: 'GE1', label: 'General Effect 1', color: 'bg-purple-500', description: 'Directors & Program Coordinators' },
  { value: 'GE2', label: 'General Effect 2', color: 'bg-purple-400', description: 'Judges & Administrators' },
  { value: 'VP', label: 'Visual Performance', color: 'bg-blue-500', description: 'Drill Designers' },
  { value: 'VA', label: 'Visual Analysis', color: 'bg-blue-400', description: 'Visual Analysts' },
  { value: 'CG', label: 'Color Guard', color: 'bg-pink-500', description: 'Guard Designers' },
  { value: 'B', label: 'Brass', color: 'bg-yellow-500', description: 'Brass Arrangers' },
  { value: 'MA', label: 'Music Analysis', color: 'bg-green-500', description: 'Front Ensemble' },
  { value: 'P', label: 'Percussion', color: 'bg-red-500', description: 'Battery Instructors' }
];

// Memoized caption color getter to prevent recreation on each render
const getCaptionColor = (caption) => {
  const option = CAPTION_OPTIONS.find(opt => opt.value === caption);
  return option?.color || 'bg-gray-500';
};

const getCaptionLabel = (caption) => {
  const option = CAPTION_OPTIONS.find(opt => opt.value === caption);
  return option?.label || caption;
};

// Memoized Staff Card Component - prevents unnecessary re-renders
const StaffCard = memo(({ staff, owned, canAfford, onPurchase }) => {
  const captionColor = getCaptionColor(staff.caption);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 hover:border-gold-500/50 transition-all group"
    >
      <div className="flex items-start gap-3 mb-3">
        <div className={`w-10 h-10 ${captionColor}/20 rounded-lg flex items-center justify-center flex-shrink-0`}>
          <Trophy className={`w-5 h-5 ${captionColor.replace('bg-', 'text-')}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-cream-100 mb-1 truncate text-base">{staff.name}</h3>
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-white ${captionColor}`}>
              {staff.caption}
            </span>
            <span className="text-xs text-cream-400">'{staff.yearInducted.toString().slice(-2)}</span>
          </div>
        </div>
      </div>

      <p className="text-sm text-cream-400 mb-4 line-clamp-2">
        {staff.biography}
      </p>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <DollarSign className="w-4 h-4 text-gold-400" />
          <span className="text-lg font-bold text-gold-400">{staff.baseValue}</span>
        </div>

        {owned ? (
          <div className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded text-sm font-semibold">
            <Check className="w-4 h-4" />
            Owned
          </div>
        ) : (
          <button
            onClick={onPurchase}
            disabled={!canAfford}
            className={`px-3 py-1 rounded text-sm font-semibold transition-all ${
              canAfford
                ? 'bg-gold-500 text-charcoal-900 hover:bg-gold-400'
                : 'bg-charcoal-700 text-cream-400 cursor-not-allowed'
            }`}
          >
            {canAfford ? 'Purchase' : 'Locked'}
          </button>
        )}
      </div>
    </motion.div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo - only re-render if these props changed
  return (
    prevProps.staff.id === nextProps.staff.id &&
    prevProps.owned === nextProps.owned &&
    prevProps.canAfford === nextProps.canAfford
  );
});

StaffCard.displayName = 'StaffCard';

const StaffMarketplace = () => {
  const { user } = useAuth();
  const {
    allStaff,
    corpsCoin,
    loading,
    purchasing,
    page,
    loadMore,
    resetPagination,
    fetchMarketplace,
    purchaseStaff,
    getFilteredStaff,
    getPaginatedStaff,
    ownsStaff,
    canAfford,
    refreshMarketplace
  } = useStaffMarketplace(user?.uid);

  const [searchTerm, setSearchTerm] = useState('');
  const [captionFilter, setCaptionFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Memoized filtered and sorted staff - only recalculates when dependencies change
  const filteredStaff = useMemo(() => {
    return getFilteredStaff(captionFilter, searchTerm, sortBy);
  }, [getFilteredStaff, captionFilter, searchTerm, sortBy]);

  // Memoized paginated results
  const { items: paginatedStaff, hasMore, totalCount, loadedCount } = useMemo(() => {
    return getPaginatedStaff(filteredStaff, page);
  }, [getPaginatedStaff, filteredStaff, page]);

  // Handle filter changes - reset pagination
  const handleCaptionFilterChange = useCallback((e) => {
    setCaptionFilter(e.target.value);
    resetPagination();
  }, [resetPagination]);

  const handleSearchChange = useCallback((e) => {
    setSearchTerm(e.target.value);
    resetPagination();
  }, [resetPagination]);

  const handleSortChange = useCallback((e) => {
    setSortBy(e.target.value);
    resetPagination();
  }, [resetPagination]);

  const handleClearFilters = useCallback(() => {
    setSearchTerm('');
    setCaptionFilter('all');
    resetPagination();
  }, [resetPagination]);

  const handlePurchase = useCallback(async (staff) => {
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
  }, [ownsStaff, canAfford, corpsCoin, purchaseStaff]);

  const handleRefresh = useCallback(() => {
    fetchMarketplace(true);
  }, [fetchMarketplace]);

  // Memoized purchase click handler factory
  const createPurchaseHandler = useCallback((staff) => () => {
    setSelectedStaff(staff);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="glass rounded-2xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-display font-bold text-gradient mb-2">
              Staff Marketplace
            </h1>
            <p className="text-cream-300">
              Recruit legendary DCI Hall of Fame members to boost your corps
            </p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 text-cream-300 hover:text-cream-100 hover:bg-charcoal-700 rounded-lg transition-colors disabled:opacity-50"
              title="Refresh marketplace"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <div className="flex items-center gap-2 px-4 py-2 bg-gold-500/20 rounded-lg border border-gold-500/30">
              <DollarSign className="w-5 h-5 text-gold-400" />
              <span className="text-2xl font-bold text-gold-400">{corpsCoin}</span>
              <span className="text-cream-300 text-sm">CorpsCoin</span>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cream-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search staff by name..."
              className="w-full pl-10 pr-4 py-2 bg-charcoal-800 border border-charcoal-700 rounded-lg text-cream-100 placeholder-cream-400 focus:outline-none focus:border-gold-500"
            />
          </div>

          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-cream-400" />
            <select
              value={captionFilter}
              onChange={handleCaptionFilterChange}
              className="w-full pl-10 pr-8 py-2 bg-charcoal-800 border border-charcoal-700 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500 appearance-none cursor-pointer"
            >
              {CAPTION_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-cream-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={handleSortChange}
              className="w-full px-4 py-2 bg-charcoal-800 border border-charcoal-700 rounded-lg text-cream-100 focus:outline-none focus:border-gold-500 appearance-none cursor-pointer"
            >
              <option value="newest">Newest Inductees</option>
              <option value="oldest">Oldest Inductees</option>
              <option value="cheapest">Lowest Price</option>
              <option value="expensive">Highest Price</option>
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 text-cream-400 pointer-events-none" />
          </div>
        </div>

        {/* Results count */}
        {!loading && allStaff.length > 0 && (
          <div className="mt-4 text-sm text-cream-400">
            Showing {loadedCount} of {totalCount} staff members
            {(searchTerm || captionFilter !== 'all') && ' (filtered)'}
          </div>
        )}
      </div>

      {/* Staff Grid */}
      {loading && allStaff.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-gold-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : paginatedStaff.length === 0 ? (
        <div className="glass rounded-2xl p-12 text-center">
          <AlertCircle className="w-12 h-12 text-cream-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-cream-100 mb-2">No Staff Found</h3>
          <p className="text-cream-400 mb-4">
            {searchTerm || captionFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'No staff members available at this time'}
          </p>
          {(searchTerm || captionFilter !== 'all') && (
            <button
              onClick={handleClearFilters}
              className="btn-outline"
            >
              Clear Filters
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedStaff.map((staff) => (
              <StaffCard
                key={staff.id}
                staff={staff}
                owned={ownsStaff(staff.id)}
                canAfford={canAfford(staff.baseValue)}
                onPurchase={createPurchaseHandler(staff)}
              />
            ))}
          </div>

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <button
                onClick={loadMore}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-charcoal-700 hover:bg-charcoal-600 text-cream-100 rounded-lg font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Load More ({totalCount - loadedCount} remaining)
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}

      {/* Purchase Confirmation Modal */}
      <AnimatePresence>
        {selectedStaff && (
          <PurchaseModal
            staff={selectedStaff}
            corpsCoin={corpsCoin}
            canAfford={canAfford(selectedStaff.baseValue)}
            purchasing={purchasing}
            onConfirm={() => handlePurchase(selectedStaff)}
            onClose={() => setSelectedStaff(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

// Memoized Purchase Modal Component
const PurchaseModal = memo(({ staff, corpsCoin, canAfford, purchasing, onConfirm, onClose }) => {
  const captionColor = getCaptionColor(staff.caption);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-charcoal-800 border border-charcoal-700 rounded-xl p-6 w-full max-w-md"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-cream-100">Confirm Purchase</h3>
          <button
            onClick={onClose}
            className="p-2 text-cream-300 hover:text-cream-100 hover:bg-charcoal-700 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 mb-6">
          <div className="flex items-start gap-4 p-4 bg-charcoal-900/50 rounded-lg">
            <div className="w-12 h-12 bg-gold-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Award className="w-6 h-6 text-gold-400" />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-cream-100 mb-1">{staff.name}</h4>
              <p className="text-sm text-cream-400 mb-2">{staff.biography}</p>
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-white ${captionColor}`}>
                  {staff.caption}
                </span>
                <span className="text-xs text-cream-400">
                  Inducted {staff.yearInducted}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-charcoal-900/50 rounded-lg">
            <span className="text-cream-300">Purchase Price</span>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gold-400" />
              <span className="text-2xl font-bold text-gold-400">{staff.baseValue}</span>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-charcoal-900/50 rounded-lg">
            <span className="text-cream-300">Your Balance</span>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-cream-400" />
              <span className="text-xl font-bold text-cream-100">{corpsCoin}</span>
            </div>
          </div>

          {canAfford && (
            <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <span className="text-green-400">After Purchase</span>
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                <span className="text-xl font-bold text-green-400">
                  {corpsCoin - staff.baseValue}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-charcoal-700 text-cream-100 rounded-lg hover:bg-charcoal-600 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={purchasing || !canAfford}
            className="flex-1 px-4 py-2 bg-gold-500 text-charcoal-900 rounded-lg hover:bg-gold-400 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {purchasing ? (
              <>
                <div className="w-4 h-4 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
                Purchasing...
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
        </div>
      </motion.div>
    </div>
  );
});

PurchaseModal.displayName = 'PurchaseModal';

export default StaffMarketplace;
