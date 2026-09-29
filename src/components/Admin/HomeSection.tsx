// Admin Home — "what needs me right now". Queue counts, scoring and scrape
// health (from getAdminInbox), the active season, and community totals. Every
// card links to the section that resolves it, so the console opens on the
// work instead of on a static season card.

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Flag,
  Inbox,
  MessageSquare,
  Radar,
  Users,
} from 'lucide-react';
import { getAdminOverviewStats } from '../../api/admin';
import type { AdminOverviewStats } from '../../api/admin';
import { usePodiumEnabled } from '../../hooks/useFeatures';
import { formatRelativeTime } from '../../utils/notifications';
import { InfoRow, Panel, StatTile } from './AdminUI';
import { useAdmin } from './adminContextCore';
import type { AdminSectionId } from './adminSections';

type Tone = 'clear' | 'attention' | 'alert' | 'unknown';

const TONE_STYLE: Record<Tone, { ring: string; value: string }> = {
  clear: { ring: 'border-line', value: 'text-green-500' },
  attention: { ring: 'border-warning/50', value: 'text-warning' },
  alert: { ring: 'border-red-500/60', value: 'text-red-500' },
  unknown: { ring: 'border-line', value: 'text-muted' },
};

interface AttentionCardProps {
  label: string;
  value: ReactNode;
  detail: string;
  tone: Tone;
  icon: typeof Flag;
  section: AdminSectionId;
  cta: string;
}

function AttentionCard({
  label,
  value,
  detail,
  tone,
  icon: Icon,
  section,
  cta,
}: AttentionCardProps) {
  const { goTo } = useAdmin();
  const style = TONE_STYLE[tone];
  return (
    <button
      type="button"
      onClick={() => goTo(section)}
      className={`group text-left bg-surface-card border ${style.ring} p-3 hover:bg-surface-sunken transition-colors flex flex-col gap-1 min-w-0`}
    >
      <span className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-muted">
        <Icon className="w-3 h-3" aria-hidden />
        {label}
      </span>
      <span className={`text-2xl font-bold font-data tabular-nums ${style.value}`}>{value}</span>
      <span className="text-[11px] text-muted leading-snug">{detail}</span>
      <span className="mt-auto pt-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase text-interactive opacity-80 group-hover:opacity-100">
        {cta} <ArrowRight className="w-3 h-3" />
      </span>
    </button>
  );
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function toDate(value: unknown): Date | null {
  if (value && typeof value === 'object' && 'toDate' in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    return typeof fn === 'function' ? fn.call(value) : null;
  }
  return null;
}

export default function HomeSection() {
  const { inbox, inboxLoading, seasonData, goTo } = useAdmin();
  const podiumEnabled = usePodiumEnabled();
  const [community, setCommunity] = useState<AdminOverviewStats | null>(null);

  useEffect(() => {
    let cancelled = false;
    getAdminOverviewStats()
      .then((stats) => {
        if (!cancelled) setCommunity(stats);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const queues = inbox?.queues;
  const runs = inbox?.health.unhealthyRuns;
  const canary = inbox?.health.scrapeCanary;
  const loadingValue = inboxLoading && !inbox ? '…' : '—';

  const runsFailed = runs?.filter((r) => r.status === 'failed').length ?? 0;
  const allClear =
    !!inbox &&
    queues?.available &&
    queues.reports + queues.comments + queues.submissions === 0 &&
    runs !== null &&
    (runs?.length ?? 0) === 0 &&
    canary?.healthy !== false;

  const start = toDate(seasonData?.schedule?.startDate);
  const end = toDate(seasonData?.schedule?.endDate);

  return (
    <div className="space-y-4">
      {allClear && (
        <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 px-4 py-3 text-sm text-green-400">
          <CheckCircle2 className="w-4 h-4" aria-hidden />
          All clear — no queued work and every system check is healthy.
        </div>
      )}

      <section aria-label="Needs attention">
        <h2 className="text-[10px] font-bold uppercase tracking-wider text-muted mb-2">
          Needs attention
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2">
          <AttentionCard
            label="Player reports"
            icon={Flag}
            value={queues ? queues.reports : loadingValue}
            tone={!queues ? 'unknown' : queues.reports > 0 ? 'alert' : 'clear'}
            detail={
              queues?.reports ? `${plural(queues.reports, 'report')} to review` : 'Nothing reported'
            }
            section="moderation"
            cta="Review"
          />
          <AttentionCard
            label="Held comments"
            icon={MessageSquare}
            value={queues ? queues.comments : loadingValue}
            tone={!queues ? 'unknown' : queues.comments > 0 ? 'attention' : 'clear'}
            detail={
              queues?.comments
                ? `${plural(queues.comments, 'article comment')} awaiting approval`
                : 'Comment queue empty'
            }
            section="moderation"
            cta="Moderate"
          />
          <AttentionCard
            label="Submissions"
            icon={Inbox}
            value={queues ? queues.submissions : loadingValue}
            tone={!queues ? 'unknown' : queues.submissions > 0 ? 'attention' : 'clear'}
            detail={
              queues?.submissions
                ? `${plural(queues.submissions, 'article')} pending editorial review`
                : 'No pending articles'
            }
            section="newsroom"
            cta="Edit"
          />
          <AttentionCard
            label="Scoring runs"
            icon={Activity}
            value={runs === undefined ? loadingValue : runs === null ? '?' : runs.length}
            tone={
              runs == null
                ? 'unknown'
                : runsFailed > 0
                  ? 'alert'
                  : runs.length > 0
                    ? 'attention'
                    : 'clear'
            }
            detail={
              runs === null
                ? 'Watchdog read failed'
                : runs && runs.length > 0
                  ? `${plural(runs.length, 'unhealthy run')} in the last 36h`
                  : 'Every night scored cleanly'
            }
            section="season"
            cta="Investigate"
          />
          <AttentionCard
            label="DCI scrape"
            icon={Radar}
            value={canary == null ? '—' : canary.healthy ? 'OK' : 'DRIFT'}
            tone={canary == null ? 'unknown' : canary.healthy ? 'clear' : 'alert'}
            detail={
              canary == null
                ? 'Canary has not run yet'
                : `Checked ${formatRelativeTime(canary.checkedAt) || 'recently'}`
            }
            section="season"
            cta="Open feed"
          />
        </div>
      </section>

      {runs && runs.length > 0 && (
        <Panel title="Unhealthy Runs" icon={Activity} flush tone="danger">
          <ul>
            {runs.map((run) => (
              <li key={run.id} className="px-4 py-2 border-b border-line-subtle last:border-b-0">
                <p className="text-[11px] text-white">
                  <span className="font-mono">{run.id}</span>{' '}
                  <span className={run.status === 'failed' ? 'text-red-500' : 'text-warning'}>
                    {run.status}
                  </span>
                  <span className="text-muted">
                    {' '}
                    · {run.kind || 'scoring'}
                    {run.stage ? ` / ${run.stage}` : ''}
                    {run.scoredDay != null ? ` · day ${run.scoredDay}` : ''}
                  </span>
                </p>
                {run.lastError && (
                  <p className="text-[10px] text-muted font-mono break-words">{run.lastError}</p>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {canary && !canary.healthy && (
        <Panel title="Scrape Canary Problems" icon={Radar} tone="danger">
          <ul className="list-disc pl-4 text-[11px] text-secondary space-y-0.5">
            {canary.problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
          <p className="text-[10px] text-muted mt-2">
            Fix the scraper selectors, then run “Run Scrape Canary” under Season &amp; Scoring.
          </p>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Active Season"
          icon={CalendarClock}
          flush
          actions={
            <button
              type="button"
              onClick={() => goTo('season')}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-interactive"
            >
              Manage <ArrowRight className="w-3 h-3" />
            </button>
          }
        >
          {seasonData ? (
            <div>
              <InfoRow label="Name" value={seasonData.name} />
              <InfoRow label="Status" value={String(seasonData.status ?? '').toUpperCase()} badge />
              <InfoRow label="Season UID" value={seasonData.seasonUid} mono />
              <InfoRow label="Start" value={start?.toLocaleDateString()} />
              <InfoRow label="End" value={end?.toLocaleDateString()} />
              <InfoRow label="Point cap" value={seasonData.currentPointCap} mono />
              <InfoRow label="Podium Division" value={podiumEnabled ? 'Live' : 'Disabled'} />
            </div>
          ) : (
            <p className="p-4 text-sm text-muted">
              No active season — the game is between seasons.
            </p>
          )}
        </Panel>

        <Panel
          title="Community"
          icon={Users}
          actions={
            <button
              type="button"
              onClick={() => goTo('insights')}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase text-interactive"
            >
              Insights <ArrowRight className="w-3 h-3" />
            </button>
          }
        >
          <div className="grid grid-cols-3 gap-2">
            <StatTile
              label="Directors"
              value={community ? community.totalUsers.toLocaleString() : '…'}
            />
            <StatTile
              label="Active 7d"
              tone="good"
              value={community ? community.activeUsers.toLocaleString() : '…'}
              hint={
                community && community.totalUsers > 0
                  ? `${Math.round((community.activeUsers / community.totalUsers) * 100)}% engaged`
                  : undefined
              }
            />
            <StatTile
              label="Corps"
              tone="accent"
              value={community ? community.totalCorps.toLocaleString() : '…'}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
