import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useUserStore } from '../store/userStore';
import { 
  Settings, 
  Database, 
  Calendar, 
  Trophy, 
  Users, 
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileText,
  RefreshCw,
  Download,
  Upload,
  UserCheck,
  DollarSign,
  Star
} from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebaseConfig';

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
      const getAdminStats = httpsCallable(functions, 'adminPanel-getSystemStats');
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
      const executeSeasonAction = httpsCallable(functions, 'adminPanel-seasonAction');
      const result = await executeSeasonAction({ action, ...params });
      
      if (result.data.success) {
        setNotifications(prev => [...prev, {
          id: Date.now(),
          type: 'success',
          message: result.data.message,
          timestamp: new Date()
        }]);
        await fetchAdminData(); // Refresh data
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
      const executeDatabaseAction = httpsCallable(functions, 'adminPanel-databaseAction');
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
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertTriangle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-text-primary-dark mb-2">Access Denied</h1>
          <p className="text-text-secondary-dark">You don't have permission to access the admin panel.</p>
        </div>
      </div>
    );
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
    <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
      <h2 className="text-xl font-bold text-text-primary-dark mb-4 flex items-center">
        <CheckCircle className={`w-5 h-5 mr-2 ${systemStatus === 'healthy' ? 'text-green-400' : 'text-red-400'}`} />
        System Status
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-primary-dark">{adminStats?.totalUsers || 0}</div>
          <div className="text-sm text-text-secondary-dark">Total Users</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary-dark">{adminStats?.activeSeasons || 0}</div>
          <div className="text-sm text-text-secondary-dark">Active Seasons</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-primary-dark">{adminStats?.totalCorps || 0}</div>
          <div className="text-sm text-text-secondary-dark">Total Corps</div>
        </div>
      </div>
    </div>
  );

  const SeasonManagementTab = () => (
    <div className="space-y-6">
      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <h2 className="text-xl font-bold text-text-primary-dark mb-4">Season Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => handleSeasonAction('createNewSeason')}
            disabled={isLoading}
            className="bg-primary hover:bg-primary-dark text-on-primary font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <Calendar className="w-5 h-5 mr-2 inline" />
            Create New Season
          </button>
          
          <button
            onClick={() => handleSeasonAction('endCurrentSeason')}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <Clock className="w-5 h-5 mr-2 inline" />
            End Current Season
          </button>
          
          <button
            onClick={() => handleSeasonAction('processScores')}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-5 h-5 mr-2 inline" />
            Process Scores
          </button>
          
          <button
            onClick={() => handleSeasonAction('generateSchedule')}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <FileText className="w-5 h-5 mr-2 inline" />
            Generate Schedule
          </button>
          
          <button
            onClick={() => handleSeasonAction('updateLeaderboards')}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <Trophy className="w-5 h-5 mr-2 inline" />
            Update Leaderboards
          </button>
          
          <button
            onClick={() => handleSeasonAction('cleanupOldData')}
            disabled={isLoading}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <Database className="w-5 h-5 mr-2 inline" />
            Cleanup Old Data
          </button>
        </div>
      </div>

      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <h2 className="text-xl font-bold text-text-primary-dark mb-4">Current Season Info</h2>
        {adminStats?.currentSeason ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary-dark mb-1">Season ID</label>
              <div className="text-text-primary-dark font-mono">{adminStats.currentSeason.id}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary-dark mb-1">Status</label>
              <div className="text-text-primary-dark">{adminStats.currentSeason.status}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary-dark mb-1">Week</label>
              <div className="text-text-primary-dark">{adminStats.currentSeason.currentWeek}</div>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-secondary-dark mb-1">Participating Corps</label>
              <div className="text-text-primary-dark">{adminStats.currentSeason.corpsCount}</div>
            </div>
          </div>
        ) : (
          <div className="text-text-secondary-dark">No active season found</div>
        )}
      </div>
    </div>
  );

  const DatabaseToolsTab = () => (
    <div className="space-y-6">
      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <h2 className="text-xl font-bold text-text-primary-dark mb-4">Database Operations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => handleDatabaseAction('backupDatabase')}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <Download className="w-5 h-5 mr-2 inline" />
            Backup Database
          </button>
          
          <button
            onClick={() => handleDatabaseAction('initializeStaff')}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <UserCheck className="w-5 h-5 mr-2 inline" />
            Initialize Staff
          </button>
          
          <button
            onClick={() => handleDatabaseAction('validateData')}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <CheckCircle className="w-5 h-5 mr-2 inline" />
            Validate Data
          </button>
          
          <button
            onClick={() => handleDatabaseAction('migrateData')}
            disabled={isLoading}
            className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <Upload className="w-5 h-5 mr-2 inline" />
            Migrate Data
          </button>
          
          <button
            onClick={() => handleDatabaseAction('optimizeIndexes')}
            disabled={isLoading}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <TrendingUp className="w-5 h-5 mr-2 inline" />
            Optimize Indexes
          </button>
          
          <button
            onClick={() => handleDatabaseAction('clearCache')}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-5 h-5 mr-2 inline" />
            Clear Cache
          </button>
        </div>
      </div>
    </div>
  );

  const UserManagementTab = () => (
    <div className="space-y-6">
      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <h2 className="text-xl font-bold text-text-primary-dark mb-4">User Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => handleDatabaseAction('grantAdminAccess')}
            disabled={isLoading}
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <UserCheck className="w-5 h-5 mr-2 inline" />
            Grant Admin Access
          </button>
          
          <button
            onClick={() => handleDatabaseAction('resetUserProgress')}
            disabled={isLoading}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-5 h-5 mr-2 inline" />
            Reset User Progress
          </button>
          
          <button
            onClick={() => handleDatabaseAction('awardCorpsCoin')}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <DollarSign className="w-5 h-5 mr-2 inline" />
            Award CorpsCoin
          </button>
        </div>
      </div>

      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <h2 className="text-xl font-bold text-text-primary-dark mb-4">User Search</h2>
        <div className="flex space-x-4">
          <input
            type="text"
            placeholder="Search by email or user ID..."
            className="flex-1 bg-background-dark border border-gray-600 rounded-theme px-4 py-2 text-text-primary-dark focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button className="bg-primary hover:bg-primary-dark text-on-primary font-bold py-2 px-6 rounded-theme transition-colors">
            Search
          </button>
        </div>
      </div>
    </div>
  );

  const StaffManagementTab = () => (
    <div className="space-y-6">
      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <h2 className="text-xl font-bold text-text-primary-dark mb-4">Staff Database</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => handleDatabaseAction('addStaffMember')}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <Star className="w-5 h-5 mr-2 inline" />
            Add Staff Member
          </button>
          
          <button
            onClick={() => handleDatabaseAction('updateStaffValues')}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <TrendingUp className="w-5 h-5 mr-2 inline" />
            Update Staff Values
          </button>
          
          <button
            onClick={() => handleDatabaseAction('cleanupMarketplace')}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <RefreshCw className="w-5 h-5 mr-2 inline" />
            Cleanup Marketplace
          </button>
        </div>
      </div>

      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <h2 className="text-xl font-bold text-text-primary-dark mb-4">Staff Statistics</h2>
        {adminStats?.staffStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-dark">{adminStats.staffStats.totalStaff}</div>
              <div className="text-sm text-text-secondary-dark">Total Staff</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-dark">{adminStats.staffStats.marketplaceListings}</div>
              <div className="text-sm text-text-secondary-dark">Marketplace Listings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-dark">{adminStats.staffStats.totalTransactions}</div>
              <div className="text-sm text-text-secondary-dark">Total Transactions</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-dark">${adminStats.staffStats.averagePrice}</div>
              <div className="text-sm text-text-secondary-dark">Avg Price</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const ReportsTab = () => (
    <div className="space-y-6">
      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <h2 className="text-xl font-bold text-text-primary-dark mb-4">System Reports</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <button
            onClick={() => handleDatabaseAction('generateUserReport')}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <FileText className="w-5 h-5 mr-2 inline" />
            User Activity Report
          </button>
          
          <button
            onClick={() => handleDatabaseAction('generateSeasonReport')}
            disabled={isLoading}
            className="bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <Trophy className="w-5 h-5 mr-2 inline" />
            Season Performance
          </button>
          
          <button
            onClick={() => handleDatabaseAction('generateFinancialReport')}
            disabled={isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <DollarSign className="w-5 h-5 mr-2 inline" />
            Financial Report
          </button>
        </div>
      </div>

      <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
        <h2 className="text-xl font-bold text-text-primary-dark mb-4">Performance Metrics</h2>
        {adminStats?.performance && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">{adminStats.performance.uptime}%</div>
              <div className="text-sm text-text-secondary-dark">System Uptime</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">{adminStats.performance.avgResponseTime}ms</div>
              <div className="text-sm text-text-secondary-dark">Avg Response Time</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">{adminStats.performance.dailyActiveUsers}</div>
              <div className="text-sm text-text-secondary-dark">Daily Active Users</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const NotificationPanel = () => (
    <div className="bg-surface-dark rounded-theme p-4 shadow-theme-dark">
      <h3 className="text-lg font-bold text-text-primary-dark mb-3">Recent Actions</h3>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="text-text-secondary-dark text-sm">No recent actions</div>
        ) : (
          notifications.slice(-5).reverse().map(notification => (
            <div
              key={notification.id}
              className={`p-3 rounded-theme text-sm ${
                notification.type === 'success' 
                  ? 'bg-green-900/30 border border-green-700 text-green-200'
                  : 'bg-red-900/30 border border-red-700 text-red-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <span className="flex-1">{notification.message}</span>
                <span className="text-xs opacity-70 ml-2">
                  {notification.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-surface-dark to-background-dark p-6 rounded-theme shadow-theme-dark">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-primary-dark">Admin Panel</h1>
            <p className="text-text-secondary-dark mt-1">marching.art Season Administration</p>
          </div>
          <button
            onClick={fetchAdminData}
            disabled={isLoading}
            className="bg-primary hover:bg-primary-dark text-on-primary font-bold py-2 px-4 rounded-theme transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 inline ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-surface-dark rounded-theme shadow-theme-dark">
        <div className="flex overflow-x-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-6 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-primary-dark bg-primary/10'
                    : 'border-transparent text-text-secondary-dark hover:text-text-primary-dark hover:border-gray-600'
                }`}
              >
                <Icon className="w-4 h-4 mr-2" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <SystemStatusCard />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
                  <h3 className="text-lg font-bold text-text-primary-dark mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    <button
                      onClick={() => handleSeasonAction('processScores')}
                      disabled={isLoading}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-theme transition-colors disabled:opacity-50"
                    >
                      Process Today's Scores
                    </button>
                    <button
                      onClick={() => handleSeasonAction('updateLeaderboards')}
                      disabled={isLoading}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-theme transition-colors disabled:opacity-50"
                    >
                      Update Leaderboards
                    </button>
                    <button
                      onClick={() => handleDatabaseAction('validateData')}
                      disabled={isLoading}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-theme transition-colors disabled:opacity-50"
                    >
                      Validate System Data
                    </button>
                  </div>
                </div>
                
                <div className="bg-surface-dark rounded-theme p-6 shadow-theme-dark">
                  <h3 className="text-lg font-bold text-text-primary-dark mb-4">System Health</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary-dark">Database</span>
                      <span className="text-green-400 font-semibold">Healthy</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary-dark">Functions</span>
                      <span className="text-green-400 font-semibold">Operational</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary-dark">Hosting</span>
                      <span className="text-green-400 font-semibold">Online</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-text-secondary-dark">Scheduler</span>
                      <span className="text-green-400 font-semibold">Running</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
          {activeTab === 'seasons' && <SeasonManagementTab />}
          {activeTab === 'database' && <DatabaseToolsTab />}
          {activeTab === 'users' && <UserManagementTab />}
          {activeTab === 'staff' && <StaffManagementTab />}
          {activeTab === 'reports' && <ReportsTab />}
        </div>
        
        <div className="xl:col-span-1">
          <NotificationPanel />
        </div>
      </div>
    </div>
  );
};

export default AdminPage;