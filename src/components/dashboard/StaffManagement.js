import React, { useState, useEffect } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebaseConfig';
import { useAuth } from '../../context/AuthContext';
import { useUserStore } from '../../store/userStore';
import toast from 'react-hot-toast';
import { 
  Users, 
  Star, 
  TrendingUp, 
  ShoppingCart, 
  Award, 
  Coins,
  Calendar,
  User,
  Plus,
  Minus,
  DollarSign,
  Info,
  CheckCircle,
  Lock
} from 'lucide-react';

const StaffManagement = ({ userProfile }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('roster');
  const [ownedStaff, setOwnedStaff] = useState([]);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCaption, setSelectedCaption] = useState('');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [expandedCaptions, setExpandedCaptions] = useState({});

  const captions = ["GE1", "GE2", "Visual Proficiency", "Visual Analysis", "Color Guard", "Brass", "Music Analysis", "Percussion"];

  // Firebase function references
  const getUserStaff = httpsCallable(functions, 'getUserStaff');
  const getAvailableStaff = httpsCallable(functions, 'getAvailableStaff');
  const purchaseStaffMember = httpsCallable(functions, 'purchaseStaffMember');
  const assignStaffToCaption = httpsCallable(functions, 'assignStaffToCaption');
  const unassignStaffFromCaption = httpsCallable(functions, 'unassignStaffFromCaption');

  // Load data on component mount
  useEffect(() => {
    if (currentUser) {
      loadData();
    }
  }, [currentUser]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadOwnedStaff(),
        loadAvailableStaff()
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
      const result = await getAvailableStaff({ caption: selectedCaption });
      if (result.data.success) {
        setAvailableStaff(result.data.staff || []);
      }
    } catch (error) {
      console.error('Error loading available staff:', error);
    }
  };

  const handlePurchaseStaff = async (staffId) => {
    try {
      const result = await purchaseStaffMember({ staffId });
      if (result.data.success) {
        toast.success(result.data.message);
        setShowPurchaseModal(false);
        setSelectedStaff(null);
        await Promise.all([
          loadOwnedStaff(),
          loadAvailableStaff()
        ]);
        // Refresh user profile to update CorpsCoin balance
        useUserStore.getState().fetchUserProfile(currentUser.uid);
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
      const result = await assignStaffToCaption({ staffId, caption });
      if (result.data.success) {
        toast.success(result.data.message);
        await loadOwnedStaff();
      }
    } catch (error) {
      console.error('Error assigning staff:', error);
      toast.error(error.message || 'Failed to assign staff member');
    }
  };

  const handleUnassignStaff = async (staffId) => {
    try {
      const result = await unassignStaffFromCaption({ staffId });
      if (result.data.success) {
        toast.success(result.data.message);
        await loadOwnedStaff();
      }
    } catch (error) {
      console.error('Error unassigning staff:', error);
      toast.error(error.message || 'Failed to unassign staff member');
    }
  };

  const getStaffForCaption = (caption) => {
    return ownedStaff.find(staff => staff.assignedCaption === caption && staff.isActive);
  };

  const getAvailableStaffForCaption = (caption) => {
    return ownedStaff.filter(staff => 
      staff.caption === caption && 
      !staff.isActive && 
      !staff.isListedForSale
    );
  };

  const toggleCaptionExpanded = (caption) => {
    setExpandedCaptions(prev => ({
      ...prev,
      [caption]: !prev[caption]
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-primary-dark mx-auto mb-4"></div>
          <p className="text-text-secondary dark:text-text-secondary-dark">Loading staff management...</p>
        </div>
      </div>
    );
  }

  const userCorpsCoin = userProfile?.corpsCoin || 0;

  return (
    <div className="space-y-6">
      {/* Header with balance */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-1">Staff Management</h2>
          <p className="text-text-secondary dark:text-text-secondary-dark">
            Hire legendary DCI Hall of Fame members to enhance your corps
          </p>
        </div>
        <div className="flex items-center gap-2 bg-secondary dark:bg-secondary-dark px-4 py-2 rounded-theme">
          <Coins className="w-5 h-5 text-white" />
          <span className="text-lg font-bold text-white">{userCorpsCoin.toLocaleString()}</span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-900 bg-opacity-30 border border-blue-400 rounded-theme p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1 text-text-primary dark:text-text-primary-dark">Staff Management Tips:</p>
            <ul className="space-y-1 text-text-secondary dark:text-text-secondary-dark">
              <li>• Assign one staff member per caption to gain performance bonuses</li>
              <li>• More experienced staff (newer Hall of Fame inductees) cost more</li>
              <li>• Staff gain value as they complete seasons with your corps</li>
              <li>• You can sell experienced staff on the marketplace for profit</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-accent dark:border-accent-dark">
        {[
          { id: 'roster', label: 'Active Roster', icon: Award },
          { id: 'hire', label: 'Hire Staff', icon: ShoppingCart },
          { id: 'collection', label: 'My Collection', icon: Users }
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 font-medium transition-all ${
                activeTab === tab.id
                  ? 'text-primary dark:text-primary-dark border-b-2 border-primary dark:border-primary-dark'
                  : 'text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Roster Tab */}
      {activeTab === 'roster' && (
        <div className="space-y-4">
          <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark">Current Season Assignments</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {captions.map(caption => {
              const assignedStaff = getStaffForCaption(caption);
              const availableForCaption = getAvailableStaffForCaption(caption);
              const showAvailable = expandedCaptions[caption] || false;

              return (
                <div key={caption} className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h4 className="font-bold text-text-primary dark:text-text-primary-dark">{caption}</h4>
                      {assignedStaff && (
                        <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                          +{assignedStaff.performanceBonus || 0}% bonus
                        </p>
                      )}
                    </div>
                    {assignedStaff ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <div className="text-xs text-error">Not assigned</div>
                    )}
                  </div>

                  {assignedStaff ? (
                    <div className="bg-background dark:bg-background-dark p-3 rounded">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-medium text-text-primary dark:text-text-primary-dark">{assignedStaff.name}</p>
                          <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                            Inducted {assignedStaff.yearInducted} • {assignedStaff.seasonsCompleted || 0} seasons
                          </p>
                        </div>
                        <button
                          onClick={() => handleUnassignStaff(assignedStaff.id)}
                          className="text-error hover:text-red-400 p-1"
                          title="Unassign staff"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-text-secondary dark:text-text-secondary-dark text-sm">
                      No staff assigned
                    </div>
                  )}

                  {/* Show available staff to assign */}
                  {availableForCaption.length > 0 && (
                    <div className="mt-3">
                      <button
                        onClick={() => toggleCaptionExpanded(caption)}
                        className="text-sm text-primary dark:text-primary-dark hover:underline"
                      >
                        {showAvailable ? 'Hide' : 'Show'} available staff ({availableForCaption.length})
                      </button>
                      
                      {showAvailable && (
                        <div className="mt-2 space-y-2">
                          {availableForCaption.map(staff => (
                            <div key={staff.id} className="flex items-center justify-between p-2 bg-background dark:bg-background-dark rounded">
                              <span className="text-sm text-text-primary dark:text-text-primary-dark">{staff.name}</span>
                              <button
                                onClick={() => handleAssignStaff(staff.id, caption)}
                                className="text-primary dark:text-primary-dark hover:text-primary p-1"
                                title="Assign to this caption"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hire Staff Tab */}
      {activeTab === 'hire' && (
        <div className="space-y-4">
          {/* Caption Filter */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-text-primary dark:text-text-primary-dark">Filter by Caption:</label>
            <select
              value={selectedCaption}
              onChange={(e) => {
                setSelectedCaption(e.target.value);
                loadAvailableStaff();
              }}
              className="bg-background dark:bg-background-dark border border-accent dark:border-accent-dark rounded px-3 py-2 text-text-primary dark:text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary dark:focus:ring-primary-dark"
            >
              <option value="">All Captions</option>
              {captions.map(caption => (
                <option key={caption} value={caption}>{caption}</option>
              ))}
            </select>
          </div>

          {/* Available Staff Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableStaff.map(staff => {
              const canAfford = userCorpsCoin >= staff.baseValue;
              const alreadyOwned = ownedStaff.some(owned => owned.id === staff.id);

              return (
                <div key={staff.id} className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-1">{staff.name}</h4>
                      <p className="text-sm text-primary dark:text-primary-dark">{staff.caption}</p>
                      <p className="text-xs text-text-secondary dark:text-text-secondary-dark">Inducted {staff.yearInducted}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Coins className="w-4 h-4 text-secondary dark:text-secondary-dark" />
                      <span className="font-bold text-text-primary dark:text-text-primary-dark">{staff.baseValue}</span>
                    </div>
                  </div>

                  {staff.biography && (
                    <p className="text-xs text-text-secondary dark:text-text-secondary-dark mb-3 line-clamp-2">
                      {staff.biography}
                    </p>
                  )}

                  <button
                    onClick={() => {
                      if (alreadyOwned) {
                        toast.info('You already own this staff member');
                      } else {
                        setSelectedStaff(staff);
                        setShowPurchaseModal(true);
                      }
                    }}
                    disabled={!canAfford && !alreadyOwned}
                    className={`w-full py-2 px-4 rounded-theme font-medium transition-colors ${
                      alreadyOwned
                        ? 'bg-gray-600 cursor-not-allowed text-white'
                        : canAfford
                          ? 'bg-primary hover:bg-primary-dark dark:bg-primary-dark dark:hover:bg-primary text-white'
                          : 'bg-gray-700 cursor-not-allowed text-gray-400'
                    }`}
                  >
                    {alreadyOwned ? 'Already Owned' : canAfford ? 'Hire' : 'Insufficient Funds'}
                  </button>
                </div>
              );
            })}
          </div>

          {availableStaff.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
              <p className="text-text-secondary dark:text-text-secondary-dark">
                No staff members available for the selected criteria.
              </p>
            </div>
          )}
        </div>
      )}

      {/* My Collection Tab */}
      {activeTab === 'collection' && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark">My Staff Collection</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownedStaff.map(staff => (
              <div key={staff.id} className="bg-background dark:bg-background-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">{staff.name}</h4>
                    <p className="text-sm text-primary dark:text-primary-dark">{staff.caption}</p>
                  </div>
                  <div className="flex items-center space-x-2">
                    {staff.isActive && (
                      <div className="w-2 h-2 bg-green-500 rounded-full" title="Active" />
                    )}
                    {staff.isListedForSale && (
                      <DollarSign className="w-4 h-4 text-yellow-500" title="Listed for sale" />
                    )}
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary dark:text-text-secondary-dark">Inducted:</span>
                    <span className="text-text-primary dark:text-text-primary-dark">{staff.yearInducted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary dark:text-text-secondary-dark">Purchase Price:</span>
                    <span className="text-text-primary dark:text-text-primary-dark">{staff.purchasePrice?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary dark:text-text-secondary-dark">Current Value:</span>
                    <span className="text-text-primary dark:text-text-primary-dark">{staff.currentMarketValue?.toLocaleString() || staff.purchasePrice?.toLocaleString()}</span>
                  </div>
                  {staff.seasonsCompleted > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary dark:text-text-secondary-dark">Seasons:</span>
                      <span className="text-text-primary dark:text-text-primary-dark">{staff.seasonsCompleted}</span>
                    </div>
                  )}
                  {staff.assignedCaption && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary dark:text-text-secondary-dark">Assigned:</span>
                      <span className="text-success">{staff.assignedCaption}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {ownedStaff.length === 0 && (
            <div className="text-center py-12">
              <Award className="w-16 h-16 mx-auto text-text-secondary dark:text-text-secondary-dark mb-4" />
              <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                You don't own any staff members yet.
              </p>
              <button
                onClick={() => setActiveTab('hire')}
                className="bg-primary hover:bg-primary-dark dark:bg-primary-dark dark:hover:bg-primary text-white px-6 py-2 rounded-theme font-medium transition-colors"
              >
                Browse Available Staff
              </button>
            </div>
          )}
        </div>
      )}

      {/* Purchase Confirmation Modal */}
      {showPurchaseModal && selectedStaff && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme max-w-md w-full">
            <h3 className="text-xl font-semibold text-text-primary dark:text-text-primary-dark mb-4">Confirm Purchase</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-text-primary dark:text-text-primary-dark font-medium">{selectedStaff.name}</p>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  {selectedStaff.caption} • Inducted {selectedStaff.yearInducted}
                </p>
              </div>
              
              <div className="bg-background dark:bg-background-dark p-3 rounded">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-text-secondary dark:text-text-secondary-dark">Cost:</span>
                  <div className="flex items-center gap-1">
                    <Coins className="w-4 h-4 text-secondary dark:text-secondary-dark" />
                    <span className="font-bold text-text-primary dark:text-text-primary-dark">{selectedStaff.baseValue}</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary dark:text-text-secondary-dark">Your Balance:</span>
                  <span className={`font-bold ${userCorpsCoin >= selectedStaff.baseValue ? 'text-success' : 'text-error'}`}>
                    {userCorpsCoin.toLocaleString()}
                  </span>
                </div>
              </div>
              
              {selectedStaff.biography && (
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">{selectedStaff.biography}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPurchaseModal(false);
                  setSelectedStaff(null);
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 px-4 rounded-theme font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePurchaseStaff(selectedStaff.id)}
                disabled={userCorpsCoin < selectedStaff.baseValue}
                className="flex-1 bg-primary hover:bg-primary-dark dark:bg-primary-dark dark:hover:bg-primary text-white py-2 px-4 rounded-theme font-medium transition-colors disabled:bg-gray-700 disabled:cursor-not-allowed"
              >
                Confirm Purchase
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;