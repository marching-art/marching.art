// Player Reports queue — every report a director has filed, in one place.
//
// Profile-comment and league-chat reports (`reports`) and article-comment
// reports (`article_comments_reports`) used to reach admins only as an email;
// nothing in the panel read them. The queue normalizes all three
// (functions/src/callable/reportsModeration.js) and moves each through
// new → reviewed → resolved. "Remove content" deletes the reported comment or
// chat message (article comments are hidden, restorable from the Comments
// queue) and resolves every other report on the same content.

import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Check,
  Eye,
  Flag,
  MessageCircle,
  MessagesSquare,
  Newspaper,
  RefreshCw,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { listReports, resolveReport } from '../../api/admin';
import type {
  ListReportsResult,
  PlayerReport,
  ReportStatus,
  ReportType,
  ResolveReportData,
} from '../../api/admin';
import { formatRelativeTime } from '../../utils/notifications';
import { Panel, inputClass } from './AdminUI';
import { useAdmin } from './adminContextCore';

type StatusFilter = ReportStatus | 'all';
type TypeFilter = ReportType | 'all';

const STATUS_TABS: { id: StatusFilter; label: string }[] = [
  { id: 'new', label: 'New' },
  { id: 'reviewed', label: 'Reviewed' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'all', label: 'All' },
];

const TYPE_META: Record<ReportType, { label: string; icon: typeof Flag }> = {
  comment: { label: 'Profile comment', icon: MessageCircle },
  league_message: { label: 'League chat', icon: MessagesSquare },
  article_comment: { label: 'Article comment', icon: Newspaper },
};

const STATUS_STYLE: Record<ReportStatus, string> = {
  new: 'bg-warning/20 text-warning',
  reviewed: 'bg-interactive/20 text-interactive',
  resolved: 'bg-green-500/20 text-green-400',
};

const EMPTY_COUNTS: ListReportsResult['counts'] = { new: 0, reviewed: 0, resolved: 0 };

const who = (name: string | null, uid: string | null) =>
  name || (uid ? `${uid.slice(0, 8)}…` : 'Unknown');

/** Where the reported content lives, for "view in context". */
function contextLink(report: PlayerReport): { to: string; label: string } | null {
  const { context } = report;
  if (report.type === 'league_message' && context.leagueId) {
    return { to: `/leagues/${context.leagueId}/chat`, label: context.leagueName || 'League chat' };
  }
  if (report.type === 'comment' && context.profileUid) {
    return {
      to: `/profile/${context.profileUid}`,
      label: `${who(context.profileName ?? null, context.profileUid)}'s profile`,
    };
  }
  if (report.type === 'article_comment' && context.articleId) {
    return { to: `/article/${encodeURIComponent(context.articleId)}`, label: 'Article' };
  }
  return null;
}

interface ReportCardProps {
  report: PlayerReport;
  busy: boolean;
  onAction: (report: PlayerReport, action: Omit<ResolveReportData, 'reportId' | 'source'>) => void;
}

function ReportCard({ report, busy, onAction }: ReportCardProps) {
  const [note, setNote] = useState('');
  const meta = TYPE_META[report.type];
  const Icon = meta.icon;
  const link = contextLink(report);
  const open = report.status !== 'resolved';
  const withNote = note.trim() ? { note: note.trim() } : {};

  return (
    <li className="border-b border-line last:border-b-0 px-4 py-3 space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <span className="inline-flex items-center gap-1 font-bold uppercase tracking-wider text-secondary">
          <Icon className="w-3 h-3" aria-hidden />
          {meta.label}
        </span>
        <span className={`px-1.5 py-0.5 font-bold uppercase ${STATUS_STYLE[report.status]}`}>
          {report.status}
        </span>
        {report.contentLive === false && (
          <span className="px-1.5 py-0.5 font-bold uppercase bg-charcoal-500/20 text-muted">
            content removed
          </span>
        )}
        <span className="text-muted ml-auto">{formatRelativeTime(report.createdAt)}</span>
      </div>

      <blockquote className="border-l-2 border-line pl-3 text-sm text-white whitespace-pre-wrap break-words">
        {report.text || <span className="text-muted italic">(text unavailable)</span>}
      </blockquote>

      <div className="text-[11px] text-muted space-y-0.5">
        <p>
          Written by{' '}
          <span className="text-secondary">{who(report.authorName, report.authorUid)}</span> ·
          reported by{' '}
          <span className="text-secondary">{who(report.reporterName, report.reporterUid)}</span>
          {link && (
            <>
              {' '}
              ·{' '}
              <Link to={link.to} className="text-interactive hover:underline">
                {link.label}
              </Link>
            </>
          )}
        </p>
        {report.reason && (
          <p>
            Reason: <span className="text-secondary">{report.reason}</span>
          </p>
        )}
        {report.resolution && (
          <p>
            Outcome:{' '}
            <span className="text-secondary">
              {report.resolution === 'content_removed' ? 'Content removed' : 'No action'}
            </span>
            {report.adminNote ? ` — ${report.adminNote}` : ''}
          </p>
        )}
      </div>

      {open ? (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <input
            type="text"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Moderator note (optional)"
            aria-label="Moderator note"
            className={`${inputClass} flex-1 min-w-[10rem] py-1.5`}
          />
          {report.contentLive !== false && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction(report, { removeContent: true, ...withNote })}
              className="inline-flex items-center gap-1 h-8 px-2.5 text-[10px] font-bold uppercase bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500 hover:text-white disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" /> Remove content
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => onAction(report, { status: 'resolved', ...withNote })}
            className="inline-flex items-center gap-1 h-8 px-2.5 text-[10px] font-bold uppercase bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-600 hover:text-white disabled:opacity-50"
          >
            <Check className="w-3 h-3" />
            {report.contentLive === false ? 'Resolve' : 'Dismiss'}
          </button>
          {report.status === 'new' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onAction(report, { status: 'reviewed', ...withNote })}
              className="inline-flex items-center gap-1 h-8 px-2.5 text-[10px] font-bold uppercase text-muted border border-line hover:text-white disabled:opacity-50"
            >
              <Eye className="w-3 h-3" /> Mark reviewed
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => onAction(report, { status: 'new' })}
          className="inline-flex items-center gap-1 h-7 px-2.5 text-[10px] font-bold uppercase text-muted border border-line hover:text-white disabled:opacity-50"
        >
          <RotateCcw className="w-3 h-3" /> Reopen
        </button>
      )}
    </li>
  );
}

export default function ReportsQueue({ id }: { id?: string }) {
  const { refreshInbox } = useAdmin();
  const [status, setStatus] = useState<StatusFilter>('new');
  const [type, setType] = useState<TypeFilter>('all');
  const [reports, setReports] = useState<PlayerReport[]>([]);
  const [counts, setCounts] = useState(EMPTY_COUNTS);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await listReports({ status, type, limit: 50 });
      setReports(data.reports);
      setCounts(data.counts);
      setHasMore(data.hasMore);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, [status, type]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAction: ReportCardProps['onAction'] = async (report, action) => {
    if (
      action.removeContent &&
      !window.confirm(
        report.type === 'article_comment'
          ? 'Hide this article comment and resolve every report on it?'
          : 'Permanently delete this content and resolve every report on it?'
      )
    ) {
      return;
    }
    setBusyId(report.id);
    try {
      const { data } = await resolveReport({
        reportId: report.id,
        source: report.source,
        ...action,
      });
      const extra =
        data.siblingsResolved > 0
          ? ` (+${data.siblingsResolved} duplicate report${data.siblingsResolved === 1 ? '' : 's'})`
          : '';
      toast.success(
        data.resolution === 'content_removed'
          ? `Content removed${extra}`
          : data.status === 'resolved'
            ? 'Report dismissed'
            : data.status === 'reviewed'
              ? 'Marked reviewed'
              : 'Report reopened'
      );
      if (data.siblingsResolved > 0) {
        await load();
      } else if (status !== 'all' && data.status !== status) {
        setReports((prev) => prev.filter((r) => r.id !== report.id));
        setCounts((prev) => ({
          ...prev,
          [report.status]: Math.max(0, prev[report.status] - 1),
          [data.status]: prev[data.status] + 1,
        }));
      } else {
        await load();
      }
      void refreshInbox();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Panel
      id={id}
      title="Player Reports"
      icon={Flag}
      description="Reports filed on profile comments, league chat and article comments. Remove the content or dismiss the report; duplicates on the same content resolve together."
      flush
      actions={
        <button
          type="button"
          onClick={() => void load()}
          aria-label="Refresh reports"
          className="text-muted hover:text-white"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      }
    >
      <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-line">
        <div role="tablist" aria-label="Report status" className="flex flex-wrap gap-1">
          {STATUS_TABS.map((tab) => {
            const count = tab.id === 'all' ? null : counts[tab.id];
            const active = status === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatus(tab.id)}
                className={`text-[10px] font-bold uppercase px-2.5 py-1 transition-colors ${
                  active ? 'bg-interactive text-white' : 'text-muted hover:text-white bg-white/5'
                }`}
              >
                {tab.label}
                {count !== null && <span className="ml-1 opacity-80">{count}</span>}
              </button>
            );
          })}
        </div>
        <label className="ml-auto flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
          Type
          <select
            value={type}
            onChange={(e) => setType(e.target.value as TypeFilter)}
            className={`${inputClass} py-1`}
          >
            <option value="all">All</option>
            <option value="comment">Profile comments</option>
            <option value="league_message">League chat</option>
            <option value="article_comment">Article comments</option>
          </select>
        </label>
      </div>

      {loading && reports.length === 0 ? (
        <p className="px-4 py-6 text-[11px] text-muted">Loading reports…</p>
      ) : reports.length === 0 ? (
        <p className="px-4 py-6 text-[11px] text-muted">
          {status === 'new' ? 'No new reports — the community is behaving.' : 'Nothing here.'}
        </p>
      ) : (
        <ul aria-busy={loading}>
          {reports.map((report) => (
            <ReportCard
              key={`${report.source}:${report.id}`}
              report={report}
              busy={busyId === report.id}
              onAction={handleAction}
            />
          ))}
        </ul>
      )}
      {hasMore && (
        <p className="px-4 py-2 text-[10px] text-muted border-t border-line">
          Showing the 50 newest. Resolve some to see the rest.
        </p>
      )}
    </Panel>
  );
}
