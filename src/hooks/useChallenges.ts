// =============================================================================
// CHALLENGES HOOK
// =============================================================================
// Manages daily and weekly challenges generation and tracking
// Usage: const { dailyChallenges, weeklyProgress } = useChallenges(profile, activeCorps);

import { useState, useEffect, useCallback } from 'react';
import { useUserStore } from '../store/userStore';
import type { UserProfile, CorpsData, CorpsClass } from '../types';

// =============================================================================
// TYPES
// =============================================================================

export interface Challenge {
  id: string;
  title: string;
  description: string;
  progress: number;
  target: number;
  reward: string;
  icon: string;
  completed: boolean;
  action?: () => void;
}

export interface WeeklyProgress {
  rehearsalsCompleted: number;
  scoreImprovement: number;
  rankChange: number;
  challengesCompleted: number;
  equipmentMaintained: number;
}

export interface UseChallengesReturn {
  dailyChallenges: Challenge[];
  setDailyChallenges: (challenges: Challenge[]) => void;
  weeklyProgress: WeeklyProgress;
  completeDailyChallenge: (challengeId: string) => void;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getGameDay(): string {
  const now = new Date();
  // Game day resets at 2 AM local time
  if (now.getHours() < 2) {
    now.setDate(now.getDate() - 1);
  }
  return now.toISOString().split('T')[0];
}

// =============================================================================
// HOOK
// =============================================================================

export function useChallenges(
  profile: UserProfile | null,
  activeCorps: CorpsData | null,
  activeCorpsClass: CorpsClass | null,
  executionState: {
    lastRehearsalDate?: Date | { toDate: () => Date };
    equipment?: Record<string, { condition: number }>;
    rehearsalsCompleted?: number;
  } | null,
  canRehearseToday: boolean
): UseChallengesReturn {
  const { saveDailyChallenges, completeDailyChallenge } = useUserStore();
  const [dailyChallenges, setDailyChallenges] = useState<Challenge[]>([]);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress>({
    rehearsalsCompleted: 0,
    scoreImprovement: 0,
    rankChange: 0,
    challengesCompleted: 0,
    equipmentMaintained: 0,
  });

  // Generate daily challenges
  useEffect(() => {
    if (!profile || !activeCorps) return;

    const generateChallenges = () => {
      const today = getGameDay();
      const savedChallenges = profile.challenges || {};
      const todayChallenges = savedChallenges[today];

      // Use saved challenges if they exist
      if (todayChallenges) {
        setDailyChallenges(todayChallenges as Challenge[]);
        return;
      }

      const challenges: Challenge[] = [];

      // Check if rehearsed today
      const lastRehearsalDate = executionState?.lastRehearsalDate;
      const rehearsalDate = lastRehearsalDate
        ? typeof lastRehearsalDate === 'object' && 'toDate' in lastRehearsalDate
          ? lastRehearsalDate.toDate()
          : lastRehearsalDate
        : null;
      const rehearsedToday =
        rehearsalDate &&
        new Date(rehearsalDate.getTime()).toDateString() === new Date().toDateString() &&
        new Date().getHours() >= 2;

      // Daily rehearsal challenge (not for SoundSport)
      if (canRehearseToday && activeCorpsClass !== 'soundSport') {
        challenges.push({
          id: 'rehearse_today',
          title: 'Daily Practice',
          description: 'Complete a rehearsal with your corps',
          progress: rehearsedToday ? 1 : 0,
          target: 1,
          reward: '50 XP',
          icon: 'target',
          completed: Boolean(rehearsedToday),
        });
      }

      // Leaderboard challenge
      challenges.push({
        id: 'check_leaderboard',
        title: 'Scout the Competition',
        description: 'Visit the leaderboard page',
        progress: 0,
        target: 1,
        reward: '25 XP',
        icon: 'trophy',
        completed: false,
        action: () => (window.location.href = '/leaderboard'),
      });

      // Equipment challenge
      if (executionState?.equipment) {
        challenges.push({
          id: 'maintain_equipment',
          title: 'Equipment Care',
          description: 'Check your equipment status',
          progress: 0,
          target: 1,
          reward: '30 XP',
          icon: 'wrench',
          completed: false,
        });
      }

      // Staff challenge
      challenges.push({
        id: 'staff_meeting',
        title: 'Staff Meeting',
        description: 'Visit the staff market',
        progress: 0,
        target: 1,
        reward: '25 XP',
        icon: 'users',
        completed: false,
      });

      // Schedule challenge
      if (activeCorps?.selectedShows) {
        const totalWeeks = 7;
        const weeksWithShows = Object.keys(activeCorps.selectedShows).filter(
          (weekKey) =>
            (activeCorps.selectedShows as Record<string, string[]>)[weekKey]?.length > 0
        ).length;
        const hasFullSchedule = weeksWithShows >= totalWeeks;

        challenges.push({
          id: 'schedule_master',
          title: 'Schedule Master',
          description: 'Select shows for all 7 weeks',
          progress: weeksWithShows,
          target: totalWeeks,
          reward: '100 XP',
          icon: 'calendar',
          completed: hasFullSchedule,
        });
      }

      setDailyChallenges(challenges);

      // Save to store
      if (challenges.length > 0) {
        saveDailyChallenges(challenges);
      }
    };

    generateChallenges();
  }, [
    profile,
    activeCorps,
    activeCorpsClass,
    canRehearseToday,
    executionState?.lastRehearsalDate,
    executionState?.equipment,
    saveDailyChallenges,
  ]);

  // Calculate weekly progress
  useEffect(() => {
    if (!profile || !activeCorps || activeCorpsClass === 'soundSport') return;

    const calculateWeeklyProgressData = () => {
      const weekData = profile.engagement?.weeklyProgress?.[activeCorpsClass] || {};
      const previousWeekData = (weekData as { previous?: WeeklyProgress }).previous || {};

      const rehearsalsThisWeek = executionState?.rehearsalsCompleted || 0;
      const rehearsalsLastWeek = previousWeekData.rehearsalsCompleted || 0;

      const currentScore = activeCorps.totalSeasonScore || 0;
      const previousScore = previousWeekData.scoreImprovement || 0;
      const scoreImprovement = currentScore - previousScore;

      const currentRank = (activeCorps as CorpsData & { rank?: number }).rank || 0;
      const previousRank = previousWeekData.rankChange || currentRank;
      const rankChange = previousRank - currentRank;

      let equipmentMaintained = 0;
      if (executionState?.equipment) {
        const equipmentCount = Object.keys(executionState.equipment).length;
        const wellMaintained = Object.values(executionState.equipment).filter(
          (eq) => eq.condition >= 80
        ).length;
        equipmentMaintained = equipmentCount > 0 ? (wellMaintained / equipmentCount) * 100 : 0;
      }

      const challengesCompleted = dailyChallenges.filter((c) => c.completed).length;

      setWeeklyProgress({
        rehearsalsCompleted: rehearsalsThisWeek - rehearsalsLastWeek,
        scoreImprovement,
        rankChange,
        challengesCompleted,
        equipmentMaintained,
      });
    };

    calculateWeeklyProgressData();
  }, [profile, activeCorps, activeCorpsClass, executionState, dailyChallenges]);

  return {
    dailyChallenges,
    setDailyChallenges,
    weeklyProgress,
    completeDailyChallenge,
  };
}

export default useChallenges;
