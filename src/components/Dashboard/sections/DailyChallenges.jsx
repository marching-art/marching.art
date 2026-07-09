// DailyChallenges - Sidebar widget showing daily objectives to drive return visits.
// The rotation comes from the shared catalog (mirrored server-side) and resets
// at 2 AM ET with the nightly scores. Completion is server-authoritative:
// profileStore.completeDailyChallenge calls the completeDailyChallenge
// callable, which awards the XP and writes the profile's `challenges` bucket;
// the profile listener then syncs the checked state here.

import React, { memo, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Target, Check, ChevronRight, Flame } from 'lucide-react';
import { useHaptic } from '../../../hooks/useHaptic';
import { useProfileStore } from '../../../store/profileStore';
import { getGameDay, getChallengesForGameDay } from '../../../utils/dailyChallenges';

// `embedded` renders the same content without the outer card chrome, for
// composition inside the Director's Report (the unified Zone-B daily card).
const DailyChallenges = memo(({ onLineupClick, embedded = false }) => {
  const { trigger: haptic } = useHaptic();
  const profile = useProfileStore((state) => state.profile);
  const completeDailyChallenge = useProfileStore((state) => state.completeDailyChallenge);

  const gameDay = getGameDay();
  const challenges = useMemo(() => getChallengesForGameDay(gameDay), [gameDay]);

  const completedIds = useMemo(() => {
    const bucket = profile?.challenges?.[gameDay] || [];
    return new Set(bucket.filter((c) => c.completed).map((c) => c.id));
  }, [profile?.challenges, gameDay]);

  const completedCount = challenges.filter((c) => completedIds.has(c.id)).length;
  const totalCount = challenges.length;

  const markComplete = (id) => {
    haptic?.();
    // Fire-and-forget: the profile listener syncs the completed state, and
    // the store toasts + floats the XP gain on success.
    completeDailyChallenge(id);
  };

  return (
    <div className={embedded ? 'overflow-hidden' : 'bg-[#1a1a1a] border border-[#333] overflow-hidden'}>
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
        {challenges.map((challenge) => {
          const isDone = completedIds.has(challenge.id);
          const inner = (
            <div className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  isDone ? 'bg-green-500' : 'border border-[#444]'
                }`}
              >
                {isDone && <Check className="w-3 h-3 text-white" />}
              </div>
              <span
                className={`text-sm flex-1 ${isDone ? 'text-gray-500 line-through' : 'text-white'}`}
              >
                {challenge.label}
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-purple-400 font-data">
                  +{challenge.xp} XP
                </span>
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
