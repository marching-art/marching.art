// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// PodiumReportSheet — the Podium Class standings sheet (design §7).
//
// The Scores-tab standings view is DAILY: the nightly processor publishes a
// full-field standings doc every processing day to
// `podium-recaps/{seasonUid}/standings/{day}`, and this sheet renders the
// selected day with a day selector (D#), matching the recap sheet's cadence.
// It uses the SAME box-score layout as the Fantasy class standings
// (pages/ScoresParts → ClassStandingsGrid): sheet card, sort pills, GE/VIS/MUS
// caption columns, box-toppers in gold, a movement arrow per row, share, and a
// wordmark footer — so every scoring surface reads as one system.
//
// The WEEKLY narrative write-up (who's peaking, who's slipping, biggest mover)
// stays separate: it ships as the auto-generated "The Podium Report" news
// article (functions/src/helpers/newsPodiumArticle.js), which reads the weekly
// `power` column. Archived seasons that predate daily standings fall back to
// that weekly `power` collection so their standings view still renders.

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { db } from '../../api';
import {
  BoxScoreHead,
  CorpsIdentity,
  CaptionValue,
  SheetFooter,
  SortPills,
  ShareButton,
} from '../scores/SheetPrimitives';
import { SHEET_CARD, TOTAL_W, STANDINGS_SORTS, captionTops } from '../scores/sheetTokens';
import { formatStandingsAsText } from '../../utils/scoresUtils';
import { useHorizontalTabSlide } from './useHorizontalTabSlide';

// GE/VIS/MUS for one standings entry. Columns populate for days scored after the
// processor started persisting captions; earlier ones render "—".
const captionsOf = (entry) => ({
  ge: entry?.ge ?? null,
  vis: entry?.vis ?? null,
  mus: entry?.mus ?? null,
});

// The Podium Class standings sheet for one snapshot (a day, or a week for
// archived seasons on the weekly fallback). `periodLabel` is e.g. "Day 12".
function PodiumStandings({ column, periodLabel, seasonName, userCorpsName }) {
  const [sortBy, setSortBy] = useState('total');

  const rows = useMemo(() => {
    const base = (column?.entries || []).map((entry) => ({
      entry,
      captions: captionsOf(entry),
    }));
    if (sortBy === 'total') return base;
    const key = { GE: 'ge', VIS: 'vis', MUS: 'mus' }[sortBy];
    return [...base].sort((a, b) => (b.captions[key] ?? -1) - (a.captions[key] ?? -1));
  }, [column, sortBy]);

  const tops = useMemo(() => captionTops(rows.map((r) => r.captions)), [rows]);

  if (!column || !(column.entries || []).length) return null;

  const activeCap = sortBy === 'total' ? null : sortBy;
  const title =
    sortBy === 'total' ? 'Podium Class · Standings' : `Podium Class · ${sortBy} Leaders`;
  const subtitle = `${periodLabel} · ${column.fieldSize} corps`;

  const shareText = () =>
    formatStandingsAsText(
      { title, subtitle, seasonName },
      rows.map(({ entry, captions }, idx) => ({
        place: sortBy === 'total' ? entry.rank : idx + 1,
        corpsName: entry.corpsName,
        total: entry.total,
        captions,
      }))
    );

  return (
    <div className={`${SHEET_CARD} space-y-2.5`}>
      {/* Section header + sort pills — mirrors ClassStandingsGrid */}
      <div className="flex items-center justify-between gap-2 border-b border-line-muted pb-2">
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-white truncate block">
            {title}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-muted">{subtitle}</span>
        </div>
        <SortPills options={STANDINGS_SORTS} value={sortBy} onChange={setSortBy} />
      </div>

      <BoxScoreHead
        active={activeCap}
        totalLabel="Score"
        trailing={<span className="w-4" aria-hidden="true" />}
      />

      <div>
        {rows.map(({ entry, captions }, idx) => {
          const isUserCorps =
            userCorpsName && entry.corpsName?.toLowerCase() === userCorpsName.toLowerCase();
          // Day-over-day movement → the same trend arrow as the fantasy grids.
          const trend = entry.delta == null ? 0 : entry.delta;

          return (
            <div
              key={entry.uid || entry.corpsName || idx}
              className={`flex items-center gap-2 px-1 py-1.5 border-b border-line-subtle last:border-b-0 ${
                isUserCorps ? 'bg-interactive/10' : ''
              }`}
            >
              {/* The movement note rides the secondary line (the fantasy grids
                  use it for the director credit — Podium has no director here). */}
              <CorpsIdentity
                place={sortBy === 'total' ? entry.rank : idx + 1}
                name={entry.corpsName}
                isMine={isUserCorps}
                displayName={entry.note}
              />
              <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                <CaptionValue
                  value={captions?.ge}
                  isTop={captions?.ge === tops.ge}
                  active={activeCap === 'GE'}
                />
                <CaptionValue
                  value={captions?.vis}
                  isTop={captions?.vis === tops.vis}
                  active={activeCap === 'VIS'}
                />
                <CaptionValue
                  value={captions?.mus}
                  isTop={captions?.mus === tops.mus}
                  active={activeCap === 'MUS'}
                />
                <span className={`${TOTAL_W} text-right font-bold text-white tabular-nums`}>
                  {typeof entry.total === 'number' ? entry.total.toFixed(3) : '—'}
                </span>
                <span className="w-4 flex items-center justify-center flex-shrink-0">
                  {trend > 0 ? (
                    <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                  ) : trend < 0 ? (
                    <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                  ) : (
                    <span className="text-muted text-xs">-</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <SheetFooter
        note="Daily standings · box-toppers in gold · weekly column in the news"
        action={<ShareButton getText={shareText} />}
      />
    </div>
  );
}

/**
 * Load the daily standings snapshots for a season. Prefers the daily
 * `standings` collection; archived seasons that predate it fall back to the
 * weekly `power` column so their standings view still renders. Returns a
 * normalized, chronologically-ascending list of snapshots.
 */
async function loadStandingsSnapshots(seasonUid) {
  const normalize = (docs, keyField, prefix, word) =>
    docs
      .map((doc) => doc.data())
      .filter((d) => d && (d.entries || []).length)
      .map((d) => ({
        key: d[keyField] ?? 0,
        tabLabel: `${prefix}${d[keyField] ?? 0}`,
        periodLabel: `${word} ${d[keyField] ?? 0}`,
        column: d,
      }))
      .sort((a, b) => a.key - b.key);

  const daily = await getDocs(collection(db, 'podium-recaps', seasonUid, 'standings'));
  const dailyItems = normalize(daily.docs, 'day', 'D', 'Day');
  if (dailyItems.length) return dailyItems;

  // Fallback for archived seasons: the weekly power column.
  const power = await getDocs(collection(db, 'podium-recaps', seasonUid, 'power'));
  return normalize(power.docs, 'week', 'W', 'Week');
}

export default function PodiumReportSheet({ seasonUid, seasonName, userCorpsName }) {
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState([]); // ascending by day/week
  const [selectedKey, setSelectedKey] = useState(null);
  // Keep the highlighted day visible on mobile (the strip runs oldest→newest
  // and the latest defaults selected, so without this it sits off the edge).
  const { containerRef: stripRef, selectedRef } = useHorizontalTabSlide(
    `${selectedKey}:${snapshots.length}`
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!seasonUid) {
        setSnapshots([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const items = await loadStandingsSnapshots(seasonUid);
        if (cancelled) return;
        setSnapshots(items);
        setSelectedKey(items.length ? items[items.length - 1].key : null);
      } catch {
        if (!cancelled) setSnapshots([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonUid]);

  const selected = useMemo(
    () => snapshots.find((s) => s.key === selectedKey) || snapshots[snapshots.length - 1] || null,
    [snapshots, selectedKey]
  );

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted" />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="p-8 text-center text-xs text-muted">
        No Podium standings yet this season — the first daily standings sheet posts after the next
        scored show.
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3">
      {/* Day selector — auto-slides so the highlighted day stays visible */}
      {snapshots.length > 1 && (
        <div ref={stripRef} className="flex gap-1 overflow-x-auto scrollbar-hide">
          {snapshots.map((s) => (
            <button
              key={s.key}
              ref={s.key === selected.key ? selectedRef : null}
              onClick={() => setSelectedKey(s.key)}
              className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-none tabular-nums transition-colors press-feedback ${
                s.key === selected.key
                  ? 'bg-interactive text-white'
                  : 'text-muted hover:text-white hover:bg-white/5 border border-line'
              }`}
            >
              {s.tabLabel}
            </button>
          ))}
        </div>
      )}

      <PodiumStandings
        column={selected.column}
        periodLabel={selected.periodLabel}
        seasonName={seasonName}
        userCorpsName={userCorpsName}
      />
    </div>
  );
}
