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
                  <span className="px-3 py-1 rounded-full text-xs font-display font-bold uppercase tracking-wide bg-amber-500 dark:bg-gold-500 text-white dark:text-charcoal-900 flex items-center gap-1">
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
          {/* SVG Connection Line */}
          <svg
            className="absolute top-12 left-0 w-full h-4 pointer-events-none z-0"
            preserveAspectRatio="none"
          >
            <line
              x1="0"
              y1="8"
              x2="100%"
              y2="8"
              stroke="currentColor"
              strokeWidth="4"
              strokeDasharray="8,4"
              className="text-stone-300 dark:text-[#3A3A3A]"
            />
            <line
              x1="0"
              y1="8"
              x2={`${Math.min(currentLevel * 2, 100)}%`}
              y2="8"
              stroke="currentColor"
              strokeWidth="4"
              className="text-amber-500 dark:text-gold-500"
            />
          </svg>

          {/* Rewards Container */}
          <div className="flex flex-row overflow-x-auto space-x-6 pb-4 pt-2 battle-pass-scroll">
            {season?.rewards?.slice(0, 50).map((levelReward) => {
              const level = levelReward.level;
              const isUnlocked = currentLevel >= level;
              const freeReward = levelReward.free;
              const premiumReward = levelReward.premium;

              const isFreeClaimed = battlePassData?.claimedRewards?.free?.includes(level);
              const isPremiumClaimed = battlePassData?.claimedRewards?.premium?.includes(level);

              const canClaimFree = isUnlocked && !isFreeClaimed;
              const canClaimPremium = isUnlocked && isPremium && !isPremiumClaimed;

              return (
                <motion.div
                  key={level}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: level * 0.02 }}
                  className="flex-shrink-0 w-48 md:w-56"
                >
                  {/* Level Node */}
                  <div className="flex flex-col items-center mb-4 relative z-10">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm border-4
                      ${isUnlocked
                        ? 'bg-amber-500 dark:bg-gold-500 text-white dark:text-charcoal-900 border-amber-400 dark:border-gold-400 shadow-lg'
                        : 'bg-stone-200 dark:bg-charcoal-700 text-slate-400 dark:text-cream-500/60 border-stone-300 dark:border-charcoal-600'}
                    `}>
                      {level}
                    </div>
                    {level % 10 === 0 && (
                      <span className="text-[10px] text-amber-600 dark:text-gold-500 font-semibold flex items-center gap-1 mt-1">
                        <Star className="w-3 h-3" />
                        Milestone
                      </span>
                    )}
                  </div>

                  {/* Reward Cards Stack */}
                  <div className="space-y-3">
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
  getRarityBg
}) => {
  const isPremium = tier === 'premium';
  const isLocked = isPremium && !isPremiumUser;

  return (
    <div className={`
      relative p-3 rounded-lg border-2 transition-all
      ${isPremium
        ? 'bg-gradient-to-br from-amber-500/10 dark:from-gold-500/10 to-purple-500/10 border-amber-500/30 dark:border-gold-500/30'
        : 'bg-stone-100 dark:bg-charcoal-900/50 border-stone-200 dark:border-charcoal-700'}
      ${canClaim ? 'ring-2 ring-amber-500 dark:ring-gold-500 ring-offset-2 ring-offset-white dark:ring-offset-charcoal-900 shadow-lg shadow-amber-500/20 dark:shadow-gold-500/20' : ''}
    `}>
      {/* Locked Overlay */}
      {isLocked && (
        <div className="absolute inset-0 bg-stone-100/90 dark:bg-charcoal-900/80 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <Lock className="w-5 h-5 text-slate-400 dark:text-cream-500/40 mx-auto mb-1" />
            <p className="text-[10px] text-slate-500 dark:text-cream-500/60 font-semibold">Premium</p>
          </div>
        </div>
      )}

      {/* Claimed Badge */}
      {isClaimed && (
        <div className="absolute top-2 right-2 z-20">
          <div className="bg-green-500 rounded-full p-1">
            <Check className="w-3 h-3 text-white" />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <div className={`
          w-8 h-8 rounded-lg flex items-center justify-center
          ${getRarityBg(reward?.rarity)} ${getRarityColor(reward?.rarity)}
        `}>
          {getRewardIcon(reward?.type)}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-slate-400 dark:text-cream-500/60 capitalize truncate">{tier}</p>
          <p className={`text-xs font-semibold capitalize truncate ${getRarityColor(reward?.rarity)}`}>
            {reward?.rarity || 'Common'}
          </p>
        </div>
      </div>

      <div className="mb-2">
        {reward?.type === 'corpscoin' ? (
          <p className="text-slate-900 dark:text-cream-100 font-semibold text-sm">
            {reward.amount} <span className="text-amber-600 dark:text-gold-500">CC</span>
          </p>
        ) : (
          <p className="text-slate-900 dark:text-cream-100 font-semibold text-xs line-clamp-2">
            {reward?.description || reward?.type}
          </p>
        )}
      </div>

      {canClaim && !isLocked && (
        <button
          onClick={onClaim}
          disabled={processing}
          className="w-full bg-slate-900 dark:bg-gold-500 text-amber-500 dark:text-charcoal-900 py-1.5 rounded-lg text-xs font-display font-bold uppercase tracking-wide flex items-center justify-center gap-1.5 hover:bg-slate-800 dark:hover:bg-gold-400 transition-colors"
        >
          {processing ? (
            <div className="w-3 h-3 border-2 border-amber-500 dark:border-charcoal-900 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <Gift className="w-3 h-3" />
              Claim
            </>
          )}
        </button>
      )}

      {!isUnlocked && (
        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 dark:text-cream-500/40">
          <Lock className="w-2.5 h-2.5" />
          Locked
        </div>
      )}
    </div>
  );
};

// XP Source Card Component
const XPSourceCard = ({ icon, title, xp }) => (
  <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-stone-100 dark:bg-charcoal-900/30 rounded-lg border border-stone-200 dark:border-transparent">
    <div className="w-8 h-8 md:w-10 md:h-10 rounded-lg bg-amber-500/10 dark:bg-gold-500/10 flex items-center justify-center text-amber-600 dark:text-gold-500 flex-shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-xs md:text-sm font-semibold text-slate-900 dark:text-cream-100 truncate">{title}</p>
      <p className="text-xs text-amber-600 dark:text-gold-500 font-bold">+{xp} XP</p>
    </div>
  </div>
);

export default BattlePass;
