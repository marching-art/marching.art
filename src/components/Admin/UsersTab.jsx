// Admin > Users tab. Extracted from pages/Admin.jsx.

import { useState, useEffect } from 'react';
import { getUserEngagementStats, getAllUserProfiles } from '../../api/admin';
import { fixProfileFields } from '../../api/functions';
import { setUserRole } from '../../api/functions';
import toast from 'react-hot-toast';
import { Flame, Search, Shield, Terminal, UserCheck, UserX, Users, Wrench, X } from 'lucide-react';
import { SectionHeader, ProcessRow } from './AdminUI';

const UsersTab = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    avgLoginStreak: 0,
    totalCorps: 0,
    totalLogins: 0,
  });
  const [users, setUsers] = useState([]);
  const [showUserList, setShowUserList] = useState(false);
  const [showRoleManager, setShowRoleManager] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleEmail, setRoleEmail] = useState('');
  const [roleLoading, setRoleLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [fixingProfiles, setFixingProfiles] = useState(false);

  useEffect(() => {
    loadUserStats();
  }, []);

  const loadUserStats = async () => {
    try {
      // Use collectionGroup to query all profile documents directly
      // This is needed because user documents don't exist at the parent level,
      // only the nested profile/data documents exist
      setStats(await getUserEngagementStats());
    } catch (error) {
      console.error('Error loading user stats:', error);
    }
  };

  const loadAllUsers = async () => {
    setUsersLoading(true);
    try {
      // Profiles are joined with the owner-private `private/data` emails and
      // sorted by last login (most recent first). Admin-only per Firestore rules.
      setUsers(await getAllUserProfiles());
      setShowUserList(true);
    } catch {
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

  const handleFixProfiles = async () => {
    if (
      !window.confirm(
        'Fix missing profile fields for all users? This will add default values for any missing required fields.'
      )
    )
      return;
    setFixingProfiles(true);
    try {
      const result = await fixProfileFields();
      toast.success(result.data.message);
      loadUserStats(); // Refresh stats after fix
    } catch (error) {
      toast.error(error.message || 'Failed to fix profiles');
    } finally {
      setFixingProfiles(false);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.uid.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* User Stats */}
      <div className="bg-surface-card border border-line overflow-hidden">
        <SectionHeader title="User Telemetry" icon={Users} />
        <div className="flex divide-x divide-line">
          <div className="flex-1 p-3">
            <p className="text-[9px] uppercase text-muted mb-1">Total</p>
            <p className="text-xl font-bold text-white font-data tabular-nums">
              {stats.totalUsers}
            </p>
          </div>
          <div className="flex-1 p-3">
            <p className="text-[9px] uppercase text-muted mb-1">Active (7d)</p>
            <p className="text-xl font-bold text-green-500 font-data tabular-nums">
              {stats.activeUsers}
            </p>
          </div>
          <div className="flex-1 p-3">
            <p className="text-[9px] uppercase text-muted mb-1 flex items-center gap-1">
              <Flame className="w-3 h-3" />
              Avg Streak
            </p>
            <p className="text-xl font-bold text-yellow-500 font-data tabular-nums">
              {stats.avgLoginStreak}d
            </p>
          </div>
          <div className="flex-1 p-3">
            <p className="text-[9px] uppercase text-muted mb-1">Corps</p>
            <p className="text-xl font-bold text-interactive font-data tabular-nums">
              {stats.totalCorps}
            </p>
          </div>
        </div>
        <div className="flex divide-x divide-line border-t border-line">
          <div className="flex-1 p-3">
            <p className="text-[9px] uppercase text-muted mb-1">Total Logins</p>
            <p className="text-lg font-bold text-secondary font-data tabular-nums">
              {stats.totalLogins.toLocaleString()}
            </p>
          </div>
          <div className="flex-1 p-3">
            <p className="text-[9px] uppercase text-muted mb-1">Engagement</p>
            <p className="text-lg font-bold text-secondary font-data tabular-nums">
              {stats.totalUsers > 0 ? Math.round((stats.activeUsers / stats.totalUsers) * 100) : 0}%
            </p>
          </div>
        </div>
      </div>

      {/* User Operations */}
      <div className="bg-surface-card border border-line overflow-hidden">
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
        <ProcessRow
          name="Fix Profile Fields"
          description="Add missing required fields to all user profiles"
          icon={Wrench}
          loading={fixingProfiles}
          onExecute={handleFixProfiles}
        />
      </div>

      {/* User List Modal */}
      {showUserList && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-surface-card border border-line w-full max-w-4xl max-h-[80dvh] flex flex-col">
            <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted">
                All Users ({users.length})
              </h2>
              <button
                onClick={() => setShowUserList(false)}
                className="text-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 border-b border-line">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-surface-sunken border border-line text-xs text-white focus:outline-none focus:border-interactive"
                />
              </div>
            </div>
            <div className="flex-1 overflow-auto">
              <table className="w-full">
                <thead className="bg-surface-raised sticky top-0">
                  <tr>
                    <th className="text-left px-4 py-2 text-[10px] text-muted uppercase">User</th>
                    <th className="text-left px-4 py-2 text-[10px] text-muted uppercase">Lvl</th>
                    <th className="text-left px-4 py-2 text-[10px] text-muted uppercase">Streak</th>
                    <th className="text-left px-4 py-2 text-[10px] text-muted uppercase">Logins</th>
                    <th className="text-left px-4 py-2 text-[10px] text-muted uppercase">Corps</th>
                    <th className="text-left px-4 py-2 text-[10px] text-muted uppercase">
                      Last Login
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filteredUsers.map((user) => (
                    <tr key={user.uid} className="hover:bg-surface-sunken">
                      <td className="px-4 py-2.5">
                        <p className="text-sm text-white">{user.username}</p>
                        <p className="text-[10px] text-muted font-data">
                          {user.uid.slice(0, 12)}...
                        </p>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-white font-data">{user.xpLevel}</td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`text-sm font-data ${user.loginStreak >= 7 ? 'text-yellow-500' : user.loginStreak >= 3 ? 'text-green-500' : 'text-muted'}`}
                        >
                          {user.loginStreak > 0 ? `${user.loginStreak}d` : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted font-data">
                        {user.totalLogins || 0}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted">{user.corps.length}</td>
                      <td className="px-4 py-2.5 text-xs text-muted">
                        {user.lastLogin && !isNaN(user.lastLogin.getTime())
                          ? user.lastLogin.toLocaleDateString()
                          : '—'}
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
          <div className="bg-surface-card border border-line w-full max-w-sm">
            <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
              <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted">
                Manage Roles
              </h2>
              <button
                onClick={() => setShowRoleManager(false)}
                className="text-muted hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[10px] text-muted uppercase mb-2">Email Address</label>
                <input
                  type="email"
                  placeholder="user@example.com"
                  value={roleEmail}
                  onChange={(e) => setRoleEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-surface-sunken border border-line text-sm text-white focus:outline-none focus:border-interactive"
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
// LIVE SCORES TAB
// =============================================================================

export default UsersTab;
