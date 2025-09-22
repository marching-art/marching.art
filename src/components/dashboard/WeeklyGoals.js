// components/dashboard/WeeklyGoals.js
// Weekly goals widget for user engagement and progression tracking

import React, { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useUserStore } from '../../store/userStore';
import Icon from '../ui/Icon';
import toast from 'react-hot-toast';

const WeeklyGoals = () => {
  const { user, loggedInProfile, updateUserExperience } = useUserStore();
  const [goals, setGoals] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  // Default weekly goals that adapt to user level and activity
  const generateDefaultGoals = () => {
    const userLevel = loggedInProfile?.level || 1;
    const hasStaff = loggedInProfile?.corps && Object.values(loggedInProfile.corps).some(corps => 
      corps.staffLineup && Object.keys(corps.staffLineup).length > 0
    );

    const defaultGoals = [
      {
        id: 'daily_login',
        title: 'Daily Check-in',
        description: 'Log in to the game 5 days this week',
        target: 5,
        progress: 0,
        reward: { experience: 150, points: 50 },
        category: 'engagement',
        icon: 'M13 10V3L4 14h7v7l9-11h-7z'
      },
      {
        id: 'lineup_update',
        title: 'Active Management',
        description: 'Update at least one corps lineup',
        target: 1,
        progress: 0,
        reward: { experience: 100, points: 30 },
        category: 'gameplay',
        icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z'
      }
    ];

    // Add level-appropriate goals
    if (userLevel >= 5) {
      defaultGoals.push({
        id: 'staff_hiring',
        title: 'Staff Development',
        description: hasStaff ? 'Trade or upgrade 1 staff member' : 'Hire your first staff member',
        target: 1,
        progress: 0,
        reward: { experience: 200, points: 75 },
        category: 'staff',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z'
      });
    }

    if (userLevel >= 10) {
      defaultGoals.push({
        id: 'social_interaction',
        title: 'Community Engagement',
        description: 'Join a league or make a trade proposal',
        target: 1,
        progress: 0,
        reward: { experience: 250, points: 100 },
        category: 'social',
        icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 715.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 919.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0z'
      });
    }

    return defaultGoals;
  };

  useEffect(() => {
    if (user && loggedInProfile) {
      const weeklyGoals = generateDefaultGoals();
      setGoals(weeklyGoals);
      setIsLoading(false);
    }
  }, [user, loggedInProfile]);

  const claimReward = async (goalId) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal || !goal.completed || goal.claimed) return;

    try {
      await updateUserExperience(goal.reward.experience, `Weekly goal: ${goal.title}`);
      
      setGoals(prev => prev.map(g => 
        g.id === goalId ? { ...g, claimed: true } : g
      ));
      
      toast.success(`Goal completed! +${goal.reward.experience} XP`);
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast.error('Failed to claim reward');
    }
  };

  const getProgressPercentage = (goal) => {
    return Math.min(100, (goal.progress / goal.target) * 100);
  };

  const completedGoals = goals.filter(g => g.completed);
  const activeGoals = goals.filter(g => !g.completed);

  if (isLoading) {
    return (
      <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-accent rounded w-3/4"></div>
          <div className="h-3 bg-accent rounded w-1/2"></div>
          <div className="h-2 bg-accent rounded w-full"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface dark:bg-surface-dark rounded-theme p-6 border border-accent dark:border-accent-dark shadow-theme">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold text-text-primary dark:text-text-primary-dark">
          Weekly Goals
        </h3>
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className="text-primary dark:text-primary-dark hover:text-primary/80 transition-colors text-sm"
        >
          {showCompleted ? 'Hide Completed' : `View Completed (${completedGoals.length})`}
        </button>
      </div>

      <div className="space-y-4">
        {/* Active Goals */}
        {activeGoals.map((goal) => (
          <div key={goal.id} className="p-4 bg-background dark:bg-background-dark rounded-theme border border-accent dark:border-accent-dark">
            <div className="flex items-start gap-3 mb-3">
              <Icon path={goal.icon} className="w-5 h-5 text-primary dark:text-primary-dark mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                  {goal.title}
                </h4>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  {goal.description}
                </p>
              </div>
              <span className="text-xs px-2 py-1 bg-primary/20 text-primary dark:text-primary-dark rounded-full">
                {goal.category}
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-text-secondary dark:text-text-secondary-dark">Progress</span>
                <span className="text-text-primary dark:text-text-primary-dark">
                  {goal.progress}/{goal.target}
                </span>
              </div>
              
              <div className="w-full bg-accent dark:bg-accent-dark rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${getProgressPercentage(goal)}%` }}
                ></div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                  Reward: {goal.reward.experience} XP
                </span>
                <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                  {Math.round(getProgressPercentage(goal))}% complete
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Completed Goals */}
        {showCompleted && completedGoals.map((goal) => (
          <div key={goal.id} className="p-4 bg-green-500/10 border border-green-500/30 rounded-theme">
            <div className="flex items-start gap-3 mb-2">
              <Icon path={goal.icon} className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h4 className="font-semibold text-text-primary dark:text-text-primary-dark">
                  {goal.title}
                </h4>
                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                  {goal.description}
                </p>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                ✓ Completed
              </span>
              {!goal.claimed ? (
                <button
                  onClick={() => claimReward(goal.id)}
                  className="bg-green-500 text-white px-3 py-1 rounded text-sm font-semibold hover:bg-green-600 transition-colors"
                >
                  Claim Reward
                </button>
              ) : (
                <span className="text-xs text-text-secondary dark:text-text-secondary-dark">
                  Reward claimed
                </span>
              )}
            </div>
          </div>
        ))}

        {goals.length === 0 && (
          <div className="text-center py-6 text-text-secondary dark:text-text-secondary-dark">
            <Icon path="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" 
                  className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No weekly goals available</p>
          </div>
        )}
      </div>

      {/* Weekly Progress Summary */}
      {goals.length > 0 && (
        <div className="mt-4 pt-4 border-t border-accent dark:border-accent-dark">
          <div className="flex justify-between items-center text-sm">
            <span className="text-text-secondary dark:text-text-secondary-dark">
              Weekly Progress
            </span>
            <span className="font-medium text-text-primary dark:text-text-primary-dark">
              {completedGoals.length}/{goals.length} goals
            </span>
          </div>
          <div className="w-full bg-accent dark:bg-accent-dark rounded-full h-2 mt-2">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${goals.length > 0 ? (completedGoals.length / goals.length) * 100 : 0}%` }}
            ></div>
          </div>
          
          {completedGoals.length === goals.length && goals.length > 0 && (
            <div className="mt-2 text-center">
              <span className="text-sm font-medium text-green-600 dark:text-green-400">
                🎉 All weekly goals completed! New goals available Monday.
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default WeeklyGoals;