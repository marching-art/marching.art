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
  RefreshCw,
  FileText,
  Activity,
  AlertTriangle,
  Inbox,
  MessageSquare,
} from 'lucide-react';
import { adminHelpers } from '../api';
import { getSeasonSettings, getAdminOverviewStats } from '../api/admin';
import { discoverAndQueueUrls, discoverAndQueueEventUrls } from '../api/functions';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import {
  ScoresSpreadsheet,
  ArticleManagement,
  SubmissionsManagement,
  CommentsModeration,
  CorpsValuesEditor,
  LiveScoresVerification,
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

const DeepScrapeCard = () => {
  const [loading, setLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  const handleDeepScrapeSchedules = async () => {
    if (
      !window.confirm(
        'Start a DEEP SCRAPE of all DCI schedules?\n\n' +
          'This reads dci.org/events (every event, 2019-present) and archives each ' +
          "running order + performance times into historical_schedules. It runs in the " +
          'background and can take a while.\n\n' +
          'Safe and idempotent: missing events and lineup entries are filled in, existing ' +
          'values are NEVER overwritten. Running it also seeds the current year in full.'
      )
    )
      return;
    setScheduleLoading(true);
    try {
      const result = await discoverAndQueueEventUrls();
      const data = result.data || {};
      if (data.success === false) {
        toast.error(data.message || 'Schedule deep scrape found nothing to queue.');
      } else {
        toast.success(data.message || 'Schedule deep scrape started.');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to start schedule deep scrape');
    } finally {
      setScheduleLoading(false);
    }
  };

  const handleDeepScrape = async () => {
    if (
      !window.confirm(
        'Start a DEEP SCRAPE of all DCI scores?\n\n' +
          'This walks every page of dci.org/scores (all events, all years) and ' +
          'archives each recap into historical_scores. It runs in the background and ' +
          'can take a long time.\n\n' +
          'It is safe and idempotent: missing corps/caption scores are filled in, but ' +
          'existing values are NEVER overwritten.'
      )
    )
      return;
    setLoading(true);
    try {
      const result = await discoverAndQueueUrls();
      const data = result.data || {};
      if (data.success === false) {
        toast.error(data.message || 'Deep scrape found nothing to queue.');
      } else {
        toast.success(data.message || 'Deep scrape started.');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to start deep scrape');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Deep Scrape — Full DCI History" icon={Database} />
      <div className="p-4 space-y-3">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Backfill the entire scores database from dci.org —{' '}
          <span className="text-gray-300">all events across all years</span>. Use this to fill in
          missing caption scores and events. The scrape runs asynchronously in the background (watch
          the function logs for progress) and is{' '}
          <span className="text-gray-300">100% format-compatible</span> with the existing database:
          it appends missing corps and fills only blank/zero captions — it never overwrites existing
          values.
        </p>
        <div className="flex items-start gap-2 px-3 py-2 bg-[#111] border border-[#333]">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-yellow-500/80">
            Heavy, long-running job. It paginates all of dci.org's score history, so it may take a
            while and generate many background invocations. Safe to re-run; runs are idempotent.
          </p>
        </div>
        <button
          onClick={handleDeepScrape}
          disabled={loading}
          className="flex items-center gap-1.5 h-9 px-3 text-[10px] font-bold uppercase bg-[#0057B8]/10 text-[#0057B8] border border-[#0057B8]/30 hover:bg-[#0057B8] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Database className="w-3.5 h-3.5" />
          )}
          {loading ? 'Starting…' : 'Start Deep Scrape (All Years)'}
        </button>
      </div>
    </div>

    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Deep Scrape — Schedules & Performance Times" icon={Calendar} />
      <div className="p-4 space-y-3">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          Backfill the schedule archive from dci.org —{' '}
          <span className="text-gray-300">every event's running order + performance times</span>,{' '}
          all years (2019-present; earlier years aren't published). This fills{' '}
          <span className="text-gray-300">historical_schedules</span>, the companion to
          historical_scores, joinable to scores by event name + date. The scrape runs in the
          background and appends missing events and lineup entries while filling only blank timing
          fields — it never overwrites existing values. Running it also seeds the{' '}
          <span className="text-gray-300">current year in full</span> (past + upcoming shows).
        </p>
        <div className="flex items-start gap-2 px-3 py-2 bg-[#111] border border-[#333]">
          <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-yellow-500/80">
            Heavy, long-running job — ~1,100 event pages across all years. Safe to re-run; runs are
            idempotent.
          </p>
        </div>
        <button
          onClick={handleDeepScrapeSchedules}
          disabled={scheduleLoading}
          className="flex items-center gap-1.5 h-9 px-3 text-[10px] font-bold uppercase bg-[#0057B8]/10 text-[#0057B8] border border-[#0057B8]/30 hover:bg-[#0057B8] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {scheduleLoading ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Calendar className="w-3.5 h-3.5" />
          )}
          {scheduleLoading ? 'Starting…' : 'Start Schedule Scrape (All Years)'}
        </button>
      </div>
    </div>
    </>
  );
};

const LiveScoresTab = () => (
  <div className="space-y-4">
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Live Season Score Verification" icon={Activity} />
      <div className="px-4 py-3 border-b border-[#333] bg-[#111]">
        <p className="text-[11px] text-gray-500 leading-relaxed">
          The Scores Reference (Content tab) shows the prior-year selectable corps. This view shows
          the
          <span className="text-gray-300"> current DCI season's scraped scores</span> — the data the
          game actually scores live lineups against — so you can confirm the daily scrape is
          correct, each event maps to the right competition day, and recaps are generated.
        </p>
      </div>
      <div className="p-4">
        <LiveScoresVerification />
      </div>
    </div>

    <DeepScrapeCard />
  </div>
);

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
            <h1 className="text-sm font-bold text-white uppercase tracking-wider">
              System Administration
            </h1>
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
