// src/hooks/useStaffMarketplace.js
import { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';

export const useStaffMarketplace = (userId) => {
  const [marketplace, setMarketplace] = useState([]);
  const [ownedStaff, setOwnedStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [corpsCoin, setCorpsCoin] = useState(0);

  const functions = getFunctions();

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
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Fetch marketplace staff
  const fetchMarketplace = async (captionFilter = null) => {
    try {
      setLoading(true);
      const getMarketplace = httpsCallable(functions, 'getStaffMarketplace');
      const result = await getMarketplace({ caption: captionFilter });
      setMarketplace(result.data.staff || []);
    } catch (error) {
      console.error('Error fetching marketplace:', error);
      toast.error('Failed to load staff marketplace');
    } finally {
      setLoading(false);
    }
  };

  // Purchase staff member
  const purchaseStaff = async (staffId) => {
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

      // Refresh marketplace
      await fetchMarketplace();

      return result.data;
    } catch (error) {
      console.error('Error purchasing staff:', error);
      const errorMessage = error.message || 'Failed to purchase staff member';
      toast.error(errorMessage);
      throw error;
    } finally {
      setPurchasing(false);
    }
  };

  // Assign staff to corps caption
  const assignStaffToCorps = async (staffId, corpsClass, caption) => {
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
  };

  // Unassign staff from corps
  const unassignStaff = async (staffId) => {
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
  };

  // Check if user owns a staff member
  const ownsStaff = (staffId) => {
    return ownedStaff.some(s => s.staffId === staffId);
  };

  // Get staff member details
  const getStaffDetails = (staffId) => {
    return ownedStaff.find(s => s.staffId === staffId);
  };

  // Get assigned staff for a specific corps/caption
  const getAssignedStaff = (corpsClass, caption) => {
    return ownedStaff.find(
      s => s.assignedTo?.corpsClass === corpsClass && s.assignedTo?.caption === caption
    );
  };

  // Get all unassigned staff
  const getUnassignedStaff = () => {
    return ownedStaff.filter(s => !s.assignedTo);
  };

  // Get staff by caption
  const getStaffByCaption = (caption) => {
    return ownedStaff.filter(s => s.caption === caption);
  };

  // Check if user can afford a staff member
  const canAfford = (cost) => {
    return corpsCoin >= cost;
  };

  return {
    marketplace,
    ownedStaff,
    corpsCoin,
    loading,
    purchasing,
    assigning,
    fetchMarketplace,
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
