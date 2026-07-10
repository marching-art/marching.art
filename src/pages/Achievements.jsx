// =============================================================================
// ACHIEVEMENTS — full catalog, earned + in-progress + locked
// =============================================================================
// The single page that answers "what is there to earn, and what does it take?"
// Every achievement in the game is listed here grouped by category, each
// showing its progress bar, requirement, rarity, and CorpsCoin reward — so a
// player can see the whole path ahead, not just what they've already unlocked.
//
// Catalog + progress come from src/data/achievementsCatalog.js (the client
// mirror of the server award logic). Earned state is server-authoritative
// (profile.achievements).

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Coins, Check, Lock, ArrowLeft } from 'lucide-react';
import { useProfileStore } from '../store/profileStore';
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_CATEGORIES,
  evaluateAchievements,
} from '../data/achievementsCatalog';

// Rarity styling — matches AchievementModal / AchievementMini so a badge looks
// the same everywhere it appears.
const RARITY_STYLES = {
  legendary: { border: 'border-purple-500/40', bg: 'bg-purple-500/10', text: 'text-purple-400', badge: 'bg-purple-500/20 text-purple-400' },
  epic: { border: 'border-purple-400/30', bg: 'bg-purple-400/10', text: 'text-purple-300', badge: 'bg-purple-400/20 text-purple-300' },
  rare: { border: 'border-[#0057B8]/40', bg: 'bg-[#0057B8]/10', text: 'text-[#0057B8]', badge: 'bg-[#0057B8]/20 text-[#0057B8]' },
  common: { border: 'border-gray-500/30', bg: 'bg-gray-500/10', text: 'text-gray-400', badge: 'bg-gray-500/20 text-gray-400' },
};

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'progress', label: 'In Progress' },
  { id: 'earned', label: 'Earned' },
  { id: 'locked', label: 'Locked' },
];

// A single achievement tile.
const AchievementCard = ({ a }) => {
  const Icon = a.icon;
  const styles = RARITY_STYLES[a.rarity] || RARITY_STYLES.common;
  const started = a.pct > 0 && !a.earned;

  return (
    <div
      className={`p-3 border transition-colors ${
        a.earned
          ? `${styles.border} bg-[#0a0a0a]`
          : started
            ? 'border-[#333] bg-[#111]'
            : 'border-[#282828] bg-[#0d0d0d] opacity-70'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-8 h-8 flex items-center justify-center border flex-shrink-0 ${
            a.earned ? `${styles.bg} ${styles.border}` : 'bg-[#1a1a1a] border-[#333]'
          }`}
        >
          {a.earned ? (
            <Icon className={`w-4 h-4 ${styles.text}`} />
          ) : started ? (
            <Icon className="w-4 h-4 text-gray-500" />
          ) : (
            <Lock className="w-3.5 h-3.5 text-gray-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className={`font-bold text-sm truncate ${a.earned ? 'text-white' : 'text-gray-300'}`}>
              {a.title}
            </h4>
            <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 ${styles.badge}`}>
              {a.rarity}
            </span>
            {a.earned && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-green-500 flex items-center gap-0.5">
                <Check className="w-3 h-3" /> Earned
              </span>
            )}
          </div>

          <p className="text-xs text-gray-500 mb-2">{a.description}</p>

          {/* Progress or earned date */}
          {a.earned ? (
            <div className="flex items-center gap-2 text-[10px] text-gray-600 font-data">
              {a.earnedAt && <span>{new Date(a.earnedAt).toLocaleDateString()}</span>}
              {a.ccReward > 0 && (
                <span className="flex items-center gap-0.5 text-yellow-600">
                  <Coins className="w-3 h-3" />+{a.ccReward} CC
                </span>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] text-gray-600 font-data tabular-nums">
                  {a.current}/{a.goal}
                </span>
                <div className="flex items-center gap-2">
                  {a.ccReward > 0 && (
                    <span className="text-[10px] text-gray-600 font-data flex items-center gap-0.5">
                      <Coins className="w-3 h-3" />+{a.ccReward}
                    </span>
                  )}
                  <span className="text-[10px] font-bold text-yellow-600 font-data">{a.pct}%</span>
                </div>
              </div>
              <div className="h-1 bg-[#222] rounded-full overflow-hidden">
                <div
                  className="h-full bg-yellow-600 transition-all duration-500 rounded-full"
                  style={{ width: `${a.pct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Achievements = () => {
  const profile = useProfileStore((state) => state.profile);
  const corps = useProfileStore((state) => state.corps);
  const [filter, setFilter] = useState('all');

  const evaluated = useMemo(() => evaluateAchievements(profile, corps), [profile, corps]);

  const earnedCount = evaluated.filter((a) => a.earned).length;
  const totalCount = ACHIEVEMENTS.length;
  const overallPct = totalCount ? Math.round((earnedCount / totalCount) * 100) : 0;
  const ccEarned = evaluated
    .filter((a) => a.earned)
    .reduce((sum, a) => sum + (a.ccReward || 0), 0);

  const matchesFilter = (a) => {
    if (filter === 'earned') return a.earned;
    if (filter === 'locked') return !a.earned && a.pct === 0;
    if (filter === 'progress') return !a.earned && a.pct > 0;
    return true;
  };

  // Group the (filtered) achievements by category, preserving category order.
  const grouped = useMemo(() => {
    return ACHIEVEMENT_CATEGORIES.map((cat) => {
      const all = evaluated.filter((a) => a.category === cat.id);
      const shown = all.filter(matchesFilter);
      return {
        ...cat,
        shown,
        earned: all.filter((a) => a.earned).length,
        total: all.length,
      };
    }).filter((cat) => cat.shown.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluated, filter]);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {/* Back link */}
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-300 mb-3"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
      </Link>

      {/* Header / overall progress */}
      <div className="bg-[#1a1a1a] border border-[#333] mb-4">
        <div className="px-4 py-3 border-b border-[#333] bg-[#222] flex items-center gap-3">
          <Award className="w-5 h-5 text-yellow-500" />
          <div className="flex-1">
            <h1 className="text-sm font-bold uppercase tracking-wider text-white">Achievements</h1>
            <p className="text-[11px] text-gray-500">
              Every award in the game — earned, in progress, and locked
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-bold text-white font-data tabular-nums leading-none">
              {earnedCount}
              <span className="text-gray-600">/{totalCount}</span>
            </div>
            <div className="text-[10px] text-gray-500">earned</div>
          </div>
        </div>
        <div className="h-1.5 bg-[#222]">
          <div
            className="h-full bg-yellow-500 transition-all duration-500"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        {ccEarned > 0 && (
          <div className="px-4 py-2 flex items-center gap-1.5 text-[11px] text-gray-500">
            <Coins className="w-3.5 h-3.5 text-yellow-600" />
            <span className="text-yellow-600 font-bold font-data">{ccEarned.toLocaleString()} CC</span>
            <span>earned from achievements</span>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors ${
              filter === f.id
                ? 'bg-[#0057B8] border-[#0057B8] text-white'
                : 'bg-[#1a1a1a] border-[#333] text-gray-400 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Categories */}
      {grouped.length === 0 ? (
        <div className="bg-[#1a1a1a] border border-[#333] px-4 py-12 text-center">
          <Award className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm text-gray-500">Nothing here yet for this filter.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {grouped.map((cat) => (
            <section key={cat.id} className="bg-[#1a1a1a] border border-[#333]">
              <div className="px-4 py-3 border-b border-[#333] bg-[#222]">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-300">
                    {cat.label}
                  </h2>
                  <span className="text-[10px] font-bold text-gray-500 font-data tabular-nums">
                    {cat.earned}/{cat.total}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 leading-snug">{cat.hint}</p>
              </div>
              <div className="p-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                {cat.shown.map((a) => (
                  <AchievementCard key={a.id} a={a} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default Achievements;
