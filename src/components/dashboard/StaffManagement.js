import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { 
  Award,
  Users,
  Coins,
  Star,
  ShoppingBag,
  X,
  Loader2,
  Trophy,
  Info,
  Target,
  Check,
  TrendingUp,
  Shield
} from 'lucide-react';

const CAPTIONS = [
  'GE1',
  'GE2', 
  'Visual Proficiency',
  'Visual Analysis',
  'Color Guard',
  'Brass',
  'Music Analysis',
  'Percussion'
];

const StaffManagement = ({ userProfile, activeCorps }) => {
  const { currentUser } = useAuth();
  const [ownedStaff, setOwnedStaff] = useState([]);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [marketplaceListings, setMarketplaceListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCaption, setSelectedCaption] = useState('all');
  const [activeTab, setActiveTab] = useState('owned'); // owned, available, marketplace
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  // Check if we have an active corps
  if (!activeCorps) {
    return (
      <div className="text-center py-12">
        <Target className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
          No Corps Selected
        </h3>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          Please create or select a corps to manage staff.
        </p>
      </div>
    );
  }

  useEffect(() => {
    if (currentUser && activeCorps) {
      loadStaffData();
    }
  }, [currentUser, activeCorps?.id, selectedCaption]);

  const loadStaffData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadOwnedStaff(),
        loadAvailableStaff(),
        loadMarketplaceListings()
      ]);
    } catch (error) {
      console.error('Error loading staff data:', error);
      toast.error('Failed to load staff data');
    } finally {
      setIsLoading(false);
    }
  };

  const loadOwnedStaff = async () => {
    try {
      const getUserStaff = httpsCallable(functions, 'getUserStaff');
      const result = await getUserStaff();
      if (result.data.success) {
        setOwnedStaff(result.data.staff || []);
      }
    } catch (error) {
      console.error('Error loading owned staff:', error);
    }
  };

  const loadAvailableStaff = async () => {
    try {
      const getAvailableStaff = httpsCallable(functions, 'getAvailableStaff');
      const result = await getAvailableStaff({ 
        caption: selectedCaption === 'all' ? null : selectedCaption 
      });
      if (result.data.success) {
        setAvailableStaff(result.data.staff || []);
      }
    } catch (error) {
      console.error('Error loading available staff:', error);
    }
  };

  const loadMarketplaceListings = async () => {
    try {
      const getMarketplaceListings = httpsCallable(functions, 'getMarketplaceListings');
      const result = await getMarketplaceListings({
        caption: selectedCaption === 'all' ? null : selectedCaption
      });
      if (result.data.success) {
        setMarketplaceListings(result.data.listings || []);
      }
    } catch (error) {
      console.error('Error loading marketplace listings:', error);
    }
  };

  const handlePurchaseStaff = async (staffId) => {
    try {
      const purchaseStaffMember = httpsCallable(functions, 'purchaseStaffMember');
      const result = await purchaseStaffMember({ staffId });
      
      if (result.data.success) {
        toast.success(result.data.message);
        setShowPurchaseModal(false);
        setSelectedStaff(null);
        await loadStaffData();
      } else {
        toast.error(result.data.message || 'Purchase failed');
      }
    } catch (error) {
      console.error('Error purchasing staff:', error);
      toast.error(error.message || 'Failed to purchase staff member');
    }
  };

  const handleAssignStaff = async (staffId, caption) => {
    try {
      const assignStaffToCaption = httpsCallable(functions, 'assignStaffToCaption');
      const result = await assignStaffToCaption({ 
        staffId, 
        caption,
        corpsId: activeCorps.id 
      });
      
      if (result.data.success) {
        toast.success(result.data.message);
        await loadOwnedStaff();
      } else {
        toast.error(result.data.message || 'Assignment failed');
      }
    } catch (error) {
      console.error('Error assigning staff:', error);
      toast.error(error.message || 'Failed to assign staff');
    }
  };

  const handleUnassignStaff = async (staffId) => {
    try {
      const unassignStaffFromCaption = httpsCallable(functions, 'unassignStaffFromCaption');
      const result = await unassignStaffFromCaption({ 
        staffId,
        corpsId: activeCorps.id 
      });
      
      if (result.data.success) {
        toast.success(result.data.message);
        await loadOwnedStaff();
      } else {
        toast.error(result.data.message || 'Unassignment failed');
      }
    } catch (error) {
      console.error('Error unassigning staff:', error);
      toast.error(error.message || 'Failed to unassign staff');
    }
  };

  const handleSellStaff = async (staffId, price) => {
    try {
      const sellStaffMember = httpsCallable(functions, 'sellStaffMember');
      const result = await sellStaffMember({ staffId, price });
      
      if (result.data.success) {
        toast.success(result.data.message);
        await loadStaffData();
      } else {
        toast.error(result.data.message || 'Listing failed');
      }
    } catch (error) {
      console.error('Error selling staff:', error);
      toast.error(error.message || 'Failed to list staff for sale');
    }
  };

  const StaffCard = ({ staff, type }) => {
    const isAssignedToThisCorps = staff.assignedTo?.corpsId === activeCorps.id;
    const isAssignedElsewhere = staff.assignedTo && !isAssignedToThisCorps;

    return (
      <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark hover:border-primary dark:hover:border-primary-dark transition-all">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-1">
              {staff.name}
            </h4>
            <div className="flex items-center gap-2 text-sm text-text-secondary dark:text-text-secondary-dark">
              <Shield className="w-4 h-4" />
              <span>{staff.caption}</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Coins className="w-4 h-4 text-yellow-500" />
            <span className="font-bold text-text-primary dark:text-text-primary-dark">
              {staff.price?.toLocaleString() || 'N/A'}
            </span>
          </div>
        </div>

        {staff.biography && (
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-3 line-clamp-2">
            {staff.biography}
          </p>
        )}

        <div className="flex items-center justify-between text-xs text-text-secondary dark:text-text-secondary-dark mb-3">
          <span>Inducted: {staff.yearInducted}</span>
          {staff.experience && (
            <div className="flex items-center gap-1">
              <TrendingUp className="w-3 h-3" />
              <span>Exp: {staff.experience}</span>
            </div>
          )}
        </div>

        {isAssignedToThisCorps && (
          <div className="mb-3 px-2 py-1 bg-green-500/10 border border-green-500 rounded text-green-500 text-xs font-semibold text-center">
            Assigned to {staff.assignedTo.caption}
          </div>
        )}

        {isAssignedElsewhere && (
          <div className="mb-3 px-2 py-1 bg-yellow-500/10 border border-yellow-500 rounded text-yellow-500 text-xs font-semibold text-center">
            Assigned to another corps
          </div>
        )}

        <div className="flex gap-2">
          {type === 'owned' && !isAssignedToThisCorps && !isAssignedElsewhere && (
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleAssignStaff(staff.id, e.target.value);
                  e.target.value = '';
                }
              }}
              className="flex-1 p-2 text-sm bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded text-text-primary dark:text-text-primary-dark"
            >
              <option value="">Assign to...</option>
              {CAPTIONS.map(caption => (
                <option key={caption} value={caption}>{caption}</option>
              ))}
            </select>
          )}

          {type === 'owned' && isAssignedToThisCorps && (
            <button
              onClick={() => handleUnassignStaff(staff.id)}
              className="flex-1 px-3 py-2 text-sm bg-yellow-500/10 border border-yellow-500 text-yellow-500 rounded hover:bg-yellow-500/20 transition-colors"
            >
              Unassign
            </button>
          )}

          {type === 'available' && (
            <button
              onClick={() => {
                setSelectedStaff(staff);
                setShowPurchaseModal(true);
              }}
              className="flex-1 px-3 py-2 text-sm bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white rounded transition-colors font-semibold flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Purchase
            </button>
          )}

          {type === 'marketplace' && (
            <button
              onClick={() => {
                setSelectedStaff(staff);
                setShowPurchaseModal(true);
              }}
              className="flex-1 px-3 py-2 text-sm bg-secondary dark:bg-secondary-dark hover:bg-secondary-dark dark:hover:bg-secondary text-white rounded transition-colors font-semibold flex items-center justify-center gap-2"
            >
              <ShoppingBag className="w-4 h-4" />
              Buy
            </button>
          )}
        </div>
      </div>
    );
  };

  // Filter owned staff for this corps
  const assignedStaff = ownedStaff.filter(s => s.assignedTo?.corpsId === activeCorps.id);
  const unassignedStaff = ownedStaff.filter(s => !s.assignedTo || s.assignedTo.corpsId !== activeCorps.id);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            Staff Management
          </h2>
          <p className="text-text-secondary dark:text-text-secondary-dark">
            {activeCorps.corpsName} • {assignedStaff.length}/8 Assigned
          </p>
        </div>

        <div className="flex items-center gap-2 bg-background dark:bg-background-dark px-4 py-2 rounded-theme">
          <Coins className="w-5 h-5 text-yellow-500" />
          <span className="font-bold text-text-primary dark:text-text-primary-dark">
            {userProfile?.corpsCoin?.toLocaleString() || 0}
          </span>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-primary/5 dark:bg-primary-dark/5 border border-primary dark:border-primary-dark rounded-theme p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-primary dark:text-primary-dark flex-shrink-0 mt-0.5" />
          <div className="text-sm text-text-secondary dark:text-text-secondary-dark">
            <p className="mb-2">
              Hire legendary DCI Hall of Fame staff to boost your corps' performance! Each staff member specializes in a specific caption.
            </p>
            <p>
              <strong>Note:</strong> Staff can only be assigned to one corps at a time. Unassign them from other corps first if needed.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveTab('owned')}
          className={`px-4 py-2 rounded-theme font-semibold transition-all ${
            activeTab === 'owned'
              ? 'bg-primary dark:bg-primary-dark text-white'
              : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            <span>My Staff ({ownedStaff.length})</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('available')}
          className={`px-4 py-2 rounded-theme font-semibold transition-all ${
            activeTab === 'available'
              ? 'bg-primary dark:bg-primary-dark text-white'
              : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark'
          }`}
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-4 h-4" />
            <span>Available</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`px-4 py-2 rounded-theme font-semibold transition-all ${
            activeTab === 'marketplace'
              ? 'bg-primary dark:bg-primary-dark text-white'
              : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark'
          }`}
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-4 h-4" />
            <span>Marketplace ({marketplaceListings.length})</span>
          </div>
        </button>
      </div>

      {/* Caption Filter */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-text-primary dark:text-text-primary-dark">
          Filter by Caption:
        </label>
        <select
          value={selectedCaption}
          onChange={(e) => setSelectedCaption(e.target.value)}
          className="px-4 py-2 bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark"
        >
          <option value="all">All Captions</option>
          {CAPTIONS.map(caption => (
            <option key={caption} value={caption}>{caption}</option>
          ))}
        </select>
      </div>

      {/* Content */}
      {isLoadingStatus ? (
        <LoadingScreen fullScreen={false} />
      ) : (
        <>
          {activeTab === 'owned' && (
            <div className="space-y-6">
              {/* Assigned Staff */}
              {assignedStaff.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-3 flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-500" />
                    Assigned to {activeCorps.corpsName}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {assignedStaff.map(staff => (
                      <StaffCard key={staff.id} staff={staff} type="owned" />
                    ))}
                  </div>
                </div>
              )}

              {/* Unassigned Staff */}
              {unassignedStaff.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold text-text-primary dark:text-text-primary-dark mb-3">
                    Available to Assign
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {unassignedStaff.map(staff => (
                      <StaffCard key={staff.id} staff={staff} type="owned" />
                    ))}
                  </div>
                </div>
              )}

              {ownedStaff.length === 0 && (
                <div className="text-center py-12 bg-surface dark:bg-surface-dark rounded-theme border-2 border-dashed border-accent dark:border-accent-dark">
                  <Users className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
                  <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-2">
                    No Staff Yet
                  </h3>
                  <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                    Purchase staff members to boost your performance!
                  </p>
                  <button
                    onClick={() => setActiveTab('available')}
                    className="bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white px-6 py-3 rounded-theme font-semibold inline-flex items-center gap-2"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    Browse Available Staff
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'available' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {availableStaff.length > 0 ? (
                availableStaff.map(staff => (
                  <StaffCard key={staff.id} staff={staff} type="available" />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <Award className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    No staff available in this category
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'marketplace' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketplaceListings.length > 0 ? (
                marketplaceListings.map(listing => (
                  <StaffCard key={listing.id} staff={listing} type="marketplace" />
                ))
              ) : (
                <div className="col-span-full text-center py-12">
                  <Trophy className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
                  <p className="text-text-secondary dark:text-text-secondary-dark">
                    No listings in the marketplace
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Purchase Modal */}
      {showPurchaseModal && selectedStaff && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">
                Confirm Purchase
              </h3>
              <button
                onClick={() => {
                  setShowPurchaseModal(false);
                  setSelectedStaff(null);
                }}
                className="text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="p-4 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark">
                <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-2">
                  {selectedStaff.name}
                </h4>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark mb-2">
                  {selectedStaff.caption}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
                    Inducted: {selectedStaff.yearInducted}
                  </span>
                  <div className="flex items-center gap-1 text-lg font-bold text-yellow-500">
                    <Coins className="w-5 h-5" />
                    {selectedStaff.price?.toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-primary/5 dark:bg-primary-dark/5 border border-primary dark:border-primary-dark rounded-theme">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">Your Balance:</span>
                  <div className="flex items-center gap-1 font-bold">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    {userProfile?.corpsCoin?.toLocaleString()}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">After Purchase:</span>
                  <div className="flex items-center gap-1 font-bold">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    {((userProfile?.corpsCoin || 0) - (selectedStaff.price || 0)).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPurchaseModal(false);
                    setSelectedStaff(null);
                  }}
                  className="flex-1 px-4 py-3 border border-accent dark:border-accent-dark rounded-theme text-text-primary dark:text-text-primary-dark hover:bg-accent dark:hover:bg-accent-dark transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePurchaseStaff(selectedStaff.id)}
                  disabled={(userProfile?.corpsCoin || 0) < (selectedStaff.price || 0)}
                  className="flex-1 px-4 py-3 bg-primary dark:bg-primary-dark hover:bg-primary-dark dark:hover:bg-primary text-white rounded-theme font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Confirm Purchase
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;