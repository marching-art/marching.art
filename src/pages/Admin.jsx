// src/pages/Admin.jsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield, Database, Users, Calendar, Award,
  Play, RefreshCw, Settings, Download, Upload,
  CheckCircle, XCircle, Clock, AlertTriangle, Plus
} from 'lucide-react';
import { db, adminHelpers } from '../firebase';
import { doc, getDoc, collection, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { useAuth } from '../App';

const Admin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [seasonData, setSeasonData] = useState(null);
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeCorps: 0,
    totalStaff: 0,
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
      const staffSnapshot = await getDocs(collection(db, 'staff_database'));

      setStats({
        totalUsers: usersSnapshot.size,
        activeCorps: 0, // Calculate from user profiles
        totalStaff: staffSnapshot.size,
        activeSeasons: 1
      });
    } catch (error) {
      console.error('Error loading admin data:', error);
      toast.error('Failed to load admin data');
    }
  };

  const callAdminFunction = async (functionName, data = {}) => {
    try {
      const functions = getFunctions();
      const callable = httpsCallable(functions, functionName);
      const result = await callable(data);
      toast.success(result.data.message || 'Operation completed successfully');
      await loadAdminData(); // Refresh data
      return result.data;
    } catch (error) {
      console.error(`Error calling ${functionName}:`, error);
      toast.error(error.message || `Failed to execute ${functionName}`);
      throw error;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gold-500"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Shield className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-cream-100 mb-2">Access Denied</h1>
          <p className="text-cream-500">You do not have administrator privileges.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-8"
      >
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gold-500/20 rounded-xl">
            <Shield className="w-8 h-8 text-gold-500" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold text-gradient">
              Admin Panel
            </h1>
            <p className="text-cream-500">System Management & Administration</p>
          </div>
        </div>
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label="Total Users"
          value={stats.totalUsers}
          color="blue"
        />
        <StatCard
          icon={Database}
          label="Active Corps"
          value={stats.activeCorps}
          color="green"
        />
        <StatCard
          icon={Award}
          label="Staff Members"
          value={stats.totalStaff}
          color="purple"
        />
        <StatCard
          icon={Calendar}
          label="Active Seasons"
          value={stats.activeSeasons}
          color="gold"
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: Database },
          { id: 'season', label: 'Season Management', icon: Calendar },
          { id: 'staff', label: 'Staff Database', icon: Award },
          { id: 'users', label: 'User Management', icon: Users },
          { id: 'jobs', label: 'Background Jobs', icon: RefreshCw },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-gold-500 text-charcoal-900'
                : 'glass text-cream-300 hover:text-cream-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'overview' && <OverviewTab seasonData={seasonData} />}
        {activeTab === 'season' && <SeasonManagementTab seasonData={seasonData} callAdminFunction={callAdminFunction} />}
        {activeTab === 'staff' && <StaffDatabaseTab callAdminFunction={callAdminFunction} />}
        {activeTab === 'users' && <UserManagementTab />}
        {activeTab === 'jobs' && <BackgroundJobsTab callAdminFunction={callAdminFunction} />}
      </motion.div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ icon: Icon, label, value, color }) => {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-500',
    green: 'bg-green-500/20 text-green-500',
    purple: 'bg-purple-500/20 text-purple-500',
    gold: 'bg-gold-500/20 text-gold-500',
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <span className="text-3xl font-bold text-cream-100">{value}</span>
      </div>
      <p className="text-sm text-cream-500">{label}</p>
    </div>
  );
};

// Overview Tab
const OverviewTab = ({ seasonData }) => (
  <div className="space-y-6">
    <div className="card">
      <h2 className="text-xl font-bold text-cream-100 mb-4">Current Season</h2>
      {seasonData ? (
        <div className="space-y-3">
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
        <p className="text-cream-500">No active season found</p>
      )}
    </div>

    <div className="card">
      <h2 className="text-xl font-bold text-cream-100 mb-4">System Health</h2>
      <div className="space-y-2">
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
    } finally {
      setNewSeasonLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-xl font-bold text-cream-100 mb-4">Season Controls</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => handleStartNewSeason('off')}
            disabled={newSeasonLoading}
            className="btn-primary flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Start New Off-Season
          </button>
          <button
            onClick={() => handleStartNewSeason('live')}
            disabled={newSeasonLoading}
            className="btn-outline flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            Start New Live Season
          </button>
        </div>
      </div>

      {seasonData && (
        <div className="card">
          <h2 className="text-xl font-bold text-cream-100 mb-4">Current Season Details</h2>
          <div className="space-y-4">
            <div>
              <label className="label">Season Name</label>
              <input
                type="text"
                value={seasonData.name}
                disabled
                className="input bg-charcoal-900/50"
              />
            </div>
            <div>
              <label className="label">Data Document ID</label>
              <input
                type="text"
                value={seasonData.dataDocId}
                disabled
                className="input bg-charcoal-900/50 font-mono text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Status</label>
                <span className={`badge ${
                  seasonData.status === 'live-season' ? 'badge-success' : 'badge-gold'
                }`}>
                  {seasonData.status}
                </span>
              </div>
              <div>
                <label className="label">Point Cap</label>
                <span className="text-cream-100 font-bold">{seasonData.currentPointCap}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Staff Database Tab
const StaffDatabaseTab = ({ callAdminFunction }) => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'staff_database'));
      const staff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setStaffList(staff);
    } catch (error) {
      console.error('Error loading staff:', error);
      toast.error('Failed to load staff database');
    } finally {
      setLoading(false);
    }
  };

  const handleAddStaff = async (staffData) => {
    try {
      const newStaffRef = doc(collection(db, 'staff_database'));
      await setDoc(newStaffRef, {
        ...staffData,
        available: true,
        createdAt: new Date(),
      });
      toast.success('Staff member added successfully');
      setShowAddForm(false);
      loadStaff();
    } catch (error) {
      console.error('Error adding staff:', error);
      toast.error('Failed to add staff member');
    }
  };

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-cream-100">Staff Database</h2>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="btn-primary"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Staff Member
          </button>
        </div>

        {showAddForm && (
          <AddStaffForm onSubmit={handleAddStaff} onCancel={() => setShowAddForm(false)} />
        )}

        <div className="text-sm text-cream-500 mb-4">
          Total: {staffList.length} staff members
        </div>

        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gold-500 mx-auto"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-charcoal-900/50">
                <tr>
                  <th className="px-4 py-2 text-left text-cream-500">Name</th>
                  <th className="px-4 py-2 text-left text-cream-500">Caption</th>
                  <th className="px-4 py-2 text-left text-cream-500">Year Inducted</th>
                  <th className="px-4 py-2 text-left text-cream-500">Base Value</th>
                  <th className="px-4 py-2 text-left text-cream-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-500/10">
                {staffList.map((staff) => (
                  <tr key={staff.id} className="hover:bg-charcoal-900/30">
                    <td className="px-4 py-3 text-cream-100">{staff.name}</td>
                    <td className="px-4 py-3 text-cream-300">{staff.caption}</td>
                    <td className="px-4 py-3 text-cream-300">{staff.yearInducted}</td>
                    <td className="px-4 py-3 text-gold-500">{staff.baseValue} CC</td>
                    <td className="px-4 py-3">
                      <span className={`badge ${staff.available ? 'badge-success' : 'badge-disabled'}`}>
                        {staff.available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

// Add Staff Form Component
const AddStaffForm = ({ onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    caption: 'GE1',
    yearInducted: new Date().getFullYear(),
    biography: '',
    baseValue: 100,
  });

  const captions = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-charcoal-900/30 p-6 rounded-lg mb-6 space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Name</label>
          <input
            type="text"
            className="input"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="label">Caption</label>
          <select
            className="select"
            value={formData.caption}
            onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
          >
            {captions.map((cap) => (
              <option key={cap} value={cap}>{cap}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Year Inducted</label>
          <input
            type="number"
            className="input"
            value={formData.yearInducted}
            onChange={(e) => setFormData({ ...formData, yearInducted: parseInt(e.target.value) })}
            required
          />
        </div>
        <div>
          <label className="label">Base Value (CorpsCoin)</label>
          <input
            type="number"
            className="input"
            value={formData.baseValue}
            onChange={(e) => setFormData({ ...formData, baseValue: parseInt(e.target.value) })}
            required
          />
        </div>
      </div>

      <div>
        <label className="label">Biography</label>
        <textarea
          className="textarea"
          rows="3"
          value={formData.biography}
          onChange={(e) => setFormData({ ...formData, biography: e.target.value })}
          placeholder="Brief biography of this staff member..."
        />
      </div>

      <div className="flex gap-3">
        <button type="submit" className="btn-primary flex-1">
          Add Staff Member
        </button>
        <button type="button" onClick={onCancel} className="btn-ghost flex-1">
          Cancel
        </button>
      </div>
    </form>
  );
};

// User Management Tab
const UserManagementTab = () => (
  <div className="card">
    <h2 className="text-xl font-bold text-cream-100 mb-4">User Management</h2>
    <p className="text-cream-500">User management tools coming soon...</p>
  </div>
);

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
    <div className="space-y-4">
      {jobs.map((job) => (
        <div key={job.id} className="card">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-gold-500/20 rounded-lg">
                <job.icon className="w-6 h-6 text-gold-500" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-cream-100 mb-1">{job.name}</h3>
                <p className="text-cream-500 text-sm">{job.description}</p>
              </div>
            </div>
            <button
              onClick={() => handleRunJob(job.id)}
              disabled={jobLoading === job.id}
              className="btn-primary flex items-center gap-2"
            >
              {jobLoading === job.id ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Now
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
  <div className="flex justify-between items-center py-2 border-b border-cream-500/10">
    <span className="text-cream-500">{label}</span>
    {badge ? (
      <span className="badge badge-gold">{value}</span>
    ) : (
      <span className={`text-cream-100 ${mono ? 'font-mono text-sm' : 'font-medium'}`}>
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
    <div className="flex items-center justify-between py-2">
      <span className="text-cream-300">{label}</span>
      <div className={`flex items-center gap-2 px-3 py-1 rounded-lg ${config.bg}`}>
        <Icon className={`w-4 h-4 ${config.color}`} />
        <span className={`text-sm font-medium ${config.color}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
      </div>
    </div>
  );
};

export default Admin;
