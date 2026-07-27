// ActivityTab - League insights dashboard with stats, achievements, and activity feed
// Design System: Card-based dashboard with engaging visualizations

import React from 'react';
import { m } from 'framer-motion';
import { Activity } from 'lucide-react';
import LeagueActivityFeed from '../LeagueActivityFeed';
import LeagueHallOfFame from '../LeagueHallOfFame';
import LeagueRecordBook from '../LeagueRecordBook';
import { ENABLED_CLASSES } from '../../../utils/classRegistry';
import { LeagueStatsOverview, AchievementsCard, PowerRankingsCard } from './ActivityTabStatsCards';
import { WeeklyRecapCard, EnhancedRivalriesCard } from './ActivityTabRecapCards';
import type { RecordWeekDoc } from '../../../utils/leagueRecords';
import type { LeagueChampionEntry } from '../LeagueHallOfFame';

interface ActivityTabProps {
  league?: { id?: string; champions?: LeagueChampionEntry[] } | null;
  userProfile?: { uid?: string } | null;
  standings?: unknown[];
  memberProfiles?: Record<string, { displayName?: string; username?: string }>;
  leagueStats?: Record<string, unknown>;
  rivalries?: unknown[];
  weeklyMatchups?: Record<number, unknown[]>;
  weeklyResults?: Record<number, Record<string, number>>;
  currentWeek?: number;
  onMatchupClick?: (activity: { type?: string; metadata?: { week?: number } }) => void;
  onChatOpen?: () => void;
  matchupDocs?: RecordWeekDoc[];
}

// Main Activity Tab Component
const ActivityTab = ({
  league,
  userProfile,
  standings,
  memberProfiles,
  leagueStats,
  rivalries: _rivalries,
  weeklyMatchups: _weeklyMatchups,
  weeklyResults: _weeklyResults,
  currentWeek,
  onMatchupClick,
  onChatOpen,
  matchupDocs = [],
}: ActivityTabProps) => {
  const getDisplayName = (uid: string) => {
    const profile = memberProfiles?.[uid] || {};
    const displayName =
      profile.displayName && profile.displayName !== 'Director'
        ? profile.displayName
        : profile.username;
    return displayName || `Director ${String(uid).slice(0, 6)}`;
  };

  return (
    <m.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-4"
    >
      {/* Weekly Recap - Shows latest week's highlights */}
      <WeeklyRecapCard
        leagueId={league?.id}
        currentWeek={currentWeek}
        memberProfiles={memberProfiles}
      />

      {/* League Stats Overview */}
      <LeagueStatsOverview
        standings={standings}
        memberProfiles={memberProfiles}
        leagueStats={leagueStats}
        currentWeek={currentWeek}
      />

      {/* Power Rankings */}
      <PowerRankingsCard
        standings={standings}
        memberProfiles={memberProfiles}
        userProfile={userProfile}
      />

      {/* Enhanced Rivalries - Fetched from auto-generated data */}
      <EnhancedRivalriesCard
        leagueId={league?.id}
        userProfile={userProfile}
        memberProfiles={memberProfiles}
      />

      {/* Achievements */}
      <AchievementsCard standings={standings} leagueStats={leagueStats} userProfile={userProfile} />

      {/* Activity Feed */}
      <div className="bg-surface-card border border-line">
        <div className="px-4 py-3 border-b border-line bg-surface-raised">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Recent Activity
            </span>
          </div>
        </div>
        <div className="p-3">
          <LeagueActivityFeed
            leagueId={league?.id}
            userId={userProfile?.uid}
            league={league}
            showFilters={true}
            maxItems={10}
            compact={true}
            onActivityTap={(activity: { type?: string; metadata?: { week?: number } }) => {
              if (activity.type === 'matchup_result' && activity.metadata?.week) {
                onMatchupClick?.(activity);
              } else if (activity.type === 'new_message') {
                onChatOpen?.();
              }
            }}
          />
        </div>
      </div>

      {/* What happened along the way — derived from the matchup documents the
          weekly resolution already writes, and previously invisible. */}
      <LeagueRecordBook
        matchupDocs={matchupDocs}
        corpsClasses={ENABLED_CLASSES}
        getDisplayName={getDisplayName}
        viewerUid={userProfile?.uid}
      />

      {/* The league's permanent record. Season archival has always written
          champions[] onto the league document; nothing ever showed it. */}
      <LeagueHallOfFame league={league} userProfile={userProfile} />
    </m.div>
  );
};

export default ActivityTab;
