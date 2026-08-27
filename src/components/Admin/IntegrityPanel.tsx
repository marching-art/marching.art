// Account-integrity readout — the third operator dashboard beside mint-vs-sink
// (economy) and active/cohorts (retention). Written weekly by integrityStatsJob
// (functions/src/helpers/integrityStats.js) to admin-stats/integrity, which is
// admin-only per firestore.rules.
//
// The lesson is FMA's (docs/FMA_LESSONS.md §3): alt-account abuse corroded
// trust in a game whose leagues, prediction pools, and the ~monthly voted
// Showcase are all zero-sum. This surfaces the signals — email-alias clusters,
// signup bursts, shared-identity clusters — for a human to judge. It is
// detection only: nothing here suspends or flags an account. The watchlist
// (accounts hit by two or more independent signals) is the row worth a look.

import { useEffect, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { AlertTriangle, Users } from 'lucide-react';
import { db } from '../../api';
import { SectionHeader } from './AdminUI';

interface Member {
  uid: string;
  username: string | null;
}

interface EmailCluster {
  key: string;
  size: number;
  sample: string | null;
  members: Member[];
}

interface AttributeCluster {
  key: string;
  kind: string;
  label: string;
  size: number;
  members: Member[];
}

interface SignupBurst {
  startedAt: string;
  spanMs: number;
  size: number;
  members: Member[];
}

interface WatchlistRow {
  uid: string;
  username: string | null;
  signals: string[];
}

interface IntegrityStats {
  totalAccounts?: number;
  withEmail?: number;
  emailClusters?: EmailCluster[];
  signupBursts?: SignupBurst[];
  attributeClusters?: AttributeCluster[];
  watchlist?: WatchlistRow[];
  summary?: {
    emailClusterCount?: number;
    accountsInEmailClusters?: number;
    largestEmailCluster?: number;
    signupBurstCount?: number;
    attributeClusterCount?: number;
    watchlistCount?: number;
  };
  thresholds?: {
    burstWindowMinutes?: number;
    burstMinSize?: number;
    attrMinSize?: number;
  };
  computedAt?: { toDate?: () => Date };
}

const num = (n: number | undefined): string => (n || 0).toLocaleString();

/** One member chip: @username (or a short uid when the handle is missing). */
function MemberChips({ members }: { members: Member[] }) {
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {members.map((m) => (
        <span
          key={m.uid}
          className="text-[10px] font-mono bg-surface-sunken border border-line px-1.5 py-0.5 text-muted"
          title={m.uid}
        >
          {m.username ? `@${m.username}` : m.uid.slice(0, 8)}
        </span>
      ))}
    </div>
  );
}

const IntegrityPanel = ({ refreshKey }: { refreshKey?: number }) => {
  const [stats, setStats] = useState<IntegrityStats | null>(null);

  useEffect(() => {
    getDoc(doc(db, 'admin-stats/integrity'))
      .then((snap) => setStats(snap.exists() ? (snap.data() as IntegrityStats) : null))
      .catch(() => setStats(null));
  }, [refreshKey]);

  const computedAt = stats?.computedAt?.toDate?.();
  const summary = stats?.summary || {};
  const watchlist = stats?.watchlist || [];
  const emailClusters = stats?.emailClusters || [];
  const signupBursts = stats?.signupBursts || [];
  const attributeClusters = stats?.attributeClusters || [];

  return (
    <div className="bg-surface-card border border-line overflow-hidden">
      <SectionHeader title="Integrity — Alt & Multi-Account Signals" icon={AlertTriangle} />
      <div className="p-3">
        {!stats ? (
          <p className="text-[11px] text-muted">
            No signals yet — run “Refresh Integrity Signals” below (also runs weekly, Monday 6 AM
            ET).
          </p>
        ) : (
          <>
            {/* Signals, never verdicts — the copy has to say so, because acting
                on a coincidence here bans a real director. */}
            <p className="text-[10px] text-muted mb-3 leading-relaxed">
              Signals for review, <span className="text-warning">not verdicts</span>. A coincidence
              is common; act only after looking. The watchlist is accounts flagged by two or more
              independent signals.
            </p>

            <div className="grid grid-cols-4 gap-2 mb-3">
              {[
                { label: 'Accounts', value: stats.totalAccounts },
                { label: 'Watchlist', value: summary.watchlistCount },
                { label: 'Email clusters', value: summary.emailClusterCount },
                { label: 'Signup bursts', value: summary.signupBurstCount },
              ].map(({ label, value }) => (
                <div key={label} className="bg-surface-sunken border border-line p-2 text-center">
                  <p className="text-[9px] uppercase tracking-wider text-muted">{label}</p>
                  <p className="text-sm font-bold text-primary font-data tabular-nums">
                    {num(value)}
                  </p>
                </div>
              ))}
            </div>

            {/* The watchlist: highest-confidence rows first. */}
            {watchlist.length > 0 && (
              <div className="mb-3">
                <p className="text-[9px] uppercase tracking-wider text-warning mb-1 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Multi-signal watchlist
                </p>
                <div className="space-y-0.5">
                  {watchlist.map((row) => (
                    <div
                      key={row.uid}
                      className="flex items-center justify-between text-[11px] bg-surface-sunken border border-line px-2 py-1"
                    >
                      <span className="font-mono text-primary truncate" title={row.uid}>
                        {row.username ? `@${row.username}` : row.uid.slice(0, 10)}
                      </span>
                      <span className="text-[10px] text-muted font-mono shrink-0">
                        {row.signals.join(' · ')}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Email-alias clusters — the strongest single signal. */}
            {emailClusters.length > 0 && (
              <div className="mb-3">
                <p className="text-[9px] uppercase tracking-wider text-muted mb-1">
                  Email-alias clusters — one inbox, many accounts
                </p>
                <div className="space-y-1.5">
                  {emailClusters.map((c) => (
                    <div key={c.key} className="border-b border-line-subtle pb-1.5 last:border-b-0">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-muted">{c.sample || '—'}</span>
                        <span className="font-data tabular-nums text-warning">{c.size} accts</span>
                      </div>
                      <MemberChips members={c.members} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Signup bursts — many accounts created within a tight window. */}
            {signupBursts.length > 0 && (
              <div className="mb-3">
                <p className="text-[9px] uppercase tracking-wider text-muted mb-1">
                  Signup bursts — created within {stats.thresholds?.burstWindowMinutes ?? 15} min
                </p>
                <div className="space-y-1.5">
                  {signupBursts.map((b) => (
                    <div
                      key={b.startedAt}
                      className="border-b border-line-subtle pb-1.5 last:border-b-0"
                    >
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-mono text-muted">
                          {new Date(b.startedAt).toLocaleString()}
                        </span>
                        <span className="font-data tabular-nums text-warning">
                          {b.size} in {Math.round(b.spanMs / 60000)}m
                        </span>
                      </div>
                      <MemberChips members={b.members} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Shared-identity clusters — same location+corps, or a name stem. */}
            {attributeClusters.length > 0 && (
              <div className="mb-2">
                <p className="text-[9px] uppercase tracking-wider text-muted mb-1">
                  Shared-identity clusters
                </p>
                <div className="space-y-1.5">
                  {attributeClusters.map((c) => (
                    <div key={c.key} className="border-b border-line-subtle pb-1.5 last:border-b-0">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted">
                          <span className="font-mono text-[10px] text-primary">{c.kind}</span>{' '}
                          {c.label}
                        </span>
                        <span className="font-data tabular-nums text-warning">{c.size} accts</span>
                      </div>
                      <MemberChips members={c.members} />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {watchlist.length === 0 &&
              emailClusters.length === 0 &&
              signupBursts.length === 0 &&
              attributeClusters.length === 0 && (
                <p className="text-[11px] text-emerald-400">
                  No clusters above threshold — nothing to review this run.
                </p>
              )}

            <p className="text-[9px] text-muted mt-2">
              {num(stats.withEmail)} of {num(stats.totalAccounts)} accounts have a joinable email
              {computedAt ? ` · computed ${computedAt.toLocaleString()}` : ''}
            </p>
          </>
        )}
      </div>
    </div>
  );
};

export default IntegrityPanel;
