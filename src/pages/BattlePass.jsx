// src/pages/BattlePass.jsx
// Horizontal Scrolling Track Layout: Centered Track + Bottom Inspection Pane
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy, Star, Lock, Check, Gift, Zap, Crown,
  TrendingUp, Award, ChevronLeft, ChevronRight, Sparkles, Coins,
  Music, Target, X, Info
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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ================================================================
          HORIZONTAL TRACK LAYOUT
          ================================================================ */}

      {/* ============================================================
          TOP: Header with Progress
          ============================================================ */}
      <div className="flex-shrink-0 border-b border-cream-500/10 bg-charcoal-950/50">
        <div className="p-4 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left: Title & Info */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-gold-500/30 to-purple-500/30 border-2 border-gold-500/50 flex items-center justify-center">
                <Crown className="w-7 h-7 text-gold-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl lg:text-2xl font-display font-bold text-cream-100 uppercase tracking-wide">
                    Season Pass
                  </h1>
                  {isPremium && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-display font-bold uppercase tracking-wide bg-gradient-to-r from-gold-500 to-amber-400 text-charcoal-900 flex items-center gap-1">
                      <Sparkles className="w-3 h-3" />
                      Premium
                    </span>
                  )}
                </div>
                <p className="text-sm text-cream-500/60">
                  {season?.name || 'Season Battle Pass'} • {season?.daysRemaining || '?'} days remaining
                </p>
              </div>
            </div>

            {/* Right: Level & XP */}
            <div className="flex items-center gap-4">
              {/* Current Level */}
              <div className="flex items-center gap-3 px-4 py-2 bg-charcoal-900/50 border border-cream-500/10 rounded-xl">
                <Zap className="w-5 h-5 text-gold-400" />
                <div>
                  <p className="text-xs text-cream-500/60 uppercase tracking-wide">Level</p>
                  <p className="text-xl font-mono font-bold text-gold-400">{currentLevel}</p>
                </div>
              </div>

              {/* XP Progress */}
              <div className="flex-1 min-w-[200px] max-w-xs">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-cream-500/60">Progress</span>
                  <span className="text-gold-400 font-mono font-bold">{xpTowardsNext} / {xpNeeded} XP</span>
                </div>
                <div className="h-3 bg-charcoal-800 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-gold-500 via-amber-400 to-gold-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.5 }}
                  />
                </div>
              </div>

              {/* Purchase Button */}
              {!isPremium && (
                <button
                  onClick={handlePurchaseBattlePass}
                  disabled={processing}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-gold-500 to-amber-400 text-charcoal-900 rounded-xl font-display font-bold uppercase tracking-wide hover:from-gold-400 hover:to-amber-300 transition-all disabled:opacity-50"
                >
                  {processing ? (
                    <div className="w-4 h-4 border-2 border-charcoal-900 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Crown className="w-4 h-4" />
                  )}
                  Upgrade $4.99
                </button>
              )}
            </div>
          </div>

          {/* Unclaimed Rewards Alert */}
          {availableRewards.length > 0 && (
            <div className="mt-4 flex items-center gap-3 p-3 bg-gold-500/10 border border-gold-500/30 rounded-xl">
              <Gift className="w-5 h-5 text-gold-400 animate-pulse" />
              <p className="text-sm text-cream-300">
                <span className="font-bold text-gold-400">{availableRewards.length} reward{availableRewards.length > 1 ? 's' : ''}</span> ready to claim!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ============================================================
          CENTER: Horizontal Scrolling Track
          ============================================================ */}
      <div className="flex-1 flex flex-col min-h-0 relative">
        {/* Track Navigation Buttons */}
        <button
          onClick={() => scrollTrack('left')}
          className="absolute left-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-charcoal-900/80 border border-cream-500/20 flex items-center justify-center text-cream-400 hover:text-cream-100 hover:bg-charcoal-800 transition-all shadow-lg"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={() => scrollTrack('right')}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-charcoal-900/80 border border-cream-500/20 flex items-center justify-center text-cream-400 hover:text-cream-100 hover:bg-charcoal-800 transition-all shadow-lg"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Horizontal Scrolling Container */}
        <div
          ref={trackRef}
          className="flex-1 overflow-x-auto overflow-y-hidden hud-scroll px-12"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          <div className="flex items-center h-full gap-4 py-6 min-w-max">
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

              return (
                <motion.button
                  key={level}
                  onClick={() => setSelectedLevel(level)}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02 }}
                  style={{ scrollSnapAlign: 'center' }}
                  className={`relative flex-shrink-0 flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'bg-gold-500/20 border-gold-500 shadow-[0_0_20px_rgba(234,179,8,0.3)]'
                      : isCurrent
                      ? 'bg-purple-500/20 border-purple-500/50'
                      : isUnlocked
                      ? 'bg-charcoal-900/50 border-green-500/30 hover:border-green-500/60'
                      : 'bg-charcoal-900/30 border-cream-500/10 hover:border-cream-500/30'
                  }`}
                >
                  {/* Level Badge */}
                  <div className={`absolute -top-3 px-3 py-1 rounded-full text-xs font-mono font-bold ${
                    isCurrent
                      ? 'bg-purple-500 text-white'
                      : isUnlocked
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : 'bg-charcoal-800 text-cream-500/60 border border-cream-500/20'
                  }`}>
                    Lv.{level}
                  </div>

                  {/* Milestone Star */}
                  {level % 10 === 0 && (
                    <Star className="absolute -top-3 -right-3 w-5 h-5 text-gold-400 fill-gold-400" />
                  )}

                  {/* Free Reward */}
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-2 border-2 ${
                    isFreeClaimed
                      ? 'bg-green-500/20 border-green-500/50'
                      : canClaimFree
                      ? 'bg-gold-500/20 border-gold-500 animate-pulse'
                      : isUnlocked
                      ? 'bg-charcoal-800 border-cream-500/20'
                      : 'bg-charcoal-900 border-cream-500/10 opacity-50'
                  }`}>
                    {isFreeClaimed ? (
                      <Check className="w-6 h-6 text-green-400" />
                    ) : !isUnlocked ? (
                      <Lock className="w-5 h-5 text-cream-500/40" />
                    ) : (
                      <span className={getRarityColor(freeReward?.rarity)}>
                        {getRewardIcon(freeReward?.type)}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-cream-500/60 uppercase tracking-wide mb-3">Free</span>

                  {/* Connector Line */}
                  <div className="w-0.5 h-4 bg-cream-500/20" />

                  {/* Premium Reward */}
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center mt-2 border-2 ${
                    isPremiumClaimed
                      ? 'bg-green-500/20 border-green-500/50'
                      : canClaimPremium
                      ? 'bg-gradient-to-br from-gold-500/30 to-purple-500/30 border-gold-500 animate-pulse'
                      : !isPremium
                      ? 'bg-purple-900/30 border-purple-500/20 opacity-50'
                      : isUnlocked
                      ? 'bg-purple-500/20 border-purple-500/30'
                      : 'bg-charcoal-900 border-cream-500/10 opacity-50'
                  }`}>
                    {isPremiumClaimed ? (
                      <Check className="w-6 h-6 text-green-400" />
                    ) : !isPremium ? (
                      <Crown className="w-5 h-5 text-purple-400/50" />
                    ) : !isUnlocked ? (
                      <Lock className="w-5 h-5 text-cream-500/40" />
                    ) : (
                      <span className={getRarityColor(premiumReward?.rarity)}>
                        {getRewardIcon(premiumReward?.type)}
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-purple-400 uppercase tracking-wide mt-1">Premium</span>

                  {/* Claimable Indicator */}
                  {(canClaimFree || canClaimPremium) && (
                    <div className="absolute -bottom-2 w-3 h-3 rounded-full bg-gold-500 animate-ping" />
                  )}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Track Legend */}
        <div className="flex-shrink-0 flex items-center justify-center gap-6 py-3 border-t border-cream-500/10 bg-charcoal-950/30">
          <div className="flex items-center gap-2 text-xs text-cream-500/60">
            <div className="w-3 h-3 rounded bg-charcoal-800 border border-cream-500/20" />
            <span>Locked</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-cream-500/60">
            <div className="w-3 h-3 rounded bg-green-500/20 border border-green-500/50" />
            <span>Claimed</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-cream-500/60">
            <div className="w-3 h-3 rounded bg-gold-500/20 border border-gold-500 animate-pulse" />
            <span>Claimable</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-cream-500/60">
            <div className="w-3 h-3 rounded bg-purple-500/20 border border-purple-500/30" />
            <span>Premium</span>
          </div>
        </div>
      </div>

      {/* ============================================================
          BOTTOM: Inspection Pane
          ============================================================ */}
      <AnimatePresence>
        {selectedLevel && selectedLevelData && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="flex-shrink-0 border-t-2 border-gold-500/30 bg-gradient-to-t from-charcoal-950 to-charcoal-900"
          >
            <div className="p-4 lg:p-6">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold-500/20 border border-gold-500/30 flex items-center justify-center">
                    <Gift className="w-5 h-5 text-gold-400" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-cream-100 text-lg">Level {selectedLevel} Rewards</h3>
                    <p className="text-xs text-cream-500/60">
                      {isSelectedLevelUnlocked ? 'Unlocked' : `Reach level ${selectedLevel} to unlock`}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLevel(null)}
                  className="p-2 rounded-lg bg-charcoal-800 border border-cream-500/20 text-cream-400 hover:text-cream-100 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Rewards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Free Reward */}
                <div className={`p-4 rounded-xl border-2 ${
                  isSelectedFreeClaimed
                    ? 'bg-green-500/10 border-green-500/30'
                    : isSelectedLevelUnlocked
                    ? 'bg-charcoal-900/50 border-gold-500/30'
                    : 'bg-charcoal-900/30 border-cream-500/10 opacity-60'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-cream-500/60 uppercase tracking-wide">Free Tier</span>
                    <span className={`text-xs font-bold uppercase ${getRarityColor(selectedLevelData.free?.rarity)}`}>
                      {selectedLevelData.free?.rarity || 'Common'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${getRarityBg(selectedLevelData.free?.rarity)} border-2 ${getRarityColor(selectedLevelData.free?.rarity)}`}>
                      {getRewardIcon(selectedLevelData.free?.type)}
                    </div>
                    <div className="flex-1">
                      <p className="font-display font-bold text-cream-100 capitalize">
                        {selectedLevelData.free?.type?.replace('_', ' ') || 'Reward'}
                      </p>
                      {selectedLevelData.free?.type === 'corpscoin' && (
                        <p className="text-gold-400 font-mono font-bold">+{selectedLevelData.free.amount} CC</p>
                      )}
                      <p className="text-xs text-cream-500/60">{selectedLevelData.free?.description || ''}</p>
                    </div>
                    {isSelectedFreeClaimed ? (
                      <div className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm font-bold flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        Claimed
                      </div>
                    ) : isSelectedLevelUnlocked ? (
                      <button
                        onClick={() => handleClaimReward(selectedLevel, 'free')}
                        disabled={processing}
                        className="px-4 py-2 bg-gold-500 text-charcoal-900 rounded-lg font-bold hover:bg-gold-400 transition-colors disabled:opacity-50"
                      >
                        {processing ? '...' : 'Claim'}
                      </button>
                    ) : (
                      <Lock className="w-5 h-5 text-cream-500/40" />
                    )}
                  </div>
                </div>

                {/* Premium Reward */}
                <div className={`p-4 rounded-xl border-2 ${
                  isSelectedPremiumClaimed
                    ? 'bg-green-500/10 border-green-500/30'
                    : isPremium && isSelectedLevelUnlocked
                    ? 'bg-gradient-to-br from-gold-500/10 to-purple-500/10 border-purple-500/30'
                    : 'bg-charcoal-900/30 border-cream-500/10 opacity-60'
                }`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-purple-400 uppercase tracking-wide flex items-center gap-1">
                      <Crown className="w-3 h-3" />
                      Premium Tier
                    </span>
                    <span className={`text-xs font-bold uppercase ${getRarityColor(selectedLevelData.premium?.rarity)}`}>
                      {selectedLevelData.premium?.rarity || 'Common'}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${getRarityBg(selectedLevelData.premium?.rarity)} border-2 ${getRarityColor(selectedLevelData.premium?.rarity)}`}>
                      {getRewardIcon(selectedLevelData.premium?.type)}
                    </div>
                    <div className="flex-1">
                      <p className="font-display font-bold text-cream-100 capitalize">
                        {selectedLevelData.premium?.type?.replace('_', ' ') || 'Reward'}
                      </p>
                      {selectedLevelData.premium?.type === 'corpscoin' && (
                        <p className="text-gold-400 font-mono font-bold">+{selectedLevelData.premium.amount} CC</p>
                      )}
                      <p className="text-xs text-cream-500/60">{selectedLevelData.premium?.description || ''}</p>
                    </div>
                    {!isPremium ? (
                      <button
                        onClick={handlePurchaseBattlePass}
                        className="px-3 py-1.5 bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-sm font-bold hover:bg-purple-500/30 transition-colors flex items-center gap-1"
                      >
                        <Crown className="w-4 h-4" />
                        Upgrade
                      </button>
                    ) : isSelectedPremiumClaimed ? (
                      <div className="px-3 py-1.5 bg-green-500/20 text-green-400 rounded-lg text-sm font-bold flex items-center gap-1">
                        <Check className="w-4 h-4" />
                        Claimed
                      </div>
                    ) : isSelectedLevelUnlocked ? (
                      <button
                        onClick={() => handleClaimReward(selectedLevel, 'premium')}
                        disabled={processing}
                        className="px-4 py-2 bg-gradient-to-r from-gold-500 to-purple-500 text-white rounded-lg font-bold hover:from-gold-400 hover:to-purple-400 transition-colors disabled:opacity-50"
                      >
                        {processing ? '...' : 'Claim'}
                      </button>
                    ) : (
                      <Lock className="w-5 h-5 text-cream-500/40" />
                    )}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* XP Sources Info - When no level selected */}
      {!selectedLevel && (
        <div className="flex-shrink-0 border-t border-cream-500/10 bg-charcoal-950/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Info className="w-4 h-4 text-gold-400" />
            <span className="text-sm font-display font-bold text-cream-300 uppercase tracking-wide">How to Earn XP</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { icon: <Music className="w-4 h-4" />, title: 'Rehearsal', xp: 25 },
              { icon: <Star className="w-4 h-4" />, title: 'Performance', xp: 50 },
              { icon: <Trophy className="w-4 h-4" />, title: 'Trophy', xp: 100 },
              { icon: <Crown className="w-4 h-4" />, title: 'Finals', xp: 200 },
              { icon: <Target className="w-4 h-4" />, title: 'Quest', xp: 50 },
            ].map((source, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 bg-charcoal-900/50 border border-cream-500/10 rounded-lg">
                <span className="text-gold-400">{source.icon}</span>
                <span className="text-xs text-cream-400">{source.title}</span>
                <span className="text-xs font-mono font-bold text-gold-400">+{source.xp}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default BattlePass;
