import React, { useState, useEffect, Suspense, lazy } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserStore } from '../store/userStore';
import { 
  Settings, 
  Database, 
  Calendar, 
  Users, 
  TrendingUp,
  CheckCircle,
  Clock,
  FileText,
  RefreshCw,
  Star,
  Trophy,
  DollarSign,
  PlayCircle,
  AlertTriangle,
  Activity,
  Grid3x3,
  Award
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import toast from 'react-hot-toast';
import LoadingScreen from '../components/common/LoadingScreen';

// Lazy load the scoring grid component
const ScoringGridAdmin = lazy(() => import('../components/admin/ScoringGridAdmin'));

const AdminPage = () => {
  const { currentUser } = useAuth();
  const { profile } = useUserStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [systemStatus, setSystemStatus] = useState('loading');

  // Check if user is admin
  const isAdmin = currentUser?.uid === 'o8vfRCOevjTKBY0k2dISlpiYiIH2';

  useEffect(() => {
    if (isAdmin) {
      fetchAdminData();
    }
  }, [isAdmin]);

  const fetchAdminData = async () => {
    try {
      setIsLoading(true);
      const getSystemStats = httpsCallable(functions, 'getSystemStats');
      const result = await getSystemStats();
      
      if (result.data) {
        setAdminStats(result.data);
        setSystemStatus('healthy');
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      toast.error('Failed to load admin stats');
      setSystemStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeasonAction = async (action, params = {}) => {
    try {
      setIsLoading(true);
      
      if (action === 'createNewSeason') {
        const initializeSeasonManually = httpsCallable(functions, 'initializeSeasonManually');
        const result = await initializeSeasonManually({});
        
        if (result.data.success) {
          toast.success(result.data.message || 'Season created successfully!');
          await fetchAdminData();
        } else {
          toast.error(result.data.message || 'Failed to create season');
        }
      } else if (action === 'endCurrentSeason') {
        if (!window.confirm('Are you sure you want to end the current season? This action cannot be undone.')) {
          return;
        }
        
        const endSeason = httpsCallable(functions, 'endCurrentSeason');
        const result = await endSeason();
        
        if (result.data.success) {
          toast.success('Season ended successfully');
          await fetchAdminData();
        }
      } else if (action === 'processScores') {
        const processScores = httpsCallable(functions, 'processScoresManually');
        const result = await processScores(params);
        
        if (result.data.success) {
          toast.success('Score processing initiated');
        }
      }
    } catch (error) {
      console.error(`Error with ${action}:`, error);
      toast.error(`Failed to ${action}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserAction = async (action, userId) => {
    try {
      setIsLoading(true);
      const manageUser = httpsCallable(functions, 'manageUser');
      const result = await manageUser({ action, userId });
      
      if (result.data.success) {
        toast.success(result.data.message || 'User action completed');
      }
    } catch (error) {
      console.error('Error with user action:', error);
      toast.error('Failed to complete user action');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStaffAction = async (action, params = {}) => {
    try {
      setIsLoading(true);
      
      if (action === 'addStaffMember') {
        const addStaff = httpsCallable(functions, 'addStaffMember');
        const result = await addStaff(params);
        
        if (result.data.success) {
          toast.success('Staff member added successfully');
        }
      } else if (action === 'updateValues') {
        const updateStaffValues = httpsCallable(functions, 'updateStaffValues');
        const result = await updateStaffValues();
        
        if (result.data.success) {
          toast.success('Staff values updated');
        }
      }
    } catch (error) {
      console.error(`Error with staff ${action}:`, error);
      toast.error(`Failed to ${action}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualScrape = async () => {
    try {
      setIsLoading(true);
      const triggerScrape = httpsCallable(functions, 'scrapeLiveScoresManually');
      const result = await triggerScrape();
      
      if (result.data.success) {
        toast.success('Live score scrape completed successfully');
      }
    } catch (error) {
      console.error('Error triggering manual scrape:', error);
      toast.error('Failed to trigger manual scrape');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualScoreProcess = async () => {
    try {
      setIsLoading(true);
      const processScores = httpsCallable(functions, 'processScoresManually');
      const result = await processScores();
      
      if (result.data.success) {
        toast.success('Score processing initiated');
      }
    } catch (error) {
      console.error('Error processing scores:', error);
      toast.error('Failed to process scores');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-error mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
            Access Denied
          </h1>
          <p className="text-text-secondary dark:text-text-secondary-dark">
            You do not have permission to access this page.
          </p>
        </div>
      </div>
    );
  }

  if (isLoading && !adminStats) {
    return <LoadingScreen />;
  }

  return (
    <div className="min-h-screen bg-background dark:bg-background-dark p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
            Admin Dashboard
          </h1>
          <p className="text-text-secondary dark:text-text-secondary-dark">
            System administration and management tools
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {[
            { id: 'overview', label: 'Overview', icon: Activity },
            { id: 'seasons', label: 'Seasons', icon: Calendar },
            { id: 'scoring', label: 'Scoring Grid', icon: Grid3x3 },
            { id: 'users', label: 'Users', icon: Users },
            { id: 'database', label: 'Database', icon: Database },
            { id: 'staff', label: 'Staff', icon: Award }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-theme font-medium capitalize whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-primary text-white'
                  : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && adminStats && (
          <>
            {/* Current Season Alert Box */}
            {adminStats.currentSeason && (
              <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-theme">
                <div className="flex items-start gap-3">
                  <Activity className="w-6 h-6 text-primary flex-shrink-0 mt-1" />
                  <div className="flex-1">
                    <h3 className="font-bold text-text-primary dark:text-text-primary-dark mb-1">
                      Current Season: {adminStats.currentSeason.seasonName || 'Unknown'}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mt-2">
                      <div>
                        <span className="text-text-secondary dark:text-text-secondary-dark">Status:</span>
                        <p className="font-medium text-text-primary dark:text-text-primary-dark">
                          {adminStats.currentSeason.status === 'active' ? (
                            <span className="text-success">● Active</span>
                          ) : adminStats.currentSeason.status === 'completed' ? (
                            <span className="text-error">● Completed</span>
                          ) : (
                            <span className="text-warning">● Preparation</span>
                          )}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary dark:text-text-secondary-dark">Day:</span>
                        <p className="font-medium text-text-primary dark:text-text-primary-dark">
                          {adminStats.currentSeason.currentDay} / {adminStats.currentSeason.totalDays}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary dark:text-text-secondary-dark">Week:</span>
                        <p className="font-medium text-text-primary dark:text-text-primary-dark">
                          {adminStats.currentSeason.currentWeek} / {adminStats.currentSeason.totalWeeks}
                        </p>
                      </div>
                      <div>
                        <span className="text-text-secondary dark:text-text-secondary-dark">Type:</span>
                        <p className="font-medium text-text-primary dark:text-text-primary-dark">
                          {adminStats.currentSeason.seasonType === 'live' ? 'Live Season' : 'Off-Season'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                <div className="flex items-center justify-between mb-2">
                  <Users className="w-8 h-8 text-primary" />
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark">Total</span>
                </div>
                <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {adminStats?.totalUsers || 0}
                </p>
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                  Registered Users
                </p>
              </div>

              <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                <div className="flex items-center justify-between mb-2">
                  <Trophy className="w-8 h-8 text-warning" />
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark">Active</span>
                </div>
                <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {adminStats?.activeCorps || 0}
                </p>
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                  Corps This Season
                </p>
              </div>

              <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                <div className="flex items-center justify-between mb-2">
                  <Calendar className="w-8 h-8 text-secondary" />
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark">Season</span>
                </div>
                <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  #{adminStats?.currentSeason?.seasonNumber || '--'}
                </p>
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                  Season Number
                </p>
              </div>

              <div className="bg-surface dark:bg-surface-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                <div className="flex items-center justify-between mb-2">
                  <DollarSign className="w-8 h-8 text-success" />
                  <span className="text-xs text-text-secondary dark:text-text-secondary-dark">Economy</span>
                </div>
                <p className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {adminStats?.totalCorpsCoin?.toLocaleString() || 0}
                </p>
                <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                  Total CorpsCoin
                </p>
              </div>
            </div>
          </>
        )}

        {/* Seasons Tab */}
        {activeTab === 'seasons' && (
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              Season Management
            </h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => handleSeasonAction('createNewSeason')}
                disabled={isLoading || adminStats?.currentSeason?.status === 'active'}
                className="px-4 py-3 bg-primary text-white rounded-theme hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Calendar className="w-5 h-5" />
                Create New Season
              </button>
              
              <button
                onClick={() => handleSeasonAction('endCurrentSeason')}
                disabled={isLoading || adminStats?.currentSeason?.status !== 'active'}
                className="px-4 py-3 bg-error text-white rounded-theme hover:bg-error-dark disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" />
                End Current Season
              </button>
            </div>
            
            {/* Live Season Score Management */}
            <div className="border-t border-accent dark:border-accent-dark pt-6">
              <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-3">
                Score Processing
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleManualScrape}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-secondary text-white rounded-theme hover:bg-opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-5 h-5" />
                  Scrape Latest Scores from DCI.org
                </button>
                
                <button
                  onClick={handleManualScoreProcess}
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-secondary text-white rounded-theme hover:bg-opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <PlayCircle className="w-5 h-5" />
                  Process Today's Scores Manually
                </button>
              </div>
              
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-4">
                Note: Scores are automatically scraped and processed daily at 1:00 AM and 2:00 AM ET respectively.
              </p>
            </div>
          </div>
        )}

        {/* Scoring Grid Tab */}
        {activeTab === 'scoring' && (
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <RefreshCw className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-2">Loading scoring grid...</span>
            </div>
          }>
            <ScoringGridAdmin />
          </Suspense>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && adminStats && (
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              User Statistics
            </h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-4">
                {adminStats.classDistribution && Object.entries(adminStats.classDistribution).map(([className, count]) => (
                  <div key={className} className="text-center p-4 bg-background dark:bg-background-dark rounded-theme">
                    <div className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                      {count}
                    </div>
                    <div className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
                      {className}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* User Management Actions */}
              <div className="mt-6 space-y-3">
                <h4 className="font-bold text-text-primary dark:text-text-primary-dark">
                  Quick Actions
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => {
                      const userId = prompt('Enter User ID:');
                      if (userId) handleUserAction('grantAdmin', userId);
                    }}
                    className="btn-secondary text-sm"
                  >
                    Grant Admin
                  </button>
                  <button
                    onClick={() => {
                      const userId = prompt('Enter User ID:');
                      const amount = prompt('Enter XP amount:');
                      if (userId && amount) handleUserAction('grantXP', userId, { xp: parseInt(amount) });
                    }}
                    className="btn-secondary text-sm"
                  >
                    Grant XP
                  </button>
                  <button
                    onClick={() => {
                      const userId = prompt('Enter User ID:');
                      const amount = prompt('Enter CorpsCoin amount:');
                      if (userId && amount) handleUserAction('grantCorpsCoin', userId, { coins: parseInt(amount) });
                    }}
                    className="btn-secondary text-sm"
                  >
                    Grant CorpsCoin
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Database Tab */}
        {activeTab === 'database' && (
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              Database Management
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-warning/10 border border-warning/30 rounded-theme">
                <p className="text-sm text-warning mb-3">
                  ⚠️ Warning: These actions modify the database directly. Use with caution.
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => {
                    if (window.confirm('This will rebuild all user statistics. Continue?')) {
                      handleSeasonAction('rebuildStats');
                    }
                  }}
                  disabled={isLoading}
                  className="btn-secondary"
                >
                  Rebuild User Stats
                </button>
                <button
                  onClick={() => {
                    if (window.confirm('This will clean up orphaned documents. Continue?')) {
                      handleSeasonAction('cleanupDatabase');
                    }
                  }}
                  disabled={isLoading}
                  className="btn-secondary"
                >
                  Cleanup Database
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Staff Tab */}
        {activeTab === 'staff' && (
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              Staff Management
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => handleStaffAction('updateValues')}
                disabled={isLoading}
                className="w-full btn-secondary"
              >
                Update Staff Values
              </button>
              <button
                onClick={() => handleStaffAction('cleanupMarketplace')}
                disabled={isLoading}
                className="w-full btn-secondary"
              >
                Cleanup Marketplace
              </button>
              <button
                onClick={() => {
                  const name = prompt('Staff member name:');
                  const caption = prompt('Caption (GE1, GE2, VP, VA, CG, B, MA, P):');
                  const yearInducted = prompt('Year inducted:');
                  const biography = prompt('Biography:');
                  
                  if (name && caption && yearInducted && biography) {
                    handleStaffAction('addStaffMember', {
                      name,
                      caption,
                      yearInducted: parseInt(yearInducted),
                      biography
                    });
                  }
                }}
                disabled={isLoading}
                className="w-full btn-primary"
              >
                Add Staff Member
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;