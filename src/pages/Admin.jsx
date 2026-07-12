// src/pages/Admin.jsx
// =============================================================================
// ADMIN PANEL - SYSTEM OPS TERMINAL
// =============================================================================
// Dense, technical "Ops Console" aesthetic. Developer tools feel.
// Laws: App Shell, Telemetry Strip, Process Tables, no glow

import React, { useState, useEffect } from 'react';
import {
  Shield,
  Database,
  Calendar,
  Play,
  FileText,
  AlertTriangle,
  Inbox,
  MessageSquare,
} from 'lucide-react';
import { adminHelpers } from '../api';
import { getSeasonSettings, getAdminOverviewStats } from '../api/admin';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, setDoc, collection, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../api';
import { useSeasonStore } from '../store/seasonStore';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { usePodiumEnabled } from '../hooks/useFeatures';
import {
  ScoresSpreadsheet,
  ArticleManagement,
  SubmissionsManagement,
  CommentsModeration,
  CorpsValuesEditor,
} from '../components/Admin';
import LoadingScreen from '../components/LoadingScreen';
import {
  TelemetryStrip,
  NavTabs,
  ProcessRow,
  SectionHeader,
  InfoRow,
} from '../components/Admin/AdminUI';
import UsersTab from '../components/Admin/UsersTab';
import JobsTab from '../components/Admin/JobsTab';
import LiveScoresTab from '../components/Admin/LiveScoresTab';

// =============================================================================
// TELEMETRY STRIP
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
        <div className="p-4 text-sm text-muted">No active season found</div>
      )}
    </div>
  </div>
);

// =============================================================================
// SEASON OPS TAB
// =============================================================================

// Podium Class launch control (Phase 8): the runtime flag lives in
// game-settings/features.podiumClass (admin-writable by rules; a missing
// field means OFF). Flipping it here opens/closes the class instantly — no
// deploy. The class-registry `enabled` flag (leagues/economy inclusion) is a
// code change and stays out of this panel by design.
const PodiumLaunchCard = () => {
  const podiumEnabled = usePodiumEnabled();
  const [saving, setSaving] = useState(false);

  const toggle = async () => {
    const next = !podiumEnabled;
    if (
      !window.confirm(
        next
          ? 'Enable Podium Class for ALL users?\n\nThe Podium tab, hosting card, and Scores tab appear immediately; the nightly stage begins processing.'
          : 'Disable Podium Class?\n\nThe UI hides and the nightly stage stops. All state is preserved — flipping back on resumes where it left off.'
      )
    )
      return;
    setSaving(true);
    try {
      await setDoc(doc(db, 'game-settings', 'features'), { podiumClass: next }, { merge: true });
      toast.success(next ? 'Podium Class is LIVE.' : 'Podium Class disabled.');
    } catch (error) {
      toast.error(error.message || 'Failed to update the feature flag');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Podium Class Launch" icon={Play} />
      <div className="px-4 py-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${podiumEnabled ? 'bg-green-500' : 'bg-gray-600'}`}
            />
            <span className="text-xs font-bold text-white">
              game-settings/features.podiumClass ={' '}
              <span className={podiumEnabled ? 'text-green-400' : 'text-gray-400'}>
                {String(podiumEnabled)}
              </span>
            </span>
          </div>
          <p className="text-[11px] text-muted mt-1">
            Runtime flag — gates every Podium surface and the nightly stage. Beta tuning lives in
            podium-config/balance (read at runtime; missing doc = committed defaults). Use the Jobs
            tab&apos;s “Run Podium Stage” to process a day on demand.
          </p>
        </div>
        <button
          onClick={toggle}
          disabled={saving}
          className={`flex-shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider rounded-none disabled:opacity-50 ${
            podiumEnabled ? 'bg-[#333] text-gray-300' : 'bg-green-600 text-white'
          }`}
        >
          {saving ? 'Saving…' : podiumEnabled ? 'Disable' : 'Enable'}
        </button>
      </div>
    </div>
  );
};

// Podium funnel telemetry (Phase 8.2): D1/D7 return, blocks-per-active-day,
// rest-day usage, show-pick coverage — written nightly by the Podium stage
// to podium-metrics/{seasonUid}/days/{calendarDay} (admin-read only).
const PodiumFunnelCard = () => {
  const seasonUid = useSeasonStore((state) => state.seasonUid);
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!seasonUid) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const snapshot = await getDocs(
          query(
            collection(db, 'podium-metrics', seasonUid, 'days'),
            orderBy('calendarDay', 'desc'),
            limit(14)
          )
        );
        if (!cancelled) setRows(snapshot.docs.map((d) => d.data()).reverse());
      } catch {
        if (!cancelled) setRows([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonUid]);

  if (!rows || rows.length === 0) return null;

  const pct = (v) => (v == null ? '—' : `${Math.round(v * 100)}%`);
  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Podium Funnel (last 14 days)" icon={Play} />
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] tabular-nums">
          <thead>
            <tr className="text-muted uppercase text-left">
              <th className="px-3 py-1.5">Day</th>
              <th className="px-2 py-1.5">Corps</th>
              <th className="px-2 py-1.5">Played</th>
              <th className="px-2 py-1.5">Rested</th>
              <th className="px-2 py-1.5">Blocks/active</th>
              <th className="px-2 py-1.5">Pick coverage</th>
              <th className="px-2 py-1.5">D1 return</th>
              <th className="px-2 py-1.5">D7 return</th>
            </tr>
          </thead>
          <tbody className="text-gray-300">
            {rows.map((row) => (
              <tr key={row.calendarDay} className="border-t border-[#242424]">
                <td className="px-3 py-1">
                  {row.competitionDay >= 1 ? `D${row.competitionDay}` : `ST${row.calendarDay}`}
                </td>
                <td className="px-2 py-1">{row.corps}</td>
                <td className="px-2 py-1">{row.activeSelf}</td>
                <td className="px-2 py-1">{row.restDays}</td>
                <td className="px-2 py-1">{row.blocksPerActiveCorps}</td>
                <td className="px-2 py-1">{pct(row.pickCoverage)}</td>
                <td className="px-2 py-1">
                  {pct(row.d1ReturnRate)}
                  {row.d1Cohort ? ` (${row.d1Cohort})` : ''}
                </td>
                <td className="px-2 py-1">
                  {pct(row.d7ReturnRate)}
                  {row.d7Cohort ? ` (${row.d7Cohort})` : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

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
    <div className="space-y-4">
      <PodiumLaunchCard />
      <PodiumFunnelCard />
      <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
        <SectionHeader title="Season Operations" icon={Calendar} />
        <div className="px-4 py-3 border-b border-[#333] bg-[#111]">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-yellow-500/80">
              Starting a new season will archive all current user corps data and reset the game
              state.
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

    {/* Comments Moderation */}
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Comments Moderation" icon={MessageSquare} />
      <div className="p-4">
        <CommentsModeration />
      </div>
    </div>

    {/* Articles Management */}
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Article Management" icon={FileText} />
      <div className="p-4">
        <ArticleManagement />
      </div>
    </div>

    {/* Corps Point Values Editor */}
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Corps Point Values" icon={Database} />
      <div className="p-4">
        <CorpsValuesEditor />
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
      const season = await getSeasonSettings();
      if (season) setSeasonData(season);

      // Use collectionGroup to query all profile documents directly
      setStats(await getAdminOverviewStats());
    } catch (error) {
      if (!error.message?.includes('permission')) {
        console.error('Error loading admin data:', error);
        toast.error('Failed to load admin data');
      }
    }
  };

  const callAdminFunction = async (functionName, data = {}) => {
    try {
      // Generic admin job runner: the function name is chosen at runtime, so
      // this stays on a raw callable rather than a static api/functions export.
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
        <p className="text-xs text-muted">Administrator privileges required</p>
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
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">
              System Administration
            </h1>
            <p className="text-[10px] text-muted">Ops Console</p>
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
          {activeTab === 'livescores' && <LiveScoresTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'content' && <ContentTab />}
          {activeTab === 'jobs' && (
            <JobsTab callAdminFunction={callAdminFunction} seasonData={seasonData} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
