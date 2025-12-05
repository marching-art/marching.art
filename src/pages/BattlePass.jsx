// src/pages/BattlePass.jsx
// One-Screen Game UI: Horizontal Scrolling Rail with Connection Pipe
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Star, Lock, Check, Gift, Zap, Crown,
  TrendingUp, Award, ChevronLeft, ChevronRight, Sparkles, Coins,
  Music, Target, X, Clock, Flame
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
  const trackRef = useRef(null);

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
        setSelectedLevel(null);
      }
    } catch (error) {
      console.error('Error claiming reward:', error);
      toast.error(error.message || 'Failed to claim reward');
    } finally {
      setProcessing(false);
    }
  };

  const scrollTrack = (direction) => {
    if (trackRef.current) {
      const scrollAmount = 300;
      trackRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Translate vertical scroll wheel to horizontal scroll on track
  const handleWheelScroll = useCallback((e) => {
    if (trackRef.current) {
      e.preventDefault();
      trackRef.current.scrollBy({
        left: e.deltaY * 2,
        behavior: 'auto'
      });
    }
  }, []);

  // Scroll to current level on mount
  useEffect(() => {
    if (!loading && trackRef.current && battlePassData?.level) {
      const nodeWidth = 100; // Approximate node width + gap
      const currentLvl = battlePassData.level;
      const scrollPosition = (currentLvl - 1) * nodeWidth - (trackRef.current.clientWidth / 2);
      setTimeout(() => {
        trackRef.current?.scrollTo({ left: Math.max(0, scrollPosition), behavior: 'smooth' });
      }, 100);
    }
  }, [loading, battlePassData?.level]);

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
      common: 'text-gray-400 border-gray-400/50',
      uncommon: 'text-green-400 border-green-400/50',
      rare: 'text-blue-400 border-blue-400/50',
      epic: 'text-purple-400 border-purple-400/50',
      legendary: 'text-gold-400 border-gold-400/50',
    };
    return colors[rarity] || 'text-gray-400 border-gray-400/50';
  };

  const getRarityBg = (rarity) => {
    const colors = {
      common: 'bg-gray-500/20',
      uncommon: 'bg-green-500/20',
      rare: 'bg-blue-500/20',
      epic: 'bg-purple-500/20',
      legendary: 'bg-gold-500/20',
    };
    return colors[rarity] || 'bg-gray-500/20';
  };

  if (loading) {
    return <LoadingScreen fullScreen={false} />;
  }

  const isPremium = battlePassData?.isPremium || false;
  const currentLevel = battlePassData?.level || 1;
  const xpTowardsNext = battlePassData?.xpTowardsNextLevel || 0;
  const xpNeeded = battlePassData?.xpNeededForNextLevel || 100;
  const progressPercent = battlePassData?.progressPercentage || 0;

  // Find selected level data
  const selectedLevelData = selectedLevel ? season?.rewards?.find(r => r.level === selectedLevel) : null;
  const isSelectedLevelUnlocked = selectedLevel ? currentLevel >= selectedLevel : false;
  const isSelectedFreeClaimed = selectedLevel ? battlePassData?.claimedRewards?.free?.includes(selectedLevel) : false;
  const isSelectedPremiumClaimed = selectedLevel ? battlePassData?.claimedRewards?.premium?.includes(selectedLevel) : false;

  // Calculate total XP earned this season
  const totalXpEarned = battlePassData?.totalXpEarned || ((currentLevel - 1) * 100 + xpTowardsNext);

  return (
    <div className="h-full w-full flex flex-col overflow-hidden">
      {/* ================================================================
          TOP: Compact Season Stats Bar
          ================================================================ */}
      <div className="shrink-0 border-b border-white/5 bg-black/30 backdrop-blur-md">
        <div className="flex items-center justify-between gap-4 py-2">
          {/* Left: Season Title + Premium Badge */}
          <div className="flex items-center gap-3">
            <Crown className="w-5 h-5 text-gold-400" />
            <span className="font-display font-bold text-cream-100 uppercase tracking-wide text-sm">
              {season?.name || 'Season Pass'}
            </span>
            {isPremium && (
              <span className="px-2 py-0.5 rounded-full text-[9px] font-display font-bold uppercase tracking-wide bg-gradient-to-r from-gold-500 to-amber-400 text-charcoal-900 flex items-center gap-0.5">
                <Sparkles className="w-2.5 h-2.5" />
                Premium
              </span>
            )}
          </div>

          {/* Center: Key Stats */}
          <div className="flex items-center gap-6">
            {/* Time Remaining */}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-cream-500/60" />
              <span className="font-mono text-xs text-cream-400">
                <span className="text-gold-400 font-bold">{season?.daysRemaining || '?'}</span> days left
              </span>
            </div>

            {/* Total XP */}
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4 text-orange-400" />
              <span className="font-mono text-xs text-cream-400">
                <span className="text-orange-400 font-bold">{totalXpEarned.toLocaleString()}</span> XP
              </span>
            </div>

            {/* Current Level */}
            <div className="flex items-center gap-2 px-3 py-1 bg-gold-500/10 border border-gold-500/30 rounded-full">
              <Zap className="w-4 h-4 text-gold-400" />
              <span className="font-mono text-sm font-bold text-gold-400">Lv.{currentLevel}</span>
            </div>

            {/* XP Progress Mini Bar */}
            <div className="w-32 hidden md:block">
              <div className="flex items-center justify-between text-[10px] mb-0.5">
                <span className="text-cream-500/50">Next</span>
                <span className="text-gold-400 font-mono">{xpTowardsNext}/{xpNeeded}</span>
              </div>
              <div className="h-1.5 bg-charcoal-800 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-gold-500 to-amber-400"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {availableRewards.length > 0 && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-gold-500/20 border border-gold-500/40 rounded-full animate-pulse">
                <Gift className="w-3.5 h-3.5 text-gold-400" />
                <span className="text-[10px] font-bold text-gold-400">{availableRewards.length} to claim</span>
              </div>
            )}
            {!isPremium && (
              <button
                onClick={handlePurchaseBattlePass}
                disabled={processing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-gold-500 to-amber-400 text-charcoal-900 rounded-lg font-display font-bold uppercase tracking-wide text-[10px] hover:from-gold-400 hover:to-amber-300 transition-all disabled:opacity-50"
              >
                {processing ? (
                  <div className="w-3 h-3 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Crown className="w-3 h-3" />
                )}
                Upgrade $4.99
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ================================================================
          CENTER: Horizontal Scrolling Track with Connection Pipe
          ================================================================ */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Track Navigation Buttons */}
        <button
          onClick={() => scrollTrack('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 backdrop-blur border border-white/10 flex items-center justify-center text-cream-400 hover:text-cream-100 hover:bg-black/80 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => scrollTrack('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full bg-black/60 backdrop-blur border border-white/10 flex items-center justify-center text-cream-400 hover:text-cream-100 hover:bg-black/80 transition-all"
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        {/* Horizontal Scrolling Container with Wheel Handler */}
        <div
          ref={trackRef}
          onWheel={handleWheelScroll}
          className="flex-1 overflow-x-auto overflow-y-hidden hud-scroll"
          style={{ scrollSnapType: 'x proximity', scrollbarWidth: 'none' }}
        >
          <div className="flex items-center h-full min-w-max relative">
            {/* Connection Pipe - SVG background track */}
            <svg
              className="absolute top-1/2 left-0 h-2 w-full pointer-events-none"
              style={{ transform: 'translateY(-50%)' }}
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="pipeBg" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="rgba(0,0,0,0.5)" />
                  <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
                </linearGradient>
                <linearGradient id="pipeProgress" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22c55e" />
                  <stop offset="50%" stopColor="#84cc16" />
                  <stop offset="100%" stopColor="#eab308" />
                </linearGradient>
              </defs>
              {/* Background pipe */}
              <rect x="0" y="0" width="100%" height="100%" rx="4" fill="url(#pipeBg)" className="opacity-60" />
              {/* Progress fill - width based on current level */}
              <rect
                x="0"
                y="1"
                width={`${Math.min((currentLevel / 50) * 100, 100)}%`}
                height="6"
                rx="3"
                fill="url(#pipeProgress)"
                className="opacity-80"
              />
            </svg>

            {/* Level Nodes */}
            {season?.rewards?.slice(0, 50).map((levelReward, index) => {
              const level = levelReward.level;
              const isUnlocked = currentLevel >= level;
              const freeReward = levelReward.free;
              const premiumReward = levelReward.premium;
              const isFreeClaimed = battlePassData?.claimedRewards?.free?.includes(level);
              const isPremiumClaimed = battlePassData?.claimedRewards?.premium?.includes(level);
              const canClaimFree = isUnlocked && !isFreeClaimed;
              const canClaimPremium = isUnlocked && isPremium && !isPremiumClaimed;
              const isSelected = selectedLevel === level;
              const isCurrent = level === currentLevel;
              const isMilestone = level % 10 === 0;

              // Node sizes: Current = large, Locked = small, Claimed/Unlocked = medium
              const nodeSize = isCurrent ? 'w-20 h-20' : isUnlocked ? 'w-16 h-16' : 'w-12 h-12';
              const iconSize = isCurrent ? 'w-8 h-8' : isUnlocked ? 'w-5 h-5' : 'w-4 h-4';

              return (
                <motion.button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.015 }}
                  style={{ scrollSnapAlign: 'center' }}
                  className={`relative flex-shrink-0 mx-2 flex flex-col items-center transition-all duration-200 ${
                    isCurrent ? 'z-10' : ''
                  }`}
                >
                  {/* Level Number Badge (above node) */}
                  <div className={`mb-1 px-2 py-0.5 rounded-full font-mono font-bold transition-all ${
                    isCurrent
                      ? 'text-sm bg-gradient-to-r from-gold-500 to-amber-400 text-charcoal-900 shadow-lg shadow-gold-500/30'
                      : isUnlocked
                      ? 'text-[10px] bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'text-[10px] bg-charcoal-800/80 text-cream-500/40 border border-white/5'
                  }`}>
                    {level}
                  </div>

                  {/* Main Node */}
                  <div className={`${nodeSize} rounded-xl flex items-center justify-center border-2 transition-all duration-200 ${
                    isSelected
                      ? 'bg-gold-500/30 border-gold-500 shadow-[0_0_30px_rgba(234,179,8,0.5)] scale-110'
                      : isCurrent
                      ? 'bg-gradient-to-br from-gold-500/40 to-purple-500/40 border-gold-500 shadow-[0_0_25px_rgba(234,179,8,0.4)] animate-pulse'
                      : isUnlocked && (isFreeClaimed || isPremiumClaimed)
                      ? 'bg-green-500/20 border-green-500/60 shadow-[0_0_10px_rgba(34,197,94,0.3)]'
                      : isUnlocked
                      ? 'bg-charcoal-800/80 border-cream-500/30 hover:border-gold-500/50 hover:bg-charcoal-700/80'
                      : 'bg-charcoal-900/60 border-white/10 opacity-50 hover:opacity-70'
                  }`}>
                    {/* Milestone Star Background */}
                    {isMilestone && (
                      <Star className="absolute -top-1 -right-1 w-4 h-4 text-gold-400 fill-gold-400 drop-shadow-lg" />
                    )}

                    {/* Node Content */}
                    {isCurrent ? (
                      <div className="flex flex-col items-center">
                        <Zap className={`${iconSize} text-gold-400`} />
                        <span className="text-[8px] text-gold-400 font-bold mt-0.5">YOU</span>
                      </div>
                    ) : isFreeClaimed && isPremiumClaimed ? (
                      <Check className={`${iconSize} text-green-400`} />
                    ) : isFreeClaimed || (isPremiumClaimed && isPremium) ? (
                      <div className="flex flex-col items-center gap-0.5">
                        <Check className="w-3 h-3 text-green-400" />
                        {(canClaimFree || canClaimPremium) && (
                          <Gift className="w-3 h-3 text-gold-400 animate-bounce" />
                        )}
                      </div>
                    ) : canClaimFree || canClaimPremium ? (
                      <Gift className={`${iconSize} text-gold-400 animate-bounce`} />
                    ) : isUnlocked ? (
                      <span className={getRarityColor(freeReward?.rarity)}>
                        {getRewardIcon(freeReward?.type)}
                      </span>
                    ) : (
                      <Lock className={`${iconSize} text-cream-500/30`} />
                    )}
                  </div>

                  {/* Reward Tier Indicators (below node) */}
                  <div className="flex gap-1 mt-1">
                    {/* Free tier dot */}
                    <div className={`w-2 h-2 rounded-full transition-all ${
                      isFreeClaimed
                        ? 'bg-green-500'
                        : canClaimFree
                        ? 'bg-gold-500 animate-pulse'
                        : isUnlocked
                        ? 'bg-cream-500/30'
                        : 'bg-white/10'
                    }`} />
                    {/* Premium tier dot */}
                    <div className={`w-2 h-2 rounded-full transition-all ${
                      isPremiumClaimed
                        ? 'bg-green-500'
                        : canClaimPremium
                        ? 'bg-purple-500 animate-pulse'
                        : isPremium && isUnlocked
                        ? 'bg-purple-500/30'
                        : 'bg-white/10'
                    }`} />
                  </div>

                  {/* Claimable Glow Ring */}
                  {(canClaimFree || canClaimPremium) && !isSelected && (
                    <div className="absolute inset-0 -m-1 rounded-xl border-2 border-gold-500/50 animate-ping pointer-events-none" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Track Legend - Minimal */}
        <div className="shrink-0 flex items-center justify-center gap-4 py-2 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-1.5 text-[10px] text-cream-500/50">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span>Claimed</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-cream-500/50">
            <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
            <span>Claimable</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-cream-500/50">
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <span>Locked</span>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] text-cream-500/50">
            <div className="w-2 h-2 rounded-full bg-purple-500/50" />
            <span>Premium</span>
          </div>
        </div>
      </div>

      {/* ============================================================
          BOTTOM: Compact Reward Preview Panel
          ============================================================ */}
      <AnimatePresence>
        {selectedLevel && selectedLevelData && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="shrink-0 border-t border-gold-500/30 bg-black/50 backdrop-blur-md"
          >
            <div className="py-3">
              {/* Compact Header Row */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-gold-400 text-sm">Lv.{selectedLevel}</span>
                  <span className="text-[10px] text-cream-500/50 uppercase tracking-wide">
                    {isSelectedLevelUnlocked ? 'Unlocked' : 'Locked'}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedLevel(null)}
                  className="p-1 rounded bg-white/5 border border-white/10 text-cream-400 hover:text-cream-100 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Horizontal Rewards Row */}
              <div className="flex gap-3">
                {/* Free Reward Card */}
                <div className={`flex-1 flex items-center gap-3 p-2 rounded-lg border ${
                  isSelectedFreeClaimed
                    ? 'bg-green-500/10 border-green-500/30'
                    : isSelectedLevelUnlocked
                    ? 'bg-charcoal-900/50 border-gold-500/30'
                    : 'bg-charcoal-900/30 border-white/10 opacity-50'
                }`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getRarityBg(selectedLevelData.free?.rarity)} border ${getRarityColor(selectedLevelData.free?.rarity)}`}>
                    {isSelectedFreeClaimed ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : (
                      getRewardIcon(selectedLevelData.free?.type)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-cream-500/60 uppercase">Free</span>
                      <span className={`text-[9px] font-bold uppercase ${getRarityColor(selectedLevelData.free?.rarity)}`}>
                        {selectedLevelData.free?.rarity || 'Common'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-cream-100 truncate capitalize">
                      {selectedLevelData.free?.type?.replace('_', ' ') || 'Reward'}
                    </p>
                    {selectedLevelData.free?.type === 'corpscoin' && (
                      <p className="text-[10px] font-mono text-gold-400">+{selectedLevelData.free.amount} CC</p>
                    )}
                  </div>
                  {isSelectedFreeClaimed ? (
                    <Check className="w-4 h-4 text-green-400 shrink-0" />
                  ) : isSelectedLevelUnlocked ? (
                    <button
                      onClick={() => handleClaimReward(selectedLevel, 'free')}
                      disabled={processing}
                      className="px-2 py-1 bg-gold-500 text-charcoal-900 rounded text-[10px] font-bold uppercase hover:bg-gold-400 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {processing ? '...' : 'Claim'}
                    </button>
                  ) : (
                    <Lock className="w-4 h-4 text-cream-500/30 shrink-0" />
                  )}
                </div>

                {/* Premium Reward Card */}
                <div className={`flex-1 flex items-center gap-3 p-2 rounded-lg border ${
                  isSelectedPremiumClaimed
                    ? 'bg-green-500/10 border-green-500/30'
                    : isPremium && isSelectedLevelUnlocked
                    ? 'bg-purple-500/10 border-purple-500/30'
                    : 'bg-charcoal-900/30 border-white/10 opacity-50'
                }`}>
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getRarityBg(selectedLevelData.premium?.rarity)} border ${getRarityColor(selectedLevelData.premium?.rarity)}`}>
                    {isSelectedPremiumClaimed ? (
                      <Check className="w-5 h-5 text-green-400" />
                    ) : !isPremium ? (
                      <Crown className="w-5 h-5 text-purple-400/50" />
                    ) : (
                      getRewardIcon(selectedLevelData.premium?.type)
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-purple-400 uppercase flex items-center gap-0.5">
                        <Crown className="w-2.5 h-2.5" />
                        Premium
                      </span>
                      <span className={`text-[9px] font-bold uppercase ${getRarityColor(selectedLevelData.premium?.rarity)}`}>
                        {selectedLevelData.premium?.rarity || 'Common'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-cream-100 truncate capitalize">
                      {selectedLevelData.premium?.type?.replace('_', ' ') || 'Reward'}
                    </p>
                    {selectedLevelData.premium?.type === 'corpscoin' && (
                      <p className="text-[10px] font-mono text-gold-400">+{selectedLevelData.premium.amount} CC</p>
                    )}
                  </div>
                  {!isPremium ? (
                    <button
                      onClick={handlePurchaseBattlePass}
                      className="px-2 py-1 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded text-[10px] font-bold uppercase hover:bg-purple-500/30 transition-colors shrink-0"
                    >
                      Unlock
                    </button>
                  ) : isSelectedPremiumClaimed ? (
                    <Check className="w-4 h-4 text-green-400 shrink-0" />
                  ) : isSelectedLevelUnlocked ? (
                    <button
                      onClick={() => handleClaimReward(selectedLevel, 'premium')}
                      disabled={processing}
                      className="px-2 py-1 bg-gradient-to-r from-gold-500 to-purple-500 text-white rounded text-[10px] font-bold uppercase hover:from-gold-400 hover:to-purple-400 transition-colors disabled:opacity-50 shrink-0"
                    >
                      {processing ? '...' : 'Claim'}
                    </button>
                  ) : (
                    <Lock className="w-4 h-4 text-cream-500/30 shrink-0" />
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* XP Sources - Compact inline when no level selected */}
      {!selectedLevel && (
        <div className="shrink-0 border-t border-white/5 bg-black/30 backdrop-blur-md">
          <div className="flex items-center justify-center gap-4 py-2">
            <span className="text-[10px] text-cream-500/40 uppercase tracking-wide">Earn XP:</span>
            {[
              { icon: <Music className="w-3 h-3" />, title: 'Rehearse', xp: 25 },
              { icon: <Star className="w-3 h-3" />, title: 'Perform', xp: 50 },
              { icon: <Trophy className="w-3 h-3" />, title: 'Trophy', xp: 100 },
              { icon: <Target className="w-3 h-3" />, title: 'Quest', xp: 50 },
            ].map((source, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="text-gold-400/70">{source.icon}</span>
                <span className="text-[10px] text-cream-400/60">{source.title}</span>
                <span className="text-[10px] font-mono font-bold text-gold-400/80">+{source.xp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BattlePass;
