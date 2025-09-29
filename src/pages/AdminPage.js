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
  PlayCircle
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
      const getAdminStats = httpsCallable(functions, 'getSystemStats');
      const result = await getAdminStats();
      
      if (result.data.success) {
        setAdminStats(result.data.stats);
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

  const handleManualScrape = async () => {
    try {
      setIsLoading(true);
      toast.loading('Scraping DCI.org for latest scores...', { id: 'scrape' });
      
      const triggerScrape = httpsCallable(functions, 'triggerManualScrape');
      const result = await triggerScrape({});
      
      if (result.data.success) {
        toast.success(result.data.message, { id: 'scrape' });
      } else {
        toast.error('Scrape failed', { id: 'scrape' });
      }
    } catch (error) {
      console.error('Error triggering scrape:', error);
      toast.error(`Scrape failed: ${error.message}`, { id: 'scrape' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualScoreProcess = async () => {
    try {
      setIsLoading(true);
      toast.loading('Processing scores...', { id: 'process' });
      
      const processScores = httpsCallable(functions, 'processScoresManually');
      const result = await processScores({});
      
      if (result.data.success) {
        toast.success('Scores processed successfully!', { id: 'process' });
        await fetchAdminData();
      } else {
        toast.error('Score processing failed', { id: 'process' });
      }
    } catch (error) {
      console.error('Error processing scores:', error);
      toast.error(`Processing failed: ${error.message}`, { id: 'process' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Access Denied
        </h1>
        <p className="text-text-secondary dark:text-text-secondary-dark">
          This page is only accessible to administrators.
        </p>
      </div>
    );
  }

  if (isLoading && !adminStats) {
    return <LoadingScreen message="Loading admin panel..." />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark">
            Admin Panel
          </h1>
          <p className="text-text-secondary dark:text-text-secondary-dark mt-1">
            System Management & Monitoring
          </p>
        </div>
        
        <div className={`px-4 py-2 rounded-full flex items-center gap-2 ${
          systemStatus === 'healthy' ? 'bg-green-900 text-green-200' :
          systemStatus === 'error' ? 'bg-red-900 text-red-200' :
          'bg-gray-700 text-gray-300'
        }`}>
          <div className={`w-2 h-2 rounded-full ${
            systemStatus === 'healthy' ? 'bg-green-400' :
            systemStatus === 'error' ? 'bg-red-400' :
            'bg-gray-400'
          }`} />
          <span className="text-sm font-medium">
            {systemStatus === 'healthy' ? 'System Healthy' :
             systemStatus === 'error' ? 'System Error' :
             'Loading...'}
          </span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-accent dark:border-accent-dark">
        {[
          { id: 'overview', label: 'Overview', icon: TrendingUp },
          { id: 'seasons', label: 'Seasons', icon: Calendar },
          { id: 'users', label: 'Users', icon: Users },
          { id: 'database', label: 'Database', icon: Database }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium transition-colors ${
              activeTab === tab.id
                ? 'text-primary dark:text-primary-dark border-b-2 border-primary dark:border-primary-dark'
                : 'text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark'
            }`}
          >
            <tab.icon className="w-5 h-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {/* Overview Tab */}
        {activeTab === 'overview' && adminStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
              <div className="flex items-center justify-between mb-2">
                <Users className="w-8 h-8 text-primary dark:text-primary-dark" />
                <span className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {adminStats.users?.total || 0}
                </span>
              </div>
              <h3 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                Total Users
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                {adminStats.users?.active || 0} active this week
              </p>
            </div>

            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
              <div className="flex items-center justify-between mb-2">
                <Trophy className="w-8 h-8 text-primary dark:text-primary-dark" />
                <span className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {adminStats.corps?.total || 0}
                </span>
              </div>
              <h3 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                Active Corps
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                Across all classes
              </p>
            </div>

            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
              <div className="flex items-center justify-between mb-2">
                <Calendar className="w-8 h-8 text-primary dark:text-primary-dark" />
                <span className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
                  {adminStats.currentSeason?.seasonNumber || 'N/A'}
                </span>
              </div>
              <h3 className="text-sm font-medium text-text-secondary dark:text-text-secondary-dark">
                Current Season
              </h3>
              <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
                Day {adminStats.currentSeason?.currentDay || 0} of {adminStats.currentSeason?.totalDays || 0}
              </p>
            </div>

            <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
              <div className="flex items-center justify-between mb-2">
                <CheckCircle className="w-8 h-8 text-green-500" />
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
            {/* FIXED: Automatic Season Creation */}
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
                {adminStats.corps?.distribution && Object.entries(adminStats.corps.distribution).map(([className, count]) => (
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
            </div>
          </div>
        )}

        {/* Database Tab */}
        {activeTab === 'database' && (
          <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
            <h3 className="text-xl font-bold text-text-primary dark:text-text-primary-dark mb-4">
              Database Tools
            </h3>
            <p className="text-text-secondary dark:text-text-secondary-dark">
              Database management tools coming soon...
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;