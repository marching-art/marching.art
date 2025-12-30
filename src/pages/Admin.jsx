// src/pages/Admin.jsx
// =============================================================================
// ADMIN PANEL - ESPN DATA GRID STYLE
// =============================================================================
// Dense panels, dark theme matching Dashboard design
// Uses bg-[#0a0a0a], bg-[#1a1a1a], bg-[#222] color scheme

import React, { useState, useEffect } from 'react';
import {
  Shield, Database, Users, Calendar, Award,
  Play, RefreshCw, CheckCircle, XCircle, AlertTriangle, Table
} from 'lucide-react';
import { db, adminHelpers } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { useAuth } from '../App';
import { ScoresSpreadsheet } from '../components/Admin';
import LoadingScreen from '../components/LoadingScreen';

const Admin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [seasonData, setSeasonData] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeCorps: 0,
    activeSeasons: 0
  });

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const adminStatus = await adminHelpers.isAdmin();
        setIsAdmin(adminStatus);
        if (adminStatus) {
          await loadAdminData();
        }
      }
      setLoading(false);
    };
    checkAdmin();
  }, [user]);

  const loadAdminData = async () => {
    try {
      // Load current season
      const seasonDoc = await getDoc(doc(db, 'game-settings/season'));
      if (seasonDoc.exists()) {
        setSeasonData(seasonDoc.data());
      }

      // Load stats
      const usersSnapshot = await getDocs(collection(db, 'artifacts/marching-art/users'));

      setStats({
        totalUsers: usersSnapshot.size,
        activeCorps: 0,
        activeSeasons: 1
      });
    } catch (error) {
      if (error.code !== 'permission-denied' && !error.message?.includes('insufficient permissions')) {
        console.error('Error loading admin data:', error);
        toast.error('Failed to load admin data');
      }
    }
  };

  const callAdminFunction = async (functionName, data = {}) => {
    try {
      const functions = getFunctions();
      const callable = httpsCallable(functions, functionName);
      const result = await callable(data);
      toast.success(result.data.message || 'Operation completed successfully');
      await loadAdminData();
      return result.data;
    } catch (error) {
      if (error.code !== 'permission-denied' && !error.message?.includes('insufficient permissions')) {
        console.error(`Error calling ${functionName}:`, error);
      }
      toast.error(error.message || `Failed to execute ${functionName}`);
      throw error;
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a]">
        <div className="text-center p-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Access Denied</h1>
          <p className="text-gray-500">You do not have administrator privileges.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-[#333]">
        <div className="px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <Shield className="w-5 h-5 text-yellow-500" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Admin Panel</h1>
              <p className="text-sm text-gray-500">System Management & Administration</p>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-px bg-[#333]">
        <StatCard icon={Users} label="Total Users" value={stats.totalUsers} />
        <StatCard icon={Database} label="Active Corps" value={stats.activeCorps} />
        <StatCard icon={Calendar} label="Active Seasons" value={stats.activeSeasons} />
      </div>

      {/* Tab Navigation */}
      <div className="bg-[#1a1a1a] border-b border-[#333] overflow-x-auto">
        <div className="flex">
          {[
            { id: 'overview', label: 'Overview', icon: Database },
            { id: 'season', label: 'Season Management', icon: Calendar },
            { id: 'scores', label: 'Scores Reference', icon: Table },
            { id: 'users', label: 'User Management', icon: Users },
            { id: 'jobs', label: 'Background Jobs', icon: RefreshCw },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-[#0057B8] border-[#0057B8] bg-[#0a0a0a]'
                  : 'text-gray-500 border-transparent hover:text-white'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        {activeTab === 'overview' && <OverviewTab seasonData={seasonData} />}
        {activeTab === 'season' && <SeasonManagementTab seasonData={seasonData} callAdminFunction={callAdminFunction} />}
        {activeTab === 'scores' && <ScoresSpreadsheet />}
        {activeTab === 'users' && <UserManagementTab />}
        {activeTab === 'jobs' && <BackgroundJobsTab callAdminFunction={callAdminFunction} />}
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value }) => (
  <div className="bg-[#1a1a1a] p-4">
    <div className="flex items-center justify-between mb-2">
      <Icon className="w-5 h-5 text-gray-500" />
      <span className="text-2xl font-bold text-white tabular-nums">{value}</span>
    </div>
    <p className="text-xs text-gray-500 uppercase tracking-wider">{label}</p>
  </div>
);

// Overview Tab
const OverviewTab = ({ seasonData }) => (
  <div className="space-y-4">
    {/* Current Season Card */}
    <div className="bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden">
      <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">Current Season</h2>
      </div>
      {seasonData ? (
        <div className="divide-y divide-[#333]">
          <InfoRow label="Season Name" value={seasonData.name} />
          <InfoRow label="Status" value={seasonData.status} badge />
          <InfoRow label="Season UID" value={seasonData.seasonUid} mono />
          <InfoRow
            label="Start Date"
            value={seasonData.schedule?.startDate?.toDate().toLocaleDateString()}
          />
          <InfoRow
            label="End Date"
            value={seasonData.schedule?.endDate?.toDate().toLocaleDateString()}
          />
          <InfoRow label="Point Cap" value={seasonData.currentPointCap} />
        </div>
      ) : (
        <div className="p-4 text-gray-500 text-sm">No active season found</div>
      )}
    </div>

    {/* System Health Card */}
    <div className="bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden">
      <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider">System Health</h2>
      </div>
      <div className="divide-y divide-[#333]">
        <HealthIndicator label="Database" status="healthy" />
        <HealthIndicator label="Cloud Functions" status="healthy" />
        <HealthIndicator label="Authentication" status="healthy" />
        <HealthIndicator label="Storage" status="healthy" />
      </div>
    </div>
  </div>
);

// Season Management Tab
const SeasonManagementTab = ({ seasonData, callAdminFunction }) => {
  const [newSeasonLoading, setNewSeasonLoading] = useState(false);

  const handleStartNewSeason = async (type) => {
    if (!window.confirm(`Start a new ${type} season? This will reset all user corps.`)) {
      return;
    }

    setNewSeasonLoading(true);
    try {
      const functionName = type === 'off' ? 'startNewOffSeason' : 'startNewLiveSeason';
      await callAdminFunction(functionName);
    } catch (error) {
      // Error handled by callAdminFunction
    } finally {
      setNewSeasonLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Season Controls */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden">
        <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Season Controls</h2>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button
            onClick={() => handleStartNewSeason('off')}
            disabled={newSeasonLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[#0057B8] text-white font-bold text-sm rounded hover:bg-[#0066d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
            Start New Off-Season
          </button>
          <button
            onClick={() => handleStartNewSeason('live')}
            disabled={newSeasonLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-[#222] text-white font-bold text-sm rounded border border-[#444] hover:bg-[#333] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
            Start New Live Season
          </button>
        </div>
      </div>

      {/* Current Season Details */}
      {seasonData && (
        <div className="bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden">
          <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Current Season Details</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Season Name</label>
              <input
                type="text"
                value={seasonData.name}
                disabled
                className="w-full px-3 py-2 bg-[#222] border border-[#333] rounded text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Data Document ID</label>
              <input
                type="text"
                value={seasonData.dataDocId}
                disabled
                className="w-full px-3 py-2 bg-[#222] border border-[#333] rounded text-white text-sm font-mono"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Status</label>
                <span className={`inline-block px-3 py-1 rounded text-xs font-bold ${
                  seasonData.status === 'live-season'
                    ? 'bg-green-500/20 text-green-500'
                    : 'bg-yellow-500/20 text-yellow-500'
                }`}>
                  {seasonData.status}
                </span>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1">Point Cap</label>
                <span className="text-white font-bold">{seasonData.currentPointCap}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// User Management Tab
const UserManagementTab = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    premiumUsers: 0,
    totalCorps: 0
  });

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      const usersRef = collection(db, 'artifacts/marching-art/users');
      const snapshot = await getDocs(usersRef);

      let activeCount = 0;
      let premiumCount = 0;
      let corpsCount = 0;

      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.lastActive) {
          const lastActive = data.lastActive.toDate();
          const daysSinceActive = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceActive <= 7) activeCount++;
        }
        if (data.battlePass?.isPremium) premiumCount++;
        if (data.corps) {
          corpsCount += Object.keys(data.corps).length;
        }
      });

      setStats({
        totalUsers: snapshot.size,
        activeUsers: activeCount,
        premiumUsers: premiumCount,
        totalCorps: corpsCount
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  return (
    <div className="space-y-4">
      {/* User Statistics */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden">
        <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">User Statistics</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#333]">
          <div className="bg-[#1a1a1a] p-4">
            <p className="text-xs text-gray-500 mb-1">Total Users</p>
            <p className="text-2xl font-bold text-white tabular-nums">{stats.totalUsers}</p>
          </div>
          <div className="bg-[#1a1a1a] p-4">
            <p className="text-xs text-gray-500 mb-1">Active (7 days)</p>
            <p className="text-2xl font-bold text-green-500 tabular-nums">{stats.activeUsers}</p>
          </div>
          <div className="bg-[#1a1a1a] p-4">
            <p className="text-xs text-gray-500 mb-1">Premium Users</p>
            <p className="text-2xl font-bold text-yellow-500 tabular-nums">{stats.premiumUsers}</p>
          </div>
          <div className="bg-[#1a1a1a] p-4">
            <p className="text-xs text-gray-500 mb-1">Total Corps</p>
            <p className="text-2xl font-bold text-[#0057B8] tabular-nums">{stats.totalCorps}</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-lg overflow-hidden">
        <div className="bg-[#222] px-4 py-3 border-b border-[#333]">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider">Quick Actions</h2>
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <button className="p-4 bg-[#222] hover:bg-[#333] border border-[#333] rounded text-left transition-colors">
            <Users className="w-5 h-5 text-[#0057B8] mb-2" />
            <p className="font-bold text-white text-sm">View All Users</p>
            <p className="text-xs text-gray-500">Browse user profiles and activity</p>
          </button>
          <button className="p-4 bg-[#222] hover:bg-[#333] border border-[#333] rounded text-left transition-colors">
            <Shield className="w-5 h-5 text-purple-500 mb-2" />
            <p className="font-bold text-white text-sm">Manage Roles</p>
            <p className="text-xs text-gray-500">Assign admin and moderator roles</p>
          </button>
        </div>
      </div>
    </div>
  );
};

// Background Jobs Tab
const BackgroundJobsTab = ({ callAdminFunction }) => {
  const [jobLoading, setJobLoading] = useState(null);

  const jobs = [
    {
      id: 'calculateCorpsStatistics',
      name: 'Calculate Corps Statistics',
      description: 'Recalculate all corps statistics from historical data',
      icon: Database,
    },
    {
      id: 'archiveSeasonResults',
      name: 'Archive Season Results',
      description: 'Archive current season results and determine league champions',
      icon: Award,
    },
    {
      id: 'processAndArchiveOffSeasonScores',
      name: 'Process Off-Season Scores',
      description: 'Manually trigger daily off-season score processing',
      icon: RefreshCw,
    },
    {
      id: 'processLiveSeasonScores',
      name: 'Process Live Season Scores',
      description: 'Manually trigger daily live season score processing',
      icon: RefreshCw,
    },
    {
      id: 'createBattlePassSeason',
      name: 'Create Battle Pass Season',
      description: 'Initialize a new battle pass season with rewards',
      icon: Award,
    },
  ];

  const handleRunJob = async (jobId) => {
    if (!window.confirm(`Run ${jobs.find(j => j.id === jobId)?.name}?`)) {
      return;
    }

    setJobLoading(jobId);
    try {
      await callAdminFunction('manualTrigger', { jobName: jobId });
    } finally {
      setJobLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <div key={job.id} className="bg-[#1a1a1a] border border-[#333] rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-10 h-10 bg-[#222] rounded-lg flex items-center justify-center flex-shrink-0">
                <job.icon className="w-5 h-5 text-yellow-500" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white text-sm">{job.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{job.description}</p>
              </div>
            </div>
            <button
              onClick={() => handleRunJob(job.id)}
              disabled={jobLoading === job.id}
              className="flex items-center gap-2 px-4 py-2 bg-[#0057B8] text-white font-bold text-xs rounded hover:bg-[#0066d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
            >
              {jobLoading === job.id ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />
                  Run
                </>
              )}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

// Helper Components
const InfoRow = ({ label, value, badge, mono }) => (
  <div className="flex justify-between items-center px-4 py-3">
    <span className="text-sm text-gray-500">{label}</span>
    {badge ? (
      <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-500 rounded text-xs font-bold">
        {value}
      </span>
    ) : (
      <span className={`text-sm text-white ${mono ? 'font-mono' : 'font-medium'}`}>
        {value || 'N/A'}
      </span>
    )}
  </div>
);

const HealthIndicator = ({ label, status }) => {
  const statusConfig = {
    healthy: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/20' },
    warning: { icon: AlertTriangle, color: 'text-yellow-500', bg: 'bg-yellow-500/20' },
    error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/20' },
  };

  const config = statusConfig[status] || statusConfig.healthy;
  const Icon = config.icon;

  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-400">{label}</span>
      <div className={`flex items-center gap-2 px-2 py-1 rounded ${config.bg}`}>
        <Icon className={`w-3.5 h-3.5 ${config.color}`} />
        <span className={`text-xs font-bold ${config.color}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
    </div>
  );
};

export default Admin;
