// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// PodiumReportSheet — the Podium Class standings sheet (Phase 7.3, design §7).
//
// This is the weekly standings the nightly processor already computes, now
// rendered with the SAME box-score layout as the Fantasy class standings
// (pages/ScoresParts → ClassStandingsGrid): a sheet card, sort pills, GE/VIS/MUS
// caption columns, box-toppers in gold, a movement arrow per row, share, and a
// wordmark footer. It replaces the old bespoke "power-rankings column" so every
// scoring surface reads as one system.
//
// The narrative weekly write-up (who's peaking, who's slipping, biggest mover)
// is NOT lost — it ships as the auto-generated "The Podium Report" news article
// (functions/src/helpers/newsPodiumArticle.js), which embeds this same ranked
// field. Reads the public `podium-recaps/{seasonUid}/power` collection.

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

// GE/VIS/MUS for one power-doc entry. Columns populate for weeks scored after
// the processor started persisting captions; earlier weeks render "—".
const captionsOf = (entry) => ({
  ge: entry?.ge ?? null,
  vis: entry?.vis ?? null,
  mus: entry?.mus ?? null,
});

// The Podium Class standings sheet for one week.
function PodiumStandings({ column, seasonName, userCorpsName }) {
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
    sortBy === 'total' ? 'Podium Class · Season Standings' : `Podium Class · ${sortBy} Leaders`;

  const shareText = () =>
    formatStandingsAsText(
      { title, subtitle: `Week ${column.week} · ${column.fieldSize} corps`, seasonName },
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
          <span className="text-[9px] uppercase tracking-wider text-muted">
            Week {column.week} · {column.fieldSize} corps
          </span>
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
          // Week-over-week movement → the same trend arrow as the fantasy grids.
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
        note="Weekly standings · box-toppers in gold · full column in the news"
        action={<ShareButton getText={shareText} />}
      />
    </div>
  );
}

export default function PodiumReportSheet({ seasonUid, seasonName, userCorpsName }) {
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState([]); // all published columns, newest first
  const [selectedWeek, setSelectedWeek] = useState(null);
  // Keep the highlighted week visible when many weeks have posted.
  const { containerRef: weekStripRef, selectedRef: selectedWeekRef } = useHorizontalTabSlide(
    `${selectedWeek}:${weeks.length}`
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!seasonUid) {
        setWeeks([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const power = await getDocs(collection(db, 'podium-recaps', seasonUid, 'power'));
        if (cancelled) return;
        const loaded = power.docs
          .map((doc) => doc.data())
          .filter((w) => w && (w.entries || []).length)
          .sort((a, b) => (b.week || 0) - (a.week || 0));
        setWeeks(loaded);
        setSelectedWeek(loaded.length ? loaded[0].week : null);
      } catch {
        if (!cancelled) setWeeks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonUid]);

  const selected = useMemo(
    () => weeks.find((w) => w.week === selectedWeek) || weeks[0] || null,
    [weeks, selectedWeek]
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
        No Podium standings yet this season — the first weekly standings sheet posts after the
        opening competition week.
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3">
      {/* Week selector — auto-slides so the highlighted week stays visible */}
      {weeks.length > 1 && (
        <div ref={weekStripRef} className="flex gap-1 overflow-x-auto scrollbar-hide">
          {weeks.map((w) => (
            <button
              key={w.week}
              ref={w.week === selected.week ? selectedWeekRef : null}
              onClick={() => setSelectedWeek(w.week)}
              className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-none tabular-nums transition-colors press-feedback ${
                w.week === selected.week
                  ? 'bg-interactive text-white'
                  : 'text-muted hover:text-white hover:bg-white/5 border border-line'
              }`}
            >
              W{w.week}
            </button>
          ))}
        </div>
      )}

      <PodiumStandings column={selected} seasonName={seasonName} userCorpsName={userCorpsName} />
    </div>
  );
}
