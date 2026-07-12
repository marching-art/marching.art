// Admin > Live Scores tab. Extracted from pages/Admin.jsx.

import { useState } from 'react';
import { Activity, AlertTriangle, Calendar, Database, RefreshCw } from 'lucide-react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import toast from 'react-hot-toast';
import {
  discoverAndQueueUrls,
  discoverAndQueueEventUrls,
  buildLearnedSchedules,
  getScheduleCoverage,
} from '../../api/functions';
import { SectionHeader } from './AdminUI';
import LiveScoresVerification from './LiveScoresVerification';

const DeepScrapeCard = () => {
  const [loading, setLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [learnedLoading, setLearnedLoading] = useState(false);

  const handleBuildLearnedSchedules = async () => {
    if (
      !window.confirm(
        'Build LEARNED schedules for all archived events?\n\n' +
          'Synthesizes a DCI-style running order + performance times for every archived ' +
          "scored event (from each event's real corps + scores) and writes them into " +
          'historical_schedules. Real scraped running orders (2019+) are always kept — ' +
          'learned ones only fill years/events that have none.\n\n' +
          'Idempotent; safe to re-run (a rebuild adopts the latest model).'
      )
    )
      return;
    setLearnedLoading(true);
    try {
      const result = await buildLearnedSchedules();
      const data = result.data || {};
      toast.success(data.message || 'Learned schedules built.');
    } catch (error) {
      toast.error(error.message || 'Failed to build learned schedules');
    } finally {
      setLearnedLoading(false);
    }
  };

  const handleDeepScrapeSchedules = async () => {
    if (
      !window.confirm(
        'Start a DEEP SCRAPE of all DCI schedules?\n\n' +
          'This reads dci.org/events (every event, 2019-present) and archives each ' +
          'running order + performance times into historical_schedules. It runs in the ' +
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
      <div className="bg-surface-card border border-line overflow-hidden">
        <SectionHeader title="Deep Scrape — Full DCI History" icon={Database} />
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-muted leading-relaxed">
            Backfill the entire scores database from dci.org —{' '}
            <span className="text-secondary">all events across all years</span>. Use this to fill in
            missing caption scores and events. The scrape runs asynchronously in the background
            (watch the function logs for progress) and is{' '}
            <span className="text-secondary">100% format-compatible</span> with the existing
            database: it appends missing corps and fills only blank/zero captions — it never
            overwrites existing values.
          </p>
          <div className="flex items-start gap-2 px-3 py-2 bg-surface-sunken border border-line">
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-yellow-500/80">
              Heavy, long-running job. It paginates all of dci.org's score history, so it may take a
              while and generate many background invocations. Safe to re-run; runs are idempotent.
            </p>
          </div>
          <button
            onClick={handleDeepScrape}
            disabled={loading}
            className="flex items-center gap-1.5 h-9 px-3 text-[10px] font-bold uppercase bg-interactive/10 text-interactive border border-interactive/30 hover:bg-interactive hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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

      <div className="bg-surface-card border border-line overflow-hidden">
        <SectionHeader title="Deep Scrape — Schedules & Performance Times" icon={Calendar} />
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-muted leading-relaxed">
            Backfill the schedule archive from dci.org —{' '}
            <span className="text-secondary">every event's running order + performance times</span>,{' '}
            all years (2019-present; earlier years aren't published). This fills{' '}
            <span className="text-secondary">historical_schedules</span>, the companion to
            historical_scores, joinable to scores by event name + date. The scrape runs in the
            background and appends missing events and lineup entries while filling only blank timing
            fields — it never overwrites existing values. Running it also seeds the{' '}
            <span className="text-secondary">current year in full</span> (past + upcoming shows).
          </p>
          <div className="flex items-start gap-2 px-3 py-2 bg-surface-sunken border border-line">
            <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-yellow-500/80">
              Heavy, long-running job — ~1,100 event pages across all years. Safe to re-run; runs
              are idempotent.
            </p>
          </div>
          <button
            onClick={handleDeepScrapeSchedules}
            disabled={scheduleLoading}
            className="flex items-center gap-1.5 h-9 px-3 text-[10px] font-bold uppercase bg-interactive/10 text-interactive border border-interactive/30 hover:bg-interactive hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {scheduleLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Calendar className="w-3.5 h-3.5" />
            )}
            {scheduleLoading ? 'Starting…' : 'Start Schedule Scrape (All Years)'}
          </button>
          <div className="pt-2 border-t border-line">
            <p className="text-[11px] text-muted leading-relaxed mb-2">
              After the scrape, synthesize running orders for the years dci.org never published
              (pre-2019) from each event's real corps + scores. Writes{' '}
              <span className="text-secondary">learned</span> entries into historical_schedules;
              real scraped orders are always kept.
            </p>
            <button
              onClick={handleBuildLearnedSchedules}
              disabled={learnedLoading}
              className="flex items-center gap-1.5 h-9 px-3 text-[10px] font-bold uppercase bg-interactive/10 text-interactive border border-interactive/30 hover:bg-interactive hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {learnedLoading ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Calendar className="w-3.5 h-3.5" />
              )}
              {learnedLoading ? 'Building…' : 'Build Learned Schedules (All Years)'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const ScheduleCoverageCard = () => {
  const [loading, setLoading] = useState(false);
  const [flagBusy, setFlagBusy] = useState(false);
  const [report, setReport] = useState(null);

  const runReport = async () => {
    setLoading(true);
    try {
      const result = await getScheduleCoverage();
      setReport(result.data || null);
    } catch (error) {
      toast.error(error.message || 'Failed to load coverage');
    } finally {
      setLoading(false);
    }
  };

  const setFlag = async (enabled) => {
    if (
      !window.confirm(
        `${enabled ? 'Enable' : 'Disable'} heritage schedules for future off-seasons?`
      )
    )
      return;
    setFlagBusy(true);
    try {
      const fn = httpsCallable(getFunctions(), 'manualTrigger');
      const res = await fn({ jobName: 'setHeritageSchedules', enabled });
      toast.success(res.data?.message || 'Updated');
    } catch (error) {
      toast.error(error.message || 'Failed to set flag');
    } finally {
      setFlagBusy(false);
    }
  };

  const t = report?.totals;
  return (
    <div className="bg-surface-card border border-line overflow-hidden">
      <SectionHeader title="Schedule Coverage — August Readiness" icon={Activity} />
      <div className="p-4 space-y-3">
        <p className="text-[11px] text-muted leading-relaxed">
          Per-year running-order coverage across historical_schedules: how many expected events have
          a real (scraped) or synthesized (learned) running order, what's still missing, any all-age
          leakage, the Finals-Saturday disambiguation, and the current pool's unmapped corps. Run
          after the scrape + learned build, before starting the off-season.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={runReport}
            disabled={loading}
            className="flex items-center gap-1.5 h-9 px-3 text-[10px] font-bold uppercase bg-interactive/10 text-interactive border border-interactive/30 hover:bg-interactive hover:text-white disabled:opacity-50 transition-colors"
          >
            {loading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Activity className="w-3.5 h-3.5" />
            )}
            {loading ? 'Checking…' : 'Check Coverage'}
          </button>
          <button
            onClick={() => setFlag(true)}
            disabled={flagBusy}
            className="h-9 px-3 text-[10px] font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500 hover:text-white disabled:opacity-50 transition-colors"
          >
            Enable Heritage
          </button>
          <button
            onClick={() => setFlag(false)}
            disabled={flagBusy}
            className="h-9 px-3 text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white disabled:opacity-50 transition-colors"
          >
            Disable (Rollback)
          </button>
        </div>

        {report && (
          <div className="space-y-3">
            {t && (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-[10px] uppercase tracking-wider">
                {[
                  ['Expected', t.expected, 'text-white'],
                  ['Matched', t.matched, 'text-green-400'],
                  ['Missing', t.missing, t.missing > 0 ? 'text-yellow-500' : 'text-muted'],
                  ['Scraped', t.scraped, 'text-white'],
                  ['Learned', t.learned, 'text-white'],
                  ['All-Age Leak', t.allAgeLeak, t.allAgeLeak > 0 ? 'text-red-400' : 'text-muted'],
                ].map(([label, val, cls]) => (
                  <div key={label} className="bg-surface-sunken border border-line p-2">
                    <div className="text-muted">{label}</div>
                    <div className={`text-sm font-data tabular-nums ${cls}`}>{val}</div>
                  </div>
                ))}
              </div>
            )}

            {report.pool?.unmapped?.length > 0 && (
              <div className="bg-surface-sunken border border-red-500/30 p-3">
                <div className="text-[10px] uppercase tracking-wider text-red-400 mb-1">
                  Pool corps with no matching results ({report.pool.unmapped.length}) — likely
                  name-map gaps
                </div>
                <div className="text-[11px] text-muted">{report.pool.unmapped.join(', ')}</div>
              </div>
            )}

            <div className="max-h-72 overflow-y-auto border-t border-line pt-2">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted text-left">
                    {['Year', 'Expected', 'Matched', 'Missing', 'Scraped', 'Learned', 'Finals'].map(
                      (h) => (
                        <th key={h} className="font-normal pb-1 pr-2">
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="text-secondary font-data tabular-nums">
                  {(report.years || []).map((r) => (
                    <tr key={r.year} className="border-t border-line-subtle">
                      <td className="py-1 pr-2">{r.year}</td>
                      <td className="py-1 pr-2">{r.expected}</td>
                      <td className="py-1 pr-2 text-green-400">{r.matched}</td>
                      <td className={`py-1 pr-2 ${r.missingCount > 0 ? 'text-yellow-500' : ''}`}>
                        {r.missingCount}
                      </td>
                      <td className="py-1 pr-2">{r.scraped}</td>
                      <td className="py-1 pr-2">{r.learned}</td>
                      <td className={`py-1 pr-2 ${r.finalsOk ? 'text-muted' : 'text-red-400'}`}>
                        {r.finalsOk ? 'ok' : 'LEAK'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const LiveScoresTab = () => (
  <div className="space-y-4">
    <div className="bg-surface-card border border-line overflow-hidden">
      <SectionHeader title="Live Season Score Verification" icon={Activity} />
      <div className="px-4 py-3 border-b border-line bg-surface-sunken">
        <p className="text-[11px] text-muted leading-relaxed">
          The Scores Reference (Content tab) shows the prior-year selectable corps. This view shows
          the
          <span className="text-secondary"> current DCI season's scraped scores</span> — the data
          the game actually scores live lineups against — so you can confirm the daily scrape is
          correct, each event maps to the right competition day, and recaps are generated.
        </p>
      </div>
      <div className="p-4">
        <LiveScoresVerification />
      </div>
    </div>

    <DeepScrapeCard />

    <ScheduleCoverageCard />
  </div>
);

export default LiveScoresTab;
