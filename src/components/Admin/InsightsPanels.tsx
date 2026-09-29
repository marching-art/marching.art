// Operator dashboards: retention (who is still here) and economy (mint vs
// sink). Written to admin-stats/* by scheduled jobs (retentionStatsJob nightly,
// economyStatsJob weekly) and admin-only per firestore.rules. Each panel has
// its own Refresh control wired to the matching registry job.

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { Coins, RefreshCw, Users } from 'lucide-react';
import { db } from '../../api';
import { ADMIN_JOBS } from './adminJobs';
import type { AdminJob } from './adminJobs';
import { Panel, StatTile } from './AdminUI';
import { useAdmin } from './adminContextCore';
import type { StatsKey } from './adminContextCore';

interface Computed {
  computedAt?: { toDate?: () => Date };
}

interface EconomyStats extends Computed {
  minted?: number;
  sunk?: number;
  net?: number;
  byType?: Record<string, { amount: number; count: number }>;
  windowDays?: number;
  transactions?: number;
  activeWallets?: number;
}

interface CohortRow {
  rate?: number | null;
  retained?: number;
  eligible?: number;
}

interface RetentionStats extends Computed {
  active?: { dau?: number; wau?: number; mau?: number };
  totalProfiles?: number;
  stickiness?: number | null;
  cohortDays?: number[];
  retention?: Record<string, CohortRow>;
  streaks?: Record<string, number>;
  signups?: { last1?: number; last7?: number; last30?: number };
  longestStreak?: number;
  neverLoggedIn?: number;
  unknownSignup?: number;
}

/** Read one admin-stats doc; re-read whenever its refresh counter bumps. */
function useAdminStat<T>(key: StatsKey, path: string): T | null {
  const { statsVersion } = useAdmin();
  const version = statsVersion[key];
  const [stats, setStats] = useState<T | null>(null);
  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, path))
      .then((snap) => {
        if (!cancelled) setStats(snap.exists() ? (snap.data() as T) : null);
      })
      .catch(() => {
        if (!cancelled) setStats(null);
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);
  return stats;
}

/** Header refresh button that runs the registry job owning a dashboard. */
export function RefreshStatsButton({ jobId }: { jobId: string }) {
  const { runJob, runningJob } = useAdmin();
  const job = ADMIN_JOBS.find((j) => j.id === jobId) as AdminJob | undefined;
  if (!job) return null;
  const busy = runningJob === job.id;
  return (
    <button
      type="button"
      onClick={() => void runJob(job)}
      disabled={busy}
      aria-label={job.name}
      title={job.description}
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-muted hover:text-white disabled:opacity-50"
    >
      <RefreshCw className={`w-3 h-3 ${busy ? 'animate-spin' : ''}`} />
      Recompute
    </button>
  );
}

const n = (v: number | undefined) => (v || 0).toLocaleString();
const computedLabel = (stats: Computed | null) => {
  const at = stats?.computedAt?.toDate?.();
  return at ? `computed ${at.toLocaleString()}` : '';
};

export function EconomyPanel({ id }: { id?: string }) {
  const stats = useAdminStat<EconomyStats>('economy', 'admin-stats/economy');
  const types = Object.entries(stats?.byType || {}).sort(
    (a, b) => Math.abs(b[1].amount) - Math.abs(a[1].amount)
  );
  const net = stats?.net || 0;

  return (
    <Panel
      id={id}
      title="Economy — Mint vs Sink"
      icon={Coins}
      actions={<RefreshStatsButton jobId="updateEconomyStats" />}
      description="CorpsCoin entering (minted) and leaving (sunk) the closed-loop economy. Read before touching prices."
    >
      {!stats ? (
        <p className="text-[11px] text-muted">
          No stats yet — press Recompute (also runs automatically every Monday).
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <StatTile label="Minted" value={`+${n(stats.minted)}`} tone="good" />
            <StatTile label="Sunk" value={`−${n(stats.sunk)}`} tone="bad" />
            <StatTile
              label="Net"
              value={`${net > 0 ? '+' : ''}${n(net)}`}
              tone={net > 0 ? 'warn' : 'good'}
            />
          </div>
          <div className="space-y-0.5">
            {types.map(([type, t]) => (
              <div key={type} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-muted font-mono truncate">{type}</span>
                <span
                  className={`font-data tabular-nums shrink-0 ${t.amount >= 0 ? 'text-green-500' : 'text-red-500'}`}
                >
                  {t.amount >= 0 ? '+' : ''}
                  {t.amount.toLocaleString()} CC
                  <span className="text-muted"> · {t.count}×</span>
                </span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted mt-2">
            Trailing {stats.windowDays}d · {n(stats.transactions)} transactions ·{' '}
            {n(stats.activeWallets)} active wallets
            {computedLabel(stats) ? ` · ${computedLabel(stats)}` : ''}
          </p>
        </>
      )}
    </Panel>
  );
}

// GA4 answers "what did users do"; it is sampled, partly ad-blocked, and
// cannot see the roster, so it cannot answer "of the directors who signed up
// last week, how many are still here". This can.
export function RetentionPanel({ id }: { id?: string }) {
  const stats = useAdminStat<RetentionStats>('retention', 'admin-stats/retention');

  // null rate means "nothing eligible yet", which must not render as 0%.
  const pct = (rate: number | null | undefined) =>
    rate === null || rate === undefined ? '—' : `${(rate * 100).toFixed(1)}%`;
  const cohortDays = stats?.cohortDays || [1, 7, 14, 30];
  const streakBuckets = Object.entries(stats?.streaks || {});
  const maxBucket = streakBuckets.reduce((max, [, count]) => Math.max(max, count), 0);

  return (
    <Panel
      id={id}
      title="Retention — Active & Cohorts"
      icon={Users}
      actions={<RefreshStatsButton jobId="updateRetentionStats" />}
      description="Daily/weekly/monthly actives and whether new directors stick. Read before deciding what to build next."
    >
      {!stats ? (
        <p className="text-[11px] text-muted">
          No stats yet — press Recompute (also runs nightly at 5 AM ET).
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <StatTile label="DAU" value={n(stats.active?.dau)} />
            <StatTile label="WAU" value={n(stats.active?.wau)} />
            <StatTile label="MAU" value={n(stats.active?.mau)} />
            <StatTile label="Directors" value={n(stats.totalProfiles)} tone="accent" />
          </div>

          {/* Stickiness: DAU/MAU. ~0.2 is healthy for a daily-loop game; this
              one should aim higher because the score drop is nightly. */}
          <div className="flex items-center justify-between text-[11px] mb-3 px-1">
            <span className="text-muted">Stickiness (DAU/MAU)</span>
            <span className="font-data tabular-nums text-primary">{pct(stats.stickiness)}</span>
          </div>

          <p className="text-[9px] uppercase tracking-wider text-muted mb-1">
            Cohort retention — of accounts old enough to answer
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {cohortDays.map((day) => {
              const cohort = stats.retention?.[`d${day}`] || {};
              return (
                <StatTile
                  key={day}
                  label={`D${day}`}
                  value={pct(cohort.rate)}
                  hint={`${n(cohort.retained)}/${n(cohort.eligible)}`}
                />
              );
            })}
          </div>

          <p className="text-[9px] uppercase tracking-wider text-muted mb-1">
            Login-streak distribution
          </p>
          <div className="space-y-0.5 mb-2">
            {streakBuckets.map(([bucket, count]) => (
              <div key={bucket} className="flex items-center gap-2 text-[11px]">
                <span className="text-muted font-mono w-14 shrink-0">{bucket}</span>
                <span className="flex-1 bg-surface-sunken h-2 overflow-hidden">
                  <span
                    className="block h-full bg-interactive"
                    style={{ width: maxBucket > 0 ? `${(count / maxBucket) * 100}%` : '0%' }}
                  />
                </span>
                <span className="font-data tabular-nums text-muted w-10 text-right shrink-0">
                  {count.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <p className="text-[9px] text-muted mt-2">
            New signups: {n(stats.signups?.last1)} today · {n(stats.signups?.last7)} this week ·{' '}
            {n(stats.signups?.last30)} this month · longest streak {n(stats.longestStreak)}d ·{' '}
            {n(stats.neverLoggedIn)} never logged in
            {(stats.unknownSignup || 0) > 0
              ? ` · ${n(stats.unknownSignup)} with no signup date`
              : ''}
            {computedLabel(stats) ? ` · ${computedLabel(stats)}` : ''}
          </p>
        </>
      )}
    </Panel>
  );
}
