import React, { useState, useEffect } from 'react';
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
  Activity
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import toast from 'react-hot-toast';
import LoadingScreen from '../components/common/LoadingScreen';

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
      // FIXED: Use the correct function name from admin.js
      const getAdminStats = httpsCallable(functions, 'getAdminStats');
      const result = await getAdminStats();
      
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
      const executeSeasonAction = httpsCallable(functions, 'seasonAction');
      const result = await executeSeasonAction({ action, ...params });
      
      if (result.data.success) {
        toast.success(result.data.message);
        await fetchAdminData();
      } else {
        throw new Error(result.data.error || 'Action failed');
      }
    } catch (error) {
      console.error(`Error executing ${action}:`, error);
      toast.error(`Failed to ${action}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUserAction = async (action, userId, amount = null) => {
    try {
      setIsLoading(true);
      const executeUserAction = httpsCallable(functions, 'userAction');
      const params = { action, userId };
      if (amount !== null) params.amount = amount;
      
      const result = await executeUserAction(params);
      
      if (result.data.success) {
        toast.success(result.data.message);
        await fetchAdminData();
      }
    } catch (error) {
      console.error(`Error executing ${action}:`, error);
      toast.error(`Failed to ${action}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStaffAction = async (action, staffData = null) => {
    try {
      setIsLoading(true);
      const executeStaffAction = httpsCallable(functions, 'staffAction');
      const params = { action };
      if (staffData) params.staffData = staffData;
      
      const result = await executeStaffAction(params);
      
      if (result.data.success) {
        toast.success(result.data.message);
      }
    } catch (error) {
      console.error(`Error executing ${action}:`, error);
      toast.error(`Failed to ${action}: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualScrape = async () => {
    try {
      setIsLoading(true);
      const triggerScrape = httpsCallable(functions, 'triggerManualScrape');
      const result = await triggerScrape();
      
      if (result.data.success) {
        toast.success('Manual scrape initiated successfully');
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
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {['overview', 'seasons', 'users', 'database', 'staff'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-theme font-medium capitalize whitespace-nowrap ${
                activeTab === tab
                  ? 'bg-primary text-white'
                  : 'bg-surface dark:bg-surface-dark text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && adminStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
              <div className="flex items-center justify-between mb-4">
                <Users className="w-8 h-8 text-primary dark:text-primary-dark" />
                <span className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {adminStats.totalUsers || 0}
                </span>
              </div>
              <h3 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                Total Users
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                {adminStats.activeUsers || 0} active this week
              </p>
            </div>

            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
              <div className="flex items-center justify-between mb-4">
                <Trophy className="w-8 h-8 text-secondary dark:text-secondary-dark" />
                <span className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {adminStats.totalCorps || 0}
                </span>
              </div>
              <h3 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                Active Corps
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                Across all divisions
              </p>
            </div>

            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
              <div className="flex items-center justify-between mb-4">
                <Calendar className="w-8 h-8 text-accent dark:text-accent-dark" />
                <span className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {adminStats.currentSeason?.currentDay || 0}
                </span>
              </div>
              <h3 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                Season Day
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                {adminStats.currentSeason?.seasonName || 'No active season'}
              </p>
            </div>

            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
              <div className="flex items-center justify-between mb-4">
                <Activity className="w-8 h-8 text-success" />
                <span className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {systemStatus === 'healthy' ? '100%' : '—'}
                </span>
              </div>
              <h3 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                System Health
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                All services operational
              </p>
            </div>
          </div>
        )}

        {/* Seasons Tab */}
        {activeTab === 'seasons' && (
          <div className="space-y-6">
            {/* Season Management */}
            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
              <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                Season Management
              </h3>
              
              <div className="space-y-4">
                {/* Automatic Season Creation */}
                <div className="bg-background dark:bg-background-dark p-4 rounded-theme border border-accent dark:border-accent-dark">
                  <div className="flex items-start gap-3 mb-3">
                    <PlayCircle className="w-6 h-6 text-primary dark:text-primary-dark flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-bold text-text-primary dark:text-text-primary-dark mb-1">
                        Create New Season (Automatic)
                      </h4>
                      <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                        The system will automatically detect which season should start based on today's date and DCI Finals schedule.
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleSeasonAction('createNewSeason')}
                    disabled={isLoading}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Creating...' : 'Initialize New Season'}
                  </button>
                </div>

                {/* Other Season Actions */}
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => handleSeasonAction('endCurrentSeason')}
                    disabled={isLoading}
                    className="btn-secondary disabled:opacity-50"
                  >
                    End Current Season
                  </button>
                  
                  <button
                    onClick={() => handleSeasonAction('generateSchedule')}
                    disabled={isLoading}
                    className="btn-secondary disabled:opacity-50"
                  >
                    Regenerate Schedule
                  </button>
                </div>
              </div>
            </div>

            {/* Current Season Info */}
            {adminStats?.currentSeason && (
              <div className="bg-background dark:bg-background-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
                <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
                  Current Season Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-text-secondary dark:text-text-secondary-dark">Season:</span>
                    <p className="font-medium text-text-primary dark:text-text-primary-dark mt-1">
                      {adminStats.currentSeason.seasonNumber || 'Unknown'}
                    </p>
                  </div>
                  <div>
                    <span className="text-text-secondary dark:text-text-secondary-dark">Type:</span>
                    <p className="font-medium text-text-primary dark:text-text-primary-dark mt-1">
                      {adminStats.currentSeason.seasonType === 'live' ? 'Live Season' : 'Off-Season'}
                    </p>
                  </div>
                  <div>
                    <span className="text-text-secondary dark:text-text-secondary-dark">Current Day:</span>
                    <p className="font-medium text-text-primary dark:text-text-primary-dark mt-1">
                      Day {adminStats.currentSeason.currentDay || 1}
                    </p>
                  </div>
                  <div>
                    <span className="text-text-secondary dark:text-text-secondary-dark">Total Days:</span>
                    <p className="font-medium text-text-primary dark:text-text-primary-dark mt-1">
                      {adminStats.currentSeason.totalDays || 49}
                    </p>
                  </div>
                  <div>
                    <span className="text-text-secondary dark:text-text-secondary-dark">Status:</span>
                    <p className="font-medium text-text-primary dark:text-text-primary-dark mt-1">
                      {adminStats.currentSeason.status || 'Active'}
                    </p>
                  </div>
                  <div>
                    <span className="text-text-secondary dark:text-text-secondary-dark">ID:</span>
                    <p className="font-mono text-xs text-text-primary dark:text-text-primary-dark mt-1">
                      {adminStats.currentSeason.activeSeasonId || 'N/A'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Live Season Tools */}
            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
              <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
                Live Season Tools
              </h3>
              
              <div className="space-y-3">
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
                      if (userId) handleUserAction('resetProgress', userId);
                    }}
                    className="btn-secondary text-sm"
                  >
                    Reset Progress
                  </button>
                  <button
                    onClick={() => {
                      const userId = prompt('Enter User ID:');
                      const amount = prompt('Enter CorpsCoin amount:');
                      if (userId && amount) handleUserAction('awardCorpsCoin', userId, parseInt(amount));
                    }}
                    className="btn-secondary text-sm"
                  >
                    Award CorpsCoin
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
              Database Tools
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => handleSeasonAction('processScores')}
                disabled={isLoading}
                className="w-full btn-secondary"
              >
                Process Scores
              </button>
              <p className="text-text-secondary dark:text-text-secondary-dark">
                More database management tools coming soon...
              </p>
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
                  const caption = prompt('Caption (GE1, GE2, etc):');
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