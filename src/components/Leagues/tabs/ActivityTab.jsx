// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// ActivityTab - League insights dashboard with stats, achievements, and activity feed
// Design System: Card-based dashboard with engaging visualizations

import React from 'react';
import { m } from 'framer-motion';
import { Activity } from 'lucide-react';
import LeagueActivityFeed from '../LeagueActivityFeed';
import { LeagueStatsOverview, AchievementsCard, PowerRankingsCard } from './ActivityTabStatsCards';
import { WeeklyRecapCard, EnhancedRivalriesCard } from './ActivityTabRecapCards';

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
}) => {
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
            onActivityTap={(activity) => {
              if (activity.type === 'matchup_result' && activity.metadata?.week) {
                onMatchupClick?.(activity);
              } else if (activity.type === 'new_message') {
                onChatOpen?.();
              }
            }}
          />
        </div>
      </div>
    </m.div>
  );
};

export default ActivityTab;
