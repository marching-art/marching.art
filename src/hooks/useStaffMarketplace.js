// src/hooks/useStaffMarketplace.js
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';

// Cache configuration
const CACHE_STALE_TIME = 5 * 60 * 1000; // 5 minutes

// Module-level cache to persist across component remounts
let marketplaceCache = {
  data: null,
  timestamp: null,
  promise: null, // For deduplicating concurrent requests
};

export const useStaffMarketplace = (userId) => {
  const [allStaff, setAllStaff] = useState(marketplaceCache.data || []);
  const [ownedStaff, setOwnedStaff] = useState([]);
  const [loading, setLoading] = useState(!marketplaceCache.data);
  const [purchasing, setPurchasing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [corpsCoin, setCorpsCoin] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const mountedRef = useRef(true);

  const ITEMS_PER_PAGE = 12;

  // Subscribe to user profile for owned staff and CorpsCoin balance
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const profileRef = doc(db, `artifacts/marching-art/users/${userId}/profile/data`);
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists() && mountedRef.current) {
        const data = doc.data();
        setOwnedStaff(data.staff || []);
        setCorpsCoin(data.corpsCoin || 0);
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Check if cache is stale
  const isCacheStale = useCallback(() => {
    if (!marketplaceCache.timestamp) return true;
    return Date.now() - marketplaceCache.timestamp > CACHE_STALE_TIME;
  }, []);

  // Fetch all marketplace staff (cached)
  const fetchMarketplace = useCallback(async (forceRefresh = false) => {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && marketplaceCache.data && !isCacheStale()) {
      setAllStaff(marketplaceCache.data);
      setLoading(false);
      return marketplaceCache.data;
    }

    // If there's already a request in flight, wait for it
    if (marketplaceCache.promise) {
      try {
        const result = await marketplaceCache.promise;
        if (mountedRef.current) {
          setAllStaff(result);
          setLoading(false);
        }
        return result;
      } catch (error) {
        // Let subsequent request handle the error
      }
    }

    try {
      setLoading(true);

      // Create and store the promise to deduplicate concurrent requests
      const fetchPromise = (async () => {
        const getMarketplace = httpsCallable(functions, 'getStaffMarketplace');
        // Fetch ALL available staff without caption filter for client-side filtering
        const result = await getMarketplace({ caption: null });
        return result.data.staff || [];
      })();

      marketplaceCache.promise = fetchPromise;
      const staffList = await fetchPromise;

      // Update cache
      marketplaceCache.data = staffList;
      marketplaceCache.timestamp = Date.now();
      marketplaceCache.promise = null;

      if (mountedRef.current) {
        setAllStaff(staffList);
        setPage(1);
      }

      return staffList;
    } catch (error) {
      console.error('Error fetching marketplace:', error);
      marketplaceCache.promise = null;
      if (mountedRef.current) {
        toast.error('Failed to load staff marketplace');
      }
      return [];
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [isCacheStale]);

  // Initial fetch on mount
  useEffect(() => {
    fetchMarketplace();
  }, [fetchMarketplace]);

  // Filter and sort staff (memoized)
  const getFilteredStaff = useCallback((captionFilter = 'all', searchTerm = '', sortBy = 'newest') => {
    let filtered = [...allStaff];

    // Apply caption filter
    if (captionFilter && captionFilter !== 'all') {
      filtered = filtered.filter(staff => staff.caption === captionFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(staff =>
        staff.name.toLowerCase().includes(searchLower) ||
        staff.biography?.toLowerCase().includes(searchLower)
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
        default:
          return 0;
      }
    });

    return filtered;
  }, [allStaff]);

  // Get paginated staff with load more support
  const getPaginatedStaff = useCallback((filteredStaff, currentPage) => {
    const totalItems = filteredStaff.length;
    const endIndex = currentPage * ITEMS_PER_PAGE;
    const paginatedItems = filteredStaff.slice(0, endIndex);
    const hasMoreItems = endIndex < totalItems;

    return {
      items: paginatedItems,
      hasMore: hasMoreItems,
      totalCount: totalItems,
      loadedCount: paginatedItems.length,
    };
  }, []);

  // Load more items
  const loadMore = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  // Reset pagination (call when filters change)
  const resetPagination = useCallback(() => {
    setPage(1);
  }, []);

  // Purchase staff member
  const purchaseStaff = useCallback(async (staffId) => {
    try {
      setPurchasing(true);
      const purchase = httpsCallable(functions, 'purchaseStaff');
      const result = await purchase({ staffId });

      toast.success(
        <div>
          <p className="font-bold">Staff Acquired!</p>
          <p className="text-sm">{result.data.message}</p>
        </div>,
        { duration: 4000 }
      );

      // Invalidate cache to refresh marketplace
      marketplaceCache.timestamp = null;
      await fetchMarketplace(true);

      return result.data;
    } catch (error) {
      console.error('Error purchasing staff:', error);
      const errorMessage = error.message || 'Failed to purchase staff member';
      toast.error(errorMessage);
      throw error;
    } finally {
      setPurchasing(false);
    }
  }, [fetchMarketplace]);

  // Assign staff to corps caption
  const assignStaffToCorps = useCallback(async (staffId, corpsClass, caption) => {
    try {
      setAssigning(true);
      const assign = httpsCallable(functions, 'assignStaff');
      const result = await assign({ staffId, corpsClass, caption });

      toast.success(
        <div>
          <p className="font-bold">Staff Assigned!</p>
          <p className="text-sm">{result.data.message}</p>
        </div>
      );

      return result.data;
    } catch (error) {
      console.error('Error assigning staff:', error);
      const errorMessage = error.message || 'Failed to assign staff member';
      toast.error(errorMessage);
      throw error;
    } finally {
      setAssigning(false);
    }
  }, []);

  // Unassign staff from corps
  const unassignStaff = useCallback(async (staffId) => {
    try {
      setAssigning(true);
      const assign = httpsCallable(functions, 'assignStaff');
      await assign({ staffId, corpsClass: null, caption: null });

      toast.success('Staff member unassigned');
    } catch (error) {
      console.error('Error unassigning staff:', error);
      toast.error('Failed to unassign staff member');
      throw error;
    } finally {
      setAssigning(false);
    }
  }, []);

  // Boost staff morale
  const boostStaffMorale = useCallback(async (staffId) => {
    try {
      const boost = httpsCallable(functions, 'boostStaffMorale');
      const result = await boost({ staffId });

      toast.success(
        <div>
          <p className="font-bold">Morale Boosted!</p>
          <p className="text-sm">{result.data.message}</p>
        </div>
      );

      return result.data;
    } catch (error) {
      console.error('Error boosting staff morale:', error);
      const errorMessage = error.message || 'Failed to boost staff morale';
      toast.error(errorMessage);
      throw error;
    }
  }, []);

  // Check if user owns a staff member
  const ownsStaff = useCallback((staffId) => {
    return ownedStaff.some(s => s.staffId === staffId);
  }, [ownedStaff]);

  // Get staff member details
  const getStaffDetails = useCallback((staffId) => {
    return ownedStaff.find(s => s.staffId === staffId);
  }, [ownedStaff]);

  // Get assigned staff for a specific corps/caption
  const getAssignedStaff = useCallback((corpsClass, caption) => {
    return ownedStaff.find(
      s => s.assignedTo?.corpsClass === corpsClass && s.assignedTo?.caption === caption
    );
  }, [ownedStaff]);

  // Get all unassigned staff
  const getUnassignedStaff = useCallback(() => {
    return ownedStaff.filter(s => !s.assignedTo);
  }, [ownedStaff]);

  // Get staff by caption
  const getStaffByCaption = useCallback((caption) => {
    return ownedStaff.filter(s => s.caption === caption);
  }, [ownedStaff]);

  // Check if user can afford a staff member
  const canAfford = useCallback((cost) => {
    return corpsCoin >= cost;
  }, [corpsCoin]);

  // Invalidate cache (useful for manual refresh)
  const invalidateCache = useCallback(() => {
    marketplaceCache.data = null;
    marketplaceCache.timestamp = null;
    marketplaceCache.promise = null;
  }, []);

  return {
    // Data
    allStaff,
    ownedStaff,
    corpsCoin,

    // Loading states
    loading,
    purchasing,
    assigning,

    // Pagination
    page,
    hasMore,
    loadMore,
    resetPagination,

    // Actions
    fetchMarketplace,
    purchaseStaff,
    assignStaffToCorps,
    unassignStaff,
    boostStaffMorale,
    invalidateCache,

    // Filtering/sorting helpers
    getFilteredStaff,
    getPaginatedStaff,

    // Query helpers
    ownsStaff,
    getStaffDetails,
    getAssignedStaff,
    getUnassignedStaff,
    getStaffByCaption,
    canAfford,
  };
};
