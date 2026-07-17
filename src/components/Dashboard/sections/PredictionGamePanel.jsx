// PredictionGamePanel - Daily prediction questions that resolve when new scores arrive
// Creates a natural "check back tomorrow" engagement loop between scoring
// cycles (the 9 PM ET off-season drop / 2 AM ET live run).
//
// Picks and their outcomes are persisted server-side on the profile's
// `predictions` ledger (mirrors DailyChallenges). submitPrediction saves each
// pick; resolvePredictions scores pending days against the authoritative
// recaps and awards XP + a CorpsCoin bonus for accurate picks. The profile
// listener syncs the checked/resolved state back here — nothing lives in
// localStorage anymore, so predictions survive across devices and sessions.

import React, { memo, useEffect, useMemo, useCallback } from 'react';
import { Crosshair, Check, X, Trophy } from 'lucide-react';
import { useHaptic } from '../../../hooks/useHaptic';
import { useProfileStore } from '../../../store/profileStore';
import { useSeasonStore } from '../../../store/seasonStore';
import { getGameDay } from '../../../utils/dailyChallenges';
import { buildQuestions } from '../../../utils/dailyPredictions';

// `embedded` renders the same content without the outer card chrome, for
// composition inside the Director's Report (the unified Zone-B daily card).
const PredictionGamePanel = memo(({ recentResults, corpsClass, embedded = false }) => {
  const { trigger: haptic } = useHaptic();
  const profile = useProfileStore((state) => state.profile);
  const submitPrediction = useProfileStore((state) => state.submitPrediction);
  const resolvePredictions = useProfileStore((state) => state.resolvePredictions);
  const seasonStatus = useSeasonStore((state) => state.seasonData?.status);

  const gameDay = getGameDay(new Date(), seasonStatus);

  const bucket = profile?.predictions?.[gameDay] || {};
  const picks = bucket.picks || {};
  const results = bucket.results || {};
  const isResolved = !!bucket.resolved;
  const stats = profile?.predictionStats || { correct: 0, total: 0 };

  // Generate questions from current data. SoundSport gets the placement-only
  // set (medal + improvement) — its numeric scores stay hidden.
  const questions = useMemo(
    () => buildQuestions(recentResults, corpsClass),
    [recentResults, corpsClass]
  );

  // Trigger server-side resolution once a newer result arrives. The callable
  // reads the authoritative recap, scores the picks and awards bonuses; the
  // profile listener then syncs the resolved state below. Idempotent + guarded
  // in the store, so re-renders are safe.
  const pickedCount = Object.keys(picks).length;
  const snapshotEvent = bucket.snapshotEvent ?? null;
  const latestEvent = recentResults?.[0]?.eventName ?? null;
  useEffect(() => {
    if (isResolved || pickedCount === 0 || !latestEvent) return;
    if (latestEvent === snapshotEvent) return;
    resolvePredictions();
  }, [isResolved, pickedCount, latestEvent, snapshotEvent, resolvePredictions]);

  // Handle user picking an option
  const handlePick = useCallback(
    (questionId, option, threshold) => {
      haptic?.();
      submitPrediction(questionId, option, threshold, corpsClass, latestEvent);
    },
    [submitPrediction, corpsClass, latestEvent, haptic]
  );

  // Don't render if not enough data to generate questions
  if (questions.length === 0) return null;

  const totalQ = questions.length;
  const correctCount = isResolved ? Object.values(results).filter((r) => r.isCorrect).length : 0;
  const accuracy = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : null;

  return (
    <div
      className={
        embedded ? 'overflow-hidden' : 'bg-surface-card border border-line overflow-hidden'
      }
    >
      {/* Header */}
      <div className="bg-surface-raised px-4 py-3 border-b border-line flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-muted flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5 text-cyan-500" />
          Daily Predictions
        </h3>
        <span className="text-[10px] font-bold text-muted font-data tabular-nums">
          {isResolved ? `${correctCount}/${totalQ}` : `${pickedCount}/${totalQ}`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-surface-raised">
        <div
          className={`h-full transition-all duration-500 ${isResolved ? 'bg-cyan-500' : 'bg-cyan-700'}`}
          style={{ width: `${((isResolved ? correctCount : pickedCount) / totalQ) * 100}%` }}
        />
      </div>

      {/* Questions */}
      <div className="divide-y divide-line-subtle">
        {questions.map((q) => {
          const pick = picks[q.id];
          const result = results[q.id];

          // Resolved state
          if (isResolved && result) {
            return (
              <div key={q.id} className="px-4 py-3 flex items-center gap-3">
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    result.isCorrect ? 'bg-green-500' : 'bg-red-500'
                  }`}
                >
                  {result.isCorrect ? (
                    <Check className="w-3 h-3 text-white" />
                  ) : (
                    <X className="w-3 h-3 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm ${result.isCorrect ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {q.text.split('?')[0]}?
                  </span>
                  <p className="text-[10px] text-muted mt-0.5">
                    You said <span className="text-white font-bold">{pick?.pick}</span>
                    {' — '}
                    {result.isCorrect ? 'correct!' : `answer: ${result.answer}`}
                  </p>
                </div>
                <span className="text-[10px] font-bold text-purple-400 font-data">
                  {result.isCorrect ? `+${q.xp} XP` : '—'}
                </span>
              </div>
            );
          }

          // Locked / awaiting state
          if (pick) {
            return (
              <div key={q.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 border border-cyan-700">
                  <Crosshair className="w-3 h-3 text-cyan-700" />
                </div>
                <span className="text-sm text-muted flex-1">{q.text.split('?')[0]}?</span>
                <span className="text-[10px] font-bold text-cyan-600 font-data">{pick.pick}</span>
              </div>
            );
          }

          // Open — show options
          return (
            <div key={q.id} className="px-4 py-3">
              <p className="text-sm text-white mb-2">{q.text}</p>
              <div className="flex items-center gap-2">
                {q.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handlePick(q.id, opt, q.threshold)}
                    className="flex-1 py-1.5 text-xs font-bold border border-line bg-surface-raised hover:bg-line text-white transition-colors press-feedback"
                  >
                    {opt}
                  </button>
                ))}
                <span className="text-[10px] font-bold text-purple-400 font-data ml-1 flex-shrink-0">
                  +{q.xp} XP
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer — accuracy stat or all-resolved banner */}
      {isResolved && correctCount === totalQ ? (
        <div className="px-4 py-3 border-t border-line-subtle bg-cyan-500/5">
          <div className="flex items-center gap-2 justify-center">
            <Trophy className="w-4 h-4 text-cyan-500" />
            <span className="text-xs font-bold text-cyan-400">Perfect predictions!</span>
          </div>
        </div>
      ) : accuracy != null ? (
        <div className="px-3 py-1.5 border-t border-line bg-surface-sunken">
          <p className="text-[10px] text-muted">
            Lifetime accuracy: {stats.correct}/{stats.total} ({accuracy}%)
          </p>
        </div>
      ) : !isResolved && pickedCount === totalQ ? (
        <div className="px-3 py-1.5 border-t border-line bg-surface-sunken">
          <p className="text-[10px] text-muted">Predictions locked — results after next show</p>
        </div>
      ) : null}
    </div>
  );
});

PredictionGamePanel.displayName = 'PredictionGamePanel';

export default PredictionGamePanel;
