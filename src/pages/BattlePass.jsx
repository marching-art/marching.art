// src/pages/BattlePass.jsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Star, Lock, Check, Gift, Zap, Crown,
  TrendingUp, Award, ChevronRight, Sparkles, Coins,
  Music, Target
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

const BattlePass = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [battlePassData, setbattlePassData] = useState(null);
  const [season, setSeason] = useState(null);
  const [availableRewards, setAvailableRewards] = useState([]);
  const [selectedLevel, setSelectedLevel] = useState(null);

  useEffect(() => {
    if (user) {
      loadBattlePassData();
      loadAvailableRewards();
    }
  }, [user]);

  const loadBattlePassData = async () => {
    try {
      setLoading(true);
      const result = await getBattlePassProgress();

      if (result.data.success) {
        setbattlePassData(result.data.progress);
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
        // Redirect to Stripe Checkout
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

  const getRewardIcon = (rewardType) => {
    switch (rewardType) {
      case 'corpscoin':
        return <Coins className="w-5 h-5" />;
      case 'staff_pack':
        return <Gift className="w-5 h-5" />;
      case 'equipment_upgrade':
        return <TrendingUp className="w-5 h-5" />;
      case 'exclusive_badge':
        return <Award className="w-5 h-5" />;
      default:
        return <Star className="w-5 h-5" />;
    }
  };

  const getRarityColor = (rarity) => {
    const colors = {
      common: 'text-gray-400',
      uncommon: 'text-green-400',
      rare: 'text-blue-400',
      epic: 'text-purple-400',
      legendary: 'text-gold-500',
    };
    return colors[rarity] || 'text-gray-400';
  };

  const getRarityBg = (rarity) => {
    const colors = {
      common: 'bg-gray-500/10',
      uncommon: 'bg-green-500/10',
      rare: 'bg-blue-500/10',
      epic: 'bg-purple-500/10',
      legendary: 'bg-gold-500/10',
    };
    return colors[rarity] || 'bg-gray-500/10';
  };

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  const isPremium = battlePassData?.isPremium || false;
  const currentLevel = battlePassData?.level || 1;
  const currentXP = battlePassData?.xp || 0;
  const xpTowardsNext = battlePassData?.xpTowardsNextLevel || 0;
  const xpNeeded = battlePassData?.xpNeededForNextLevel || 100;
  const progressPercent = battlePassData?.progressPercentage || 0;

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-amber-500/10 dark:via-gold-500/10 to-blue-500/10 rounded-2xl" />
        <div className="relative p-6 md:p-8 card-brutalist">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Crown className="w-8 h-8 text-amber-600 dark:text-gold-500" />
                <h1 className="text-3xl md:text-4xl font-display font-bold text-slate-900 dark:text-[#FAF6EA]">
                  Season Pass
                </h1>
                {isPremium && (
                  <span className="px-3 py-1 rounded-full text-xs font-display font-bold uppercase tracking-wide bg-amber-500 dark:bg-gold-500 text-[#1A1A1A] flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Premium
                  </span>
                )}
              </div>
              <p className="text-slate-500 dark:text-cream-300 mb-4">
                {season?.name || 'Season Battle Pass'} • {season?.daysRemaining || '?'} days remaining
              </p>

              {/* XP Progress Bar */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-900 dark:text-cream-100 font-semibold flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-600 dark:text-gold-500" />
                    Level {currentLevel} {currentLevel >= 50 && <span className="text-amber-600 dark:text-gold-500">• MAX</span>}
                  </span>
                  <span className="text-slate-400 dark:text-cream-500/60">
                    {xpTowardsNext} / {xpNeeded} XP
                  </span>
                </div>
                <div className="h-4 bg-stone-200 dark:bg-charcoal-800 rounded-full overflow-hidden relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 via-amber-500 dark:via-gold-500 to-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow-lg">
                    {progressPercent.toFixed(0)}%
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Button */}
            {!isPremium && (
              <div className="text-center">
                <div className="mb-4">
                  <p className="text-3xl font-bold text-amber-600 dark:text-gold-500">$4.99</p>
                  <p className="text-sm text-slate-400 dark:text-cream-500/60">Unlock Premium Rewards</p>
                </div>
                <button
                  onClick={handlePurchaseBattlePass}
                  disabled={processing}
                  className="btn-primary flex items-center gap-2"
                >
                  {processing ? (
                    <>
                      <div className="w-5 h-5 border-2 border-amber-500 dark:border-charcoal-900 border-t-transparent rounded-full animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Crown className="w-5 h-5" />
                      Purchase Battle Pass
                    </>
                  )}
                </button>
                <p className="text-xs text-slate-400 dark:text-cream-500/40 mt-2">
                  Secure checkout via Stripe
                </p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Unclaimed Rewards Notification */}
      {availableRewards.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card-brutalist p-4 bg-amber-500/10 dark:bg-gold-500/10 border-2 border-amber-500/30 dark:border-gold-500/30"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Gift className="w-6 h-6 text-amber-600 dark:text-gold-500" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-cream-100">
                  {availableRewards.length} Reward{availableRewards.length > 1 ? 's' : ''} Available!
                </p>
                <p className="text-sm text-slate-500 dark:text-cream-500/60">
                  Click on rewards below to claim them
                </p>
              </div>
            </div>
            <Sparkles className="w-6 h-6 text-amber-600 dark:text-gold-500 animate-pulse" />
          </div>
        </motion.div>
      )}

      {/* Rewards Track - Horizontal Layout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="card-brutalist p-4 md:p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-display font-bold text-slate-900 dark:text-cream-100">
            Reward Track
          </h2>
          <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-cream-500/60">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-stone-300 dark:bg-charcoal-700 rounded" />
              Free
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-amber-500 dark:bg-gradient-gold rounded" />
              Premium
            </div>
          </div>
        </div>

        {/* Horizontal Scrolling Track */}
        <div className="relative">
          {/* The Track - Thick like a football field yard line */}
          <div className="absolute top-[52px] left-0 right-0 h-8 z-0">
            {/* Base track (locked portion) */}
            <div className="absolute inset-0 bg-gradient-to-b from-stone-300 via-stone-200 to-stone-300 dark:from-charcoal-700 dark:via-charcoal-600 dark:to-charcoal-700 rounded-full border-2 border-stone-400/50 dark:border-charcoal-500">
              {/* Yard line markings */}
              <div className="absolute inset-0 flex items-center justify-around px-8 overflow-hidden">
                {[...Array(25)].map((_, i) => (
                  <div key={i} className="w-1 h-4 bg-stone-400/40 dark:bg-charcoal-500/60 rounded-full" />
                ))}
              </div>
            </div>
            {/* Progress fill (unlocked portion) */}
            <motion.div
              className="absolute top-0 left-0 h-full bg-gradient-to-b from-green-500 via-green-400 to-green-500 dark:from-green-600 dark:via-green-500 dark:to-green-600 rounded-full border-2 border-green-600/50 dark:border-green-400/50 overflow-hidden"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(currentLevel * 2, 100)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
            >
              {/* Field turf texture lines */}
              <div className="absolute inset-0 flex items-center justify-around px-4">
                {[...Array(25)].map((_, i) => (
                  <div key={i} className="w-1 h-5 bg-green-300/40 dark:bg-green-400/30 rounded-full" />
                ))}
              </div>
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/10 to-transparent" />
            </motion.div>
          </div>

          {/* Rewards Container */}
          <div className="flex flex-row overflow-x-auto space-x-6 pb-4 pt-2 battle-pass-scroll">
            {season?.rewards?.slice(0, 50).map((levelReward, index) => {
              const level = levelReward.level;
              const isUnlocked = currentLevel >= level;
              const freeReward = levelReward.free;
              const premiumReward = levelReward.premium;

              const isFreeClaimed = battlePassData?.claimedRewards?.free?.includes(level);
              const isPremiumClaimed = battlePassData?.claimedRewards?.premium?.includes(level);

              const canClaimFree = isUnlocked && !isFreeClaimed;
              const canClaimPremium = isUnlocked && isPremium && !isPremiumClaimed;

              // Determine if this is the next reward (first unclaimed reward at or below current level)
              const isNextFreeReward = canClaimFree && !season?.rewards?.slice(0, index).some(r =>
                currentLevel >= r.level && !battlePassData?.claimedRewards?.free?.includes(r.level)
              );
              const isNextPremiumReward = canClaimPremium && !season?.rewards?.slice(0, index).some(r =>
                currentLevel >= r.level && isPremium && !battlePassData?.claimedRewards?.premium?.includes(r.level)
              );
              // Or the next level to unlock
              const isNextLevelToUnlock = !isUnlocked && level === currentLevel + 1;

              return (
                <motion.div
                  key={level}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: level * 0.02 }}
                  className="flex-shrink-0 w-48 md:w-56"
                >
                  {/* Level Node with Connector */}
                  <div className="flex flex-col items-center relative z-10">
                    {/* The Level Circle */}
                    <div className={`
                      w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm border-4 shadow-lg
                      ${isUnlocked
                        ? 'bg-amber-500 dark:bg-gold-500 text-[#1A1A1A] border-amber-300 dark:border-gold-300'
                        : 'bg-stone-300 dark:bg-charcoal-600 text-slate-500 dark:text-cream-500/60 border-stone-400 dark:border-charcoal-500'}
                      ${isNextLevelToUnlock ? 'ring-4 ring-yellow-400 ring-offset-2 ring-offset-cream-50 dark:ring-offset-charcoal-800 animate-pulse' : ''}
                    `}>
                      {level}
                    </div>

                    {/* Connector stem to track */}
                    <div className={`
                      w-2 h-6 rounded-b-full -mt-1
                      ${isUnlocked
                        ? 'bg-gradient-to-b from-amber-500 to-green-500 dark:from-gold-500 dark:to-green-500'
                        : 'bg-gradient-to-b from-stone-300 to-stone-400 dark:from-charcoal-600 dark:to-charcoal-500'}
                    `} />

                    {level % 10 === 0 && (
                      <span className="text-[10px] text-amber-600 dark:text-gold-500 font-semibold flex items-center gap-1 mt-2">
                        <Star className="w-3 h-3" />
                        Milestone
                      </span>
                    )}
                  </div>

                  {/* Reward Cards Stack */}
                  <div className="space-y-3 mt-6">
                    {/* Free Reward */}
                    <RewardCard
                      reward={freeReward}
                      tier="free"
                      isUnlocked={isUnlocked}
                      isClaimed={isFreeClaimed}
                      canClaim={canClaimFree}
                      onClaim={() => handleClaimReward(level, 'free')}
                      processing={processing}
                      getRewardIcon={getRewardIcon}
                      getRarityColor={getRarityColor}
                      getRarityBg={getRarityBg}
                      isNextReward={isNextFreeReward}
                    />

                    {/* Premium Reward */}
                    <RewardCard
                      reward={premiumReward}
                      tier="premium"
                      isUnlocked={isUnlocked}
                      isClaimed={isPremiumClaimed}
                      canClaim={canClaimPremium}
                      onClaim={() => handleClaimReward(level, 'premium')}
                      processing={processing}
                      isPremiumUser={isPremium}
                      getRewardIcon={getRewardIcon}
                      getRarityColor={getRarityColor}
                      getRarityBg={getRarityBg}
                      isNextReward={isNextPremiumReward}
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>

      {/* XP Sources Info */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="card-brutalist p-4 md:p-6"
      >
        <h3 className="text-xl font-display font-bold text-slate-900 dark:text-cream-100 mb-4">
          How to Earn XP
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
          <XPSourceCard icon={<Zap />} title="Daily Rehearsal" xp={25} />
          <XPSourceCard icon={<Music />} title="Performance" xp={50} />
          <XPSourceCard icon={<Trophy />} title="Trophy Win" xp={100} />
          <XPSourceCard icon={<Crown />} title="Finals" xp={200} />
          <XPSourceCard icon={<Target />} title="Daily Quest" xp={50} />
          <XPSourceCard icon={<Star />} title="Weekly Quest" xp={150} />
        </div>
      </motion.div>
    </div>
  );
};

// Reward Card Component
const RewardCard = ({
  reward,
  tier,
  isUnlocked,
  isClaimed,
  canClaim,
  onClaim,
  processing,
  isPremiumUser,
  getRewardIcon,
  getRarityColor,
  getRarityBg,
  isNextReward
}) => {
  const isPremiumTier = tier === 'premium';
  const isPremiumLocked = isPremiumTier && !isPremiumUser;
  const isLevelLocked = !isUnlocked;
  const isLocked = isLevelLocked || isPremiumLocked;

  // Unlocked & Claimed: colorful, full opacity
  // Locked: greyed out with padlock overlay
  // Next Reward: pulsing yellow glow

  return (
    <div className={`
      relative p-3 rounded-lg border-2 transition-all
      ${isLocked
        ? 'bg-stone-200/80 dark:bg-charcoal-800/60 border-stone-300 dark:border-charcoal-600 opacity-75 grayscale-[30%]'
        : isPremiumTier
          ? 'bg-gradient-to-br from-amber-500/20 dark:from-gold-500/20 via-purple-500/10 to-amber-500/20 dark:to-gold-500/20 border-amber-400 dark:border-gold-500/60'
          : isClaimed
            ? 'bg-gradient-to-br from-green-500/10 via-emerald-500/5 to-green-500/10 dark:from-green-500/20 dark:via-emerald-500/10 dark:to-green-500/20 border-green-400 dark:border-green-500/60'
            : 'bg-white dark:bg-charcoal-900/70 border-stone-200 dark:border-cream-500/30'}
      ${isNextReward ? 'animate-pulse-glow ring-2 ring-yellow-400 ring-offset-2 ring-offset-cream-50 dark:ring-offset-charcoal-800 border-yellow-400 dark:border-yellow-400 shadow-lg shadow-yellow-400/40' : ''}
      ${canClaim && !isNextReward ? 'ring-2 ring-amber-500 dark:ring-gold-500 ring-offset-2 ring-offset-white dark:ring-offset-charcoal-900 shadow-lg shadow-amber-500/20 dark:shadow-gold-500/20 border-amber-500 dark:border-gold-500 hover:border-amber-400 dark:hover:border-gold-400' : ''}
      ${!isLocked && !canClaim ? 'hover:border-amber-500/50 dark:hover:border-gold-500/50' : ''}
    `}>
      {/* Locked Overlay with Padlock */}
      {isLocked && (
        <div className="absolute inset-0 bg-stone-300/60 dark:bg-charcoal-900/70 backdrop-blur-[2px] rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <div className="w-10 h-10 rounded-full bg-stone-400/80 dark:bg-charcoal-700 flex items-center justify-center mx-auto mb-1 shadow-inner">
              <Lock className="w-5 h-5 text-stone-600 dark:text-cream-500/50" />
            </div>
            <p className="text-[10px] text-stone-600 dark:text-cream-500/60 font-semibold uppercase tracking-wide">
              {isPremiumLocked ? 'Premium' : 'Locked'}
            </p>
          </div>
        </div>
      )}

      {/* Claimed Badge */}
      {isClaimed && (
        <div className="absolute top-2 right-2 z-20">
          <div className="bg-green-500 rounded-full p-1.5 shadow-md">
            <Check className="w-3.5 h-3.5 text-white" strokeWidth={3} />
          </div>
        </div>
      )}

      {/* Next Reward Badge */}
      {isNextReward && (
        <div className="absolute -top-2 -left-2 z-20">
          <div className="bg-yellow-400 text-yellow-900 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide shadow-md flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Next
          </div>
        </div>
      )}

      <div className={`flex items-center gap-2 mb-2 ${isLocked ? 'opacity-50' : ''}`}>
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center
          ${isLocked ? 'bg-stone-300 dark:bg-charcoal-700 text-stone-500 dark:text-charcoal-500' : `${getRarityBg(reward?.rarity)} ${getRarityColor(reward?.rarity)}`}
        `}>
          {getRewardIcon(reward?.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-400 dark:text-cream-500/60 capitalize truncate">{tier}</p>
          <p className={`text-xs font-semibold capitalize truncate ${isLocked ? 'text-stone-500 dark:text-charcoal-500' : getRarityColor(reward?.rarity)}`}>
            {reward?.rarity || 'Common'}
          </p>
        </div>
      </div>

      <div className={`mb-2 ${isLocked ? 'opacity-50' : ''}`}>
        {reward?.type === 'corpscoin' ? (
          <p className={`font-semibold text-sm ${isLocked ? 'text-stone-500 dark:text-charcoal-500' : 'text-slate-900 dark:text-white'}`}>
            {reward.amount} <span className={isLocked ? 'text-stone-400 dark:text-charcoal-600' : 'text-amber-600 dark:text-gold-500'}>CC</span>
          </p>
        ) : (
          <p className={`font-semibold text-xs line-clamp-2 ${isLocked ? 'text-stone-500 dark:text-charcoal-500' : 'text-slate-900 dark:text-white'}`}>
            {reward?.description || reward?.type}
          </p>
        )}
      </div>

      {canClaim && !isPremiumLocked && (
        <button
          onClick={onClaim}
          disabled={processing}
          className={`w-full py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 transition-colors
            ${isNextReward
              ? 'bg-yellow-400 text-yellow-900 hover:bg-yellow-300'
              : 'bg-slate-900 dark:bg-gold-500 text-amber-500 dark:text-charcoal-900 hover:bg-slate-800 dark:hover:bg-gold-400'}`}
        >
          {processing ? (
            <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Gift className="w-3 h-3" />
              Claim
            </>
          )}
        </button>
      )}
    </div>
  );
};

// XP Source Card Component
const XPSourceCard = ({ icon, title, xp }) => (
  <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-white dark:bg-charcoal-900/30 rounded-lg border border-cream-200 dark:border-cream-500/20 hover:border-amber-400 dark:hover:border-gold-500 transition-colors shadow-sm">
    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-amber-500/10 dark:bg-gold-500/10 flex items-center justify-center text-amber-600 dark:text-gold-500 flex-shrink-0 border border-amber-500/20 dark:border-gold-500/20">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs md:text-sm font-semibold text-slate-900 dark:text-cream-100 truncate">{title}</p>
      <p className="text-xs text-amber-600 dark:text-gold-500 font-bold">+{xp} XP</p>
    </div>
  </div>
);

export default BattlePass;
