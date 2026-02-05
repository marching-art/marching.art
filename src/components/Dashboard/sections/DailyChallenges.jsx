// DailyChallenges - Sidebar widget showing daily objectives to drive return visits
// Rotates 3 challenges per day based on date seed. Tracks completion in localStorage.

import React, { memo, useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Target, Check, ChevronRight, Flame } from 'lucide-react';
import { useHaptic } from '../../../hooks/useHaptic';

// Pool of challenges that rotate daily
const CHALLENGE_POOL = [
  { id: 'check-lineup', label: 'Review your lineup', link: null, action: 'lineup', xp: 10 },
  { id: 'visit-scores', label: 'Check the leaderboard', link: '/scores', xp: 10 },
  { id: 'visit-schedule', label: 'View upcoming shows', link: '/schedule', xp: 10 },
  { id: 'visit-leagues', label: 'Check league standings', link: '/leagues', xp: 10 },
  { id: 'visit-profile', label: 'Visit your profile', link: '/profile', xp: 5 },
  { id: 'read-news', label: 'Read the latest news', link: '/', xp: 5 },
  { id: 'visit-guide', label: 'Review game rules', link: '/guide', xp: 5 },
  { id: 'visit-hall', label: 'Visit Hall of Champions', link: '/hall-of-champions', xp: 5 },
];

// Deterministic daily seed to pick 3 challenges
const getDailyKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
};

const getDailyChallenges = () => {
  const key = getDailyKey();
  // Simple hash from date string to get a seed
  let seed = 0;
  for (let i = 0; i < key.length; i++) {
    seed = ((seed << 5) - seed + key.charCodeAt(i)) | 0;
  }
  // Use seed to pick 3 unique challenges
  const shuffled = [...CHALLENGE_POOL].sort((a, b) => {
    const ha = ((seed * 31 + a.id.charCodeAt(0)) | 0) & 0x7fffffff;
    const hb = ((seed * 31 + b.id.charCodeAt(0)) | 0) & 0x7fffffff;
    return ha - hb;
  });
  return shuffled.slice(0, 3);
};

const getCompletedKey = () => `dailyChallenges_${getDailyKey()}`;

const getCompleted = () => {
  try {
    return JSON.parse(localStorage.getItem(getCompletedKey()) || '[]');
  } catch {
    return [];
  }
};

const DailyChallenges = memo(({ onLineupClick }) => {
  const { trigger: haptic } = useHaptic();
  const challenges = useMemo(() => getDailyChallenges(), []);
  const [completed, setCompleted] = useState(() => getCompleted());

  const completedCount = completed.length;
  const totalCount = challenges.length;

  const markComplete = useCallback((id) => {
    setCompleted(prev => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      try {
        localStorage.setItem(getCompletedKey(), JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
    haptic?.();
  }, [haptic]);

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-orange-500" />
          Daily Challenges
        </h3>
        <span className="text-[10px] font-bold text-gray-500 font-data tabular-nums">
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#222]">
        <div
          className="h-full bg-orange-500 transition-all duration-500"
          style={{ width: `${(completedCount / totalCount) * 100}%` }}
        />
      </div>

      <div className="divide-y divide-[#222]">
        {challenges.map(challenge => {
          const isDone = completed.includes(challenge.id);
          const inner = (
            <div className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                isDone ? 'bg-green-500' : 'border border-[#444]'
              }`}>
                {isDone && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className={`text-sm flex-1 ${isDone ? 'text-gray-500 line-through' : 'text-white'}`}>
                {challenge.label}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-purple-400 font-data">+{challenge.xp} XP</span>
                {!isDone && <ChevronRight className="w-3.5 h-3.5 text-gray-600" />}
              </div>
            </div>
          );

          if (challenge.action === 'lineup') {
            return (
              <button
                key={challenge.id}
                onClick={() => {
                  markComplete(challenge.id);
                  onLineupClick?.();
                }}
                className="w-full px-4 py-3 hover:bg-[#222] transition-colors text-left press-feedback"
              >
                {inner}
              </button>
            );
          }

          return (
            <Link
              key={challenge.id}
              to={challenge.link}
              onClick={() => markComplete(challenge.id)}
              className="block px-4 py-3 hover:bg-[#222] transition-colors press-feedback"
            >
              {inner}
            </Link>
          );
        })}
      </div>

      {/* All complete state */}
      {completedCount === totalCount && (
        <div className="px-4 py-3 border-t border-[#222] bg-orange-500/5">
          <div className="flex items-center gap-2 justify-center">
            <Flame className="w-4 h-4 text-orange-500" />
            <span className="text-xs font-bold text-orange-400">All challenges complete!</span>
          </div>
        </div>
      )}
    </div>
  );
});

export default DailyChallenges;
