// LeagueDetailHeader — the fixed header of the league command center:
// back/actions bar, league banner with the viewer's own record, and the
// sticky tab strip.
//
// Presentational only. Split out of LeagueDetailView so that file stays
// orchestration + tab routing; the markup here is unchanged from where it
// used to live inline.

import React from 'react';
import {
  Trophy,
  Crown,
  ChevronLeft,
  Settings,
  Flame,
  Copy,
  Check,
  Users,
  Calendar,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { Heading } from '../ui';
import type { LeagueMemberStanding } from '../../utils/leagueStats';

export interface LeagueDetailTab {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Renders the unread dot when the tab is not the active one. */
  badge?: boolean;
  /** Unread count, rendered next to the dot when there is one. */
  badgeCount?: number;
}

export interface LeagueDetailHeaderProps {
  leagueName?: string;
  memberCount: number;
  currentWeek: number;
  isCommissioner: boolean;
  inviteCode: string | null;
  inviteCopied: boolean;
  /** The viewer's own standings row, when they have one. */
  userStats?: LeagueMemberStanding;
  tabs: LeagueDetailTab[];
  activeTab: string;
  onBack?: () => void;
  onOpenSettings: () => void;
  onLeaveClick: () => void;
  onCopyInvite: () => void;
  onTabChange: (tabId: string) => void;
}

const LeagueDetailHeader = ({
  leagueName,
  memberCount,
  currentWeek,
  isCommissioner,
  inviteCode,
  inviteCopied,
  userStats,
  tabs,
  activeTab,
  onBack,
  onOpenSettings,
  onLeaveClick,
  onCopyInvite,
  onTabChange,
}: LeagueDetailHeaderProps) => (
  <div className="flex-shrink-0 bg-surface-card border-b border-line">
    {/* Top Bar: Back + Actions */}
    <div className="flex items-center justify-between px-4 py-2 border-b border-line-subtle">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-muted hover:text-white transition-colors text-sm"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>
      <div className="flex items-center gap-2">
        {isCommissioner && (
          <button
            aria-label="League settings"
            onClick={onOpenSettings}
            className="p-1.5 bg-surface-raised hover:bg-line transition-colors min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
          >
            <Settings className="w-4 h-4 text-muted" />
          </button>
        )}
        <button
          onClick={onLeaveClick}
          className="p-1.5 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors"
          title="Leave League"
        >
          <LogOut className="w-4 h-4 text-red-500" />
        </button>
      </div>
    </div>

    {/* League Banner Content */}
    <div className="px-4 py-3">
      <div className="flex items-center gap-3">
        {/* League Avatar */}
        <div className="w-12 h-12 bg-line border border-line-strong flex-shrink-0 flex items-center justify-center">
          <Trophy className="w-6 h-6 text-secondary" />
        </div>

        {/* Name + Meta */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Heading level="title" as="h1" className="truncate">
              {leagueName}
            </Heading>
            {isCommissioner && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-surface-raised border border-line text-secondary text-[10px] font-bold">
                <Crown className="w-2.5 h-2.5" />
                Commish
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted mt-0.5">
            <span className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {memberCount}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              Wk {currentWeek}
            </span>
          </div>
        </div>

        {/* Invite Code Badge */}
        <button
          onClick={onCopyInvite}
          className="hidden sm:flex items-center gap-2 px-3 py-2 bg-surface-raised border border-line hover:border-line-strong transition-colors"
        >
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted">Invite Code</p>
            <p className="text-sm font-bold font-mono text-interactive">{inviteCode || '——'}</p>
          </div>
          {inviteCopied ? (
            <Check className="w-4 h-4 text-green-500" />
          ) : (
            <Copy className="w-4 h-4 text-muted" />
          )}
        </button>

        {/* Your Stats - Desktop */}
        {userStats && (
          <div className="hidden md:flex items-center gap-1 border-l border-line pl-3">
            <div className="px-2 py-1 bg-surface-raised text-center min-w-[50px]">
              <p className="text-[10px] uppercase tracking-wider text-muted">Rank</p>
              <p className="text-base font-bold text-white font-data tabular-nums">
                #{userStats.currentRank}
              </p>
            </div>
            <div className="px-2 py-1 bg-surface-raised text-center min-w-[60px]">
              <p className="text-[10px] uppercase tracking-wider text-muted">Record</p>
              <p className="text-base font-bold font-data tabular-nums">
                <span className="text-green-500">{userStats.wins}</span>
                <span className="text-muted">-</span>
                <span className="text-red-500">{userStats.losses}</span>
              </p>
            </div>
            {userStats.streak > 0 && (
              <div className="px-2 py-1 bg-surface-raised text-center min-w-[50px]">
                <p className="text-[10px] uppercase tracking-wider text-muted">Streak</p>
                <p
                  className={`text-base font-bold font-data tabular-nums flex items-center justify-center gap-0.5 ${
                    userStats.streakType === 'W' ? 'text-green-500' : 'text-red-500'
                  }`}
                >
                  {userStats.streakType === 'W' && <Flame className="w-3.5 h-3.5" />}
                  {userStats.streakType}
                  {userStats.streak}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Stats Strip */}
      {userStats && (
        <div className="flex md:hidden items-center gap-2 mt-3 pt-3 border-t border-line-subtle">
          <div className="flex-1 px-2 py-1.5 bg-surface-raised text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted">Rank</p>
            <p className="text-sm font-bold text-white font-data tabular-nums">
              #{userStats.currentRank}
            </p>
          </div>
          <div className="flex-1 px-2 py-1.5 bg-surface-raised text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted">Record</p>
            <p className="text-sm font-bold font-data tabular-nums">
              <span className="text-green-500">{userStats.wins}</span>
              <span className="text-muted">-</span>
              <span className="text-red-500">{userStats.losses}</span>
            </p>
          </div>
          {userStats.streak > 0 && (
            <div className="flex-1 px-2 py-1.5 bg-surface-raised text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted">Streak</p>
              <p
                className={`text-sm font-bold font-data tabular-nums flex items-center justify-center gap-0.5 ${
                  userStats.streakType === 'W' ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {userStats.streakType === 'W' && <Flame className="w-3 h-3" />}
                {userStats.streakType}
                {userStats.streak}
              </p>
            </div>
          )}
          {/* Mobile Invite Code */}
          <button
            onClick={onCopyInvite}
            className="flex-1 px-2 py-1.5 bg-surface-raised text-center"
          >
            <p className="text-[10px] uppercase tracking-wider text-muted">Code</p>
            <p className="text-sm font-bold font-mono text-interactive">{inviteCode || '——'}</p>
          </button>
        </div>
      )}
    </div>

    {/* STICKY TABS */}
    <div className="flex border-t border-line-subtle" role="tablist" aria-label="League sections">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            id={`league-tab-${tab.id}`}
            role="tab"
            aria-selected={isActive}
            aria-controls="league-tabpanel"
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 font-bold text-sm transition-all relative ${
              isActive
                ? 'bg-background text-interactive border-t-2 border-interactive'
                : 'text-muted hover:text-white hover:bg-surface-raised'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge && !isActive && (
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-none bg-purple-500" />
                {tab.badgeCount ? (
                  <span className="text-[9px] font-bold font-data tabular-nums text-purple-400">
                    {tab.badgeCount > 99 ? '99+' : tab.badgeCount}
                  </span>
                ) : null}
              </span>
            )}
          </button>
        );
      })}
    </div>
  </div>
);

export default LeagueDetailHeader;
