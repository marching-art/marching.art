// =============================================================================
// CHALLENGE & ACHIEVEMENT TYPES
// =============================================================================

export interface DailyChallenges {
  date: string;
  challenges: DailyChallenge[];
  completed: string[];
}

export interface DailyChallenge {
  id: string;
  title: string;
  description: string;
  xpReward?: number;
  coinReward?: number;
  requirement?: string;
  progress?: number;
  target?: number;
  // Extended properties used by hooks
  reward?: string;
  icon?: string;
  completed?: boolean;
  action?: () => void;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt: string;
}
