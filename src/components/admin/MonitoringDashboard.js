import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { getCacheStats } from '../../utils/cacheHelper';

/**
 * Admin Monitoring Dashboard Component
 * Displays real-time system health and performance metrics
 */
const MonitoringDashboard = () => {
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalLeagues: 0,
    activeLeagues: 0,
    todaySignups: 0,
    cacheStats: null
  });
  
  const [systemHealth, setSystemHealth] = useState({
    status: 'healthy',
    alerts: [],
    warnings: []
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  useEffect(() => {
    loadMetrics();
    
    // Refresh every 30 seconds
    const interval = setInterval(() => {
      loadMetrics();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Check system health whenever metrics change
    if (metrics.totalUsers > 0) {
      checkSystemHealth();
    }
  }, [metrics]);

  const loadMetrics = async () => {
    setIsLoading(true);
    try {
      // Get user counts
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const totalUsers = usersSnapshot.size;
      
      // Calculate active users (last 7 days)
      const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const activeUsers = usersSnapshot.docs.filter(doc => {
        const lastActive = doc.data().lastActive;
        return lastActive && lastActive > sevenDaysAgo;
      }).length;
      
      // Get league counts
      const leaguesSnapshot = await getDocs(collection(db, 'leagues'));
      const totalLeagues = leaguesSnapshot.size;
      const activeLeagues = leaguesSnapshot.docs.filter(
        doc => doc.data().isActive === true
      ).length;
      
      // Get today's signups
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = today.getTime();
      
      const todaySignups = usersSnapshot.docs.filter(doc => {
        const createdAt = doc.data().createdAt;
        if (!createdAt) return false;
        
        // Handle both Timestamp and regular number
        const createdTimestamp = createdAt.toDate 
          ? createdAt.toDate().getTime() 
          : createdAt;
        
        return createdTimestamp > todayTimestamp;
      }).length;
      
      // Get cache stats
      const cacheStats = getCacheStats();
      
      setMetrics({
        totalUsers,
        activeUsers,
        totalLeagues,
        activeLeagues,
        todaySignups,
        cacheStats
      });
      
      setLastRefresh(new Date());
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading metrics:', error);
      setIsLoading(false);
    }
  };

  const checkSystemHealth = () => {
    const alerts = [];
    const warnings = [];
    
    // Check if approaching capacity
    if (metrics.totalUsers > 9500) {
      alerts.push({
        severity: 'critical',
        message: 'Approaching 10K user capacity',
        action: 'Consider scaling infrastructure or implementing user limits'
      });
    } else if (metrics.totalUsers > 8000) {
      warnings.push({
        severity: 'warning',
        message: 'User count above 8,000',
        action: 'Monitor growth rate and prepare scaling plan'
      });
    }
    
    // Check user engagement
    const engagementRate = metrics.totalUsers > 0 
      ? (metrics.activeUsers / metrics.totalUsers) * 100 
      : 0;
    
    if (engagementRate < 10 && metrics.totalUsers > 100) {
      warnings.push({
        severity: 'warning',
        message: `Low user engagement (${engagementRate.toFixed(1)}%)`,
        action: 'Review user retention strategies and re-engagement campaigns'
      });
    }
    
    // Check league participation
    const leagueRate = metrics.totalLeagues > 0 
      ? (metrics.activeLeagues / metrics.totalLeagues) * 100 
      : 100;
    
    if (leagueRate < 50 && metrics.totalLeagues > 10) {
      warnings.push({
        severity: 'warning',
        message: `Low league activity (${leagueRate.toFixed(1)}%)`,
        action: 'Encourage league creation and participation'
      });
    }
    
    // Check cache health
    if (metrics.cacheStats && metrics.cacheStats.totalItems > 1000) {
      warnings.push({
        severity: 'warning',
        message: 'High cache item count',
        action: 'Consider implementing cache cleanup or reducing cache duration'
      });
    }
    
    // Determine overall status
    let status = 'healthy';
    if (alerts.length > 0) status = 'critical';
    else if (warnings.length > 0) status = 'warning';
    
    setSystemHealth({ status, alerts, warnings });
  };

  const handleClearCache = () => {
    if (window.confirm('Are you sure you want to clear all cached data? This will affect all users.')) {
      sessionStorage.clear();
      localStorage.clear();
      alert('Cache cleared successfully. Page will reload.');
      window.location.reload();
    }
  };

  const MetricCard = ({ title, value, subtitle, trend, icon, color = 'primary' }) => (
    <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-text-secondary dark:text-text-secondary-dark font-medium">
            {title}
          </p>
          <p className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mt-2">
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-text-secondary dark:text-text-secondary-dark mt-1">
              {subtitle}
            </p>
          )}
        </div>
        {icon && (
          <div className="text-3xl ml-3">{icon}</div>
        )}
      </div>
      {trend !== undefined && trend !== null && (
        <div className={`mt-3 text-sm font-semibold flex items-center ${
          trend > 0 ? 'text-green-500' : trend < 0 ? 'text-red-500' : 'text-gray-500'
        }`}>
          {trend > 0 ? '↑' : trend < 0 ? '↓' : '→'} {Math.abs(trend)}%
          <span className="text-xs ml-2 text-text-secondary dark:text-text-secondary-dark font-normal">
            vs last period
          </span>
        </div>
      )}
    </div>
  );

  const AlertCard = ({ alert }) => (
    <div className={`p-4 rounded-theme border-l-4 shadow-sm ${
      alert.severity === 'critical' 
        ? 'bg-red-50 dark:bg-red-900/20 border-red-500' 
        : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500'
    }`}>
      <div className="flex items-start">
        <span className="text-2xl mr-3 flex-shrink-0">
          {alert.severity === 'critical' ? '🚨' : '⚠️'}
        </span>
        <div className="flex-1">
          <p className={`font-semibold text-base ${
            alert.severity === 'critical' 
              ? 'text-red-800 dark:text-red-200' 
              : 'text-yellow-800 dark:text-yellow-200'
          }`}>
            {alert.message}
          </p>
          <p className={`text-sm mt-2 ${
            alert.severity === 'critical' 
              ? 'text-red-600 dark:text-red-300' 
              : 'text-yellow-600 dark:text-yellow-300'
          }`}>
            <strong>Action:</strong> {alert.action}
          </p>
        </div>
      </div>
    </div>
  );

  const ProgressBar = ({ label, value, max, color = 'primary' }) => {
    const percentage = max > 0 ? (value / max) * 100 : 0;
    const colorClasses = {
      primary: 'bg-primary dark:bg-primary-dark',
      secondary: 'bg-secondary dark:bg-secondary-dark',
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      danger: 'bg-red-500'
    };

    return (
      <div>
        <div className="flex justify-between mb-2">
          <span className="text-sm text-text-secondary dark:text-text-secondary-dark">
            {label}
          </span>
          <span className="text-sm font-semibold text-text-primary dark:text-text-primary-dark">
            {percentage.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div 
            className={`${colorClasses[color]} rounded-full h-2.5 transition-all duration-500`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  if (isLoading && metrics.totalUsers === 0) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary dark:border-primary-dark mx-auto mb-4"></div>
          <p className="text-text-secondary dark:text-text-secondary-dark">Loading system metrics...</p>
        </div>
      </div>
    );
  }

  const engagementRate = metrics.totalUsers > 0 
    ? (metrics.activeUsers / metrics.totalUsers) * 100 
    : 0;
  
  const leagueRate = metrics.totalLeagues > 0 
    ? (metrics.activeLeagues / metrics.totalLeagues) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Header with Last Refresh */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark">
            System Monitoring Dashboard
          </h2>
          {lastRefresh && (
            <p className="text-sm text-text-secondary dark:text-text-secondary-dark mt-1">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={loadMetrics}
          disabled={isLoading}
          className="px-4 py-2 bg-primary dark:bg-primary-dark hover:opacity-90 text-white rounded-theme font-medium transition-opacity disabled:opacity-50"
        >
          {isLoading ? 'Refreshing...' : '🔄 Refresh'}
        </button>
      </div>

      {/* System Status Banner */}
      <div className={`p-4 rounded-theme text-center font-bold text-lg shadow-sm ${
        systemHealth.status === 'healthy' 
          ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
          : systemHealth.status === 'warning'
          ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200'
          : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
      }`}>
        {systemHealth.status === 'healthy' && '✅ All Systems Operational'}
        {systemHealth.status === 'warning' && `⚠️ ${systemHealth.warnings.length} Warning(s) Detected`}
        {systemHealth.status === 'critical' && `🚨 ${systemHealth.alerts.length} Critical Alert(s)`}
      </div>

      {/* Alerts Section */}
      {(systemHealth.alerts.length > 0 || systemHealth.warnings.length > 0) && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
            Active Alerts & Warnings
          </h3>
          {systemHealth.alerts.map((alert, index) => (
            <AlertCard key={`alert-${index}`} alert={alert} />
          ))}
          {systemHealth.warnings.map((warning, index) => (
            <AlertCard key={`warning-${index}`} alert={warning} />
          ))}
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Users"
          value={metrics.totalUsers.toLocaleString()}
          subtitle={`${metrics.activeUsers.toLocaleString()} active (7 days)`}
          icon="👥"
        />
        
        <MetricCard
          title="Total Leagues"
          value={metrics.totalLeagues.toLocaleString()}
          subtitle={`${metrics.activeLeagues.toLocaleString()} active`}
          icon="🏆"
        />
        
        <MetricCard
          title="Today's Signups"
          value={metrics.todaySignups}
          subtitle="New users today"
          icon="✨"
        />
        
        <MetricCard
          title="Cache Items"
          value={metrics.cacheStats?.totalItems || 0}
          subtitle={metrics.cacheStats?.totalSize || '0 KB'}
          icon="💾"
        />
      </div>

      {/* Performance Metrics */}
      <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
        <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Performance Metrics
        </h3>
        
        <div className="space-y-4">
          <ProgressBar
            label="User Engagement Rate"
            value={metrics.activeUsers}
            max={metrics.totalUsers}
            color={engagementRate > 50 ? 'success' : engagementRate > 25 ? 'warning' : 'danger'}
          />

          <ProgressBar
            label="League Participation"
            value={metrics.activeLeagues}
            max={metrics.totalLeagues}
            color={leagueRate > 70 ? 'success' : leagueRate > 40 ? 'warning' : 'danger'}
          />

          <ProgressBar
            label="Capacity Usage"
            value={metrics.totalUsers}
            max={10000}
            color={metrics.totalUsers < 8000 ? 'success' : metrics.totalUsers < 9500 ? 'warning' : 'danger'}
          />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
        <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button 
            onClick={loadMetrics}
            disabled={isLoading}
            className="p-3 bg-primary dark:bg-primary-dark hover:opacity-90 text-white rounded-theme text-sm font-medium transition-opacity disabled:opacity-50"
          >
            🔄 Refresh Data
          </button>
          <button 
            onClick={() => window.open('https://console.firebase.google.com', '_blank')}
            className="p-3 bg-secondary dark:bg-secondary-dark hover:opacity-90 text-white rounded-theme text-sm font-medium transition-opacity"
          >
            🔥 Firebase Console
          </button>
          <button 
            onClick={() => {
              const data = JSON.stringify(metrics, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `metrics-${new Date().toISOString()}.json`;
              a.click();
            }}
            className="p-3 bg-accent dark:bg-accent-dark hover:opacity-90 text-white rounded-theme text-sm font-medium transition-opacity"
          >
            📊 Export Metrics
          </button>
          <button 
            onClick={handleClearCache}
            className="p-3 bg-gray-500 hover:opacity-90 text-white rounded-theme text-sm font-medium transition-opacity"
          >
            🗑️ Clear Cache
          </button>
        </div>
      </div>

      {/* Cache Details */}
      {metrics.cacheStats && (
        <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
          <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
            Cache Statistics
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-accent dark:border-accent-dark">
              <span className="text-text-secondary dark:text-text-secondary-dark font-medium">Total Items:</span>
              <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                {metrics.cacheStats.totalItems}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-accent dark:border-accent-dark">
              <span className="text-text-secondary dark:text-text-secondary-dark font-medium">Total Size:</span>
              <span className="font-semibold text-text-primary dark:text-text-primary-dark">
                {metrics.cacheStats.totalSize}
              </span>
            </div>
            {metrics.cacheStats.categories && Object.keys(metrics.cacheStats.categories).length > 0 && (
              <div className="mt-4 pt-4 border-t border-accent dark:border-accent-dark">
                <p className="text-xs font-semibold text-text-secondary dark:text-text-secondary-dark mb-2 uppercase">
                  By Category
                </p>
                {Object.keys(metrics.cacheStats.categories).map(category => (
                  <div key={category} className="flex justify-between py-1 pl-4">
                    <span className="text-text-secondary dark:text-text-secondary-dark">
                      {category}:
                    </span>
                    <span className="text-text-primary dark:text-text-primary-dark">
                      {metrics.cacheStats.categories[category].count} items ({metrics.cacheStats.categories[category].size})
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* System Info */}
      <div className="bg-surface dark:bg-surface-dark p-6 rounded-theme border border-accent dark:border-accent-dark">
        <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
          System Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-text-secondary dark:text-text-secondary-dark mb-1">Environment</p>
            <p className="font-semibold text-text-primary dark:text-text-primary-dark">
              {process.env.NODE_ENV === 'production' ? 'Production' : 'Development'}
            </p>
          </div>
          <div>
            <p className="text-text-secondary dark:text-text-secondary-dark mb-1">Last Refresh</p>
            <p className="font-semibold text-text-primary dark:text-text-primary-dark">
              {lastRefresh ? lastRefresh.toLocaleString() : 'Never'}
            </p>
          </div>
          <div>
            <p className="text-text-secondary dark:text-text-secondary-dark mb-1">User Capacity</p>
            <p className="font-semibold text-text-primary dark:text-text-primary-dark">
              {metrics.totalUsers.toLocaleString()} / 10,000 ({((metrics.totalUsers / 10000) * 100).toFixed(1)}%)
            </p>
          </div>
          <div>
            <p className="text-text-secondary dark:text-text-secondary-dark mb-1">Health Status</p>
            <p className={`font-semibold ${
              systemHealth.status === 'healthy' ? 'text-green-500' :
              systemHealth.status === 'warning' ? 'text-yellow-500' :
              'text-red-500'
            }`}>
              {systemHealth.status.charAt(0).toUpperCase() + systemHealth.status.slice(1)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitoringDashboard;