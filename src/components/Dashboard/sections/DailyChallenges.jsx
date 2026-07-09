// DailyChallenges — the day's three rotating objectives. Every challenge is
// now a DECISION with a server-verified outcome (make a prediction, register
// for a show, set a show concept, review your lineup) — the old pool of
// "visit page X" rows that auto-completed on navigation is retired
// (DASHBOARD_UNIFICATION.md Part 4: a task with no agency has no value).
//
// Completion flow: rows point the player at the thing to do; once the
// verifying profile state appears (a pick saved, a show registered, ...) the
// component auto-claims and the completeDailyChallenge callable re-verifies
// before awarding XP. Completing the full set on 5 days in an ET week pays
// the weekly-arc bonus (server-owned, engagement.weeklyLoop).

import React, { memo, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Target, Check, ChevronRight, Flame, CalendarCheck } from 'lucide-react';
import { useHaptic } from '../../../hooks/useHaptic';
import { useProfileStore } from '../../../store/profileStore';
import {
  getGameDay,
  getWeekKey,
  getChallengesForGameDay,
  WEEKLY_LOOP_TARGET_DAYS,
  WEEKLY_LOOP_BONUS,
} from '../../../utils/dailyChallenges';

// `embedded` renders the same content without the outer card chrome, for
// composition inside the Director's Report (the unified Zone-B daily card).
// `predictionAvailable={false}` drops the make-prediction row entirely: a
// brand-new director (fewer than two scored results) has NO prediction
// questions, so the row would point at a panel that doesn't exist and the
// day's set could never complete (the server excuses it the same way).
const DailyChallenges = memo(
  ({ onLineupClick, onConceptClick, embedded = false, predictionAvailable = true }) => {
  const { trigger: haptic } = useHaptic();
  const profile = useProfileStore((state) => state.profile);
  const completeDailyChallenge = useProfileStore((state) => state.completeDailyChallenge);

  const gameDay = getGameDay();
  const challenges = useMemo(
    () =>
      getChallengesForGameDay(gameDay).filter(
        (c) => c.id !== 'make-prediction' || predictionAvailable
      ),
    [gameDay, predictionAvailable]
  );

  const completedIds = useMemo(() => {
    const bucket = profile?.challenges?.[gameDay] || [];
    return new Set(bucket.filter((c) => c.completed).map((c) => c.id));
  }, [profile?.challenges, gameDay]);

  const completedCount = challenges.filter((c) => completedIds.has(c.id)).length;
  const totalCount = challenges.length;

  // Weekly arc progress (server-owned; countedDays are full-set days)
  const weeklyLoop = profile?.engagement?.weeklyLoop;
  const arcDays =
    weeklyLoop?.weekKey === getWeekKey(gameDay) ? weeklyLoop.countedDays?.length || 0 : 0;

  // Auto-claim: when the verifying state for a challenge is already
  // satisfied, claim it — the server re-verifies before paying, and no-ops
  // for anything not actually done. One attempt per challenge per day.
  const attemptedRef = useRef(new Set());
  useEffect(() => {
    if (!profile) return;
    for (const challenge of challenges) {
      const key = `${gameDay}:${challenge.id}`;
      if (completedIds.has(challenge.id) || attemptedRef.current.has(key)) continue;
      if (challenge.check && challenge.check(profile, gameDay)) {
        attemptedRef.current.add(key);
        completeDailyChallenge(challenge.id);
      }
    }
  }, [profile, challenges, completedIds, gameDay, completeDailyChallenge]);

  const handleAction = (challenge) => {
    haptic?.();
    if (challenge.action === 'lineup') onLineupClick?.();
    if (challenge.action === 'concept') onConceptClick?.();
    // Reviewing the lineup is satisfied by opening it — claim on the spot
    // (the server still verifies a lineup exists).
    if (challenge.action === 'lineup') completeDailyChallenge(challenge.id);
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
                className={`text-sm flex-1 text-left ${isDone ? 'text-gray-500 line-through' : 'text-white'}`}
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

          // Done rows are inert; open rows route the player to the decision.
          if (isDone) {
            return (
              <div key={challenge.id} className="px-4 py-3">
                {inner}
              </div>
            );
          }

          if (challenge.action === 'predictions') {
            // The predictions live directly below in the Director's Report —
            // completing a pick auto-claims this row.
            return (
              <div key={challenge.id} className="px-4 py-3">
                {inner}
                <p className="text-[10px] text-gray-600 mt-1 ml-8">
                  Answer in Daily Predictions below
                </p>
              </div>
            );
          }

          if (challenge.action) {
            return (
              <button
                key={challenge.id}
                onClick={() => handleAction(challenge)}
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
              onClick={() => haptic?.()}
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

      {/* Weekly arc — a week-long pursuit on top of the daily set */}
      <div className="px-4 py-2 border-t border-[#222] flex items-center gap-2">
        <CalendarCheck className="w-3 h-3 text-emerald-500 flex-shrink-0" />
        <span className="text-[10px] text-gray-500 flex-1">
          Weekly arc: full set on {arcDays}/{WEEKLY_LOOP_TARGET_DAYS} days
        </span>
        <span className="text-[10px] font-bold text-emerald-400 font-data">
          +{WEEKLY_LOOP_BONUS.coin} CC
        </span>
      </div>
    </div>
  );
  }
);

export default DailyChallenges;
