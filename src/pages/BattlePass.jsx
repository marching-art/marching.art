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

        {/* Horizontal Scrolling Track - Football Field Style */}
        <div className="relative overflow-x-auto battle-pass-scroll pb-4">
          {/* The Football Field / Road Track */}
          <div className="relative min-w-max">
            {/* Track Container */}
            <div className="relative h-40 px-8">
              {/* The Main Track - Thick h-8 football field style */}
              <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-8 z-0">
                {/* Base track (asphalt/field base) */}
                <div className="absolute inset-0 bg-gradient-to-b from-stone-400 via-stone-300 to-stone-400 dark:from-charcoal-600 dark:via-charcoal-500 dark:to-charcoal-600 border-y-4 border-stone-500 dark:border-charcoal-400">
                  {/* Yard line / road markings - white dashes */}
                  <div className="absolute inset-0 flex items-center">
                    <div className="flex-1 flex items-center justify-evenly">
                      {[...Array(100)].map((_, i) => (
                        <div key={i} className="w-3 h-1 bg-white/60 dark:bg-cream-100/40 rounded-full" />
                      ))}
                    </div>
                  </div>
                  {/* Center line - like road center or 50 yard line */}
                  <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 bg-yellow-400/50 dark:bg-gold-500/40" />
                </div>

                {/* Progress fill (green turf / completed road) */}
                <motion.div
                  className="absolute top-0 left-0 h-full bg-gradient-to-b from-green-600 via-green-500 to-green-600 dark:from-green-700 dark:via-green-600 dark:to-green-700 border-y-4 border-green-700 dark:border-green-500 overflow-hidden"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(currentLevel * 2, 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                >
                  {/* Field turf texture - grass lines */}
                  <div className="absolute inset-0 flex items-center">
                    <div className="flex-1 flex items-center justify-evenly">
                      {[...Array(100)].map((_, i) => (
                        <div key={i} className="w-3 h-1 bg-white/70 dark:bg-cream-100/50 rounded-full" />
                      ))}
                    </div>
                  </div>
                  {/* Shine / wet look */}
                  <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/5 to-white/10" />
                </motion.div>
              </div>

              {/* Rewards on the track */}
              <div className="relative z-10 flex items-center gap-6 h-full">
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
                  const isNextLevelToUnlock = !isUnlocked && level === currentLevel + 1;

                  const isPremiumLocked = !isPremium;
                  const isLevelLocked = !isUnlocked;

                  return (
                    <motion.div
                      key={level}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: level * 0.02 }}
                      className="flex flex-col items-center flex-shrink-0"
                    >
                      {/* Level Number */}
                      <div className="text-xs font-bold text-slate-600 dark:text-cream-500/60 mb-1">
                        Lv.{level}
                        {level % 10 === 0 && (
                          <Star className="w-3 h-3 inline ml-1 text-amber-500 dark:text-gold-500" />
                        )}
                      </div>

                      {/* Free Reward Circle - Top */}
                      <RewardCircle
                        reward={freeReward}
                        tier="free"
                        level={level}
                        isUnlocked={isUnlocked}
                        isClaimed={isFreeClaimed}
                        canClaim={canClaimFree}
                        onClaim={() => handleClaimReward(level, 'free')}
                        processing={processing}
                        isNextReward={isNextFreeReward}
                        isLocked={isLevelLocked}
                        getRewardIcon={getRewardIcon}
                        getRarityColor={getRarityColor}
                      />

                      {/* Vertical connector between free and premium */}
                      <div className="w-0.5 h-3 bg-stone-300 dark:bg-charcoal-600" />

                      {/* Premium Reward Circle - Bottom */}
                      <RewardCircle
                        reward={premiumReward}
                        tier="premium"
                        level={level}
                        isUnlocked={isUnlocked}
                        isClaimed={isPremiumClaimed}
                        canClaim={canClaimPremium}
                        onClaim={() => handleClaimReward(level, 'premium')}
                        processing={processing}
                        isNextReward={isNextPremiumReward}
                        isPremiumUser={isPremium}
                        isLocked={isLevelLocked || isPremiumLocked}
                        getRewardIcon={getRewardIcon}
                        getRarityColor={getRarityColor}
                      />
                    </motion.div>
                  );
                })}
              </div>
            </div>
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

// Reward Circle Component - Circles that sit on the track
const RewardCircle = ({
  reward,
  tier,
  level,
  isUnlocked,
  isClaimed,
  canClaim,
  onClaim,
  processing,
  isPremiumUser,
  isNextReward,
  isLocked,
  getRewardIcon,
  getRarityColor
}) => {
  const isPremiumTier = tier === 'premium';
  const isPremiumLocked = isPremiumTier && !isPremiumUser;
  const actuallyLocked = isLocked || isPremiumLocked;

  // Claimed = Green, Next = Pulsing Yellow, Locked = Gray, Unlocked = Gold/Purple based on tier
  const getCircleStyles = () => {
    if (isClaimed) {
      return 'bg-gradient-to-br from-green-500 to-emerald-600 border-green-400 dark:border-green-300 shadow-lg shadow-green-500/30';
    }
    if (isNextReward) {
      return 'bg-gradient-to-br from-yellow-400 to-amber-500 border-yellow-300 dark:border-yellow-200 animate-pulse shadow-lg shadow-yellow-400/50';
    }
    if (actuallyLocked) {
      return 'bg-gradient-to-br from-stone-400 to-stone-500 dark:from-charcoal-600 dark:to-charcoal-700 border-stone-500 dark:border-charcoal-500 opacity-60';
    }
    if (canClaim) {
      return isPremiumTier
        ? 'bg-gradient-to-br from-amber-500 to-purple-600 border-amber-400 dark:border-gold-400 shadow-lg shadow-amber-500/30 hover:scale-110 cursor-pointer'
        : 'bg-gradient-to-br from-amber-500 to-orange-600 border-amber-400 dark:border-gold-400 shadow-lg shadow-amber-500/30 hover:scale-110 cursor-pointer';
    }
    // Unlocked but already claimed state won't reach here
    return isPremiumTier
      ? 'bg-gradient-to-br from-purple-500/80 to-amber-500/80 border-purple-400 dark:border-purple-300'
      : 'bg-gradient-to-br from-stone-300 to-stone-400 dark:from-charcoal-500 dark:to-charcoal-600 border-stone-400 dark:border-charcoal-400';
  };

  return (
    <div className="relative group">
      {/* The Circle */}
      <button
        onClick={canClaim ? onClaim : undefined}
        disabled={processing || !canClaim}
        className={`
          w-12 h-12 rounded-full flex items-center justify-center border-3 transition-all duration-200
          ${getCircleStyles()}
        `}
        title={`${tier === 'premium' ? 'Premium: ' : ''}${reward?.description || reward?.type || 'Reward'}`}
      >
        {processing && canClaim ? (
          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
        ) : isClaimed ? (
          <Check className="w-5 h-5 text-white" strokeWidth={3} />
        ) : actuallyLocked ? (
          <Lock className="w-4 h-4 text-white/60" />
        ) : (
          <span className={`${isClaimed ? 'text-white' : isNextReward ? 'text-yellow-900' : 'text-white'}`}>
            {getRewardIcon(reward?.type)}
          </span>
        )}
      </button>

      {/* Tier indicator */}
      <div className={`
        absolute -bottom-1 left-1/2 -translate-x-1/2 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wide
        ${isPremiumTier
          ? 'bg-purple-600 text-white'
          : 'bg-stone-500 dark:bg-charcoal-600 text-white'}
      `}>
        {isPremiumTier ? 'P' : 'F'}
      </div>

      {/* Tooltip on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
        <div className="bg-slate-900 dark:bg-charcoal-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl whitespace-nowrap border border-slate-700 dark:border-charcoal-600">
          <p className="font-semibold capitalize">{reward?.type?.replace('_', ' ') || 'Reward'}</p>
          {reward?.type === 'corpscoin' && (
            <p className="text-amber-400">{reward.amount} CC</p>
          )}
          <p className={`text-[10px] ${getRarityColor(reward?.rarity)}`}>
            {reward?.rarity || 'Common'} • {tier}
          </p>
          {isClaimed && <p className="text-green-400 text-[10px] mt-1">Claimed</p>}
          {isNextReward && <p className="text-yellow-400 text-[10px] mt-1">Click to claim!</p>}
          {actuallyLocked && !isPremiumLocked && <p className="text-stone-400 text-[10px] mt-1">Reach Level {level}</p>}
          {isPremiumLocked && <p className="text-purple-400 text-[10px] mt-1">Premium required</p>}
        </div>
        {/* Tooltip arrow */}
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-slate-900 dark:border-t-charcoal-800" />
      </div>
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
