// ResultCorrection - the commissioner's fix for a week that resolved wrong.
//
// A resolved matchup used to be final and unappealable. If a week resolved
// against missing recap data, or a director's shows were re-scored, or the
// pairing itself was wrong, there was nothing anyone could do.
//
// Corrections do not unfold the old result — the standings fold counts each
// pair exactly once, so subtracting one result and adding another is exactly
// the arithmetic that goes wrong quietly. The matchup document is edited and
// the whole table is rebuilt from every resolved week
// (functions/src/callable/leagueResults.js). The rebuild is exposed on its own
// too, as the escape hatch for a table that has drifted for any other reason.

import React, { useMemo, useState } from 'react';
import { Gavel, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

import { overrideMatchupResult, recomputeLeagueStandings } from '../../../api/functions';
import { CORPS_CLASS_SHORT_LABELS } from '../../../utils/corps';

interface WeekMatchup {
  pair?: [string, string | null];
  winner?: string | null;
  completed?: boolean;
  isBye?: boolean;
  scores?: Record<string, number>;
  overriddenBy?: string;
}

interface ResultCorrectionProps {
  league?: { id?: string } | null;
  /** The selected week's raw matchup document, if it has been generated. */
  weekData?: Record<string, unknown> | null;
  week: number;
  corpsClasses: string[];
  getDisplayName: (uid: string) => string;
  onCorrected?: () => void;
}

interface Row {
  corpsClass: string;
  index: number;
  matchup: WeekMatchup;
}

const ResultCorrection = ({
  league,
  weekData,
  week,
  corpsClasses,
  getDisplayName,
  onCorrected,
}: ResultCorrectionProps) => {
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);

  // Only settled head-to-head matchups can be corrected: a bye has no result,
  // and an unresolved week will be settled by the nightly run anyway.
  const rows = useMemo<Row[]>(() => {
    const found: Row[] = [];
    for (const corpsClass of corpsClasses) {
      const matchups = (weekData?.[`${corpsClass}Matchups`] || []) as WeekMatchup[];
      matchups.forEach((matchup, index) => {
        if (matchup?.completed && matchup.pair?.[1] && !matchup.isBye) {
          found.push({ corpsClass, index, matchup });
        }
      });
    }
    return found;
  }, [weekData, corpsClasses]);

  const handleOverride = async (row: Row, winner: string) => {
    if (!league?.id || row.matchup.winner === winner) return;
    const key = `${row.corpsClass}-${row.index}`;
    setBusyKey(key);
    try {
      const result = await overrideMatchupResult({
        leagueId: league.id,
        week,
        corpsClass: row.corpsClass,
        matchupIndex: row.index,
        winner,
      });
      toast.success(result.data?.message || 'Result corrected.');
      onCorrected?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to correct the result');
    } finally {
      setBusyKey(null);
    }
  };

  const handleRebuild = async () => {
    if (!league?.id) return;
    setRebuilding(true);
    try {
      const result = await recomputeLeagueStandings({ leagueId: league.id });
      toast.success(result.data?.message || 'Standings recalculated.');
      onCorrected?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to recalculate standings');
    } finally {
      setRebuilding(false);
    }
  };

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center gap-2">
        <Gavel className="w-4 h-4 text-orange-500" />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Correct A Result
        </span>
      </div>

      <div className="px-4 py-2 bg-surface-sunken border-b border-line-subtle">
        <p className="text-[10px] text-muted">
          Changing a winner recalculates the whole table from every resolved week, and posts a note
          to the activity feed. Week {week}.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="px-4 py-4 text-xs text-muted text-center">
          No settled matchups in week {week} yet.
        </p>
      ) : (
        <div className="divide-y divide-line-subtle">
          {rows.map((row) => {
            const [p1, p2] = row.matchup.pair as [string, string];
            const key = `${row.corpsClass}-${row.index}`;
            const busy = busyKey === key;
            const options: Array<{ value: string; label: string }> = [
              { value: p1, label: getDisplayName(p1) },
              { value: 'tie', label: 'Tie' },
              { value: p2, label: getDisplayName(p2) },
            ];

            return (
              <div key={key} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] uppercase tracking-wider text-muted">
                    {CORPS_CLASS_SHORT_LABELS[row.corpsClass] || row.corpsClass}
                  </span>
                  {row.matchup.overriddenBy && (
                    <span className="text-[9px] uppercase tracking-wider text-orange-500">
                      Corrected
                    </span>
                  )}
                  {busy && <Loader2 className="w-3 h-3 animate-spin text-muted" />}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {options.map((option) => {
                    const isWinner = row.matchup.winner === option.value;
                    return (
                      <button
                        key={option.value}
                        onClick={() => handleOverride(row, option.value)}
                        disabled={busy || isWinner}
                        className={`px-2 py-2 min-h-touch text-[10px] font-bold border transition-colors truncate disabled:cursor-default ${
                          isWinner
                            ? 'border-green-500/50 bg-green-500/10 text-green-500'
                            : 'border-line text-muted hover:border-line-strong hover:text-white'
                        }`}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <button
        onClick={handleRebuild}
        disabled={rebuilding}
        className="w-full py-2.5 min-h-touch border-t border-line text-[10px] font-bold uppercase tracking-wider text-muted hover:text-white disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
      >
        {rebuilding ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : (
          <RefreshCw className="w-3 h-3" />
        )}
        Recalculate standings from scratch
      </button>
    </div>
  );
};

export default ResultCorrection;
