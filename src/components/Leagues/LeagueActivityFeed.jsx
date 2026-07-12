// LeagueActivityFeed - Shows recent league events and notifications
// Keeps users engaged with real-time activity updates

import React, { useState, useMemo, useCallback } from 'react';
import { m, AnimatePresence } from 'framer-motion';
import {
  Bell,
  Swords,
  TrendingUp,
  MessageSquare,
  ArrowLeftRight,
  Check,
  UserPlus,
  Flame,
  ChevronRight,
  Eye,
  Trophy,
  Calendar,
  Clock,
  X,
  CheckCircle,
} from 'lucide-react';
import {
  useLeagueActivity,
  useLeagueNotifications,
  formatNotificationTime,
} from '../../hooks/useLeagueNotifications';

// =============================================================================
// ICON MAPPING - Enhanced Transaction Log Style
// =============================================================================

import { Star, Settings, Crown, Target, Zap, Award } from 'lucide-react';

const iconMap = {
  matchup_result: Swords,
  new_champion: Trophy,
  standings_change: TrendingUp,
  new_message: MessageSquare,
  trade_proposal: ArrowLeftRight,
  trade_response: Check,
  member_joined: UserPlus,
  rivalry_matchup: Flame,
  show_result: Trophy,
  week_start: Calendar,
  week_end: Clock,
  // New transaction log event types
  lineup_update: Settings,
  season_high: Star,
  commissioner_action: Crown,
  achievement_unlocked: Award,
  score_update: Target,
  live_matchup: Zap,
};

const colorMap = {
  matchup_result: {
    text: 'text-purple-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
  },
  new_champion: { text: 'text-brand', bg: 'bg-brand/10', border: 'border-brand/30' },
  standings_change: { text: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
  new_message: { text: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  trade_proposal: {
    text: 'text-orange-500',
    bg: 'bg-orange-500/10',
    border: 'border-orange-500/30',
  },
  trade_response: { text: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
  member_joined: { text: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
  rivalry_matchup: { text: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  show_result: { text: 'text-secondary', bg: 'bg-surface-raised', border: 'border-line' },
  week_start: { text: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  week_end: { text: 'text-pink-500', bg: 'bg-pink-500/10', border: 'border-pink-500/30' },
  // New transaction log event types
  lineup_update: {
    text: 'text-secondary',
    bg: 'bg-surface-raised',
    border: 'border-line',
  },
  season_high: { text: 'text-brand', bg: 'bg-brand/10', border: 'border-brand/30' },
  commissioner_action: {
    text: 'text-secondary',
    bg: 'bg-surface-raised',
    border: 'border-line',
  },
  achievement_unlocked: {
    text: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
  },
  score_update: { text: 'text-lime-500', bg: 'bg-lime-500/10', border: 'border-lime-500/30' },
  live_matchup: { text: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/30' },
};

// =============================================================================
// ACTIVITY ITEM COMPONENT
// =============================================================================

const ActivityItem = React.memo(({ activity, isNotification = false, onMarkRead, onTap }) => {
  const Icon = iconMap[activity.type] || Bell;
  const colors = colorMap[activity.type] || colorMap.matchup_result;

  const timestamp = activity.createdAt || activity.timestamp;
  const timeAgo = timestamp ? formatNotificationTime(timestamp) : '';

  const handleClick = useCallback(() => {
    onTap?.(activity);
  }, [onTap, activity]);

  const handleMarkRead = useCallback(
    (e) => {
      e.stopPropagation();
      onMarkRead(activity.id);
    },
    [onMarkRead, activity.id]
  );

  return (
    <m.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      whileHover={{ scale: 1.01 }}
      onClick={handleClick}
      className={`
        relative flex items-start gap-3 p-3 rounded-none cursor-pointer transition-all
        ${isNotification && !activity.read ? 'bg-surface-raised border border-warning/30' : 'bg-surface-card border border-line'}
        hover:border-line-strong
      `}
    >
      {/* Unread indicator */}
      {isNotification && !activity.read && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-none bg-warning animate-pulse" />
      )}

      {/* Icon */}
      <div className={`p-2 rounded-none ${colors.bg}`}>
        <Icon className={`w-4 h-4 ${colors.text}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold text-sm text-white truncate">{activity.title}</h4>
          <span className="text-xs text-muted whitespace-nowrap">{timeAgo}</span>
        </div>
        <p className="text-xs text-muted mt-0.5 line-clamp-2">
          {activity.message || activity.description}
        </p>

        {/* Metadata badges */}
        {activity.metadata && (
          <div className="flex flex-wrap gap-1 mt-2">
            {activity.metadata.won !== undefined && (
              <span
                className={`text-xs px-2 py-0.5 rounded-none ${
                  activity.metadata.won
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-red-500/10 text-red-500'
                }`}
              >
                {activity.metadata.won ? 'Victory' : 'Defeat'}
              </span>
            )}
            {activity.metadata.isRival && (
              <span className="text-xs px-2 py-0.5 rounded-none bg-red-500/10 text-red-500 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Rivalry
              </span>
            )}
            {activity.metadata.week && (
              <span className="text-xs px-2 py-0.5 rounded-none bg-line text-muted">
                Week {activity.metadata.week}
              </span>
            )}
            {activity.metadata.score && (
              <span className="text-xs px-2 py-0.5 rounded-none bg-surface-raised text-secondary flex items-center gap-1">
                <Target className="w-3 h-3" />
                {activity.metadata.score.toFixed(1)}
              </span>
            )}
            {activity.metadata.newRank && (
              <span className="text-xs px-2 py-0.5 rounded-none bg-blue-500/10 text-blue-500 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />#{activity.metadata.newRank}
              </span>
            )}
            {activity.metadata.seasonHigh && (
              <span className="text-xs px-2 py-0.5 rounded-none bg-brand/10 text-brand flex items-center gap-1">
                <Star className="w-3 h-3" />
                Season High!
              </span>
            )}
          </div>
        )}
      </div>

      {/* Mark as read button for notifications */}
      {isNotification && !activity.read && onMarkRead && (
        <button
          onClick={handleMarkRead}
          className="p-1.5 rounded-none hover:bg-line transition-colors"
          title="Mark as read"
        >
          <CheckCircle className="w-4 h-4 text-muted hover:text-green-500" />
        </button>
      )}

      <ChevronRight className="w-4 h-4 text-muted flex-shrink-0 self-center" />
    </m.div>
  );
});
ActivityItem.displayName = 'ActivityItem';

// =============================================================================
// FILTER TABS
// =============================================================================

const FilterTab = React.memo(({ active, onClick, children, count }) => (
  <button
    onClick={onClick}
    className={`
      relative px-3 py-1.5 rounded-none text-xs font-bold transition-all
      ${active ? 'bg-interactive text-white' : 'bg-surface-raised text-muted hover:bg-line'}
    `}
  >
    {children}
    {count > 0 && (
      <span
        className={`
        absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-none text-[10px] flex items-center justify-center
        ${active ? 'bg-black text-interactive' : 'bg-interactive text-white'}
      `}
      >
        {count > 99 ? '99+' : count}
      </span>
    )}
  </button>
));
FilterTab.displayName = 'FilterTab';

// =============================================================================
// LEAGUE ACTIVITY FEED COMPONENT
// =============================================================================

const LeagueActivityFeed = ({
  leagueId,
  userId,
  league: _league,
  compact = false,
  showFilters = true,
  maxItems = 10,
  onActivityTap,
}) => {
  const [activeFilter, setActiveFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  // Fetch league activity
  const { activities, loading: activityLoading } = useLeagueActivity(leagueId, {
    enabled: !!leagueId,
    limit: 50,
  });

  // Fetch user notifications for this league
  const {
    notifications,
    loading: notificationsLoading,
    markAsRead,
    markAllAsRead,
  } = useLeagueNotifications(userId, {
    enabled: !!userId,
    limit: 50,
  });

  // Filter notifications for this league
  const leagueNotifications = useMemo(() => {
    return notifications.filter((n) => n.leagueId === leagueId);
  }, [notifications, leagueId]);

  const leagueUnreadCount = useMemo(() => {
    return leagueNotifications.filter((n) => !n.read).length;
  }, [leagueNotifications]);

  // Combine and filter items
  const filteredItems = useMemo(() => {
    let items = [];

    if (activeFilter === 'all' || activeFilter === 'activity') {
      items = [...items, ...activities.map((a) => ({ ...a, isActivity: true }))];
    }

    if (activeFilter === 'all' || activeFilter === 'notifications') {
      items = [...items, ...leagueNotifications.map((n) => ({ ...n, isNotification: true }))];
    }

    // Sort by timestamp
    items.sort((a, b) => {
      const timeA = (a.createdAt || a.timestamp)?.toMillis?.() || 0;
      const timeB = (b.createdAt || b.timestamp)?.toMillis?.() || 0;
      return timeB - timeA;
    });

    // Apply type filter. (A 'chat' filter used to exist here, but chat
    // messages live in the league's chat subcollection, not the activity
    // feed — the filter could never match anything and is gone.)
    if (activeFilter === 'matchups') {
      items = items.filter((i) => i.type === 'matchup_result' || i.type === 'rivalry_matchup');
    } else if (activeFilter === 'trades') {
      items = items.filter((i) => i.type === 'trade_proposal' || i.type === 'trade_response');
    }

    return showAll ? items : items.slice(0, maxItems);
  }, [activities, leagueNotifications, activeFilter, showAll, maxItems]);

  const hasMore = useMemo(() => {
    const totalItems = activities.length + leagueNotifications.length;
    return totalItems > maxItems && !showAll;
  }, [activities.length, leagueNotifications.length, maxItems, showAll]);

  const isLoading = activityLoading || notificationsLoading;

  if (isLoading && filteredItems.length === 0) {
    return (
      <div className="bg-surface-card border border-line rounded-none p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-none bg-line animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-line rounded-none animate-pulse" />
            <div className="h-3 w-48 bg-line rounded-none animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-surface-card border border-line rounded-none ${compact ? 'p-3' : 'p-4'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-secondary" />
          <h3 className="text-sm font-bold text-white">Activity Feed</h3>
          {leagueUnreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-none bg-warning/10 text-warning text-xs font-bold">
              {leagueUnreadCount} new
            </span>
          )}
        </div>

        {leagueUnreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-muted hover:text-secondary transition-colors flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />
            Mark all read
          </button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-line">
          <FilterTab
            active={activeFilter === 'all'}
            onClick={() => setActiveFilter('all')}
            count={0}
          >
            All
          </FilterTab>
          <FilterTab
            active={activeFilter === 'notifications'}
            onClick={() => setActiveFilter('notifications')}
            count={leagueUnreadCount}
          >
            Notifications
          </FilterTab>
          <FilterTab
            active={activeFilter === 'matchups'}
            onClick={() => setActiveFilter('matchups')}
            count={0}
          >
            Matchups
          </FilterTab>
          <FilterTab
            active={activeFilter === 'trades'}
            onClick={() => setActiveFilter('trades')}
            count={0}
          >
            Trades
          </FilterTab>
        </div>
      )}

      {/* Activity List */}
      <div className="space-y-2">
        <AnimatePresence mode="popLayout">
          {filteredItems.length > 0 ? (
            filteredItems.map((item) => (
              <ActivityItem
                key={item.id}
                activity={item}
                isNotification={item.isNotification}
                onMarkRead={item.isNotification ? markAsRead : undefined}
                onTap={onActivityTap}
              />
            ))
          ) : (
            <m.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-8">
              <Bell className="w-8 h-8 mx-auto text-muted mb-2" />
              <p className="text-muted text-sm">No activity yet</p>
              <p className="text-muted text-xs mt-1">Check back after some matchups!</p>
            </m.div>
          )}
        </AnimatePresence>
      </div>

      {/* Show More */}
      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full mt-3 py-2 text-sm text-muted hover:text-white transition-colors flex items-center justify-center gap-2"
        >
          Show all activity
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full mt-3 py-2 text-sm text-muted hover:text-muted transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
};

// =============================================================================
// NOTIFICATION DROPDOWN COMPONENT
// =============================================================================

export const NotificationDropdown = ({
  notifications,
  unreadCount,
  onMarkRead,
  onMarkAllRead,
  onClose,
  onNotificationClick,
}) => {
  return (
    <m.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-surface-card border border-line rounded-none z-50"
    >
      {/* Header */}
      <div className="sticky top-0 bg-surface-card p-3 border-b border-line flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-secondary" />
          <span className="font-bold text-white">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-none bg-warning text-black text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button onClick={onMarkAllRead} className="text-xs text-muted hover:text-secondary">
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-line rounded-none">
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="p-2 space-y-1">
        {notifications.length > 0 ? (
          notifications
            .slice(0, 20)
            .map((notification) => (
              <ActivityItem
                key={notification.id}
                activity={notification}
                isNotification={true}
                onMarkRead={onMarkRead}
                onTap={onNotificationClick}
              />
            ))
        ) : (
          <div className="text-center py-8">
            <Bell className="w-8 h-8 mx-auto text-muted mb-2" />
            <p className="text-muted text-sm">No notifications</p>
          </div>
        )}
      </div>
    </m.div>
  );
};

// =============================================================================
// RIVALRY BADGE COMPONENT
// =============================================================================

export const RivalryBadge = ({ rivalry, compact = false }) => {
  const userLeading = rivalry.userWins > rivalry.rivalWins;
  const tied = rivalry.userWins === rivalry.rivalWins;

  if (compact) {
    return (
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-none bg-red-500/10 text-red-500 text-xs">
        <Flame className="w-3 h-3" />
        <span>{rivalry.matchupCount}x</span>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-none bg-red-500/10 border border-red-500/20">
      <div className="flex items-center gap-2 mb-2">
        <Flame className="w-4 h-4 text-red-500" />
        <span className="font-bold text-red-500 text-sm">Rivalry</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted">vs {rivalry.rivalName}</p>
          <p className="font-bold text-white">
            {rivalry.userWins}-{rivalry.rivalWins}
            {rivalry.ties > 0 && <span className="text-muted">-{rivalry.ties}</span>}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-muted">{rivalry.matchupCount} matchups</p>
          {rivalry.streak && (
            <p
              className={`text-xs font-bold ${
                rivalry.streak.type === 'W' ? 'text-green-500' : 'text-red-500'
              }`}
            >
              {rivalry.streak.type}
              {rivalry.streak.count} streak
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 h-1 rounded-none bg-surface-raised overflow-hidden">
        <div
          className={`h-full rounded-none transition-all ${
            userLeading ? 'bg-green-500' : tied ? 'bg-charcoal-500' : 'bg-red-500'
          }`}
          style={{
            width: `${(rivalry.userWins / (rivalry.userWins + rivalry.rivalWins + rivalry.ties)) * 100}%`,
          }}
        />
      </div>
    </div>
  );
};

export default LeagueActivityFeed;
