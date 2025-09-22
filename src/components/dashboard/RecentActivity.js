// components/dashboard/RecentActivity.js
// Recent activity feed widget for user dashboard

import React from 'react';
import Icon from '../ui/Icon';

const RecentActivity = ({ activities = [] }) => {
  const getActivityIcon = (type) => {
    switch (type) {
      case 'experience_gained':
        return 'M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z';
      case 'staff_lineup_created':
        return 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z';
      case 'staff_updated':
        return 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z';
      case 'challenge_completed':
        return 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z';
      case 'trade_completed':
        return 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4';
      case 'league_joined':
        return 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z';
      default:
        return 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
    }
  };

  const getActivityColor = (type) => {
    switch (type) {
      case 'experience_gained':
        return 'text-yellow-500';
      case 'staff_lineup_created':
      case 'staff_updated':
        return 'text-green-500';
      case 'challenge_completed':
        return 'text-blue-500';
      case 'trade_completed':
        return 'text-purple-500';
      case 'league_joined':
        return 'text-orange-500';
      default:
        return 'text-primary';
    }
  };

  const getActivityMessage = (activity) => {
    switch (activity.type) {
      case 'experience_gained':
        return `Gained ${activity.points || 0} XP${activity.reason ? ` - ${activity.reason}` : ''}`;
      case 'staff_lineup_created':
        return `Created staff lineup for ${activity.corpsClass || 'corps'}`;
      case 'staff_updated':
        return `Updated ${activity.caption || 'staff'} position`;
      case 'challenge_completed':
        return `Completed challenge: ${activity.challengeId || 'Daily Challenge'}`;
      case 'trade_completed':
        return `Completed trade with ${activity.targetUser || 'another director'}`;
      case 'league_joined':
        return `Joined league: ${activity.leagueName || 'Unknown League'}`;
      default:
        return activity.description || 'Activity completed';
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Recently';
    
    const now = new Date();
    const time = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
    const diffMs = now - time;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) return `${diffDays}d ago`;
    if (diffHours > 0) return `${diffHours}h ago`;
    return 'Just now';
  };

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
      <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark mb-4">
        Recent Activity
      </h3>

      {activities.length === 0 ? (
        <div className="text-center py-6 text-text-secondary dark:text-text-secondary-dark">
          <Icon path="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p>No recent activity</p>
          <p className="text-sm">Start playing to see your activity here!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {activities.slice(0, 5).map((activity, index) => (
            <div key={index} className="flex items-center gap-3 p-3 bg-background dark:bg-background-dark rounded-theme">
              <Icon 
                path={getActivityIcon(activity.type)} 
                className={`w-5 h-5 ${getActivityColor(activity.type)} flex-shrink-0`} 
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary dark:text-text-primary-dark truncate">
                  {getActivityMessage(activity)}
                </p>
                {activity.metadata && (
                  <p className="text-xs text-text-secondary dark:text-text-secondary-dark">
                    {activity.metadata.corpsName && `Corps: ${activity.metadata.corpsName}`}
                    {activity.metadata.points && ` • ${activity.metadata.points} pts`}
                  </p>
                )}
              </div>
              <span className="text-xs text-text-secondary dark:text-text-secondary-dark flex-shrink-0">
                {formatTime(activity.timestamp)}
              </span>
            </div>
          ))}
          
          {activities.length > 5 && (
            <div className="text-center pt-2">
              <button className="text-sm text-primary dark:text-primary-dark hover:text-primary/80 font-medium">
                View All Activity
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RecentActivity;