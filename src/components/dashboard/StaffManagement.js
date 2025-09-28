import React, { useState, useEffect } from 'react';
import { db, functions } from 'firebaseConfig';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { useAuth } from '../../context/AuthContext';
import { useUserStore } from '../../store/userStore';
import { Star, ShoppingCart, TrendingUp, Award, Users, Coins, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

const StaffManagement = ({ userProfile }) => {
  const { currentUser } = useAuth();
  const [availableStaff, setAvailableStaff] = useState([]);
  const [userStaff, setUserStaff] = useState([]);
  const [marketplace, setMarketplace] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('browse');
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({
    caption: 'all',
    minValue: '',
    maxValue: '',
    searchTerm: ''
  });

  const captions = ['GE1', 'GE2', 'Visual Proficiency', 'Visual Analysis', 'Color Guard', 'Brass', 'Music Analysis', 'Percussion'];

  useEffect(() => {
    if (currentUser) {
      fetchAllData();
    }
  }, [currentUser]);

  const fetchAllData = async () => {
    setError('');
    await Promise.all([
      fetchAvailableStaff(),
      fetchUserStaff(),
      fetchMarketplace()
    ]);
    setLoading(false);
  };

  const fetchAvailableStaff = async () => {
    try {
      const staffRef = collection(db, 'staff');
      
      // Try with orderBy, fall back to simple query if it fails
      let snapshot;
      try {
        const q = query(staffRef, orderBy('yearInducted', 'desc'));
        snapshot = await getDocs(q);
      } catch (orderError) {
        console.warn('OrderBy failed, using simple query:', orderError);
        snapshot = await getDocs(staffRef);
      }
      
      const staff = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        baseValue: calculateBaseValue(doc.data().yearInducted || 2020)
      }));
      
      // Sort manually if orderBy failed
      staff.sort((a, b) => (b.yearInducted || 2020) - (a.yearInducted || 2020));
      
      setAvailableStaff(staff);
    } catch (error) {
      console.error('Error fetching available staff:', error);
      setError('Failed to load available staff');
    }
  };

  const fetchUserStaff = async () => {
    try {
      if (!currentUser?.uid) return;
      
      const userStaffRef = collection(db, `artifacts/marching-art/users/${currentUser.uid}/staff`);
      const snapshot = await getDocs(userStaffRef);
      
      const staff = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setUserStaff(staff);
    } catch (error) {
      console.error('Error fetching user staff:', error);
      // Don't set error here, as this might be expected for new users
    }
  };

  const fetchMarketplace = async () => {
    try {
      const marketplaceRef = collection(db, 'staff_marketplace');
      
      // Try with where clause, fall back to simple query
      let snapshot;
      try {
        const q = query(
          marketplaceRef,
          where('isActive', '==', true),
          orderBy('price', 'asc')
        );
        snapshot = await getDocs(q);
      } catch (queryError) {
        console.warn('Complex query failed, using simple query:', queryError);
        snapshot = await getDocs(marketplaceRef);
      }
      
      const listings = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(listing => listing.isActive === true)
        .sort((a, b) => (a.price || 0) - (b.price || 0));
      
      setMarketplace(listings);
    } catch (error) {
      console.error('Error fetching marketplace:', error);
      // Don't set error, marketplace might not exist yet
    }
  };

  const calculateBaseValue = (yearInducted) => {
    const currentYear = new Date().getFullYear();
    const yearsAgo = currentYear - (yearInducted || 2020);
    return Math.max(500, 2000 - (yearsAgo * 100)); // More recent inductees are more valuable
  };

  const purchaseStaff = async (staffId) => {
    try {
      const purchaseStaffMember = httpsCallable(functions, 'purchaseStaffMember');
      const result = await purchaseStaffMember({ staffId });
      toast.success(result.data.message || 'Staff member purchased successfully!');
      await fetchAllData();
    } catch (error) {
      console.error('Purchase error:', error);
      toast.error(error.message || 'Failed to purchase staff member');
    }
  };

  const purchaseFromMarketplace = async (listingId) => {
    try {
      const purchaseFromMarketplace = httpsCallable(functions, 'purchaseFromMarketplace');
      const result = await purchaseFromMarketplace({ listingId });
      toast.success(result.data.message || 'Staff member purchased from marketplace!');
      await fetchAllData();
    } catch (error) {
      console.error('Marketplace purchase error:', error);
      toast.error(error.message || 'Failed to purchase from marketplace');
    }
  };

  const listOnMarketplace = async (staffId, price) => {
    try {
      const listStaffOnMarketplace = httpsCallable(functions, 'listStaffOnMarketplace');
      const result = await listStaffOnMarketplace({ staffId, price });
      toast.success(result.data.message || 'Staff member listed on marketplace!');
      await fetchAllData();
    } catch (error) {
      console.error('List error:', error);
      toast.error(error.message || 'Failed to list staff member');
    }
  };

  const applyStaffToCaption = async (staffId, caption) => {
    try {
      const applyStaffToCaption = httpsCallable(functions, 'applyStaffToCaption');
      const result = await applyStaffToCaption({ staffId, caption });
      toast.success(result.data.message || `Staff member applied to ${caption}!`);
      await fetchAllData();
    } catch (error) {
      console.error('Apply error:', error);
      toast.error(error.message || 'Failed to apply staff member');
    }
  };

  const getFilteredStaff = (staffList) => {
    return staffList.filter(staff => {
      const matchesCaption = filters.caption === 'all' || staff.caption === filters.caption;
      const matchesMinValue = !filters.minValue || (staff.baseValue || staff.price || 0) >= parseInt(filters.minValue);
      const matchesMaxValue = !filters.maxValue || (staff.baseValue || staff.price || 0) <= parseInt(filters.maxValue);
      const matchesSearch = !filters.searchTerm || 
        (staff.name || '').toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        (staff.biography || '').toLowerCase().includes(filters.searchTerm.toLowerCase());
      
      return matchesCaption && matchesMinValue && matchesMaxValue && matchesSearch;
    });
  };

  const StaffCard = ({ staff, onPurchase, onApply, isOwned = false, showApply = false }) => (
    <div className="bg-surface-dark p-4 rounded-theme border border-accent-dark hover:border-primary-dark transition-colors">
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <h4 className="font-bold text-text-primary-dark text-lg">{staff.name || 'Unknown Staff'}</h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-2 py-1 bg-primary text-on-primary rounded text-sm font-medium">
              {staff.caption || 'General'}
            </span>
            <span className="text-text-secondary-dark text-sm">
              Inducted {staff.yearInducted || 'Unknown'}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1 text-yellow-500">
            <Coins className="w-4 h-4" />
            <span className="font-bold">{staff.baseValue || staff.price || 0}</span>
          </div>
          {staff.experienceLevel && (
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-4 h-4 text-primary-dark" />
              <span className="text-sm text-text-secondary-dark">Level {staff.experienceLevel}</span>
            </div>
          )}
        </div>
      </div>

      <p className="text-text-secondary-dark text-sm mb-4 line-clamp-2">
        {staff.biography || 'Experienced staff member with proven track record.'}
      </p>

      <div className="flex gap-2">
        {!isOwned && onPurchase && (
          <button
            onClick={() => onPurchase(staff.id)}
            className="flex-1 bg-primary hover:bg-primary-dark text-on-primary px-3 py-2 rounded-theme font-medium transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingCart className="w-4 h-4" />
            Purchase
          </button>
        )}
        {isOwned && showApply && (
          <select
            onChange={(e) => {
              if (e.target.value && onApply) {
                onApply(staff.id, e.target.value);
                e.target.value = ''; // Reset select
              }
            }}
            className="flex-1 bg-background-dark border border-accent-dark rounded-theme px-3 py-2 text-text-primary-dark"
            defaultValue=""
          >
            <option value="" disabled>Apply to Caption</option>
            {captions.map(caption => (
              <option key={caption} value={caption}>{caption}</option>
            ))}
          </select>
        )}
        {isOwned && (
          <button
            onClick={() => {
              const price = prompt('Enter listing price:');
              if (price && !isNaN(price) && parseInt(price) > 0) {
                listOnMarketplace(staff.id, parseInt(price));
              }
            }}
            className="px-3 py-2 bg-accent-dark hover:bg-secondary text-text-primary-dark rounded-theme transition-colors"
          >
            <TrendingUp className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-dark"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <Award className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
        <h3 className="text-xl font-medium text-text-primary-dark mb-2">Error Loading Staff</h3>
        <p className="text-text-secondary-dark mb-4">{error}</p>
        <button
          onClick={fetchAllData}
          className="bg-primary hover:bg-primary-dark text-on-primary px-6 py-2 rounded-theme font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-text-primary-dark mb-2">Staff Management</h1>
        <p className="text-text-secondary-dark">
          Build your staff with DCI Hall of Fame members
        </p>
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <Coins className="w-5 h-5 text-yellow-500" />
            <span className="font-bold text-text-primary-dark">
              {userProfile?.corpsCoin || 0} CorpsCoin
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-dark" />
            <span className="text-text-primary-dark">
              {userStaff.length} Staff Members
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center gap-2">
        {[
          { id: 'browse', label: 'Browse Staff', icon: Award },
          { id: 'mystaff', label: 'My Staff', icon: Users },
          { id: 'marketplace', label: 'Marketplace', icon: ShoppingCart }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 rounded-theme font-medium transition-colors flex items-center gap-2 ${
              activeTab === tab.id
                ? 'bg-primary text-on-primary'
                : 'bg-surface-dark text-text-secondary-dark hover:bg-accent-dark hover:text-text-primary-dark'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-surface-dark p-4 rounded-theme">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-secondary-dark" />
            <span className="font-medium text-text-primary-dark">Filters:</span>
          </div>
          
          <select
            value={filters.caption}
            onChange={(e) => setFilters({...filters, caption: e.target.value})}
            className="bg-background-dark border border-accent-dark rounded px-3 py-2 text-text-primary-dark"
          >
            <option value="all">All Captions</option>
            {captions.map(caption => (
              <option key={caption} value={caption}>{caption}</option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Search by name..."
            value={filters.searchTerm}
            onChange={(e) => setFilters({...filters, searchTerm: e.target.value})}
            className="bg-background-dark border border-accent-dark rounded px-3 py-2 text-text-primary-dark placeholder-text-secondary-dark"
          />

          <input
            type="number"
            placeholder="Min Value"
            value={filters.minValue}
            onChange={(e) => setFilters({...filters, minValue: e.target.value})}
            className="w-24 bg-background-dark border border-accent-dark rounded px-3 py-2 text-text-primary-dark placeholder-text-secondary-dark"
          />

          <input
            type="number"
            placeholder="Max Value"
            value={filters.maxValue}
            onChange={(e) => setFilters({...filters, maxValue: e.target.value})}
            className="w-24 bg-background-dark border border-accent-dark rounded px-3 py-2 text-text-primary-dark placeholder-text-secondary-dark"
          />

          <button
            onClick={() => setFilters({caption: 'all', minValue: '', maxValue: '', searchTerm: ''})}
            className="px-3 py-2 bg-accent-dark hover:bg-secondary text-text-primary-dark rounded transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'browse' && (
        <div>
          <h3 className="text-xl font-semibold text-text-primary-dark mb-4">
            Available Staff ({getFilteredStaff(availableStaff).length})
          </h3>
          {getFilteredStaff(availableStaff).length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getFilteredStaff(availableStaff).map(staff => (
                <StaffCard
                  key={staff.id}
                  staff={staff}
                  onPurchase={purchaseStaff}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Award className="w-12 h-12 mx-auto text-text-secondary-dark mb-3" />
              <p className="text-text-secondary-dark">No staff members match your filters</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'mystaff' && (
        <div>
          <h3 className="text-xl font-semibold text-text-primary-dark mb-4">
            My Staff ({userStaff.length})
          </h3>
          {userStaff.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getFilteredStaff(userStaff).map(staff => (
                <StaffCard
                  key={staff.id}
                  staff={staff}
                  onApply={applyStaffToCaption}
                  isOwned={true}
                  showApply={true}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
              <h4 className="text-lg font-medium text-text-primary-dark mb-2">
                No Staff Members Yet
              </h4>
              <p className="text-text-secondary-dark mb-4">
                Purchase staff members to improve your corps performance
              </p>
              <button
                onClick={() => setActiveTab('browse')}
                className="bg-primary hover:bg-primary-dark text-on-primary px-6 py-2 rounded-theme font-medium transition-colors"
              >
                Browse Available Staff
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'marketplace' && (
        <div>
          <h3 className="text-xl font-semibold text-text-primary-dark mb-4">
            Staff Marketplace ({marketplace.length} listings)
          </h3>
          {marketplace.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getFilteredStaff(marketplace).map(listing => (
                <div key={listing.id} className="bg-surface-dark p-4 rounded-theme border border-accent-dark hover:border-primary-dark transition-colors">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-text-primary-dark text-lg">{listing.staffName || 'Unknown Staff'}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="px-2 py-1 bg-primary text-on-primary rounded text-sm font-medium">
                          {listing.caption || 'General'}
                        </span>
                        <span className="text-text-secondary-dark text-sm">
                          Level {listing.experienceLevel || 1}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-yellow-500">
                        <Coins className="w-4 h-4" />
                        <span className="font-bold">{listing.price || 0}</span>
                      </div>
                      <p className="text-xs text-text-secondary-dark">
                        by {listing.sellerName || 'Unknown'}
                      </p>
                    </div>
                  </div>

                  <p className="text-text-secondary-dark text-sm mb-4 line-clamp-2">
                    {listing.biography || 'Experienced staff member with proven track record.'}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => purchaseFromMarketplace(listing.id)}
                      className="flex-1 bg-primary hover:bg-primary-dark text-on-primary px-3 py-2 rounded-theme font-medium transition-colors flex items-center justify-center gap-2"
                      disabled={listing.sellerId === currentUser?.uid}
                    >
                      <ShoppingCart className="w-4 h-4" />
                      {listing.sellerId === currentUser?.uid ? 'Your Listing' : 'Purchase'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ShoppingCart className="w-16 h-16 mx-auto text-text-secondary-dark mb-4" />
              <h4 className="text-lg font-medium text-text-primary-dark mb-2">
                No Marketplace Listings
              </h4>
              <p className="text-text-secondary-dark">
                Check back later for staff members listed by other players
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StaffManagement;