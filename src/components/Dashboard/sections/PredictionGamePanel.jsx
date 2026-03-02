// PredictionGamePanel - Daily prediction questions that resolve when new scores arrive
// Creates a natural "check back tomorrow" engagement loop between 2 AM scoring cycles

import React, { memo, useState, useEffect, useMemo, useCallback } from 'react';
import { Crosshair, Check, X, Trophy } from 'lucide-react';
import { useHaptic } from '../../../hooks/useHaptic';

// ---------------------------------------------------------------------------
// localStorage helpers (same pattern as DailyChallenges)
// ---------------------------------------------------------------------------

const getToday = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

const PRED_KEY = (date) => `pred_${date}`;
const STATS_KEY = 'predStats';

const loadPredictions = (date) => {
  try { return JSON.parse(localStorage.getItem(PRED_KEY(date)) || '{}'); }
  catch { return {}; }
};

const savePredictions = (date, data) => {
  try { localStorage.setItem(PRED_KEY(date), JSON.stringify(data)); }
  catch { /* ignore */ }
};

const loadStats = () => {
  try { return JSON.parse(localStorage.getItem(STATS_KEY) || '{"correct":0,"total":0}'); }
  catch { return { correct: 0, total: 0 }; }
};

const saveStats = (stats) => {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); }
  catch { /* ignore */ }
};

// ---------------------------------------------------------------------------
// Question generation — uses recent results for thresholds
// ---------------------------------------------------------------------------

const buildQuestions = (recentResults) => {
  if (!recentResults || recentResults.length < 2) return [];

  const scores = recentResults.map(r => r.score).filter(Boolean);
  if (scores.length < 2) return [];

  const avg = scores.slice(0, 3).reduce((s, v) => s + v, 0) / Math.min(scores.length, 3);
  const line = Math.round(avg * 10) / 10;
  const lastScore = scores[0];

  return [
    {
      id: 'over-under',
      text: `Next score over or under ${line.toFixed(1)}?`,
      options: ['Over', 'Under'],
      xp: 15,
      threshold: line,
    },
    {
      id: 'beat-prev',
      text: `Beat your last score of ${lastScore.toFixed(1)}?`,
      options: ['Yes', 'No'],
      xp: 15,
      threshold: lastScore,
    },
    {
      id: 'podium',
      text: 'Top 3 finish next show?',
      options: ['Yes', 'No'],
      xp: 15,
      threshold: 3,
    },
  ];
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PredictionGamePanel = memo(({ recentResults }) => {
  const { trigger: haptic } = useHaptic();
  const today = getToday();
  const [preds, setPreds] = useState(() => loadPredictions(today));
  const [stats, setStats] = useState(() => loadStats());

  // Generate questions from current data
  const questions = useMemo(
    () => buildQuestions(recentResults),
    [recentResults]
  );

  // Resolve predictions when new results arrive
  useEffect(() => {
    if (!preds.picks || preds.resolved || !recentResults?.length) return;

    // Detect new result by comparing latest event name to stored snapshot
    const latestEvent = recentResults[0]?.eventName;
    if (!latestEvent || latestEvent === preds.snapshotEvent) return;

    const newScore = recentResults[0]?.score;
    const newPlacement = recentResults[0]?.placement;
    if (newScore == null) return;

    // Evaluate each pick against stored thresholds
    const results = {};
    let correct = 0;
    const storedPicks = preds.picks;

    const resolvers = [
      { id: 'over-under', answer: () => newScore > storedPicks['over-under']?.threshold ? 'Over' : 'Under', extra: { newScore } },
      { id: 'beat-prev', answer: () => newScore > storedPicks['beat-prev']?.threshold ? 'Yes' : 'No', extra: { newScore } },
      { id: 'podium', skip: newPlacement == null, answer: () => newPlacement <= 3 ? 'Yes' : 'No', extra: { placement: newPlacement } },
    ];

    for (const { id, skip, answer, extra } of resolvers) {
      if (!storedPicks[id] || skip) continue;
      const resolved = answer();
      const isCorrect = storedPicks[id].pick === resolved;
      results[id] = { answer: resolved, isCorrect, ...extra };
      if (isCorrect) correct++;
    }

    if (Object.keys(results).length === 0) return;

    const resolvedPreds = { ...preds, resolved: true, results };
    setPreds(resolvedPreds);
    savePredictions(today, resolvedPreds);

    setStats(prev => {
      const next = {
        correct: prev.correct + correct,
        total: prev.total + Object.keys(results).length,
      };
      saveStats(next);
      return next;
    });
  }, [preds, recentResults, today]);

  // Handle user picking an option
  const handlePick = useCallback((questionId, option, threshold) => {
    haptic?.();
    setPreds(prev => {
      const next = {
        ...prev,
        picks: {
          ...(prev.picks || {}),
          [questionId]: { pick: option, threshold },
        },
        snapshotEvent: recentResults?.[0]?.eventName ?? null,
      };
      savePredictions(today, next);
      return next;
    });
  }, [today, recentResults, haptic]);

  // Don't render if not enough data to generate questions
  if (questions.length === 0) return null;

  const picks = preds.picks || {};
  const results = preds.results || {};
  const isResolved = preds.resolved;
  const pickedCount = Object.keys(picks).length;
  const totalQ = questions.length;
  const correctCount = isResolved
    ? Object.values(results).filter(r => r.isCorrect).length
    : 0;
  const accuracy = stats.total > 0
    ? Math.round((stats.correct / stats.total) * 100)
    : null;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      {/* Header */}
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Crosshair className="w-3.5 h-3.5 text-cyan-500" />
          Daily Predictions
        </h3>
        <span className="text-[10px] font-bold text-gray-500 font-data tabular-nums">
          {isResolved ? `${correctCount}/${totalQ}` : `${pickedCount}/${totalQ}`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-[#222]">
        <div
          className={`h-full transition-all duration-500 ${isResolved ? 'bg-cyan-500' : 'bg-cyan-700'}`}
          style={{ width: `${((isResolved ? correctCount : pickedCount) / totalQ) * 100}%` }}
        />
      </div>

      {/* Questions */}
      <div className="divide-y divide-[#222]">
        {questions.map(q => {
          const pick = picks[q.id];
          const result = results[q.id];

          // Resolved state
          if (isResolved && result) {
            return (
              <div key={q.id} className="px-4 py-3 flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  result.isCorrect ? 'bg-green-500' : 'bg-red-500'
                }`}>
                  {result.isCorrect
                    ? <Check className="w-3 h-3 text-white" />
                    : <X className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className={`text-sm ${result.isCorrect ? 'text-green-400' : 'text-red-400'}`}>
                    {q.text.split('?')[0]}?
                  </span>
                  <p className="text-[10px] text-gray-500 mt-0.5">
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
                <span className="text-sm text-gray-400 flex-1">{q.text.split('?')[0]}?</span>
                <span className="text-[10px] font-bold text-cyan-600 font-data">{pick.pick}</span>
              </div>
            );
          }

          // Open — show options
          return (
            <div key={q.id} className="px-4 py-3">
              <p className="text-sm text-white mb-2">{q.text}</p>
              <div className="flex items-center gap-2">
                {q.options.map(opt => (
                  <button
                    key={opt}
                    onClick={() => handlePick(q.id, opt, q.threshold)}
                    className="flex-1 py-1.5 text-xs font-bold border border-[#333] bg-[#222] hover:bg-[#333] text-white transition-colors press-feedback"
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
        <div className="px-4 py-3 border-t border-[#222] bg-cyan-500/5">
          <div className="flex items-center gap-2 justify-center">
            <Trophy className="w-4 h-4 text-cyan-500" />
            <span className="text-xs font-bold text-cyan-400">Perfect predictions!</span>
          </div>
        </div>
      ) : accuracy != null ? (
        <div className="px-3 py-1.5 border-t border-[#333] bg-[#111]">
          <p className="text-[10px] text-gray-600">
            Lifetime accuracy: {stats.correct}/{stats.total} ({accuracy}%)
          </p>
        </div>
      ) : !isResolved && pickedCount === totalQ ? (
        <div className="px-3 py-1.5 border-t border-[#333] bg-[#111]">
          <p className="text-[10px] text-gray-600">
            Predictions locked — results after next show
          </p>
        </div>
      ) : null}
    </div>
  );
});

PredictionGamePanel.displayName = 'PredictionGamePanel';

export default PredictionGamePanel;
