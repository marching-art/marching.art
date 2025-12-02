// =============================================================================
// BATTLE PASS HOOK
// =============================================================================
// Fetches and manages battle pass progress and rewards
// Usage: const { battlePassRewards, unclaimedCount } = useBattlePass();

import { useState, useEffect, useCallback } from 'react';
import { getBattlePassProgress } from '../api';

// =============================================================================
// TYPES
// =============================================================================

export interface BattlePassProgress {
  currentLevel: number;
  currentXP: number;
  xpToNextLevel: number;
  hasBattlePass: boolean;
  claimedRewards: {
    free: number[];
    premium: number[];
  };
  seasonId: string;
  rewards?: BattlePassReward[];
}

export interface BattlePassReward {
  level: number;
  type: 'free' | 'premium';
  rewardType: string;
  amount?: number;
  item?: string;
}

export interface UseBattlePassReturn {
  battlePassRewards: BattlePassProgress | null;
  unclaimedRewardsCount: number;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// =============================================================================
// HOOK
// =============================================================================

export function useBattlePass(): UseBattlePassReturn {
  const [battlePassRewards, setBattlePassRewards] = useState<BattlePassProgress | null>(null);
  const [unclaimedRewardsCount, setUnclaimedRewardsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBattlePassProgress = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await getBattlePassProgress();
      const data = result.data as { success: boolean; progress?: BattlePassProgress };

      if (data && data.success && data.progress) {
        const progress = data.progress;
        setBattlePassRewards(progress);

        // Calculate unclaimed rewards
        let unclaimedCount = 0;
        for (let level = 1; level <= progress.currentLevel; level++) {
          if (!progress.claimedRewards?.free?.includes(level)) {
            unclaimedCount++;
          }
          if (progress.hasBattlePass && !progress.claimedRewards?.premium?.includes(level)) {
            unclaimedCount++;
          }
        }
        setUnclaimedRewardsCount(unclaimedCount);
      } else {
        setBattlePassRewards(null);
        setUnclaimedRewardsCount(0);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Don't log "no active battle pass" as an error
      if (!errorMessage.includes('No active battle pass season')) {
        console.error('Error fetching battle pass progress:', err);
        setError(errorMessage);
      }

      setBattlePassRewards(null);
      setUnclaimedRewardsCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBattlePassProgress();
  }, [fetchBattlePassProgress]);

  return {
    battlePassRewards,
    unclaimedRewardsCount,
    loading,
    error,
    refresh: fetchBattlePassProgress,
  };
}

export default useBattlePass;
