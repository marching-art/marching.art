// LeagueActivityFeed - Shows recent league events and notifications
// Keeps users engaged with real-time activity updates

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, Swords, TrendingUp, MessageSquare, ArrowLeftRight,
  Check, UserPlus, Flame, ChevronRight, Filter, Eye,
  Trophy, Calendar, Clock, X, CheckCircle
} from 'lucide-react';
import { useLeagueActivity, useLeagueNotifications, formatNotificationTime } from '../../hooks/useLeagueNotifications';

// =============================================================================
// ICON MAPPING - Enhanced Transaction Log Style
// =============================================================================

import { Star, Settings, Crown, Target, Zap, Award } from 'lucide-react';

const iconMap = {
  matchup_result: Swords,
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
  matchup_result: { text: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/30' },
  standings_change: { text: 'text-blue-400', bg: 'bg-blue-500/20', border: 'border-blue-500/30' },
  new_message: { text: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/30' },
  trade_proposal: { text: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
  trade_response: { text: 'text-teal-400', bg: 'bg-teal-500/20', border: 'border-teal-500/30' },
  member_joined: { text: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500/30' },
  rivalry_matchup: { text: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
  show_result: { text: 'text-gold-400', bg: 'bg-gold-500/20', border: 'border-gold-500/30' },
  week_start: { text: 'text-indigo-400', bg: 'bg-indigo-500/20', border: 'border-indigo-500/30' },
  week_end: { text: 'text-pink-400', bg: 'bg-pink-500/20', border: 'border-pink-500/30' },
  // New transaction log event types
  lineup_update: { text: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
  season_high: { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500/30' },
  commissioner_action: { text: 'text-gold-400', bg: 'bg-gold-500/20', border: 'border-gold-500/30' },
  achievement_unlocked: { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' },
  score_update: { text: 'text-lime-400', bg: 'bg-lime-500/20', border: 'border-lime-500/30' },
  live_matchup: { text: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/30' },
};

// =============================================================================
// ACTIVITY ITEM COMPONENT
// =============================================================================

const ActivityItem = ({ activity, isNotification = false, onMarkRead, onTap }) => {
  const Icon = iconMap[activity.type] || Bell;
  const colors = colorMap[activity.type] || colorMap.matchup_result;

  const timestamp = activity.createdAt || activity.timestamp;
  const timeAgo = timestamp ? formatNotificationTime(timestamp) : '';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      whileHover={{ scale: 1.01 }}
      onClick={() => onTap?.(activity)}
      className={`
        relative flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all
        ${isNotification && !activity.read ? 'bg-charcoal-900/60 border border-gold-500/30' : 'bg-charcoal-900/30 border border-cream-500/10'}
        hover:border-cream-500/30
      `}
    >
      {/* Unread indicator */}
      {isNotification && !activity.read && (
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
      )}

      {/* Icon */}
      <div className={`p-2 rounded-lg ${colors.bg}`}>
        <Icon className={`w-4 h-4 ${colors.text}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-display font-semibold text-sm text-cream-100 truncate">
            {activity.title}
          </h4>
          <span className="text-xs text-cream-500/50 whitespace-nowrap">
            {timeAgo}
          </span>
        </div>
        <p className="text-xs text-cream-500/70 mt-0.5 line-clamp-2">
          {activity.message || activity.description}
        </p>

        {/* Metadata badges */}
        {activity.metadata && (
          <div className="flex flex-wrap gap-1 mt-2">
            {activity.metadata.won !== undefined && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                activity.metadata.won ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
              }`}>
                {activity.metadata.won ? 'Victory' : 'Defeat'}
              </span>
            )}
            {activity.metadata.isRival && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 flex items-center gap-1">
                <Flame className="w-3 h-3" /> Rivalry
              </span>
            )}
            {activity.metadata.week && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-cream-500/10 text-cream-400">
                Week {activity.metadata.week}
              </span>
            )}
            {activity.metadata.score && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400 flex items-center gap-1">
                <Target className="w-3 h-3" />
                {activity.metadata.score.toFixed(1)}
              </span>
            )}
            {activity.metadata.newRank && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                #{activity.metadata.newRank}
              </span>
            )}
            {activity.metadata.seasonHigh && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 flex items-center gap-1">
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
          onClick={(e) => {
            e.stopPropagation();
            onMarkRead(activity.id);
          }}
          className="p-1.5 rounded-lg hover:bg-cream-500/10 transition-colors"
          title="Mark as read"
        >
          <CheckCircle className="w-4 h-4 text-cream-500/50 hover:text-green-400" />
        </button>
      )}

      <ChevronRight className="w-4 h-4 text-cream-500/30 flex-shrink-0 self-center" />
    </motion.div>
  );
};

// =============================================================================
// FILTER TABS
// =============================================================================

const FilterTab = ({ active, onClick, children, count }) => (
  <button
    onClick={onClick}
    className={`
      relative px-3 py-1.5 rounded-lg text-xs font-display font-semibold transition-all
      ${active
        ? 'bg-gold-500 text-charcoal-900'
        : 'bg-charcoal-900/30 text-cream-400 hover:bg-charcoal-900/50'
      }
    `}
  >
    {children}
    {count > 0 && (
      <span className={`
        absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] flex items-center justify-center
        ${active ? 'bg-charcoal-900 text-gold-400' : 'bg-gold-500 text-charcoal-900'}
      `}>
        {count > 99 ? '99+' : count}
      </span>
    )}
  </button>
);

// =============================================================================
// LEAGUE ACTIVITY FEED COMPONENT
// =============================================================================

const LeagueActivityFeed = ({
  leagueId,
  userId,
  league,
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
    unreadCount,
    loading: notificationsLoading,
    markAsRead,
    markAllAsRead,
  } = useLeagueNotifications(userId, {
    enabled: !!userId,
    limit: 50,
  });

  // Filter notifications for this league
  const leagueNotifications = useMemo(() => {
    return notifications.filter(n => n.leagueId === leagueId);
  }, [notifications, leagueId]);

  const leagueUnreadCount = useMemo(() => {
    return leagueNotifications.filter(n => !n.read).length;
  }, [leagueNotifications]);

  // Combine and filter items
  const filteredItems = useMemo(() => {
    let items = [];

    if (activeFilter === 'all' || activeFilter === 'activity') {
      items = [...items, ...activities.map(a => ({ ...a, isActivity: true }))];
    }

    if (activeFilter === 'all' || activeFilter === 'notifications') {
      items = [...items, ...leagueNotifications.map(n => ({ ...n, isNotification: true }))];
    }

    // Sort by timestamp
    items.sort((a, b) => {
      const timeA = (a.createdAt || a.timestamp)?.toMillis?.() || 0;
      const timeB = (b.createdAt || b.timestamp)?.toMillis?.() || 0;
      return timeB - timeA;
    });

    // Apply type filter
    if (activeFilter === 'matchups') {
      items = items.filter(i => i.type === 'matchup_result' || i.type === 'rivalry_matchup');
    } else if (activeFilter === 'chat') {
      items = items.filter(i => i.type === 'new_message');
    } else if (activeFilter === 'trades') {
      items = items.filter(i => i.type === 'trade_proposal' || i.type === 'trade_response');
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
      <div className="glass rounded-xl p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cream-500/10 animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-cream-500/10 rounded animate-pulse" />
            <div className="h-3 w-48 bg-cream-500/10 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`glass rounded-xl ${compact ? 'p-3' : 'p-4'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gold-400" />
          <h3 className="text-sm font-display font-semibold text-cream-100">
            Activity Feed
          </h3>
          {leagueUnreadCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-gold-500/20 text-gold-400 text-xs font-bold">
              {leagueUnreadCount} new
            </span>
          )}
        </div>

        {leagueUnreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="text-xs text-cream-500/60 hover:text-cream-300 transition-colors flex items-center gap-1"
          >
            <Eye className="w-3 h-3" />
            Mark all read
          </button>
        )}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="flex flex-wrap gap-2 mb-3 pb-3 border-b border-cream-500/10">
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
            active={activeFilter === 'chat'}
            onClick={() => setActiveFilter('chat')}
            count={0}
          >
            Chat
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-8"
            >
              <Bell className="w-8 h-8 mx-auto text-cream-500/30 mb-2" />
              <p className="text-cream-500/50 text-sm">
                No activity yet
              </p>
              <p className="text-cream-500/30 text-xs mt-1">
                Check back after some matchups!
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Show More */}
      {hasMore && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full mt-3 py-2 text-sm text-cream-400 hover:text-cream-200 transition-colors flex items-center justify-center gap-2"
        >
          Show all activity
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {showAll && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full mt-3 py-2 text-sm text-cream-500/60 hover:text-cream-400 transition-colors"
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
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto glass rounded-xl border border-cream-500/20 shadow-2xl z-50"
    >
      {/* Header */}
      <div className="sticky top-0 bg-charcoal-900/95 backdrop-blur-xl p-3 border-b border-cream-500/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-gold-400" />
          <span className="font-display font-semibold text-cream-100">Notifications</span>
          {unreadCount > 0 && (
            <span className="px-1.5 py-0.5 rounded-full bg-gold-500 text-charcoal-900 text-xs font-bold">
              {unreadCount}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              onClick={onMarkAllRead}
              className="text-xs text-cream-500/60 hover:text-cream-300"
            >
              Mark all read
            </button>
          )}
          <button onClick={onClose} className="p-1 hover:bg-cream-500/10 rounded-lg">
            <X className="w-4 h-4 text-cream-500/50" />
          </button>
        </div>
      </div>

      {/* Notification List */}
      <div className="p-2 space-y-1">
        {notifications.length > 0 ? (
          notifications.slice(0, 20).map((notification) => (
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
            <Bell className="w-8 h-8 mx-auto text-cream-500/30 mb-2" />
            <p className="text-cream-500/50 text-sm">No notifications</p>
          </div>
        )}
      </div>
    </motion.div>
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
      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-xs">
        <Flame className="w-3 h-3" />
        <span>{rivalry.matchupCount}x</span>
      </div>
    );
  }

  return (
    <div className="p-3 rounded-xl bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/20">
      <div className="flex items-center gap-2 mb-2">
        <Flame className="w-4 h-4 text-red-400" />
        <span className="font-display font-semibold text-red-400 text-sm">Rivalry</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-cream-500/60">vs {rivalry.rivalName}</p>
          <p className="font-display font-bold text-cream-100">
            {rivalry.userWins}-{rivalry.rivalWins}
            {rivalry.ties > 0 && <span className="text-cream-500/60">-{rivalry.ties}</span>}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs text-cream-500/60">{rivalry.matchupCount} matchups</p>
          {rivalry.streak && (
            <p className={`text-xs font-semibold ${
              rivalry.streak.type === 'W' ? 'text-green-400' : 'text-red-400'
            }`}>
              {rivalry.streak.type}{rivalry.streak.count} streak
            </p>
          )}
        </div>
      </div>

      <div className="mt-2 h-1 rounded-full bg-charcoal-900/50 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            userLeading ? 'bg-green-500' : tied ? 'bg-cream-500' : 'bg-red-500'
          }`}
          style={{
            width: `${(rivalry.userWins / (rivalry.userWins + rivalry.rivalWins + rivalry.ties)) * 100}%`
          }}
        />
      </div>
    </div>
  );
};

export default LeagueActivityFeed;
