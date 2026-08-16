// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// PodiumSeasonLedger — a director's running stat ledger for their OWN Podium
// corps, show to show (community request). Where PodiumRecapSheet is the whole
// field's box score for one night, this is one corps' season told as a recap:
// every scored outing on one line, full caption breakdown, with the season's
// personal bests bolded in gold like box-toppers and the total movement between
// outings shown as a trend.
//
// Reads the same public `podium-recaps/{seasonUid}/days` collection the recap
// sheet does, then keeps only this corps' row from each show. Surfaced two ways
// (both from the community ask): as a panel on the Podium Dashboard, and as the
// modal that opens when a director clicks SEASON SCORE on the Season Scorecard.

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, TrendingUp, Medal } from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../api';
import { formatEventName } from '../../utils/season';
import { CLASS_LABELS } from '../../utils/scoresUtils';
import { ShareButton } from '../scores/SheetPrimitives';
import { SHEET_CARD } from '../scores/sheetTokens';
import { PODIUM_CAPTIONS } from './podiumConstants';

// New recaps carry `shows: [...]`; legacy per-day recaps carried a flat
// `results`. Normalize both to the shows shape (mirrors PodiumRecapSheet).
function showsOf(recap) {
  if (Array.isArray(recap?.shows)) return recap.shows;
  if (Array.isArray(recap?.results)) {
    return [{ eventName: null, location: null, results: recap.results }];
  }
  return [];
}

const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');
const MEDAL_COLORS = { gold: 'text-brand', silver: 'text-secondary', bronze: 'text-amber-700' };

/**
 * Reduce every day's recap to THIS corps' outings, oldest first. Each entry is
 * one scored show: its caption line, subtotals, total, and the corps' placement
 * WITHIN ITS OWN DIVISION that night (the number that matters to it — a
 * division crowns its own winner, §5.7), not its rank in the mixed field.
 */
function buildLedger(days, uid, userCorpsName) {
  const isMine = (r) =>
    (uid && r.uid === uid) ||
    (userCorpsName && r.corpsName?.toLowerCase() === userCorpsName.toLowerCase());

  const entries = [];
  for (const { day, recap } of days) {
    for (const show of showsOf(recap)) {
      const results = show.results || [];
      const mine = results.find(isMine);
      if (!mine) continue;
      const division = mine.division || 'aClass';
      const divisionField = results
        .filter((r) => (r.division || 'aClass') === division)
        .sort((a, b) => b.totalScore - a.totalScore);
      const place = divisionField.findIndex(isMine) + 1;
      entries.push({
        day,
        eventName: show.eventName,
        location: show.location || null,
        division,
        captions: mine.captions || {},
        geScore: mine.geScore,
        visualScore: mine.visualScore,
        musicScore: mine.musicScore,
        totalScore: mine.totalScore,
        place: place > 0 ? place : null,
        fieldSize: divisionField.length,
        medal: mine.medal || null,
      });
    }
  }
  return entries;
}

/**
 * Season aggregates over the ledger: outing count, the best/average total, the
 * best value posted in each caption (its "personal box-topper"), and a medal
 * tally. These drive both the summary strip and the gold highlighting.
 */
function summarize(ledger) {
  if (ledger.length === 0) return null;
  const totals = ledger.map((e) => e.totalScore).filter((t) => typeof t === 'number');
  const best = ledger.reduce((a, b) => (b.totalScore > a.totalScore ? b : a));
  const captionBests = {};
  for (const caption of PODIUM_CAPTIONS) {
    let top = null;
    for (const entry of ledger) {
      const v = entry.captions?.[caption];
      if (typeof v === 'number' && (top === null || v > top)) top = v;
    }
    captionBests[caption] = top;
  }
  const medals = { gold: 0, silver: 0, bronze: 0 };
  for (const entry of ledger) {
    if (entry.medal && medals[entry.medal] != null) medals[entry.medal] += 1;
  }
  return {
    outings: ledger.length,
    best,
    average: totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : null,
    captionBests,
    medals,
    medalCount: medals.gold + medals.silver + medals.bronze,
  };
}

// Signed total movement between consecutive outings — the "how am I trending"
// glyph. Positive is a green climb, negative a red slip, first outing a dash.
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

function StatTile({ label, value, sub }) {
  return (
    <div className="bg-surface-raised p-2.5 min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-muted mb-0.5 truncate">{label}</p>
      <p className="text-lg font-bold text-white font-data tabular-nums leading-none">{value}</p>
      {sub && <p className="text-[9px] text-muted mt-1 truncate">{sub}</p>}
    </div>
  );
}

/** Monospace ledger for the Share button — pastes cleanly into Discord. */
function formatLedgerAsText(ledger, summary, corpsName, seasonName) {
  const lines = [
    `${corpsName || 'My Corps'} — Season Recap Ledger${seasonName ? ` · ${seasonName}` : ''}`,
    `${summary.outings} outing${summary.outings === 1 ? '' : 's'} · best ${fmt(
      summary.best.totalScore
    )} · avg ${fmt(summary.average)}`,
    '',
  ];
  for (const entry of ledger) {
    const name = formatEventName(entry.eventName) || `Day ${entry.day}`;
    const placeStr = entry.place ? `${entry.place}/${entry.fieldSize}` : '—';
    lines.push(
      `D${String(entry.day).padStart(2)} ${name.padEnd(26).slice(0, 26)} ${fmt(
        entry.totalScore
      ).padStart(6)}  (GE ${fmt(entry.geScore)} · VIS ${fmt(entry.visualScore)} · MUS ${fmt(
        entry.musicScore
      )}) ${CLASS_LABELS[entry.division] || entry.division} ${placeStr}`
    );
  }
  lines.push('');
  lines.push(`marching.art${seasonName ? ` · ${seasonName}` : ''} — Podium Class`);
  return '```\n' + lines.join('\n') + '\n```';
}

/**
 * @param {{
 *   seasonUid?: string|null,
 *   seasonName?: string|null,
 *   uid?: string|null,
 *   userCorpsName?: string|null,
 *   compact?: boolean,   // drop the card chrome when hosted inside a modal
 * }} props
 */
export default function PodiumSeasonLedger({
  seasonUid,
  seasonName,
  uid,
  userCorpsName,
  compact = false,
}) {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!seasonUid) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const snapshot = await getDocs(collection(db, 'podium-recaps', seasonUid, 'days'));
        if (cancelled) return;
        const loaded = snapshot.docs
          .map((doc) => ({ day: Number(doc.id), recap: doc.data() }))
          .sort((a, b) => a.day - b.day);
        setDays(loaded);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonUid]);

  const ledger = useMemo(() => buildLedger(days, uid, userCorpsName), [days, uid, userCorpsName]);
  const summary = useMemo(() => summarize(ledger), [ledger]);

  const Header = (
    <div className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
        <TrendingUp className="w-3 h-3" /> Season Recap Ledger
      </span>
      <span className="text-[9px] uppercase tracking-wider text-muted truncate">
        {userCorpsName || 'Your corps'} · show to show
      </span>
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
    body = (
      <div className="p-8 text-center text-[11px] text-muted">
        No scored outings yet — your ledger fills in one line at a time as your corps competes. The
        first entry posts after your next scored show.
      </div>
    );
  } else {
    body = (
      <div className="space-y-3">
        {/* Season summary strip — the running totals at a glance */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label="Outings" value={summary.outings} />
          <StatTile
            label="Season Best"
            value={fmt(summary.best.totalScore)}
            sub={formatEventName(summary.best.eventName) || `Day ${summary.best.day}`}
          />
          <StatTile label="Average" value={fmt(summary.average)} />
          <StatTile
            label="Medals"
            value={summary.medalCount}
            sub={
              summary.medalCount > 0
                ? `${summary.medals.gold}G · ${summary.medals.silver}S · ${summary.medals.bronze}B`
                : 'none yet'
            }
          />
        </div>

        {/* The ledger — one line per outing, caption bests bolded in gold */}
        <div className="overflow-x-auto">
          <table className="w-full table-fixed text-[11px] tabular-nums whitespace-nowrap">
            <colgroup>
              <col style={{ width: '150px' }} />
              {PODIUM_CAPTIONS.map((caption) => (
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
                {PODIUM_CAPTIONS.map((caption) => (
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
                    key={`${entry.day}-${entry.eventName || index}`}
                    className="border-b border-line-subtle"
                  >
                    <td className="py-1.5 pr-2 sticky left-0 bg-surface-card">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {entry.medal && (
                          <Medal
                            className={`w-3 h-3 flex-shrink-0 ${
                              MEDAL_COLORS[entry.medal] || 'text-muted'
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
                    {PODIUM_CAPTIONS.map((caption) => {
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
                          {fmt(value)}
                        </td>
                      );
                    })}
                    <td className="px-1.5 text-right text-muted">{fmt(entry.geScore)}</td>
                    <td className="px-1.5 text-right text-muted">{fmt(entry.visualScore)}</td>
                    <td className="px-1.5 text-right text-muted">{fmt(entry.musicScore)}</td>
                    <td
                      className={`px-1.5 text-right font-bold ${
                        isSeasonBest ? 'text-brand' : 'text-white'
                      }`}
                    >
                      {fmt(entry.totalScore)}
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

        {/* Legend + share — caption bests are your personal box-toppers */}
        <div className="flex justify-between items-center gap-2 pt-0.5 text-[9px] uppercase tracking-wider text-muted">
          <span className="truncate">
            Your caption bests in <span className="text-brand font-bold">gold</span> · place is
            within division
          </span>
          <ShareButton
            getText={() => formatLedgerAsText(ledger, summary, userCorpsName, seasonName)}
            title="Copy your season ledger as Discord-ready text"
          />
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="p-3 md:p-4 space-y-3">
        {Header}
        {body}
      </div>
    );
  }

  return (
    <div className={`${SHEET_CARD} space-y-3`}>
      {Header}
      {body}
    </div>
  );
}
