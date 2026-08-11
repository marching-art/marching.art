// =============================================================================
// PROFILE NEWSROOM — a director's own published news, on their profile
// =============================================================================
// The press releases and articles a director has authored, gathered on their
// profile as their organization's ongoing story (docs/FMA_LESSONS.md, lesson 1
// fast-follow). Reuses the news feed's category styling and links each item to
// the shared article page. Renders nothing on someone else's empty profile, and
// a gentle prompt on your own so the feature is discoverable.

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Newspaper } from 'lucide-react';
import { getDirectorArticles } from '../../api/directorArticles';
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

const ProfileNewsroom: React.FC<ProfileNewsroomProps> = ({ uid, isOwnProfile = false }) => {
  const { data, isLoading } = useQuery({
    queryKey: ['directorArticles', uid],
    queryFn: () => getDirectorArticles(uid as string),
    enabled: !!uid,
    staleTime: 60 * 1000,
  });

  if (!uid || isLoading) return null;

  const items = data ?? [];

  if (items.length === 0) {
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
          <span className="ml-auto text-[10px] text-muted font-data">{items.length}</span>
        </div>
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
      </div>
    </section>
  );
};

export default ProfileNewsroom;
