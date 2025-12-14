// src/pages/BattlePass.jsx
// Streamlined Battle Pass: Seasonal progression without daily pressure
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Star, Lock, Check, Gift, Crown,
  Award, ChevronLeft, ChevronRight, Sparkles, Coins,
  Calendar, Target
} from 'lucide-react';
import { useAuth } from '../App';
import {
  getBattlePassProgress,
  purchaseBattlePass,
  claimBattlePassReward,
  getAvailableRewards
} from '../firebase/functions';
import toast from 'react-hot-toast';
import LoadingScreen from '../components/LoadingScreen';

// Milestones with special rewards
const MILESTONES = [10, 25, 50];

const BattlePass = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [battlePassData, setBattlePassData] = useState(null);
  const [season, setSeason] = useState(null);
  const [availableRewards, setAvailableRewards] = useState([]);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 5 });

  useEffect(() => {
    if (user) {
      loadBattlePassData();
      loadAvailableRewards();
    }
  }, [user]);

  // Center view on current level when data loads
  useEffect(() => {
    if (battlePassData?.level) {
      const currentLevel = battlePassData.level;
      const start = Math.max(0, currentLevel - 3);
      setVisibleRange({ start, end: start + 5 });
    }
  }, [battlePassData?.level]);

  const loadBattlePassData = async () => {
    try {
      setLoading(true);
      const result = await getBattlePassProgress();
      if (result.data.success) {
        setBattlePassData(result.data.progress);
        setSeason(result.data.season);
      }
    } catch (error) {
      console.error('Error loading battle pass:', error);
      toast.error('Failed to load battle pass data');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableRewards = async () => {
    try {
      const result = await getAvailableRewards();
      if (result.data.success) {
        setAvailableRewards(result.data.rewards || []);
      }
    } catch (error) {
      console.error('Error loading available rewards:', error);
    }
  };

  const handlePurchaseBattlePass = async () => {
    try {
      setProcessing(true);
      const result = await purchaseBattlePass();
      if (result.data.success && result.data.url) {
        window.location.href = result.data.url;
      }
    } catch (error) {
      console.error('Error purchasing battle pass:', error);
      toast.error(error.message || 'Failed to start checkout');
      setProcessing(false);
    }
  };

  const handleClaimReward = async (level, tier) => {
    try {
      setProcessing(true);
      const result = await claimBattlePassReward({ level, tier });
      if (result.data.success) {
        toast.success(result.data.message, { icon: '🎁' });
        await loadBattlePassData();
        await loadAvailableRewards();
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast.error(error.message || 'Failed to claim reward');
    } finally {
      setProcessing(false);
    }
  };

  const handleClaimAll = async () => {
    if (availableRewards.length === 0) return;
    try {
      setProcessing(true);
      for (const reward of availableRewards) {
        await claimBattlePassReward({ level: reward.level, tier: reward.tier });
      }
      toast.success(`Claimed ${availableRewards.length} rewards!`, { icon: '🎁' });
      await loadBattlePassData();
      await loadAvailableRewards();
    } catch (error) {
      console.error('Error claiming rewards:', error);
      toast.error('Failed to claim some rewards');
    } finally {
      setProcessing(false);
    }
  };

  const navigateRewards = (direction) => {
    const maxLevel = 50;
    if (direction === 'left') {
      const newStart = Math.max(0, visibleRange.start - 5);
      setVisibleRange({ start: newStart, end: newStart + 5 });
    } else {
      const newStart = Math.min(maxLevel - 5, visibleRange.start + 5);
      setVisibleRange({ start: newStart, end: newStart + 5 });
    }
  };

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  const isPremium = battlePassData?.isPremium || false;
  const currentLevel = battlePassData?.level || 1;
  const xpTowardsNext = battlePassData?.xpTowardsNextLevel || 0;
  const xpNeeded = battlePassData?.xpNeededForNextLevel || 180;
  const progressPercent = battlePassData?.progressPercentage || 0;
  const overallProgress = battlePassData?.overallProgress || ((currentLevel - 1) / 50 * 100);
  const weeksRemaining = season?.weeksRemaining || 13;

  // Get visible reward levels
  const visibleLevels = [];
  for (let i = visibleRange.start; i < visibleRange.end && i < 50; i++) {
    const level = i + 1;
    const levelReward = season?.rewards?.find(r => r.level === level);
    if (levelReward) {
      visibleLevels.push({
        level,
        reward: levelReward,
        isUnlocked: currentLevel >= level,
        isCurrent: currentLevel === level,
        isMilestone: MILESTONES.includes(level),
        isFreeClaimed: battlePassData?.claimedRewards?.free?.includes(level),
        isPremiumClaimed: battlePassData?.claimedRewards?.premium?.includes(level),
      });
    }
  }

  // Get next milestone
  const nextMilestone = MILESTONES.find(m => m > currentLevel) || 50;

  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-gradient-to-b from-charcoal-900 to-charcoal-950">
      {/* Header: Season Info */}
      <div className="shrink-0 border-b border-white/10 bg-black/30 backdrop-blur-md px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-2xl font-bold text-cream-100 uppercase tracking-wide">
                Battle Pass
              </h1>
              <p className="text-sm text-cream-500 mt-0.5">
                {season?.name || 'Current Season'}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Time Remaining */}
              <div className="flex items-center gap-2 px-3 py-1.5 bg-charcoal-800/50 rounded-lg border border-white/5">
                <Calendar className="w-4 h-4 text-cream-500" />
                <span className="text-sm text-cream-300">
                  <span className="font-bold text-cream-100">{weeksRemaining}</span> weeks left
                </span>
              </div>

              {/* Premium Badge */}
              {isPremium && (
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-gold-500/20 to-amber-500/20 border border-gold-500/30">
                  <Crown className="w-4 h-4 text-gold-400" />
                  <span className="text-sm font-bold text-gold-400">Premium</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">

          {/* Progress Section */}
          <div className="bg-charcoal-800/50 rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gold-500 to-amber-500 flex items-center justify-center shadow-lg shadow-gold-500/20">
                  <span className="font-display text-2xl font-bold text-charcoal-900">{currentLevel}</span>
                </div>
                <div>
                  <p className="text-sm text-cream-500">Current Level</p>
                  <p className="text-lg font-bold text-cream-100">
                    {Math.round(overallProgress)}% Complete
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-sm text-cream-500">Next Milestone</p>
                <p className="text-lg font-bold text-gold-400 flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  Level {nextMilestone}
                </p>
              </div>
            </div>

            {/* Overall Progress Bar */}
            <div className="mb-3">
              <div className="h-3 bg-charcoal-900 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-green-500 via-gold-500 to-amber-400 rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${overallProgress}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-cream-500">Level 1</span>
                {MILESTONES.map(m => (
                  <span
                    key={m}
                    className={`text-xs ${currentLevel >= m ? 'text-gold-400' : 'text-cream-500'}`}
                    style={{ marginLeft: `${(m / 50) * 100 - 10}%`, position: 'absolute' }}
                  >
                  </span>
                ))}
                <span className="text-xs text-cream-500">Level 50</span>
              </div>
            </div>

            {/* XP to Next Level */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-cream-500">Progress to Level {Math.min(currentLevel + 1, 50)}</span>
              <span className="font-mono text-cream-300">{xpTowardsNext} / {xpNeeded} XP</span>
            </div>
            <div className="h-1.5 bg-charcoal-900 rounded-full overflow-hidden mt-1">
              <motion.div
                className="h-full bg-gold-500"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Rewards Preview */}
          <div className="bg-charcoal-800/50 rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-cream-100 uppercase tracking-wide">
                Rewards
              </h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigateRewards('left')}
                  disabled={visibleRange.start === 0}
                  className="w-8 h-8 rounded-lg bg-charcoal-700 border border-white/10 flex items-center justify-center text-cream-400 hover:text-cream-100 hover:bg-charcoal-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => navigateRewards('right')}
                  disabled={visibleRange.end >= 50}
                  className="w-8 h-8 rounded-lg bg-charcoal-700 border border-white/10 flex items-center justify-center text-cream-400 hover:text-cream-100 hover:bg-charcoal-600 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Reward Cards */}
            <div className="grid grid-cols-5 gap-3">
              {visibleLevels.map(({ level, reward, isUnlocked, isCurrent, isMilestone, isFreeClaimed, isPremiumClaimed }) => {
                const canClaimFree = isUnlocked && !isFreeClaimed;
                const canClaimPremium = isUnlocked && isPremium && !isPremiumClaimed;

                return (
                  <motion.div
                    key={level}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`relative rounded-xl border-2 transition-all ${
                      isCurrent
                        ? 'border-gold-500 bg-gold-500/10 shadow-lg shadow-gold-500/20'
                        : isUnlocked
                        ? 'border-green-500/30 bg-green-500/5'
                        : 'border-white/10 bg-charcoal-900/50 opacity-60'
                    }`}
                  >
                    {/* Level Badge */}
                    <div className={`absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-xs font-bold ${
                      isCurrent
                        ? 'bg-gold-500 text-charcoal-900'
                        : isUnlocked
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-charcoal-800 text-cream-500 border border-white/10'
                    }`}>
                      {level}
                    </div>

                    {/* Milestone Star */}
                    {isMilestone && (
                      <Star className="absolute -top-1 -right-1 w-4 h-4 text-gold-400 fill-gold-400" />
                    )}

                    <div className="p-3 pt-4">
                      {/* Free Track */}
                      <div className={`flex items-center gap-2 p-2 rounded-lg mb-2 ${
                        isFreeClaimed ? 'bg-green-500/10' : canClaimFree ? 'bg-gold-500/10' : 'bg-charcoal-900/50'
                      }`}>
                        {isFreeClaimed ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : (
                          <Coins className="w-4 h-4 text-gold-400" />
                        )}
                        <span className="text-xs text-cream-300">
                          {reward.free?.type === 'corpscoin'
                            ? `${reward.free.amount} CC`
                            : reward.free?.type === 'milestone_bundle'
                            ? 'Bundle'
                            : 'Free'}
                        </span>
                        {canClaimFree && (
                          <button
                            onClick={() => handleClaimReward(level, 'free')}
                            disabled={processing}
                            className="ml-auto w-5 h-5 rounded bg-gold-500 flex items-center justify-center hover:bg-gold-400 transition-colors"
                          >
                            <Gift className="w-3 h-3 text-charcoal-900" />
                          </button>
                        )}
                      </div>

                      {/* Premium Track */}
                      <div className={`flex items-center gap-2 p-2 rounded-lg ${
                        isPremiumClaimed ? 'bg-green-500/10' : canClaimPremium ? 'bg-purple-500/10' : 'bg-charcoal-900/50'
                      } ${!isPremium && 'opacity-50'}`}>
                        {isPremiumClaimed ? (
                          <Check className="w-4 h-4 text-green-400" />
                        ) : isPremium ? (
                          <Sparkles className="w-4 h-4 text-purple-400" />
                        ) : (
                          <Lock className="w-4 h-4 text-cream-500/50" />
                        )}
                        <span className="text-xs text-cream-300">
                          {reward.premium?.type === 'corpscoin'
                            ? `${reward.premium.amount} CC`
                            : reward.premium?.type === 'milestone_bundle'
                            ? 'Exclusive'
                            : 'Premium'}
                        </span>
                        {canClaimPremium && (
                          <button
                            onClick={() => handleClaimReward(level, 'premium')}
                            disabled={processing}
                            className="ml-auto w-5 h-5 rounded bg-purple-500 flex items-center justify-center hover:bg-purple-400 transition-colors"
                          >
                            <Gift className="w-3 h-3 text-white" />
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Claim All Button */}
            <AnimatePresence>
              {availableRewards.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="mt-4 flex justify-center"
                >
                  <button
                    onClick={handleClaimAll}
                    disabled={processing}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-gold-500 to-amber-500 text-charcoal-900 rounded-lg font-display font-bold uppercase tracking-wide text-sm hover:from-gold-400 hover:to-amber-400 transition-all disabled:opacity-50"
                  >
                    <Gift className="w-4 h-4" />
                    Claim All ({availableRewards.length})
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* How to Earn XP */}
          <div className="bg-charcoal-800/50 rounded-2xl border border-white/5 p-6">
            <h2 className="font-display text-lg font-bold text-cream-100 uppercase tracking-wide mb-4">
              Earning XP This Season
            </h2>
            <p className="text-sm text-cream-500 mb-4">
              No daily grind required. Earn XP at your own pace through weekly activities.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-start gap-3 p-4 bg-charcoal-900/50 rounded-xl border border-white/5">
                <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                  <Calendar className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="font-bold text-cream-100">Weekly Shows</p>
                  <p className="text-sm text-cream-500">Participate in weekly shows</p>
                  <p className="text-sm font-mono text-gold-400 mt-1">+50 XP</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-charcoal-900/50 rounded-xl border border-white/5">
                <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="font-bold text-cream-100">League Wins</p>
                  <p className="text-sm text-cream-500">Win league matchups</p>
                  <p className="text-sm font-mono text-gold-400 mt-1">+100 XP</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 bg-charcoal-900/50 rounded-xl border border-white/5">
                <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
                  <Award className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="font-bold text-cream-100">Season Finish</p>
                  <p className="text-sm text-cream-500">End-of-season bonus</p>
                  <p className="text-sm font-mono text-gold-400 mt-1">up to +500 XP</p>
                </div>
              </div>
            </div>
          </div>

          {/* Premium Upgrade (Non-pressuring) */}
          {!isPremium && (
            <div className="bg-gradient-to-r from-purple-500/10 to-gold-500/10 rounded-2xl border border-purple-500/20 p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-gold-500 flex items-center justify-center">
                    <Crown className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-cream-100">
                      Upgrade to Premium
                    </h3>
                    <p className="text-sm text-cream-400 mt-0.5">
                      Unlock bonus CorpsCoin rewards and exclusive cosmetics
                    </p>
                  </div>
                </div>

                <button
                  onClick={handlePurchaseBattlePass}
                  disabled={processing}
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-500 to-gold-500 text-white rounded-lg font-display font-bold uppercase tracking-wide text-sm hover:from-purple-400 hover:to-gold-400 transition-all disabled:opacity-50"
                >
                  {processing ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      $4.99
                    </>
                  )}
                </button>
              </div>

              {/* Premium Benefits Preview */}
              <div className="mt-4 pt-4 border-t border-white/10">
                <p className="text-xs text-cream-500 uppercase tracking-wide mb-2">Premium Includes:</p>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center gap-1.5 text-sm text-cream-300">
                    <Coins className="w-3.5 h-3.5 text-gold-400" />
                    3x CorpsCoin per level
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-cream-300">
                    <Target className="w-3.5 h-3.5 text-purple-400" />
                    Exclusive cosmetics
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-cream-300">
                    <Award className="w-3.5 h-3.5 text-blue-400" />
                    Milestone bonuses
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default BattlePass;
