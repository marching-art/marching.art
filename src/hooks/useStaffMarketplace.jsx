// src/hooks/useStaffMarketplace.js
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { queryKeys } from '../lib/queryClient';

// Fetch marketplace staff from backend
const fetchMarketplaceStaff = async () => {
  const getMarketplace = httpsCallable(functions, 'getStaffMarketplace');
  const result = await getMarketplace({});
  return result.data.staff || [];
};

export const useStaffMarketplace = (userId) => {
  const queryClient = useQueryClient();
  const [ownedStaff, setOwnedStaff] = useState([]);
  const [corpsCoin, setCorpsCoin] = useState(0);
  const [profileLoading, setProfileLoading] = useState(true);

  // Use React Query for marketplace data with caching
  const {
    data: marketplace = [],
    isLoading: marketplaceLoading,
    refetch: refetchMarketplace,
  } = useQuery({
    queryKey: queryKeys.staffMarketplace(),
    queryFn: fetchMarketplaceStaff,
    staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
    gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
    enabled: !!userId, // Only run query when user is authenticated
  });

  // Subscribe to user profile for owned staff and CorpsCoin balance
  useEffect(() => {
    if (!userId) {
      setProfileLoading(false);
      return;
    }

    const profileRef = doc(db, `artifacts/marching-art/users/${userId}/profile/data`);
    const unsubscribe = onSnapshot(profileRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setOwnedStaff(data.staff || []);
        setCorpsCoin(data.corpsCoin || 0);
      }
      setProfileLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Create a Set of owned staff IDs for O(1) lookup
  const ownedStaffIds = useMemo(() => {
    return new Set(ownedStaff.map(s => s.staffId));
  }, [ownedStaff]);

  // Purchase staff mutation with optimistic updates
  const purchaseMutation = useMutation({
    mutationFn: async (staffId) => {
      const purchase = httpsCallable(functions, 'purchaseStaff');
      return purchase({ staffId });
    },
    onSuccess: (result) => {
      toast.success(
        <div>
          <p className="font-bold">Staff Acquired!</p>
          <p className="text-sm">{result.data.message}</p>
        </div>,
        { duration: 4000 }
      );
      // Invalidate marketplace cache to refetch fresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.staffMarketplace() });
    },
    onError: (error) => {
      console.error('Error purchasing staff:', error);
      const errorMessage = error.message || 'Failed to purchase staff member';
      toast.error(errorMessage);
    },
  });

  // Assign staff mutation
  const assignMutation = useMutation({
    mutationFn: async ({ staffId, corpsClass }) => {
      const assign = httpsCallable(functions, 'assignStaff');
      return assign({ staffId, corpsClass });
    },
    onSuccess: (result) => {
      toast.success(
        <div>
          <p className="font-bold">Staff Assigned!</p>
          <p className="text-sm">{result.data.message}</p>
        </div>
      );
    },
    onError: (error) => {
      console.error('Error assigning staff:', error);
      const errorMessage = error.message || 'Failed to assign staff member';
      toast.error(errorMessage);
    },
  });

  // Purchase staff member
  const purchaseStaff = useCallback(async (staffId) => {
    return purchaseMutation.mutateAsync(staffId);
  }, [purchaseMutation]);

  // Assign staff to corps
  const assignStaffToCorps = useCallback(async (staffId, corpsClass) => {
    return assignMutation.mutateAsync({ staffId, corpsClass });
  }, [assignMutation]);

  // Unassign staff from corps
  const unassignStaff = useCallback(async (staffId) => {
    try {
      const assign = httpsCallable(functions, 'assignStaff');
      await assign({ staffId, corpsClass: null });
      toast.success('Staff member unassigned');
    } catch (error) {
      console.error('Error unassigning staff:', error);
      toast.error('Failed to unassign staff member');
      throw error;
    }
  }, []);

  // Check if user owns a staff member - O(1) lookup with Set
  const ownsStaff = useCallback((staffId) => {
    return ownedStaffIds.has(staffId);
  }, [ownedStaffIds]);

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

  const loading = profileLoading || marketplaceLoading;
  const purchasing = purchaseMutation.isPending;
  const assigning = assignMutation.isPending;

  return {
    marketplace,
    ownedStaff,
    corpsCoin,
    loading,
    purchasing,
    assigning,
    fetchMarketplace: refetchMarketplace,
    purchaseStaff,
    assignStaffToCorps,
    unassignStaff,
    ownsStaff,
    getStaffDetails,
    getAssignedStaff,
    getUnassignedStaff,
    getStaffByCaption,
    canAfford
  };
};
