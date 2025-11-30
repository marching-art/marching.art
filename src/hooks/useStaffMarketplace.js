// src/hooks/useStaffMarketplace.js
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';

// Module-level cache for marketplace data
let marketplaceCache = {
  data: null,
  timestamp: null,
  promise: null, // For request deduplication
};

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

const isCacheValid = () => {
  return (
    marketplaceCache.data &&
    marketplaceCache.timestamp &&
    Date.now() - marketplaceCache.timestamp < CACHE_DURATION
  );
};

export const useStaffMarketplace = (userId) => {
  const [allStaff, setAllStaff] = useState(marketplaceCache.data || []);
  const [ownedStaff, setOwnedStaff] = useState([]);
  const [loading, setLoading] = useState(!isCacheValid());
  const [purchasing, setPurchasing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [corpsCoin, setCorpsCoin] = useState(0);
  const mountedRef = useRef(true);

  // Subscribe to user profile for owned staff and CorpsCoin balance
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const profileRef = doc(db, `artifacts/marching-art/users/${userId}/profile/data`);
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setOwnedStaff(data.staff || []);
        setCorpsCoin(data.corpsCoin || 0);
      }
      // Only stop initial loading if we have marketplace data cached
      if (isCacheValid()) {
        setLoading(false);
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

  // Fetch all marketplace staff once on mount (with caching & deduplication)
  const fetchAllMarketplace = useCallback(async (forceRefresh = false) => {
    // Return cached data if valid and not forcing refresh
    if (!forceRefresh && isCacheValid()) {
      setAllStaff(marketplaceCache.data);
      setLoading(false);
      return marketplaceCache.data;
    }

    // Request deduplication - reuse in-flight request
    if (marketplaceCache.promise) {
      try {
        const result = await marketplaceCache.promise;
        if (mountedRef.current) {
          setAllStaff(result);
          setLoading(false);
        }
        return result;
      } catch (error) {
        // Fall through to make a new request
      }
    }

    try {
      setLoading(true);

      // Create and store the promise for deduplication
      const getMarketplace = httpsCallable(functions, 'getStaffMarketplace');
      marketplaceCache.promise = getMarketplace({}).then(result => {
        const staffData = result.data.staff || [];
        // Update cache
        marketplaceCache.data = staffData;
        marketplaceCache.timestamp = Date.now();
        marketplaceCache.promise = null;
        return staffData;
      });

      const staffData = await marketplaceCache.promise;

      if (mountedRef.current) {
        setAllStaff(staffData);
      }
      return staffData;
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
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    fetchAllMarketplace();
  }, [fetchAllMarketplace]);

  // Memoized filter function for caption filtering (client-side)
  const getFilteredByCaption = useCallback((captionFilter) => {
    if (!captionFilter || captionFilter === 'all') {
      return allStaff;
    }
    return allStaff.filter(staff => staff.caption === captionFilter);
  }, [allStaff]);

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

      // Invalidate cache and refresh marketplace
      marketplaceCache.data = null;
      marketplaceCache.timestamp = null;
      await fetchAllMarketplace(true);

      return result.data;
    } catch (error) {
      console.error('Error purchasing staff:', error);
      const errorMessage = error.message || 'Failed to purchase staff member';
      toast.error(errorMessage);
      throw error;
    } finally {
      setPurchasing(false);
    }
  }, [fetchAllMarketplace]);

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

  // Check if user owns a staff member (memoized)
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

  // Force refresh function for manual cache invalidation
  const refreshMarketplace = useCallback(() => {
    return fetchAllMarketplace(true);
  }, [fetchAllMarketplace]);

  return {
    marketplace: allStaff, // Full list for backward compatibility
    ownedStaff,
    corpsCoin,
    loading,
    purchasing,
    assigning,
    fetchMarketplace: fetchAllMarketplace, // Keep old name for compatibility
    getFilteredByCaption, // New: efficient client-side filtering
    purchaseStaff,
    assignStaffToCorps,
    unassignStaff,
    ownsStaff,
    getStaffDetails,
    getAssignedStaff,
    getUnassignedStaff,
    getStaffByCaption,
    canAfford,
    refreshMarketplace, // New: manual refresh
  };
};
