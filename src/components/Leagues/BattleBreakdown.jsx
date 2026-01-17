// BattleBreakdown - Visual breakdown of head-to-head battle points
// Shows caption battles, total score, high single, and momentum battles

import React from 'react';
import { m } from 'framer-motion';
import {
  Trophy, TrendingUp, Zap, Target, Check, X, Minus,
  Crown, Flame, Award
} from 'lucide-react';
import { GAME_CONFIG } from '../../config';

// Caption display names
const CAPTION_NAMES = GAME_CONFIG.captionNames;

// Battle type icons and labels
const BATTLE_INFO = {
  total: { icon: Trophy, label: 'Total Score', color: 'gold' },
  highSingle: { icon: Zap, label: 'High Single', color: 'purple' },
  momentum: { icon: TrendingUp, label: 'Momentum', color: 'blue' },
};

/**
 * Main battle score display (e.g., "7-4")
 */
export const BattleScoreHeader = ({
  homeBattlePoints,
  awayBattlePoints,
  homeUserId,
  awayUserId,
  currentUserId,
  homeDisplayName,
  awayDisplayName,
  isClutch,
  isBlowout,
  winnerId,
}) => {
  const homeWins = homeBattlePoints > awayBattlePoints;
  const awayWins = awayBattlePoints > homeBattlePoints;
  const isTie = homeBattlePoints === awayBattlePoints;

  return (
    <div className="text-center">
      {/* Battle Points Display */}
      <div className="flex items-center justify-center gap-4 mb-2">
        <div className="text-right flex-1">
          <span className={`text-3xl font-display font-bold tabular-nums ${
            homeWins ? 'text-green-400' : isTie ? 'text-yellow-400' : 'text-cream-100'
          }`}>
            {homeBattlePoints}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-xs text-cream-500/40 uppercase tracking-wider">Battle</span>
          <span className="text-xs text-cream-500/40 uppercase tracking-wider">Points</span>
        </div>

        <div className="text-left flex-1">
          <span className={`text-3xl font-display font-bold tabular-nums ${
            awayWins ? 'text-green-400' : isTie ? 'text-yellow-400' : 'text-cream-100'
          }`}>
            {awayBattlePoints}
          </span>
        </div>
      </div>

      {/* Match Type Badge */}
      {(isClutch || isBlowout) && (
        <div className="flex justify-center">
          {isClutch && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-yellow-500/20 text-yellow-400 text-xs font-display font-bold">
              <Flame className="w-3 h-3" />
              CLUTCH
            </span>
          )}
          {isBlowout && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-sm bg-red-500/20 text-red-400 text-xs font-display font-bold">
              <Zap className="w-3 h-3" />
              BLOWOUT
            </span>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * Single battle row (for caption or special battles)
 */
const BattleRow = ({
  label,
  homeValue,
  awayValue,
  homeWins,
  awayWins,
  icon: Icon,
  color = 'cream',
  delay = 0,
  showDiff = true,
}) => {
  const isTie = !homeWins && !awayWins;
  const diff = Math.abs(homeValue - awayValue);

  const colorClasses = {
    gold: 'text-gold-400',
    purple: 'text-purple-400',
    blue: 'text-blue-400',
    green: 'text-green-400',
    cream: 'text-cream-300',
  };

  return (
    <m.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex items-center py-2 border-b border-cream-500/5 last:border-0"
    >
      {/* Home Side */}
      <div className={`flex-1 flex items-center justify-end gap-2 pr-3 ${
        homeWins ? 'opacity-100' : 'opacity-50'
      }`}>
        <span className={`text-sm font-display tabular-nums ${
          homeWins ? 'text-green-400 font-bold' : 'text-cream-300'
        }`}>
          {typeof homeValue === 'number' ? homeValue.toFixed(1) : homeValue}
        </span>
        {homeWins && (
          <div className="w-5 h-5 rounded-sm bg-green-500/20 flex items-center justify-center">
            <Check className="w-3 h-3 text-green-400" />
          </div>
        )}
        {!homeWins && !isTie && (
          <div className="w-5 h-5 rounded-sm bg-red-500/10 flex items-center justify-center">
            <X className="w-3 h-3 text-red-400/50" />
          </div>
        )}
        {isTie && (
          <div className="w-5 h-5 rounded-sm bg-yellow-500/10 flex items-center justify-center">
            <Minus className="w-3 h-3 text-yellow-400/50" />
          </div>
        )}
      </div>

      {/* Center Label */}
      <div className="w-28 flex items-center justify-center gap-1.5 px-2">
        {Icon && <Icon className={`w-3.5 h-3.5 ${colorClasses[color]}`} />}
        <span className={`text-xs font-display font-semibold ${colorClasses[color]}`}>
          {label}
        </span>
      </div>

      {/* Away Side */}
      <div className={`flex-1 flex items-center justify-start gap-2 pl-3 ${
        awayWins ? 'opacity-100' : 'opacity-50'
      }`}>
        {awayWins && (
          <div className="w-5 h-5 rounded-sm bg-green-500/20 flex items-center justify-center">
            <Check className="w-3 h-3 text-green-400" />
          </div>
        )}
        {!awayWins && !isTie && (
          <div className="w-5 h-5 rounded-sm bg-red-500/10 flex items-center justify-center">
            <X className="w-3 h-3 text-red-400/50" />
          </div>
        )}
        {isTie && (
          <div className="w-5 h-5 rounded-sm bg-yellow-500/10 flex items-center justify-center">
            <Minus className="w-3 h-3 text-yellow-400/50" />
          </div>
        )}
        <span className={`text-sm font-display tabular-nums ${
          awayWins ? 'text-green-400 font-bold' : 'text-cream-300'
        }`}>
          {typeof awayValue === 'number' ? awayValue.toFixed(1) : awayValue}
        </span>
      </div>
    </m.div>
  );
};

/**
 * Caption battles section (8 caption comparisons)
 */
export const CaptionBattlesSection = ({
  captionBattles,
  captionBattlesWon,
  homeUserId,
  awayUserId,
}) => {
  return (
    <div className="glass rounded-sm overflow-hidden">
      <div className="p-3 border-b border-cream-500/10 bg-charcoal-900/50">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-display font-bold text-cream-100 flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-gold-400" />
            Caption Battles
          </h3>
          <div className="flex items-center gap-2">
            <span className={`text-sm font-display font-bold ${
              captionBattlesWon.home > captionBattlesWon.away ? 'text-green-400' : 'text-cream-300'
            }`}>
              {captionBattlesWon.home}
            </span>
            <span className="text-xs text-cream-500/40">-</span>
            <span className={`text-sm font-display font-bold ${
              captionBattlesWon.away > captionBattlesWon.home ? 'text-green-400' : 'text-cream-300'
            }`}>
              {captionBattlesWon.away}
            </span>
          </div>
        </div>
      </div>

      <div className="p-2">
        {captionBattles.map((battle, idx) => (
          <BattleRow
            key={battle.caption}
            label={battle.caption}
            homeValue={battle.homeScore}
            awayValue={battle.awayScore}
            homeWins={battle.winnerId === homeUserId}
            awayWins={battle.winnerId === awayUserId}
            delay={idx * 0.03}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Special battles section (total score, high single, momentum)
 */
export const SpecialBattlesSection = ({
  totalScoreBattle,
  highSingleBattle,
  momentumBattle,
  homeUserId,
  awayUserId,
}) => {
  const battles = [
    { ...BATTLE_INFO.total, battle: totalScoreBattle },
    { ...BATTLE_INFO.highSingle, battle: highSingleBattle },
    { ...BATTLE_INFO.momentum, battle: momentumBattle },
  ];

  return (
    <div className="glass rounded-sm overflow-hidden">
      <div className="p-3 border-b border-cream-500/10 bg-charcoal-900/50">
        <h3 className="text-xs font-display font-bold text-cream-100 flex items-center gap-2">
          <Award className="w-3.5 h-3.5 text-gold-400" />
          Bonus Battles
        </h3>
      </div>

      <div className="p-2">
        {battles.map(({ icon, label, color, battle }, idx) => (
          <BattleRow
            key={label}
            label={label}
            icon={icon}
            color={color}
            homeValue={battle.homeValue}
            awayValue={battle.awayValue}
            homeWins={battle.winnerId === homeUserId}
            awayWins={battle.winnerId === awayUserId}
            delay={idx * 0.05}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Battle summary bar (visual representation of battle point distribution)
 */
export const BattleSummaryBar = ({
  homeBattlePoints,
  awayBattlePoints,
  maxPoints = 11,
  homeColor = 'purple',
  awayColor = 'cream',
}) => {
  const homePercent = (homeBattlePoints / maxPoints) * 100;
  const awayPercent = (awayBattlePoints / maxPoints) * 100;
  const tiePercent = 100 - homePercent - awayPercent;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-cream-500/60">{homeBattlePoints} pts</span>
        <span className="text-cream-500/40">of {maxPoints} possible</span>
        <span className="text-cream-500/60">{awayBattlePoints} pts</span>
      </div>
      <div className="flex h-3 rounded-sm overflow-hidden bg-charcoal-800">
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${homePercent}%` }}
          transition={{ type: 'spring', damping: 20, delay: 0.2 }}
          className={`${homeColor === 'purple' ? 'bg-purple-500' : 'bg-green-500'}`}
        />
        {tiePercent > 0 && (
          <div
            style={{ width: `${tiePercent}%` }}
            className="bg-yellow-500/30"
          />
        )}
        <m.div
          initial={{ width: 0 }}
          animate={{ width: `${awayPercent}%` }}
          transition={{ type: 'spring', damping: 20, delay: 0.2 }}
          className="bg-cream-500/50"
        />
      </div>
    </div>
  );
};

/**
 * Complete battle breakdown component
 */
const BattleBreakdown = ({
  battleBreakdown,
  homeDisplayName,
  awayDisplayName,
  currentUserId,
}) => {
  if (!battleBreakdown) {
    return (
      <div className="glass rounded-sm p-8 text-center">
        <Target className="w-8 h-8 text-cream-500/30 mx-auto mb-2" />
        <p className="text-sm text-cream-500/40">Battle data not available</p>
      </div>
    );
  }

  const {
    homeUserId,
    awayUserId,
    homeBattlePoints,
    awayBattlePoints,
    captionBattles,
    captionBattlesWon,
    totalScoreBattle,
    highSingleBattle,
    momentumBattle,
    isClutch,
    isBlowout,
    winnerId,
  } = battleBreakdown;

  return (
    <m.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Main Battle Score */}
      <div className="glass rounded-sm p-4">
        <BattleScoreHeader
          homeBattlePoints={homeBattlePoints}
          awayBattlePoints={awayBattlePoints}
          homeUserId={homeUserId}
          awayUserId={awayUserId}
          currentUserId={currentUserId}
          homeDisplayName={homeDisplayName}
          awayDisplayName={awayDisplayName}
          isClutch={isClutch}
          isBlowout={isBlowout}
          winnerId={winnerId}
        />

        <div className="mt-4 pt-3 border-t border-cream-500/10">
          <BattleSummaryBar
            homeBattlePoints={homeBattlePoints}
            awayBattlePoints={awayBattlePoints}
            homeColor={homeUserId === currentUserId ? 'purple' : 'green'}
          />
        </div>
      </div>

      {/* Caption Battles */}
      <CaptionBattlesSection
        captionBattles={captionBattles}
        captionBattlesWon={captionBattlesWon}
        homeUserId={homeUserId}
        awayUserId={awayUserId}
      />

      {/* Special Battles */}
      <SpecialBattlesSection
        totalScoreBattle={totalScoreBattle}
        highSingleBattle={highSingleBattle}
        momentumBattle={momentumBattle}
        homeUserId={homeUserId}
        awayUserId={awayUserId}
      />

      {/* Legend */}
      <div className="glass rounded-sm p-3">
        <p className="text-[10px] text-cream-500/40 text-center">
          Win 6+ battle points to win the matchup. Caption battles (8 pts) + Total Score (1 pt) + High Single (1 pt) + Momentum (1 pt) = 11 max
        </p>
      </div>
    </m.div>
  );
};

export default BattleBreakdown;
