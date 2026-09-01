// =============================================================================
// PROFILE NEWSROOM — a director's own published news, on their profile
// =============================================================================
// The press releases and articles a director has authored, gathered on their
// profile as their organization's ongoing story (docs/FMA_LESSONS.md, lesson 1
// fast-follow). Reuses the news feed's category styling and links each item to
// the shared article page. Renders nothing on someone else's empty profile, and
// a gentle prompt on your own so the feature is discoverable.
//
// On your OWN profile the Newsroom also shows what's still in flight: a new
// director's first press releases are held for admin review (the trust track in
// functions/src/triggers/newsSubmissions.js), and news submissions are always
// reviewed — without this section those pieces produce one toast and then
// vanish until an admin acts, with the empty Newsroom claiming nothing was
// ever written.

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Newspaper, Clock, CalendarClock, XCircle } from 'lucide-react';
import { getDirectorArticles } from '../../api/directorArticles';
import { getMyNewsSubmissions, type MyNewsSubmission } from '../../api/articleAdmin';
import { getCategoryConfig } from '../Landing/newsFeedUtils';
import { Heading } from '../ui';

export interface ProfileNewsroomProps {
  uid?: string | null;
  isOwnProfile?: boolean;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// Per-status presentation for an in-flight submission. Scheduled releases show
// their publish time separately (they carry a scheduledPublishAt).
const SUBMISSION_STATUS = {
  pending: {
    label: 'In review',
    detail: 'Waiting for an admin to review it.',
    icon: Clock,
    // The status token, not a raw amber utility — gold/amber is reserved for
    // brand + reward (docs/DESIGN_SYSTEM.md §4; the design census enforces it).
    textClass: 'text-warning',
    bgClass: 'bg-warning/10',
  },
  scheduled: {
    label: 'Scheduled',
    detail: 'Approved to publish automatically.',
    icon: CalendarClock,
    textClass: 'text-teal-400',
    bgClass: 'bg-teal-500/10',
  },
  rejected: {
    label: 'Not approved',
    detail: null,
    icon: XCircle,
    textClass: 'text-red-400',
    bgClass: 'bg-red-500/10',
  },
} as const;

function formatPublishTime(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const InReviewItem: React.FC<{ submission: MyNewsSubmission }> = ({ submission }) => {
  const status = SUBMISSION_STATUS[submission.status];
  const Icon = status.icon;
  const publishTime =
    submission.status === 'scheduled' ? formatPublishTime(submission.scheduledPublishAt) : null;
  return (
    <li className="px-4 py-3">
      <div className="flex items-center gap-2 mb-1">
        <span
          className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${status.textClass} ${status.bgClass}`}
        >
          <Icon className="w-3 h-3" aria-hidden="true" />
          {status.label}
        </span>
        <span className="text-[10px] text-muted uppercase tracking-wider">
          {submission.kind === 'press_release' ? 'Press release' : 'Article'}
        </span>
        <time className="text-[10px] text-muted tabular-nums ml-auto">
          {formatDate(submission.createdAt)}
        </time>
      </div>
      <p className="text-sm font-bold text-white leading-snug">{submission.headline}</p>
      <p className="text-xs text-muted mt-0.5">
        {submission.status === 'rejected'
          ? submission.rejectionReason || 'It didn’t meet the content guidelines.'
          : publishTime
            ? `Publishes ${publishTime}.`
            : status.detail}
      </p>
    </li>
  );
};

const ProfileNewsroom: React.FC<ProfileNewsroomProps> = ({ uid, isOwnProfile = false }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['directorArticles', uid],
    queryFn: () => getDirectorArticles(uid as string),
    enabled: !!uid,
    staleTime: 60 * 1000,
  });

  // In-flight submissions are the author's own view of the review queue —
  // only ever fetched on the director's own profile.
  const { data: inReview } = useQuery({
    queryKey: ['myNewsSubmissions', uid],
    queryFn: async () => (await getMyNewsSubmissions()).data.submissions,
    enabled: !!uid && isOwnProfile,
    staleTime: 60 * 1000,
  });

  if (!uid || isLoading) return null;

  const items = data ?? [];
  const submissions = inReview ?? [];

  if (items.length === 0 && submissions.length === 0) {
    if (!isOwnProfile) return null;
    return (
      <section className="px-4 pb-4">
        <div className="bg-surface-card border border-line p-4">
          <div className="flex items-center gap-2 mb-1">
            <Newspaper className="w-4 h-4 text-teal-400" />
            <Heading level="section" as="h2">
              Newsroom
            </Heading>
          </div>
          <p className="text-xs text-muted">
            Press releases you publish about your corps appear here — your organization&apos;s
            ongoing story.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="px-4 pb-4">
      <div className="bg-surface-card border border-line overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface-raised">
          <Newspaper className="w-4 h-4 text-teal-400" />
          <Heading level="section" as="h2">
            Newsroom
          </Heading>
          {items.length > 0 && (
            <span className="ml-auto text-[10px] text-muted font-data">{items.length}</span>
          )}
        </div>

        {submissions.length > 0 && (
          <div className="border-b border-line">
            <p className="px-4 pt-3 text-[10px] font-bold uppercase tracking-wider text-muted">
              In review
            </p>
            <ul className="divide-y divide-line">
              {submissions.map((submission) => (
                <InReviewItem key={submission.id} submission={submission} />
              ))}
            </ul>
          </div>
        )}

        {items.length > 0 && (
          <ul className="divide-y divide-line">
            {items.map((article) => {
              const config = getCategoryConfig(article.category);
              return (
                <li key={article.id}>
                  <Link
                    to={`/article/${article.id}`}
                    className="block px-4 py-3 hover:bg-surface-raised transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${config.textClass} ${config.bgLightClass}`}
                      >
                        {config.label}
                      </span>
                      <time className="text-[10px] text-muted tabular-nums ml-auto">
                        {formatDate(article.createdAt)}
                      </time>
                    </div>
                    <p className="text-sm font-bold text-white leading-snug">{article.headline}</p>
                    {article.summary && (
                      <p className="text-xs text-muted mt-0.5 line-clamp-2">{article.summary}</p>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};

export default ProfileNewsroom;
