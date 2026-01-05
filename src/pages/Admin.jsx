// src/pages/Admin.jsx
// =============================================================================
// ADMIN PANEL - SYSTEM OPS TERMINAL
// =============================================================================
// Dense, technical "Ops Console" aesthetic. Developer tools feel.
// Laws: App Shell, Telemetry Strip, Process Tables, no glow

import React, { useState, useEffect } from 'react';
import {
  Shield, Database, Users, Award, Calendar,
  Play, RefreshCw, FileText, Terminal,
  X, Search, Mail, UserCheck, UserX, Activity,
  CheckCircle, AlertTriangle, Send, Newspaper, Flame, Inbox
} from 'lucide-react';
import { setUserRole, triggerDailyNews } from '../firebase/functions';
import { db, adminHelpers } from '../firebase';
import { doc, getDoc, collection, getDocs, collectionGroup } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { useAuth } from '../App';
import { ScoresSpreadsheet, ArticleManagement, SubmissionsManagement } from '../components/Admin';
import LoadingScreen from '../components/LoadingScreen';

// =============================================================================
// CONSTANTS
// =============================================================================

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'season', label: 'Season Ops' },
  { id: 'users', label: 'Users' },
  { id: 'content', label: 'Content' },
  { id: 'jobs', label: 'Jobs' },
];

// =============================================================================
// TELEMETRY STRIP
// =============================================================================

const TelemetryStrip = ({ stats }) => (
  <div className="bg-[#1a1a1a] border-b border-[#333]">
    <div className="flex items-center divide-x divide-[#333]">
      <TelemetryStat label="Users" value={stats.totalUsers.toLocaleString()} />
      <TelemetryStat label="Active (7d)" value={stats.activeUsers.toLocaleString()} color="text-green-500" />
      <TelemetryStat label="Corps" value={stats.totalCorps.toLocaleString()} color="text-[#0057B8]" />
      <TelemetryStat label="System" value="ONLINE" color="text-green-500" icon={CheckCircle} />
    </div>
  </div>
);

const TelemetryStat = ({ label, value, color = 'text-white', icon: Icon }) => (
  <div className="flex items-center gap-3 px-4 py-2">
    <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500">{label}:</span>
    <span className={`text-sm font-bold font-data tabular-nums ${color} flex items-center gap-1`}>
      {Icon && <Icon className="w-3 h-3" />}
      {value}
    </span>
  </div>
);

// =============================================================================
// NAVIGATION TABS (Segmented Control)
// =============================================================================

const NavTabs = ({ activeTab, onTabChange }) => (
  <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-2">
    <div className="flex items-center gap-1">
      {ADMIN_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm transition-colors ${
            activeTab === tab.id
              ? 'bg-[#0057B8] text-white'
              : 'text-gray-500 hover:text-white hover:bg-white/5'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  </div>
);

// =============================================================================
// PROCESS TABLE ROW
// =============================================================================

const ProcessRow = ({ name, description, icon: Icon, loading, onExecute }) => (
  <div className="flex items-center justify-between px-4 py-3 border-b border-[#333] hover:bg-[#111] transition-colors">
    <div className="flex items-center gap-3 min-w-0">
      <Icon className="w-4 h-4 text-gray-500 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">{name}</p>
        <p className="text-[11px] text-gray-500 truncate">{description}</p>
      </div>
    </div>
    <button
      onClick={onExecute}
      disabled={loading}
      className="flex items-center gap-1.5 h-7 px-3 text-[10px] font-bold uppercase bg-[#0057B8]/10 text-[#0057B8] border border-[#0057B8]/20 hover:bg-[#0057B8] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex-shrink-0"
    >
      {loading ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : (
        <Terminal className="w-3 h-3" />
      )}
      {loading ? 'Running' : 'Execute'}
    </button>
  </div>
);

// =============================================================================
// SECTION HEADER
// =============================================================================

const SectionHeader = ({ title, icon: Icon }) => (
  <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center gap-2">
    {Icon && <Icon className="w-3.5 h-3.5 text-gray-500" />}
    <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{title}</h3>
  </div>
);

// =============================================================================
// INFO ROW (for data display)
// =============================================================================

const InfoRow = ({ label, value, badge, mono }) => (
  <div className="flex justify-between items-center px-4 py-2.5 border-b border-[#222] last:border-b-0">
    <span className="text-[11px] uppercase tracking-wider text-gray-500">{label}</span>
    {badge ? (
      <span className="px-2 py-0.5 bg-green-500/20 text-green-500 text-[10px] font-bold uppercase">
        {value}
      </span>
    ) : (
      <span className={`text-sm text-white ${mono ? 'font-data tabular-nums' : 'font-medium'}`}>
        {value || '—'}
      </span>
    )}
  </div>
);

// =============================================================================
// OVERVIEW TAB
// =============================================================================

const OverviewTab = ({ seasonData }) => (
  <div className="space-y-4">
    {/* Current Season */}
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Active Season" icon={Calendar} />
      {seasonData ? (
        <div>
          <InfoRow label="Name" value={seasonData.name} />
          <InfoRow label="Status" value={seasonData.status?.toUpperCase()} badge />
          <InfoRow label="Season UID" value={seasonData.seasonUid} mono />
          <InfoRow label="Data Doc ID" value={seasonData.dataDocId} mono />
          <InfoRow
            label="Start"
            value={seasonData.schedule?.startDate?.toDate().toLocaleDateString()}
          />
          <InfoRow
            label="End"
            value={seasonData.schedule?.endDate?.toDate().toLocaleDateString()}
          />
          <InfoRow label="Point Cap" value={seasonData.currentPointCap} mono />
        </div>
      ) : (
        <div className="p-4 text-sm text-gray-500">No active season found</div>
      )}
    </div>
  </div>
);

// =============================================================================
// SEASON OPS TAB
// =============================================================================

const SeasonOpsTab = ({ callAdminFunction }) => {
  const [loading, setLoading] = useState(null);

  const handleAction = async (type, functionName) => {
    if (!window.confirm(`Execute ${type}? This may affect user data.`)) return;
    setLoading(functionName);
    try {
      await callAdminFunction(functionName);
    } finally {
      setLoading(null);
    }
  };

  const seasonOps = [
    {
      id: 'startNewOffSeason',
      name: 'Start New Off-Season',
      description: 'Archive current data and begin a new off-season',
      icon: Play,
    },
    {
      id: 'startNewLiveSeason',
      name: 'Start New Live Season',
      description: 'Archive current data and begin a new live DCI season',
      icon: Play,
    },
  ];

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Season Operations" icon={Calendar} />
      <div className="px-4 py-3 border-b border-[#333] bg-[#111]">
        <div className="flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-yellow-500/80">
            Starting a new season will archive all current user corps data and reset the game state.
          </p>
        </div>
      </div>
      {seasonOps.map((op) => (
        <ProcessRow
          key={op.id}
          name={op.name}
          description={op.description}
          icon={op.icon}
          loading={loading === op.id}
          onExecute={() => handleAction(op.name, op.id)}
        />
      ))}
    </div>
  );
};

// =============================================================================
// USERS TAB
// =============================================================================

const UsersTab = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    avgLoginStreak: 0,
    totalCorps: 0,
    totalLogins: 0
  });
  const [users, setUsers] = useState([]);
  const [showUserList, setShowUserList] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleEmail, setRoleEmail] = useState('');
  const [roleLoading, setRoleLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      // Use collectionGroup to query all profile documents directly
      // This is needed because user documents don't exist at the parent level,
      // only the nested profile/data documents exist
      const profilesRef = collectionGroup(db, 'profile');
      const snapshot = await getDocs(profilesRef);

      let totalUsers = 0;
      let activeCount = 0, corpsCount = 0, totalStreaks = 0, streakCount = 0, loginSum = 0;

      for (const profileDoc of snapshot.docs) {
        // Only count profile docs from the marching-art users collection
        if (!profileDoc.ref.path.includes('artifacts/marching-art/users')) continue;

        totalUsers++;
        const data = profileDoc.data();

        // Check activity using lastLogin (Timestamp) or engagement.lastLogin (string)
        let lastLoginDate = null;
        if (data.lastLogin?.toDate) {
          lastLoginDate = data.lastLogin.toDate();
        } else if (data.engagement?.lastLogin) {
          lastLoginDate = new Date(data.engagement.lastLogin);
        }

        if (lastLoginDate) {
          const days = (Date.now() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24);
          if (days <= 7) activeCount++;
        }

        // Engagement stats
        if (data.engagement) {
          if (data.engagement.loginStreak > 0) {
            totalStreaks += data.engagement.loginStreak;
            streakCount++;
          }
          loginSum += data.engagement.totalLogins || 0;
        }

        if (data.corps) corpsCount += Object.keys(data.corps).length;
      }

      const avgStreak = streakCount > 0 ? Math.round(totalStreaks / streakCount * 10) / 10 : 0;
      setStats({
        totalUsers,
        activeUsers: activeCount,
        avgLoginStreak: avgStreak,
        totalCorps: corpsCount,
        totalLogins: loginSum
      });
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const loadAllUsers = async () => {
    setUsersLoading(true);
    try {
      // Use collectionGroup to query all profile documents directly
      const profilesRef = collectionGroup(db, 'profile');
      const snapshot = await getDocs(profilesRef);

      const userList = snapshot.docs
        .filter(profileDoc => profileDoc.ref.path.includes('artifacts/marching-art/users'))
        .map(profileDoc => {
          const data = profileDoc.data();

          // Extract user ID from the doc path
          // Path format: artifacts/marching-art/users/{userId}/profile/data
          const pathParts = profileDoc.ref.path.split('/');
          const uid = pathParts[3];

          // Get last login from either lastLogin (Timestamp) or engagement.lastLogin (string)
          let lastLoginDate = null;
          if (data.lastLogin?.toDate) {
            lastLoginDate = data.lastLogin.toDate();
          } else if (data.engagement?.lastLogin) {
            lastLoginDate = new Date(data.engagement.lastLogin);
          }

          return {
            uid,
            username: data.username || 'Unknown',
            email: data.email || null,
            lastLogin: lastLoginDate,
            xpLevel: data.xpLevel || 1,
            xp: data.xp || 0,
            loginStreak: data.engagement?.loginStreak || 0,
            totalLogins: data.engagement?.totalLogins || 0,
            corps: data.corps ? Object.keys(data.corps) : [],
            createdAt: data.createdAt?.toDate?.() || null
          };
        });

      // Sort by last login (most recent first)
      setUsers(userList.sort((a, b) => (b.lastLogin?.getTime() || 0) - (a.lastLogin?.getTime() || 0)));
      setShowUserList(true);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setUsersLoading(false);
    }
  };

  const handleSetRole = async (makeAdmin) => {
    if (!roleEmail.trim()) return toast.error('Enter an email');
    setRoleLoading(true);
    try {
      const result = await setUserRole({ email: roleEmail.trim(), makeAdmin });
      toast.success(result.data.message);
      setRoleEmail('');
    } catch (error) {
      toast.error(error.message || 'Failed to set role');
    } finally {
      setRoleLoading(false);
    }
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.uid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* User Stats */}
      <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
        <SectionHeader title="User Telemetry" icon={Users} />
        <div className="flex divide-x divide-[#333]">
          <div className="flex-1 p-3">
            <p className="text-[9px] uppercase text-gray-500 mb-1">Total</p>
            <p className="text-xl font-bold text-white font-data tabular-nums">{stats.totalUsers}</p>
          </div>
          <div className="flex-1 p-3">
            <p className="text-[9px] uppercase text-gray-500 mb-1">Active (7d)</p>
            <p className="text-xl font-bold text-green-500 font-data tabular-nums">{stats.activeUsers}</p>
          </div>
          <div className="flex-1 p-3">
            <p className="text-[9px] uppercase text-gray-500 mb-1 flex items-center gap-1">
              <Flame className="w-3 h-3" />Avg Streak
            </p>
            <p className="text-xl font-bold text-yellow-500 font-data tabular-nums">{stats.avgLoginStreak}d</p>
          </div>
          <div className="flex-1 p-3">
            <p className="text-[9px] uppercase text-gray-500 mb-1">Corps</p>
            <p className="text-xl font-bold text-[#0057B8] font-data tabular-nums">{stats.totalCorps}</p>
          </div>
        </div>
        <div className="flex divide-x divide-[#333] border-t border-[#333]">
          <div className="flex-1 p-3">
            <p className="text-[9px] uppercase text-gray-500 mb-1">Total Logins</p>
            <p className="text-lg font-bold text-gray-300 font-data tabular-nums">{stats.totalLogins.toLocaleString()}</p>
          </div>
          <div className="flex-1 p-3">
            <p className="text-[9px] uppercase text-gray-500 mb-1">Engagement</p>
            <p className="text-lg font-bold text-gray-300 font-data tabular-nums">
              {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* User Operations */}
      <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
        <SectionHeader title="User Operations" icon={Terminal} />
        <ProcessRow
          name="View All Users"
          description="Browse user profiles and activity"
          icon={Users}
          loading={usersLoading}
          onExecute={loadAllUsers}
        />
        <ProcessRow
          name="Manage Roles"
          description="Assign admin and moderator roles"
          icon={Shield}
          loading={false}
          onExecute={() => setShowRoleManager(true)}
        />
      </div>

      {/* User List Modal */}
      {showUserList && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-[#333] w-full max-w-4xl max-h-[80vh] flex flex-col">
            <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                All Users ({users.length})
              </h2>
              <button onClick={() => setShowUserList(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b border-[#333]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#111] border border-[#333] text-xs text-white focus:outline-none focus:border-[#0057B8]"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-[#222] sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-[10px] text-gray-500 uppercase">User</th>
                    <th className="text-left px-4 py-2 text-[10px] text-gray-500 uppercase">Lvl</th>
                    <th className="text-left px-4 py-2 text-[10px] text-gray-500 uppercase">Streak</th>
                    <th className="text-left px-4 py-2 text-[10px] text-gray-500 uppercase">Logins</th>
                    <th className="text-left px-4 py-2 text-[10px] text-gray-500 uppercase">Corps</th>
                    <th className="text-left px-4 py-2 text-[10px] text-gray-500 uppercase">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#333]">
                  {filteredUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-[#111]">
                      <td className="px-4 py-2.5">
                        <p className="text-sm text-white">{user.username}</p>
                        <p className="text-[10px] text-gray-600 font-data">{user.uid.slice(0, 12)}...</p>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-white font-data">{user.xpLevel}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-sm font-data ${user.loginStreak >= 7 ? 'text-yellow-500' : user.loginStreak >= 3 ? 'text-green-500' : 'text-gray-400'}`}>
                          {user.loginStreak > 0 ? `${user.loginStreak}d` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-400 font-data">{user.totalLogins || 0}</td>
                      <td className="px-4 py-2.5 text-sm text-gray-400">{user.corps.length}</td>
                      <td className="px-4 py-2.5 text-xs text-gray-400">
                        {user.lastLogin ? user.lastLogin.toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Role Manager Modal */}
      {showRoleManager && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] border border-[#333] w-full max-w-sm">
            <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Manage Roles</h2>
              <button onClick={() => setShowRoleManager(false)} className="text-gray-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-2">Email Address</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={roleEmail}
                  onChange={(e) => setRoleEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-[#111] border border-[#333] text-sm text-white focus:outline-none focus:border-[#0057B8]"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleSetRole(true)}
                  disabled={roleLoading}
                  className="flex items-center justify-center gap-1.5 py-2 bg-green-600 text-white text-xs font-bold hover:bg-green-700 disabled:opacity-50"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  Grant
                </button>
                <button
                  onClick={() => handleSetRole(false)}
                  disabled={roleLoading}
                  className="flex items-center justify-center gap-1.5 py-2 bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50"
                >
                  <UserX className="w-3.5 h-3.5" />
                  Revoke
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// =============================================================================
// CONTENT TAB
// =============================================================================

const ContentTab = () => (
  <div className="space-y-4">
    {/* User Submissions */}
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="User Submissions" icon={Inbox} />
      <div className="p-4">
        <SubmissionsManagement />
      </div>
    </div>

    {/* Articles Management */}
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Article Management" icon={FileText} />
      <div className="p-4">
        <ArticleManagement />
      </div>
    </div>

    {/* Scores Reference */}
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Scores Reference" icon={Database} />
      <div className="p-4">
        <ScoresSpreadsheet />
      </div>
    </div>
  </div>
);

// =============================================================================
// JOBS TAB
// =============================================================================

const JobsTab = ({ callAdminFunction, seasonData }) => {
  const [loading, setLoading] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [newsDay, setNewsDay] = useState('');

  const jobs = [
    { id: 'calculateCorpsStatistics', name: 'Calculate Corps Statistics', description: 'Recalculate all corps stats from historical data', icon: Database },
    { id: 'archiveSeasonResults', name: 'Archive Season Results', description: 'Archive results and determine champions', icon: Award },
    { id: 'processAndArchiveOffSeasonScores', name: 'Process Off-Season Scores', description: 'Trigger daily off-season score processing', icon: RefreshCw },
    { id: 'processLiveSeasonScores', name: 'Process Live Season Scores', description: 'Trigger daily live season score processing', icon: RefreshCw },
    { id: 'refreshLiveSeasonSchedule', name: 'Refresh Live Schedule', description: 'Scrape DCI events and update schedule', icon: Calendar },
    { id: 'regenerateOffSeasonSchedule', name: 'Regenerate Off-Season Schedule', description: 'Regenerate schedule for current off-season', icon: Calendar },
  ];

  const handleRunJob = async (jobId, jobName) => {
    if (!window.confirm(`Run ${jobName}?`)) return;
    setLoading(jobId);
    try {
      await callAdminFunction('manualTrigger', { jobName: jobId });
    } finally {
      setLoading(null);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail.trim()) return toast.error('Enter an email');
    setLoading('testEmail');
    try {
      await callAdminFunction('sendTestEmail', { email: testEmail.trim() });
      setTestEmail('');
    } finally {
      setLoading(null);
    }
  };

  const handleTriggerNews = async () => {
    const day = parseInt(newsDay, 10);
    if (!day || day < 1 || day > 49) return toast.error('Enter a valid day (1-49)');
    if (!seasonData?.dataDocId || !seasonData?.seasonUid) {
      return toast.error('Season data not available');
    }
    setLoading('newsGen');
    try {
      await triggerDailyNews({
        currentDay: day,
        dataDocId: seasonData.dataDocId,
        seasonId: seasonData.seasonUid
      });
      toast.success(`News generated for Day ${day}`);
      setNewsDay('');
    } catch (error) {
      toast.error(error.message || 'Failed to generate news');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* News Generation - Trigger for specific day */}
      <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
        <SectionHeader title="News Generation" icon={Newspaper} />
        <div className="p-3">
          <p className="text-[11px] text-gray-500 mb-2">
            Generate news articles for a specific day (1-49). Uses current season data.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max="49"
              placeholder="Day #"
              value={newsDay}
              onChange={(e) => setNewsDay(e.target.value)}
              className="w-20 px-3 py-2 bg-[#111] border border-[#333] text-xs text-white font-data tabular-nums focus:outline-none focus:border-[#0057B8]"
            />
            <button
              onClick={handleTriggerNews}
              disabled={loading === 'newsGen' || !newsDay || !seasonData}
              className="flex items-center gap-1.5 h-9 px-3 text-[10px] font-bold uppercase bg-[#0057B8]/10 text-[#0057B8] border border-[#0057B8]/20 hover:bg-[#0057B8] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'newsGen' ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <Newspaper className="w-3 h-3" />
              )}
              {loading === 'newsGen' ? 'Generating...' : 'Generate'}
            </button>
          </div>
        </div>
      </div>

      {/* Test Email - Compact Input Group */}
      <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
        <SectionHeader title="Test Email" icon={Mail} />
        <div className="p-3">
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1 px-3 py-2 bg-[#111] border border-[#333] text-xs text-white focus:outline-none focus:border-[#0057B8]"
            />
            <button
              onClick={handleSendTestEmail}
              disabled={loading === 'testEmail' || !testEmail.trim()}
              className="flex items-center justify-center w-10 h-9 bg-[#0057B8] text-white hover:bg-[#0066d6] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'testEmail' ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Background Jobs Process Table */}
      <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
        <SectionHeader title="Background Processes" icon={Terminal} />
        {jobs.map((job) => (
          <ProcessRow
            key={job.id}
            name={job.name}
            description={job.description}
            icon={job.icon}
            loading={loading === job.id}
            onExecute={() => handleRunJob(job.id, job.name)}
          />
        ))}
      </div>
    </div>
  );
};

// =============================================================================
// MAIN ADMIN COMPONENT
// =============================================================================

const Admin = () => {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [seasonData, setSeasonData] = useState(null);
  const [stats, setStats] = useState({ totalUsers: 0, activeUsers: 0, totalCorps: 0 });

  useEffect(() => {
    const checkAdmin = async () => {
      if (user) {
        const adminStatus = await adminHelpers.isAdmin();
        setIsAdmin(adminStatus);
        if (adminStatus) await loadAdminData();
      }
      setLoading(false);
    };
    checkAdmin();
  }, [user]);

  const loadAdminData = async () => {
    try {
      const seasonDoc = await getDoc(doc(db, 'game-settings/season'));
      if (seasonDoc.exists()) setSeasonData(seasonDoc.data());

      // Use collectionGroup to query all profile documents directly
      const profilesRef = collectionGroup(db, 'profile');
      const snapshot = await getDocs(profilesRef);

      let totalUsers = 0;
      let activeCount = 0, corpsCount = 0;

      for (const profileDoc of snapshot.docs) {
        // Only count profile docs from the marching-art users collection
        if (!profileDoc.ref.path.includes('artifacts/marching-art/users')) continue;

        totalUsers++;
        const data = profileDoc.data();

        // Check activity using lastLogin (Timestamp) or engagement.lastLogin (string)
        let lastLoginDate = null;
        if (data.lastLogin?.toDate) {
          lastLoginDate = data.lastLogin.toDate();
        } else if (data.engagement?.lastLogin) {
          lastLoginDate = new Date(data.engagement.lastLogin);
        }

        if (lastLoginDate) {
          const days = (Date.now() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24);
          if (days <= 7) activeCount++;
        }

        if (data.corps) corpsCount += Object.keys(data.corps).length;
      }
      setStats({ totalUsers, activeUsers: activeCount, totalCorps: corpsCount });
    } catch (error) {
      if (!error.message?.includes('permission')) {
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
      toast.success(result.data.message || 'Operation completed');
      await loadAdminData();
      return result.data;
    } catch (error) {
      toast.error(error.message || `Failed to execute ${functionName}`);
      throw error;
    }
  };

  if (loading) return <LoadingScreen />;

  if (!isAdmin) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#0a0a0a]">
        <div className="w-12 h-12 bg-red-500/20 flex items-center justify-center mb-4">
          <Shield className="w-6 h-6 text-red-500" />
        </div>
        <p className="text-sm font-bold text-white mb-1">ACCESS DENIED</p>
        <p className="text-xs text-gray-500">Administrator privileges required</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0a0a0a]">
      {/* Page Header */}
      <div className="bg-[#1a1a1a] border-b border-[#333] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-yellow-500/20 flex items-center justify-center">
            <Shield className="w-4 h-4 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">System Administration</h1>
            <p className="text-[10px] text-gray-500">Ops Console</p>
          </div>
        </div>
      </div>

      {/* Telemetry Strip */}
      <TelemetryStrip stats={stats} />

      {/* Navigation Tabs */}
      <NavTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto min-h-0 pb-20 md:pb-4">
        <div className="p-3 md:p-4">
          {activeTab === 'overview' && <OverviewTab seasonData={seasonData} />}
          {activeTab === 'season' && <SeasonOpsTab callAdminFunction={callAdminFunction} />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'content' && <ContentTab />}
          {activeTab === 'jobs' && <JobsTab callAdminFunction={callAdminFunction} seasonData={seasonData} />}
        </div>
      </div>
    </div>
  );
};

export default Admin;
