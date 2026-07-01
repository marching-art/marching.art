// =============================================================================
// ENGAGEMENT TRACKING HOOK
// =============================================================================
// Tracks login streaks, daily logins, and engagement metrics
// Usage: const { engagementData, loginStreak } = useEngagement(uid, profile);

import { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../api';
import type { UserProfile, Achievement } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface EngagementData {
  loginStreak: number;
  lastLogin: string | null;
  totalLogins: number;
  recentActivity: ActivityItem[];
  weeklyProgress: WeeklyProgressData[];
}

export interface ActivityItem {
  type: 'login' | 'milestone' | 'achievement' | 'game';
  message: string;
  timestamp: string;
  icon: string;
}

export interface WeeklyProgressData {
  week: number;
  xpEarned: number;
  rehearsalsCompleted: number;
}

export interface UseEngagementReturn {
  engagementData: EngagementData;
  newAchievement: Achievement | null;
  clearNewAchievement: () => void;
}

// =============================================================================
// STREAK MILESTONES
// =============================================================================

const STREAK_MILESTONES = [3, 7, 14, 30, 60, 100];

function getStreakRarity(streak: number): Achievement['rarity'] {
  if (streak >= 30) return 'legendary';
  if (streak >= 14) return 'epic';
  if (streak >= 7) return 'rare';
  return 'common';
}

// =============================================================================
// HOOK
// =============================================================================

export function useEngagement(
  uid: string | undefined,
  profile: UserProfile | null
): UseEngagementReturn {
  const [engagementData, setEngagementData] = useState<EngagementData>({
    loginStreak: 0,
    lastLogin: null,
    totalLogins: 0,
    recentActivity: [],
    weeklyProgress: [],
  });
  const [newAchievement, setNewAchievement] = useState<Achievement | null>(null);

  // Track daily login and streaks
  useEffect(() => {
    if (!uid || !profile) return;

    const updateEngagement = async () => {
      try {
        const profileRef = doc(db, `artifacts/marching-art/users/${uid}/profile/data`);
        const today = new Date().toDateString();
        const lastLogin = profile.engagement?.lastLogin;
        // engagement.lastLogin is persisted as a Firestore Timestamp; tolerate an
        // ISO string too for any legacy data written by older client builds.
        const lastLoginDateObj = lastLogin
          ? (typeof lastLogin === 'object' && 'toDate' in lastLogin
              ? (lastLogin as { toDate: () => Date }).toDate()
              : new Date(lastLogin as string))
          : null;
        const lastLoginDate = lastLoginDateObj ? lastLoginDateObj.toDateString() : null;

        // Already logged in today
        if (lastLoginDate === today) {
          if (profile.engagement) {
            // Map from stored format to local format
            const storedEngagement = profile.engagement;
            setEngagementData({
              loginStreak: storedEngagement.loginStreak,
              // Normalize the persisted Timestamp (or legacy string) to an ISO string for local state
              lastLogin: lastLoginDateObj ? lastLoginDateObj.toISOString() : null,
              totalLogins: storedEngagement.totalLogins,
              recentActivity: (storedEngagement.recentActivity || []).map((a) => ({
                type: a.type as ActivityItem['type'],
                message: a.description,
                timestamp: a.timestamp,
                icon: 'activity',
              })),
              weeklyProgress: [],
            });
          }
          return;
        }

        // Calculate new streak
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toDateString();

        let newStreak = 1;
        const currentStreak = profile.engagement?.loginStreak || 0;

        if (lastLoginDate === yesterdayStr) {
          newStreak = currentStreak + 1;
        }

        // Map stored activity to local format
        const existingActivity: ActivityItem[] = (profile.engagement?.recentActivity || []).map((a) => ({
          type: a.type as ActivityItem['type'],
          message: a.description,
          timestamp: a.timestamp,
          icon: 'activity',
        }));

        const updatedEngagement: EngagementData = {
          loginStreak: newStreak,
          lastLogin: new Date().toISOString(),
          totalLogins: (profile.engagement?.totalLogins || 0) + 1,
          recentActivity: existingActivity,
          weeklyProgress: [],
        };

        // Add login activity
        updatedEngagement.recentActivity.unshift({
          type: 'login',
          message: `Day ${newStreak} login streak!`,
          timestamp: new Date().toISOString(),
          icon: 'flame',
        });

        // Keep only recent 10 activities
        updatedEngagement.recentActivity = updatedEngagement.recentActivity.slice(0, 10);

        // Check for streak achievements
        if (STREAK_MILESTONES.includes(newStreak)) {
          const achievementId = `streak_${newStreak}`;
          const existingAchievements = profile.achievements || [];

          if (!existingAchievements.find((a) => a.id === achievementId)) {
            const achievement: Achievement = {
              id: achievementId,
              title: `${newStreak} Day Streak!`,
              description: `Logged in ${newStreak} days in a row`,
              icon: 'flame',
              earnedAt: new Date().toISOString(),
              rarity: getStreakRarity(newStreak),
            };

            await updateDoc(profileRef, {
              achievements: [...existingAchievements, achievement],
            });

            setNewAchievement(achievement);
          }
        }

        // Update profile with engagement data. Persist lastLogin as a Firestore
        // Timestamp so it matches what the backend (dailyOps) writes; local state
        // keeps the ISO string in updatedEngagement.
        await updateDoc(profileRef, {
          engagement: {
            ...updatedEngagement,
            lastLogin: serverTimestamp(),
          },
        });

        setEngagementData(updatedEngagement);
      } catch (error) {
        console.error('Error updating engagement:', error);
      }
    };

    updateEngagement();
  }, [uid, profile?.uid]);

  const clearNewAchievement = () => {
    setNewAchievement(null);
  };

  return {
    engagementData,
    newAchievement,
    clearNewAchievement,
  };
}

export default useEngagement;
