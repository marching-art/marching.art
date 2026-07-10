// Admin > Jobs tab. Extracted from pages/Admin.jsx.

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../api';
import { triggerDailyNews, triggerSeasonSummary } from '../../api/functions';
import {
  AlertTriangle,
  Award,
  BookOpen,
  Calendar,
  Coins,
  Database,
  Mail,
  Newspaper,
  RefreshCw,
  Search,
  Send,
  Terminal,
} from 'lucide-react';
import { SectionHeader, ProcessRow } from './AdminUI';

// Mint-vs-sink readout — the one dashboard the closed-loop economy needs
// (written weekly by economyStatsJob; refresh on demand with the job below).
const EconomyStatsPanel = ({ refreshKey }) => {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    getDoc(doc(db, 'admin-stats/economy'))
      .then((snap) => setStats(snap.exists() ? snap.data() : null))
      .catch(() => setStats(null));
  }, [refreshKey]);

  const types = Object.entries(stats?.byType || {}).sort(
    (a, b) => Math.abs(b[1].amount) - Math.abs(a[1].amount)
  );
  const computedAt = stats?.computedAt?.toDate?.();

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <SectionHeader title="Economy — Mint vs Sink" icon={Coins} />
      <div className="p-3">
        {!stats ? (
          <p className="text-[11px] text-gray-500">
            No stats yet — run “Refresh Economy Stats” below (also runs automatically every Monday).
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <div className="bg-[#111] border border-[#333] p-2 text-center">
                <p className="text-[9px] uppercase tracking-wider text-gray-500">Minted</p>
                <p className="text-sm font-bold text-green-500 font-data tabular-nums">
                  +{(stats.minted || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-[#111] border border-[#333] p-2 text-center">
                <p className="text-[9px] uppercase tracking-wider text-gray-500">Sunk</p>
                <p className="text-sm font-bold text-red-500 font-data tabular-nums">
                  −{(stats.sunk || 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-[#111] border border-[#333] p-2 text-center">
                <p className="text-[9px] uppercase tracking-wider text-gray-500">Net</p>
                <p
                  className={`text-sm font-bold font-data tabular-nums ${
                    (stats.net || 0) > 0 ? 'text-yellow-500' : 'text-emerald-400'
                  }`}
                >
                  {(stats.net || 0) > 0 ? '+' : ''}
                  {(stats.net || 0).toLocaleString()}
                </p>
              </div>
            </div>
            <div className="space-y-0.5">
              {types.map(([type, t]) => (
                <div key={type} className="flex items-center justify-between text-[11px]">
                  <span className="text-gray-400 font-mono">{type}</span>
                  <span
                    className={`font-data tabular-nums ${t.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}
                  >
                    {t.amount >= 0 ? '+' : ''}
                    {t.amount.toLocaleString()} CC
                    <span className="text-gray-600"> · {t.count}×</span>
                  </span>
                </div>
              ))}
            </div>
            <p className="text-[9px] text-gray-600 mt-2">
              Trailing {stats.windowDays}d · {stats.transactions?.toLocaleString()} transactions ·{' '}
              {stats.activeWallets?.toLocaleString()} active wallets
              {computedAt ? ` · computed ${computedAt.toLocaleString()}` : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

const JobsTab = ({ callAdminFunction, seasonData }) => {
  const [loading, setLoading] = useState(null);
  const [testEmail, setTestEmail] = useState('');
  const [newsDay, setNewsDay] = useState('');
  const [summaryDay, setSummaryDay] = useState('');
  const [sweepResult, setSweepResult] = useState(null);
  const [statsRefresh, setStatsRefresh] = useState(0);

  const jobs = [
    {
      id: 'calculateCorpsStatistics',
      name: 'Calculate Corps Statistics',
      description: 'Recalculate all corps stats from historical data',
      icon: Database,
    },
    {
      id: 'archiveSeasonResults',
      name: 'Archive Season Results',
      description: 'Archive results and determine champions',
      icon: Award,
    },
    {
      id: 'processAndArchiveOffSeasonScores',
      name: 'Process Off-Season Scores',
      description: 'Trigger daily off-season score processing',
      icon: RefreshCw,
    },
    {
      id: 'processLiveSeasonScores',
      name: 'Process Live Season Scores',
      description: 'Trigger daily live season score processing',
      icon: RefreshCw,
    },
    {
      id: 'refreshLiveSeasonSchedule',
      name: 'Refresh Live Schedule',
      description: 'Scrape DCI events and update schedule',
      icon: Calendar,
    },
    {
      id: 'regenerateOffSeasonSchedule',
      name: 'Regenerate Off-Season Schedule',
      description: 'Regenerate schedule for current off-season',
      icon: Calendar,
    },
    {
      id: 'updateEconomyStats',
      name: 'Refresh Economy Stats',
      description: 'Recompute the mint-vs-sink aggregates above (also runs weekly)',
      icon: Coins,
    },
    {
      id: 'processPodiumStage',
      name: 'Run Podium Stage',
      description:
        'Run the nightly Podium Class stage now (flag-gated; lease-guarded, so a completed day is skipped)',
      icon: RefreshCw,
    },
    {
      id: 'rebuildGameRecords',
      name: 'Rebuild Records Book',
      description:
        'Rebuild all-time records (/records) from every archived recap — run once after the Records Book ships, then only after data fixes',
      icon: BookOpen,
    },
    {
      id: 'auditShowSelections',
      name: 'Audit Show Selections (Dry Run)',
      description:
        "Report directors' selections that no longer match the schedule — changes nothing",
      icon: Search,
    },
    {
      id: 'repairShowSelections',
      name: 'Repair Show Selections',
      description:
        'Re-match selections to the schedule: rename/move stale entries, remove dead ones to free slots',
      icon: RefreshCw,
    },
  ];

  const handleRunJob = async (jobId, jobName) => {
    if (!window.confirm(`Run ${jobName}?`)) return;
    setLoading(jobId);
    try {
      await callAdminFunction('manualTrigger', { jobName: jobId });
      if (jobId === 'updateEconomyStats') setStatsRefresh((n) => n + 1);
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

  const handleSweepDuplicates = async () => {
    if (
      !window.confirm(
        'Run duplicate corps sweep?\n\nThis scans every active corps, flags any that share a name with a higher-priority corps, and forces those directors into a rename modal on next dashboard load.'
      )
    )
      return;
    setLoading('sweepDuplicates');
    setSweepResult(null);
    try {
      const data = await callAdminFunction('sweepDuplicateCorps', {});
      setSweepResult(data);
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
        seasonId: seasonData.seasonUid,
      });
      toast.success(`News generated for Day ${day}`);
      setNewsDay('');
    } catch (error) {
      toast.error(error.message || 'Failed to generate news');
    } finally {
      setLoading(null);
    }
  };

  const handleTriggerSeasonSummary = async () => {
    const day = parseInt(summaryDay, 10);
    if (!day || day < 15 || day > 49) return toast.error('Enter a valid day (15-49)');
    if (!seasonData?.seasonUid) {
      return toast.error('Season data not available');
    }
    setLoading('seasonSummary');
    try {
      const result = await triggerSeasonSummary({
        seasonId: seasonData.seasonUid,
        dataDocId: seasonData.dataDocId,
        throughDay: day,
      });
      if (result?.data?.success) {
        toast.success(`Season summary generated for Day ${day}`);
        setSummaryDay('');
      } else {
        toast.error(result?.data?.error || 'Not enough season data for that day');
      }
    } catch (error) {
      toast.error(error.message || 'Failed to generate season summary');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Economy instrumentation — read before touching prices */}
      <EconomyStatsPanel refreshKey={statsRefresh} />

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

      {/* Season Summary (Article 6) - manual generate/backfill for a dark day */}
      <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
        <SectionHeader title="Season Summary Article" icon={BookOpen} />
        <div className="p-3">
          <p className="text-[11px] text-gray-500 mb-2">
            Generate the season-to-date summary (Article 6) for a day (15-49). Auto-publishes on
            dark days; use this to backfill a day already scored or to test.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min="15"
              max="49"
              placeholder="Day #"
              value={summaryDay}
              onChange={(e) => setSummaryDay(e.target.value)}
              className="w-20 px-3 py-2 bg-[#111] border border-[#333] text-xs text-white font-data tabular-nums focus:outline-none focus:border-[#0057B8]"
            />
            <button
              onClick={handleTriggerSeasonSummary}
              disabled={loading === 'seasonSummary' || !summaryDay || !seasonData}
              className="flex items-center gap-1.5 h-9 px-3 text-[10px] font-bold uppercase bg-[#0057B8]/10 text-[#0057B8] border border-[#0057B8]/20 hover:bg-[#0057B8] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading === 'seasonSummary' ? (
                <RefreshCw className="w-3 h-3 animate-spin" />
              ) : (
                <BookOpen className="w-3 h-3" />
              )}
              {loading === 'seasonSummary' ? 'Generating...' : 'Generate'}
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

      {/* Duplicate Corps Sweep */}
      <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
        <SectionHeader title="Duplicate Corps Sweep" icon={AlertTriangle} />
        <div className="p-3 space-y-3">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Scan every active corps for name collisions. The higher-tier corps wins (World &gt; Open
            &gt; A &gt; SoundSport, ties broken by oldest createdAt). Each loser is flagged so the
            director sees a rename modal on next dashboard load and is hard-blocked from other corps
            actions until they pick a unique name. Idempotent — safe to re-run.
          </p>
          <button
            onClick={handleSweepDuplicates}
            disabled={loading === 'sweepDuplicates'}
            className="flex items-center gap-1.5 h-9 px-3 text-[10px] font-bold uppercase bg-[#0057B8]/10 text-[#0057B8] border border-[#0057B8]/20 hover:bg-[#0057B8] hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading === 'sweepDuplicates' ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Search className="w-3 h-3" />
            )}
            {loading === 'sweepDuplicates' ? 'Scanning…' : 'Run Sweep'}
          </button>
          {sweepResult && (
            <div className="bg-[#111] border border-[#333] p-3 space-y-2">
              <div className="grid grid-cols-4 gap-2 text-[10px] uppercase tracking-wider">
                <div>
                  <div className="text-gray-500">Scanned</div>
                  <div className="text-sm text-white font-data tabular-nums">
                    {sweepResult.scanned}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Flagged</div>
                  <div className="text-sm text-red-400 font-data tabular-nums">
                    {sweepResult.flagged}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Cleared</div>
                  <div className="text-sm text-green-400 font-data tabular-nums">
                    {sweepResult.cleared}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Directors</div>
                  <div className="text-sm text-white font-data tabular-nums">
                    {sweepResult.directorsAffected}
                  </div>
                </div>
              </div>
              {sweepResult.losers?.length > 0 && (
                <div className="border-t border-[#333] pt-2 max-h-64 overflow-y-auto">
                  <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-1">
                    Flagged Corps
                  </div>
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-gray-500 text-left">
                        <th className="font-normal pb-1">Corps</th>
                        <th className="font-normal pb-1">Class</th>
                        <th className="font-normal pb-1">Loses To</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-300">
                      {sweepResult.losers.map((l, idx) => (
                        <tr
                          key={`${l.uid}-${l.corpsClass}-${idx}`}
                          className="border-t border-[#222]"
                        >
                          <td className="py-1 pr-2">{l.corpsName}</td>
                          <td className="py-1 pr-2 text-gray-500">{l.corpsClass}</td>
                          <td className="py-1 text-gray-500">
                            {l.winner.corpsName} ({l.winner.corpsClass})
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
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

export default JobsTab;
