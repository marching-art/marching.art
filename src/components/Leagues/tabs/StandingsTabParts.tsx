// Small presentational pieces of the standings table, split out to keep
// StandingsTab under the ~700-line guidance in ARCHITECTURE.md. Pure render,
// no state — memoized because the table redraws on every standings push.

import React, { useState } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  Crown,
  UserX,
} from 'lucide-react';

import { getEquippedCosmetic } from '../../../utils/cosmetics';

interface RankBadgeProps {
  rank: number;
  isPlayoffSpot?: boolean;
}

/** Medal colours for the podium, a Finals-spot tint below it. */
export const RankBadge = React.memo(({ rank, isPlayoffSpot }: RankBadgeProps) => {
  if (rank === 1) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 bg-brand/20 text-brand text-xs font-bold">
        1
      </div>
    );
  }
  if (rank === 2) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 bg-charcoal-500/20 text-muted text-xs font-bold">
        2
      </div>
    );
  }
  if (rank === 3) {
    return (
      <div className="inline-flex items-center justify-center w-6 h-6 bg-orange-500/20 text-orange-500 text-xs font-bold">
        3
      </div>
    );
  }

  return (
    <div
      className={`inline-flex items-center justify-center w-6 h-6 text-xs font-bold ${
        isPlayoffSpot
          ? 'bg-green-500/10 text-green-500 border border-green-500/30'
          : 'bg-surface-raised text-muted'
      }`}
    >
      {rank}
    </div>
  );
});
RankBadge.displayName = 'RankBadge';

/** Form over the member's three most recent scored weeks. */
export const TrendIndicator = React.memo(({ trend }: { trend?: 'up' | 'down' | 'same' }) => {
  if (trend === 'up') {
    return <TrendingUp className="w-3.5 h-3.5 text-green-500 mx-auto" />;
  }
  if (trend === 'down') {
    return <TrendingDown className="w-3.5 h-3.5 text-red-500 mx-auto" />;
  }
  return <Minus className="w-3.5 h-3.5 text-muted mx-auto" />;
});
TrendIndicator.displayName = 'TrendIndicator';

/**
 * Corps Identity Shop flair. Status only works when OTHERS see it, so standings
 * rows show each member's equipped title and card-theme swatch.
 */
export const MemberFlair = ({
  uid,
  memberProfiles,
}: {
  uid: string;
  memberProfiles?: Record<string, unknown>;
}) => {
  const profile = memberProfiles?.[uid];
  if (!profile) return null;
  const title = getEquippedCosmetic(profile, 'title');
  const theme = getEquippedCosmetic(profile, 'cardTheme');
  if (!title && !theme) return null;

  return (
    <>
      {title && (
        <span
          className={`text-[9px] font-bold uppercase tracking-wider flex-shrink-0 ${title.textClass || 'text-muted'}`}
        >
          {title.name}
        </span>
      )}
      {theme && (
        <span
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${theme.swatchClass || 'bg-charcoal-500'}`}
          title={theme.name}
          aria-label={`${theme.name} card theme`}
        />
      )}
    </>
  );
};

interface InactiveMembersPanelProps {
  members: Array<{ uid: string }>;
  viewerUid?: string;
  commissionerUid?: string;
  getDisplayName: (uid: string) => string;
}

/**
 * Members who have not registered a corps this season, folded away below the
 * table. They are excluded from standings and matchups until they do, so
 * listing them inline would put empty rows above directors who are playing —
 * but dropping them silently would make the roster and the table disagree.
 */
export const InactiveMembersPanel = ({
  members,
  viewerUid,
  commissionerUid,
  getDisplayName,
}: InactiveMembersPanelProps) => {
  const [open, setOpen] = useState(false);
  if (members.length === 0) return null;

  return (
    <div className="mt-4 bg-surface-card border border-line overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 bg-surface-raised flex items-center justify-between hover:bg-surface-elevated transition-colors"
      >
        <div className="flex items-center gap-2">
          <UserX className="w-3.5 h-3.5 text-muted" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Inactive Members
          </span>
          <span className="text-[10px] text-muted">({members.length})</span>
        </div>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <m.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-2 border-t border-line-subtle bg-surface-sunken">
              <p className="text-[10px] text-muted">
                These members haven&apos;t registered a corps for this season yet. They&apos;re
                excluded from standings and weekly matchups until they do.
              </p>
            </div>
            <div className="divide-y divide-line-subtle">
              {members.map((stats) => {
                const isUser = stats.uid === viewerUid;
                return (
                  <div
                    key={stats.uid}
                    className={`flex items-center gap-3 px-4 py-2 ${isUser ? 'bg-purple-500/10' : ''}`}
                  >
                    <div
                      className={`w-7 h-7 flex-shrink-0 flex items-center justify-center ${
                        isUser
                          ? 'bg-purple-500/20 border border-purple-500/50'
                          : 'bg-surface-raised'
                      }`}
                    >
                      <span
                        className={`text-xs font-bold ${isUser ? 'text-purple-400' : 'text-muted'}`}
                      >
                        {getDisplayName(stats.uid).charAt(0)}
                      </span>
                    </div>
                    <p
                      className={`text-sm truncate ${
                        isUser ? 'text-purple-400 font-bold' : 'text-muted'
                      }`}
                    >
                      {getDisplayName(stats.uid)}
                    </p>
                    {stats.uid === commissionerUid && (
                      <Crown className="w-3 h-3 text-secondary flex-shrink-0" />
                    )}
                  </div>
                );
              })}
            </div>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
};
