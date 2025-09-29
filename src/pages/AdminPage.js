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
          
          {activeTab === 'seasons' && (
            <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 shadow-theme dark:shadow-theme-dark">
              <h2 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">Season Controls</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  onClick={() => handleSeasonAction('createNewSeason')}
                  disabled={isLoading}
                  className="bg-primary hover:bg-primary-dark text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
                >
                  <Calendar className="w-5 h-5 mr-2 inline" />
                  Create New Season
                </button>
                
                <button
                  onClick={() => handleSeasonAction('processScores')}
                  disabled={isLoading}
                  className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-5 h-5 mr-2 inline" />
                  Process Scores
                </button>
              </div>
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