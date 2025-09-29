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
  Crown,
  User,
  Plus,
  Minus,
  Eye,
  DollarSign
} from 'lucide-react';

const StaffManagement = ({ userProfile }) => {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('roster');
  const [ownedStaff, setOwnedStaff] = useState([]);
  const [availableStaff, setAvailableStaff] = useState([]);
  const [marketplaceListings, setMarketplaceListings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCaption, setSelectedCaption] = useState('');
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);

  const captions = ["GE1", "GE2", "Visual Proficiency", "Visual Analysis", "Color Guard", "Brass", "Music Analysis", "Percussion"];

  // Firebase function references
  const getUserStaff = httpsCallable(functions, 'staff-getUserStaff');
  const getAvailableStaff = httpsCallable(functions, 'staff-getAvailableStaff');
  const purchaseStaffMember = httpsCallable(functions, 'staff-purchaseStaffMember');
  const assignStaffToCaption = httpsCallable(functions, 'staff-assignStaffToCaption');
  const unassignStaffFromCaption = httpsCallable(functions, 'staff-unassignStaffFromCaption');
  const sellStaffMember = httpsCallable(functions, 'staff-sellStaffMember');

  // Load data on component mount
  useEffect(() => {
    loadData();
  }, [currentUser]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadOwnedStaff(),
        loadAvailableStaff(),
        // loadMarketplaceListings() // TODO: Implement marketplace
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
        setOwnedStaff(result.data.staff);
      }
    } catch (error) {
      console.error('Error loading owned staff:', error);
    }
  };

  const loadAvailableStaff = async () => {
    try {
      const result = await getAvailableStaff({ caption: selectedCaption });
      if (result.data.success) {
        setAvailableStaff(result.data.staff);
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

  if (isLoading) {
    return (
      <div className="bg-surface-dark p-8 rounded-theme text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-dark mx-auto mb-4"></div>
        <p className="text-text-secondary-dark">Loading staff management...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with tabs */}
      <div className="bg-surface-dark p-6 rounded-theme shadow-theme-dark">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-text-primary-dark mb-2">Staff Management</h2>
            <p className="text-text-secondary-dark">Hire legendary DCI staff to boost your corps performance</p>
          </div>
          <div className="flex items-center space-x-4 mt-4 sm:mt-0">
            <div className="flex items-center space-x-2 bg-background-dark px-4 py-2 rounded-theme">
              <Coins className="w-5 h-5 text-yellow-500" />
              <span className="text-text-primary-dark font-semibold">
                {userProfile.corpsCoin?.toLocaleString() || 0}
              </span>
            </div>
            <div className="text-sm text-text-secondary-dark">
              Owned: {ownedStaff.length} | Active: {ownedStaff.filter(s => s.isActive).length}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 bg-background-dark p-1 rounded-theme">
          {[
            { id: 'roster', label: 'Active Roster', icon: Users },
            { id: 'hire', label: 'Hire Staff', icon: ShoppingCart },
            { id: 'collection', label: 'My Collection', icon: Award },
            // { id: 'marketplace', label: 'Marketplace', icon: DollarSign }
          ].map(tab => {
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-2 rounded-theme transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary text-on-primary'
                    : 'text-text-secondary-dark hover:text-text-primary-dark hover:bg-surface-dark'
                }`}
              >
                <IconComponent className="w-4 h-4" />
                <span className="font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Roster Tab */}
      {activeTab === 'roster' && (
        <div className="bg-surface-dark p-6 rounded-theme shadow-theme-dark">
          <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Active Staff Assignments</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {captions.map(caption => {
              const assignedStaff = getStaffForCaption(caption);
              const availableForCaption = getAvailableStaffForCaption(caption);
              
              return (
                <div key={caption} className="bg-background-dark p-4 rounded-theme border border-accent-dark">
                  <div className="flex justify-between items-center mb-3">
                    <h4 className="font-semibold text-text-primary-dark">{caption}</h4>
                    {assignedStaff && (
                      <button
                        onClick={() => handleUnassignStaff(assignedStaff.id)}
                        className="text-red-400 hover:text-red-300 p-1"
                        title="Remove from assignment"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  
                  {assignedStaff ? (
                    <div className="space-y-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                          <User className="w-4 h-4 text-on-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-text-primary-dark">{assignedStaff.name}</p>
                          <p className="text-sm text-text-secondary-dark">
                            Inducted {assignedStaff.yearInducted}
                            {assignedStaff.seasonsCompleted > 0 && (
                              <span className="ml-2">• {assignedStaff.seasonsCompleted} seasons</span>
                            )}
                          </p>
                        </div>
                      </div>
                      {assignedStaff.performanceBonus > 0 && (
                        <div className="flex items-center space-x-2 text-green-400">
                          <TrendingUp className="w-4 h-4" />
                          <span className="text-sm">+{assignedStaff.performanceBonus} performance bonus</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-text-secondary-dark text-sm">No staff assigned</p>
                      {availableForCaption.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium text-text-primary-dark">Available to assign:</p>
                          {availableForCaption.slice(0, 3).map(staff => (
                            <div key={staff.id} className="flex items-center justify-between bg-surface-dark p-2 rounded">
                              <span className="text-sm text-text-primary-dark">{staff.name}</span>
                              <button
                                onClick={() => handleAssignStaff(staff.id, caption)}
                                className="text-primary-dark hover:text-primary p-1"
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
          <div className="bg-surface-dark p-4 rounded-theme shadow-theme-dark">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
              <label className="text-sm font-medium text-text-secondary-dark">Filter by Caption:</label>
              <select
                value={selectedCaption}
                onChange={(e) => {
                  setSelectedCaption(e.target.value);
                  loadAvailableStaff();
                }}
                className="bg-background-dark border border-accent-dark rounded px-3 py-2 text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary-dark"
              >
                <option value="">All Captions</option>
                {captions.map(caption => (
                  <option key={caption} value={caption}>{caption}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Available Staff Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {availableStaff.map(staff => (
              <div key={staff.id} className="bg-surface-dark p-4 rounded-theme shadow-theme-dark border border-accent-dark">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-text-primary-dark">{staff.name}</h4>
                    <p className="text-sm text-primary-dark">{staff.caption}</p>
                  </div>
                  <div className="flex items-center space-x-1 text-yellow-500">
                    <Crown className="w-4 h-4" />
                    <span className="text-sm">{staff.yearInducted}</span>
                  </div>
                </div>

                <p className="text-sm text-text-secondary-dark mb-4 line-clamp-3">
                  {staff.biography}
                </p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    <span className="font-semibold text-text-primary-dark">
                      {staff.currentMarketValue.toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedStaff(staff);
                      setShowPurchaseModal(true);
                    }}
                    disabled={userProfile.corpsCoin < staff.currentMarketValue}
                    className="bg-primary hover:bg-primary-dark text-on-primary px-3 py-1 rounded text-sm font-medium disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
                  >
                    {userProfile.corpsCoin < staff.currentMarketValue ? 'Insufficient Funds' : 'Hire'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {availableStaff.length === 0 && (
            <div className="bg-surface-dark p-8 rounded-theme text-center">
              <Users className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
              <p className="text-text-secondary-dark">No staff members available for the selected criteria.</p>
            </div>
          )}
        </div>
      )}

      {/* My Collection Tab */}
      {activeTab === 'collection' && (
        <div className="bg-surface-dark p-6 rounded-theme shadow-theme-dark">
          <h3 className="text-xl font-semibold text-text-primary-dark mb-4">My Staff Collection</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ownedStaff.map(staff => (
              <div key={staff.id} className="bg-background-dark p-4 rounded-theme border border-accent-dark">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-text-primary-dark">{staff.name}</h4>
                    <p className="text-sm text-primary-dark">{staff.caption}</p>
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
                    <span className="text-text-secondary-dark">Inducted:</span>
                    <span className="text-text-primary-dark">{staff.yearInducted}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary-dark">Purchase Price:</span>
                    <span className="text-text-primary-dark">{staff.purchasePrice?.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary-dark">Current Value:</span>
                    <span className="text-text-primary-dark">{staff.currentMarketValue?.toLocaleString()}</span>
                  </div>
                  {staff.seasonsCompleted > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary-dark">Seasons:</span>
                      <span className="text-text-primary-dark">{staff.seasonsCompleted}</span>
                    </div>
                  )}
                  {staff.assignedCaption && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary-dark">Assigned:</span>
                      <span className="text-green-400">{staff.assignedCaption}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {ownedStaff.length === 0 && (
            <div className="text-center py-8">
              <Award className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
              <p className="text-text-secondary-dark">You don't own any staff members yet.</p>
              <button
                onClick={() => setActiveTab('hire')}
                className="mt-4 bg-primary hover:bg-primary-dark text-on-primary px-4 py-2 rounded-theme font-medium transition-colors"
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
          <div className="bg-surface-dark p-6 rounded-theme max-w-md w-full">
            <h3 className="text-xl font-semibold text-text-primary-dark mb-4">Confirm Purchase</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <p className="text-text-primary-dark font-medium">{selectedStaff.name}</p>
                <p className="text-sm text-text-secondary-dark">{selectedStaff.caption} • Inducted {selectedStaff.yearInducted}</p>
              </div>
              
              <div className="bg-background-dark p-3 rounded">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary-dark">Cost:</span>
                  <div className="flex items-center space-x-2">
                    <Coins className="w-4 h-4 text-yellow-500" />
                    <span className="font-semibold text-text-primary-dark">
                      {selectedStaff.currentMarketValue.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-text-secondary-dark">Remaining:</span>
                  <span className="text-text-primary-dark">
                    {(userProfile.corpsCoin - selectedStaff.currentMarketValue).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowPurchaseModal(false);
                  setSelectedStaff(null);
                }}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white px-4 py-2 rounded-theme font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePurchaseStaff(selectedStaff.id)}
                className="flex-1 bg-primary hover:bg-primary-dark text-on-primary px-4 py-2 rounded-theme font-medium transition-colors"
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