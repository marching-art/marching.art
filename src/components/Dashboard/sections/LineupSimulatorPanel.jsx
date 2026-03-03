// LineupSimulatorPanel - Per-caption efficiency breakdown and weak-spot identification
// Fetches season averages from historical_scores and highlights underperforming captions

import React, { useState, useEffect, useMemo } from 'react';
import { Zap, ChevronRight, AlertTriangle, BarChart2 } from 'lucide-react';
import { db } from '../../../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { REQUIRED_CAPTIONS, CAPTION_CATEGORIES } from '../../../utils/captionPricing';

/**
 * Calculate the season average for one caption across all historical shows.
 * Returns null if no scored shows found for this corps/caption.
 */
const calcSeasonAvg = (yearData, corpsName, captionId) => {
  const scores = yearData
    .flatMap(e => e.scores?.filter(s => s.corps === corpsName) ?? [])
    .map(s => s.captions?.[captionId])
    .filter(v => v != null && v > 0);
  return scores.length > 0
    ? scores.reduce((a, b) => a + b, 0) / scores.length
    : null;
};

/** Map efficiency percentage to a color tier */
const effBgColor = (pct) =>
  pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';

const effTextColor = (pct) =>
  pct >= 80 ? 'text-green-500' : pct >= 60 ? 'text-yellow-500' : 'text-red-500';

const EfficiencyBar = React.memo(({ pct }) => (
  <div className="h-1.5 bg-[#333] rounded-full overflow-hidden">
    <div
      className={`h-full ${effBgColor(pct)} rounded-full transition-all duration-500`}
      style={{ width: `${Math.min(pct, 100)}%` }}
    />
  </div>
));
EfficiencyBar.displayName = 'EfficiencyBar';

const LineupSimulatorPanel = React.memo(({ lineup, lineupScoreData, activeCorpsClass, onSwapCaption }) => {
  const [seasonAvgs, setSeasonAvgs] = useState({});
  const [avgsLoading, setAvgsLoading] = useState(false);

  // Compute derived values without hooks so we can guard the effect/render
  const filledCount = Object.values(lineup || {}).filter(Boolean).length;
  const isSoundSport = activeCorpsClass === 'soundSport';
  const isFull = filledCount >= REQUIRED_CAPTIONS.length;

  // Fetch season averages for every corps in the current lineup
  useEffect(() => {
    if (isSoundSport || !isFull || !lineup) return;

    let cancelled = false;
    setSeasonAvgs({}); // clear stale data from previous lineup
    const fetchAvgs = async () => {
      setAvgsLoading(true);
      try {
        // Collect unique source years
        const yearsNeeded = new Set(
          Object.values(lineup).map(v => v?.split('|')[1]).filter(Boolean)
        );

        // Fetch historical_scores documents in parallel (same pattern as Dashboard.jsx)
        const historicalData = {};
        await Promise.all([...yearsNeeded].map(async year => {
          const snap = await getDoc(doc(db, `historical_scores/${year}`));
          if (snap.exists()) historicalData[year] = snap.data().data || [];
        }));

        if (cancelled) return;

        // Compute per-caption season averages
        const avgs = {};
        REQUIRED_CAPTIONS.forEach(captionId => {
          const value = lineup[captionId];
          if (!value) return;
          const [corpsName, year] = value.split('|');
          const yearData = historicalData[year];
          if (yearData) avgs[captionId] = calcSeasonAvg(yearData, corpsName, captionId);
        });

        setSeasonAvgs(avgs);
      } catch (err) {
        console.error('LineupSimulatorPanel fetch error:', err);
      } finally {
        if (!cancelled) setAvgsLoading(false);
      }
    };

    fetchAvgs();
    return () => { cancelled = true; };
  }, [lineup, isFull, isSoundSport]);

  // Build row data: prefer season avg over last-show score
  const rows = useMemo(() => REQUIRED_CAPTIONS.map(captionId => {
    const value = lineup?.[captionId];
    const [corpsName, year] = value ? value.split('|') : [];
    const lastScore = lineupScoreData?.[captionId]?.score ?? null;
    const avg = seasonAvgs[captionId] ?? lastScore;
    const max = CAPTION_CATEGORIES[captionId].weight;
    const pct = avg != null ? Math.round((avg / max) * 100) : null;
    // How many points gained by reaching 80% efficiency
    const potentialGain = (pct != null && pct < 80) ? +((0.8 * max) - avg).toFixed(1) : null;
    return { id: captionId, corpsName, year, avg, pct, potentialGain };
  }), [lineup, lineupScoreData, seasonAvgs]);

  // Only render for full, non-SoundSport lineups
  if (isSoundSport || !isFull) return null;

  // Derived values — only computed when the component will actually render
  const scoredRows = rows.filter(r => r.pct != null);
  const weakSpots = [...scoredRows]
    .filter(r => r.pct < 75)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 2);
  const overallEff = scoredRows.length > 0
    ? Math.round(scoredRows.reduce((s, r) => s + r.pct, 0) / scoredRows.length)
    : null;
  const hasScores = scoredRows.length > 0;
  const usingSeasonAvgs = Object.keys(seasonAvgs).length > 0;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] overflow-hidden">
      {/* Header */}
      <div className="bg-[#222] px-4 py-3 border-b border-[#333] flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-[#F5A623]" />
          Lineup Analyzer
        </h3>
        {overallEff != null && (
          <span className={`text-xs font-bold px-2 py-0.5 ${
            overallEff >= 80 ? 'bg-green-500/20 text-green-500' :
            overallEff >= 60 ? 'bg-yellow-500/20 text-yellow-500' :
            'bg-red-500/20 text-red-500'
          }`}>
            {overallEff}% eff.
          </span>
        )}
      </div>

      {!hasScores ? (
        <div className="px-4 py-6 text-center">
          <BarChart2 className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-xs text-gray-500">
            {avgsLoading ? 'Calculating averages…' : 'Score data appears after your first show.'}
          </p>
        </div>
      ) : (
        <>
          {/* Per-caption rows */}
          {rows.map((row, idx) => {
            const isWeak = weakSpots.some(w => w.id === row.id);
            const isLast = idx === rows.length - 1;
            return (
              <button
                key={row.id}
                onClick={() => onSwapCaption?.(row.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 transition-all hover:bg-[#222] active:bg-[#252525] text-left ${
                  !isLast ? 'border-b border-[#333]/50' : ''
                }`}
              >
                {/* Caption badge */}
                <div className={`w-9 h-7 flex items-center justify-center text-[10px] font-bold flex-shrink-0 rounded-sm ${
                  isWeak                    ? 'bg-red-500/20 text-red-400' :
                  (row.pct ?? 0) >= 80     ? 'bg-green-500/20 text-green-400' :
                  row.pct != null          ? 'bg-yellow-500/20 text-yellow-400' :
                                             'bg-[#333] text-gray-500'
                }`}>
                  {row.id}
                </div>

                {/* Corps name + efficiency bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-1">
                    <span className="text-xs text-white truncate">{row.corpsName ?? '—'}</span>
                    {row.year && (
                      <span className="text-[10px] text-gray-500 flex-shrink-0">
                        '{row.year.slice(-2)}
                      </span>
                    )}
                    {isWeak && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
                  </div>
                  {row.pct != null && <EfficiencyBar pct={row.pct} />}
                </div>

                {/* Score + percentage */}
                <div className="text-right flex-shrink-0 min-w-[44px]">
                  {row.avg != null ? (
                    <>
                      <div className="text-xs font-bold text-white font-data tabular-nums">
                        {row.avg.toFixed(1)}
                      </div>
                      <div className={`text-[10px] tabular-nums ${effTextColor(row.pct ?? 0)}`}>
                        {row.pct}%
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}
                </div>

                <ChevronRight className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
              </button>
            );
          })}

          {/* Weak spot recommendations */}
          {weakSpots.length > 0 && (
            <div className="px-3 py-2.5 border-t border-[#333] bg-[#111] space-y-1">
              {weakSpots.map(w => (
                <div key={w.id} className="flex items-start gap-1.5 text-[11px]">
                  <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0 mt-px" />
                  <span className="text-gray-400">
                    <span className="text-red-400 font-bold">{w.id}</span>
                    {' '}at {w.pct}%
                    {w.potentialGain != null && (
                      <span className="text-green-400">
                        {' '}— swap could gain <span className="font-bold">+{w.potentialGain} pts</span>
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Footer label */}
          <div className="px-3 py-1.5 border-t border-[#333] bg-[#111]">
            <p className="text-[10px] text-gray-600">
              {avgsLoading
                ? 'Calculating season averages…'
                : usingSeasonAvgs
                  ? 'Season averages · tap any row to swap'
                  : 'Last show scores · tap any row to swap'}
            </p>
          </div>
        </>
      )}
    </div>
  );
});

LineupSimulatorPanel.displayName = 'LineupSimulatorPanel';

export default LineupSimulatorPanel;
