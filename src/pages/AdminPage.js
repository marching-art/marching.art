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
  DollarSign
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';
import LoadingScreen from '../components/common/LoadingScreen';

const AdminPage = () => {
  const { currentUser } = useAuth();
  const { profile } = useUserStore();
  const [activeTab, setActiveTab] = useState('overview');
  const [isLoading, setIsLoading] = useState(false);
  const [adminStats, setAdminStats] = useState(null);
  const [systemStatus, setSystemStatus] = useState('loading');
  const [notifications, setNotifications] = useState([]);
  const [selectedSeasonType, setSelectedSeasonType] = useState('');

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
      // FIXED: Changed from 'adminPanel-getSystemStats' to 'getSystemStats'
      const getAdminStats = httpsCallable(functions, 'getSystemStats');
      const result = await getAdminStats();
      
      if (result.data.success) {
        setAdminStats(result.data.stats);
        setSystemStatus('healthy');
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setSystemStatus('error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeasonAction = async (action, params = {}) => {
    try {
      setIsLoading(true);
      // FIXED: Changed from 'adminPanel-seasonAction' to 'seasonAction'
      const executeSeasonAction = httpsCallable(functions, 'seasonAction');
      const result = await executeSeasonAction({ action, ...params });
      
      if (result.data.success) {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'success',
          message: result.data.message,
          timestamp: new Date()
        }]);
        await fetchAdminData();
      } else {
        throw new Error(result.data.error);
      }
    } catch (error) {
      console.error(`Error executing ${action}:`, error);
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: `Failed to ${action}: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDatabaseAction = async (action, params = {}) => {
    try {
      setIsLoading(true);
      // FIXED: Changed from 'adminPanel-databaseAction' to 'databaseAction'
      const executeDatabaseAction = httpsCallable(functions, 'databaseAction');
      const result = await executeDatabaseAction({ action, ...params });
      
      if (result.data.success) {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'success',
          message: result.data.message,
          timestamp: new Date()
        }]);
      } else {
        throw new Error(result.data.error);
      }
    } catch (error) {
      console.error(`Error executing ${action}:`, error);
      setNotifications(prev => [...prev, {
        id: Date.now(),
        type: 'error',
        message: `Failed to ${action}: ${error.message}`,
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-error mb-4">Access Denied</h1>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          You do not have permission to access this page.
        </p>
      </div>
    );
  }

  if (isLoading && !adminStats) {
    return <LoadingScreen message="Loading admin panel..." />;
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Settings },
    { id: 'seasons', label: 'Season Management', icon: Calendar },
    { id: 'database', label: 'Database Tools', icon: Database },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'staff', label: 'Staff Management', icon: Star },
    { id: 'reports', label: 'Reports', icon: TrendingUp }
  ];

  const SystemStatusCard = () => (
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark">
      <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4 flex items-center">
        <CheckCircle className={`w-5 h-5 mr-2 ${systemStatus === 'healthy' ? 'text-green-400' : 'text-red-400'}`} />
        System Status
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary dark:text-primary-dark">{adminStats?.totalUsers || 0}</div>
          <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Total Users</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary dark:text-primary-dark">{adminStats?.activeSeasons || 0}</div>
          <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Active Seasons</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary dark:text-primary-dark">{adminStats?.totalCorps || 0}</div>
          <div className="text-sm text-text-secondary dark:text-text-secondary-dark">Total Corps</div>
        </div>
      </div>
    </div>
  );

  const NotificationPanel = () => (
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-4 shadow-theme dark:shadow-theme-dark">
      <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-3">Recent Actions</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="text-text-secondary dark:text-text-secondary-dark text-sm">No recent actions</div>
        ) : (
          notifications.slice(-5).reverse().map(notification => (
            <div
              key={notification.id}
              className={`p-3 rounded-theme text-sm ${
                notification.type === 'success' 
                  ? 'bg-green-900 bg-opacity-30 text-green-400' 
                  : 'bg-red-900 bg-opacity-30 text-red-400'
              }`}
            >
              <div className="font-medium">{notification.message}</div>
              <div className="text-xs opacity-75 mt-1">
                {notification.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark">
        <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">Admin Panel</h1>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          System administration and management tools
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="bg-surface dark:bg-surface-dark rounded-theme shadow-theme dark:shadow-theme-dark overflow-hidden">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'bg-primary dark:bg-primary-dark text-white border-b-4 border-primary dark:border-primary-dark'
                    : 'text-text-secondary dark:text-text-secondary-dark hover:bg-accent dark:hover:bg-accent-dark'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'overview' && <SystemStatusCard />}
          
          {/* Season Management Actions */}
          {activeTab === 'seasons' && (
            <div className="space-y-6">
              <div className="bg-surface-dark p-6 rounded-theme">
                <h3 className="text-xl font-bold text-text-primary-dark mb-4">Season Actions</h3>
                
                {/* FIXED: Proper Season Type Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-text-primary-dark mb-2">
                      Create New Season
                    </label>
                    <select
                      value={selectedSeasonType || ''}
                      onChange={(e) => setSelectedSeasonType(e.target.value)}
                      className="w-full px-4 py-2 bg-background-dark border border-accent-dark rounded text-text-primary-dark focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select Season Type</option>
                      <option value="overture">Overture (Off-Season 1)</option>
                      <option value="allegro">Allegro (Off-Season 2)</option>
                      <option value="adagio">Adagio (Off-Season 3)</option>
                      <option value="scherzo">Scherzo (Off-Season 4)</option>
                      <option value="crescendo">Crescendo (Off-Season 5)</option>
                      <option value="finale">Finale (Off-Season 6)</option>
                      <option value="live">Live Season (10 weeks)</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={() => handleSeasonAction('createNewSeason', { seasonType: selectedSeasonType })}
                    disabled={!selectedSeasonType}
                    className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create {selectedSeasonType ? selectedSeasonType.charAt(0).toUpperCase() + selectedSeasonType.slice(1) : 'New'} Season
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-6">
                  <button
                    onClick={() => handleSeasonAction('endCurrentSeason')}
                    className="btn-secondary"
                  >
                    End Current Season
                  </button>
                  
                  <button
                    onClick={() => handleSeasonAction('generateSchedule')}
                    className="btn-secondary"
                  >
                    Regenerate Schedule
                  </button>
                </div>
              </div>

              {/* Current Season Info */}
              {adminStats?.currentSeason && (
                <div className="bg-background-dark p-6 rounded-theme border border-accent-dark">
                  <h3 className="text-lg font-bold text-text-primary-dark mb-3">Current Season</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-secondary-dark">Season:</span>
                      <span className="text-text-primary-dark font-medium">
                        {adminStats.currentSeason.seasonNumber || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary-dark">Type:</span>
                      <span className="text-text-primary-dark font-medium">
                        {adminStats.currentSeason.seasonType === 'live' ? 'Live Season' : 'Off-Season'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary-dark">Current Day:</span>
                      <span className="text-text-primary-dark font-medium">
                        Day {adminStats.currentSeason.currentDay || 1}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary-dark">Total Days:</span>
                      <span className="text-text-primary-dark font-medium">
                        {adminStats.currentSeason.totalDays || 49}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'database' && (
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark">
              <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Database Tools</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleDatabaseAction('backupDatabase')}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
                >
                  <Database className="w-5 h-5 mr-2 inline" />
                  Backup Database
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          <NotificationPanel />
        </div>
      </div>
    </div>
  );
};

export default AdminPage;