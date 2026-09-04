// SeasonLedgerView — the shared presentation for the Season Recap Ledger: a
// director's own corps told as a running recap, one line per scored outing with
// the full 8-caption breakdown, GE/VIS/MUS subtotals, total, placement, and the
// score movement between outings. Personal caption bests are bolded in gold like
// box-toppers. Both the Podium ledger (public podium-recaps) and the fantasy
// ledger (the private, owner-only caption store) build a normalized ledger array
// and hand it here, so the two read as one system.

import React from 'react';
import { Loader2, TrendingUp, Medal } from 'lucide-react';
import { MEDAL_TEXT_CLASS } from '../../utils/podiumMedals';
import { ShareButton } from './SheetPrimitives';
import { SHEET_CARD } from './sheetTokens';
import { fmtScore } from './seasonLedgerUtils';
import { CAPTION_IDS } from '../../data/captions';

// Signed total movement between consecutive outings — the "how am I trending"
// glyph. Positive is a green climb, negative a red slip, first outing a dash.
/** @param {{ delta?: number|null }} props */
function TotalTrend({ delta }) {
  if (delta === null || delta === undefined) {
    return (
      <span className="text-muted text-[10px]" aria-hidden="true">
        —
      </span>
    );
  }
  if (Math.abs(delta) < 0.005) {
    return <span className="text-muted text-[10px] tabular-nums">0.00</span>;
  }
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-bold tabular-nums ${
        up ? 'text-green-500' : 'text-red-500'
      }`}
      aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(delta).toFixed(2)} since previous outing`}
    >
      <span aria-hidden="true" className="text-[8px] leading-none">
        {up ? '▲' : '▼'}
      </span>
      {Math.abs(delta).toFixed(2)}
    </span>
  );
}

/** @param {{ label: React.ReactNode, value: React.ReactNode, sub?: React.ReactNode }} props */
function StatTile({ label, value, sub }) {
  return (
    <div className="bg-surface-raised p-2.5 min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-muted mb-0.5 truncate">{label}</p>
      <p className="text-lg font-bold text-white font-data tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[9px] text-muted mt-1 truncate">{sub}</p>}
    </div>
  );
}

/**
 * @param {{
 *   loading?: boolean,
 *   ledger: import('./seasonLedgerUtils').LedgerEntry[],
 *   summary: import('./seasonLedgerUtils').LedgerSummary | null,
 *   captions?: readonly string[],
 *   title?: string,
 *   subtitle?: string,
 *   emptyText?: string,
 *   legendText?: React.ReactNode,
 *   getShareText?: () => string,
 *   formatEventName?: (name?: string | null) => string,
 *   showMedals?: boolean,
 *   compact?: boolean,   // drop the card chrome when hosted inside a modal
 * }} props
 */
export default function SeasonLedgerView({
  loading = false,
  ledger,
  summary,
  captions = CAPTION_IDS,
  title = 'Season Recap Ledger',
  subtitle,
  emptyText = 'No scored outings yet — your ledger fills in one line at a time as your corps competes.',
  legendText,
  getShareText,
  formatEventName = (n) => n || '',
  showMedals = false,
  compact = false,
}) {
  const header = (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
        <TrendingUp className="w-3 h-3" /> {title}
      </span>
      {subtitle && (
        <span className="text-[9px] uppercase tracking-wider text-muted truncate">{subtitle}</span>
      )}
    </div>
  );

  let body;
  if (loading) {
    body = (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted" />
      </div>
    );
  } else if (!summary) {
    body = <div className="p-8 text-center text-[11px] text-muted">{emptyText}</div>;
  } else {
    body = (
      <div className="space-y-3">
        {/* Season summary strip — the running totals at a glance */}
        <div className={`grid gap-2 ${showMedals ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'}`}>
          <StatTile label="Outings" value={summary.outings} />
          <StatTile
            label="Season Best"
            value={fmtScore(summary.best.totalScore)}
            sub={formatEventName(summary.best.eventName) || `Day ${summary.best.day}`}
          />
          <StatTile label="Average" value={fmtScore(summary.average)} />
          {showMedals && (
            <StatTile
              label="Medals"
              value={summary.medalCount}
              sub={
                summary.medalCount > 0
                  ? `${summary.medals.gold}G · ${summary.medals.silver}S · ${summary.medals.bronze}B`
                  : 'none yet'
              }
            />
          )}
        </div>

        {/* The ledger — one line per outing, caption bests bolded in gold */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-[11px] tabular-nums whitespace-nowrap">
            <colgroup>
              <col style={{ width: '150px' }} />
              {captions.map((caption) => (
                <col key={caption} style={{ width: '48px' }} />
              ))}
              <col style={{ width: '48px' }} />
              <col style={{ width: '48px' }} />
              <col style={{ width: '48px' }} />
              <col style={{ width: '58px' }} />
              <col style={{ width: '52px' }} />
              <col style={{ width: '56px' }} />
            </colgroup>
            <thead>
              <tr className="text-[9px] uppercase tracking-wider text-muted border-b border-line">
                <th className="text-left py-1.5 pr-2 sticky left-0 bg-surface-card">Show</th>
                {captions.map((caption) => (
                  <th key={caption} className="px-1.5 text-right">
                    {caption}
                  </th>
                ))}
                <th className="px-1.5 text-right text-muted">GE</th>
                <th className="px-1.5 text-right text-muted">VIS</th>
                <th className="px-1.5 text-right text-muted">MUS</th>
                <th className="px-1.5 text-right text-white">Total</th>
                <th className="px-1.5 text-right text-muted">Place</th>
                <th className="pl-2 text-right text-muted">Move</th>
              </tr>
            </thead>
            <tbody>
              {ledger.map((entry, index) => {
                const prev = index > 0 ? ledger[index - 1] : null;
                const delta =
                  prev &&
                  typeof prev.totalScore === 'number' &&
                  typeof entry.totalScore === 'number'
                    ? entry.totalScore - prev.totalScore
                    : null;
                const isSeasonBest = entry === summary.best;
                return (
                  <tr
                    key={entry.key || `${entry.day}-${index}`}
                    className="border-b border-line-subtle"
                  >
                    <td className="py-1.5 pr-2 sticky left-0 bg-surface-card">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {showMedals && entry.medal && (
                          <Medal
                            className={`w-3 h-3 flex-shrink-0 ${
                              MEDAL_TEXT_CLASS[entry.medal] || 'text-muted'
                            }`}
                            aria-label={`${entry.medal} medal`}
                          />
                        )}
                        <div className="min-w-0">
                          <div className="text-white font-bold truncate leading-tight">
                            {formatEventName(entry.eventName) || `Day ${entry.day}`}
                          </div>
                          <div className="text-[9px] text-muted truncate leading-tight">
                            D{entry.day}
                            {entry.location ? ` · ${entry.location}` : ''}
                          </div>
                        </div>
                      </div>
                    </td>
                    {captions.map((caption) => {
                      const value = entry.captions?.[caption];
                      const isBest =
                        typeof value === 'number' && value === summary.captionBests[caption];
                      return (
                        <td
                          key={caption}
                          className={`px-1.5 text-right ${
                            isBest ? 'font-bold text-brand' : 'text-secondary'
                          }`}
                        >
                          {fmtScore(value)}
                        </td>
                      );
                    })}
                    <td className="px-1.5 text-right text-muted">{fmtScore(entry.geScore)}</td>
                    <td className="px-1.5 text-right text-muted">{fmtScore(entry.visualScore)}</td>
                    <td className="px-1.5 text-right text-muted">{fmtScore(entry.musicScore)}</td>
                    <td
                      className={`px-1.5 text-right font-bold ${
                        isSeasonBest ? 'text-brand' : 'text-white'
                      }`}
                    >
                      {fmtScore(entry.totalScore)}
                    </td>
                    <td className="px-1.5 text-right text-secondary">
                      {entry.place ? (
                        <span>
                          {entry.place}
                          <span className="text-muted">/{entry.fieldSize}</span>
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="pl-2 text-right">
                      <TotalTrend delta={delta} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend + share — caption bests are personal box-toppers */}
        <div className="flex justify-between items-center gap-2 pt-0.5 text-[9px] uppercase tracking-wider text-muted">
          <span className="truncate">{legendText}</span>
          {getShareText && (
            <ShareButton
              getText={getShareText}
              title="Copy your season ledger as Discord-ready text"
            />
          )}
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="p-3 md:p-4 space-y-3">
        {header}
        {body}
      </div>
    );
  }

  return (
    <div className={`${SHEET_CARD} space-y-3`}>
      {header}
      {body}
    </div>
  );
}
