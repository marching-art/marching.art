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
// wordmark footer — so every scoring surface reads as one system. The field is
// SPLIT BY DIVISION (World / Open / A), each ranked on its own, because that is
// the standing a corps actually competes for (§5.7: every division crowns its
// own). Archived seasons scored before divisions rode on the standings doc have
// no `division` on their entries and still render as one undivided sheet.
//
// The WEEKLY narrative write-up (who's peaking, who's slipping, biggest mover)
// stays separate: it ships as the auto-generated "The Podium Report" news
// article (functions/src/helpers/newsPodiumArticle.js), which reads the weekly
// `power` column. Archived seasons that predate daily standings fall back to
// that weekly `power` collection so their standings view still renders.

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { db } from '../../api';
import {
  BoxScoreHead,
  CorpsIdentity,
  CaptionValue,
  SheetFooter,
  SortPills,
  ShareButton,
  TrendIndicator,
} from '../scores/SheetPrimitives';
import {
  SHEET_CARD,
  TOTAL_W,
  TREND_W,
  STANDINGS_SORTS,
  captionTops,
  groupByClass,
} from '../scores/sheetTokens';
import { CLASS_LABELS, formatStandingsAsText } from '../../utils/scoresUtils';
import { useHorizontalTabSlide } from '../scores/useHorizontalTabSlide';

// GE/VIS/MUS for one standings entry. Columns populate for days scored after the
// processor started persisting captions; earlier ones render "—".
const captionsOf = (entry) => ({
  ge: entry?.ge ?? null,
  vis: entry?.vis ?? null,
  mus: entry?.mus ?? null,
});

/**
 * uid → the corps' rank WITHIN ITS DIVISION in a standings column. The column's
 * entries arrive in overall score order, so a running per-division counter is
 * that division's ranking. Used against the previous snapshot to measure
 * movement inside the division a corps actually competes in — an overall delta
 * would report a "climb" a corps earned only because someone in another
 * division dropped past it.
 */
function divisionRanksOf(column) {
  const counts = new Map();
  const ranks = new Map();
  for (const entry of column?.entries || []) {
    if (!entry?.uid) continue;
    const division = entry.division;
    const rank = (counts.get(division) || 0) + 1;
    counts.set(division, rank);
    ranks.set(entry.uid, rank);
  }
  return ranks;
}

// The Podium Class standings sheet for one snapshot (a day, or a week for
// archived seasons on the weekly fallback). `periodLabel` is e.g. "Day 12";
// `previousColumn` is the snapshot before it (null for the first one), which is
// where the movement arrows come from.
function PodiumStandings({ column, previousColumn, periodLabel, seasonName, userCorpsName }) {
  const [sortBy, setSortBy] = useState('total');

  // World → Open → A, each ranked on its own scores. Entries with no division
  // (archived seasons) fall into one unlabeled section, i.e. the sheet as it
  // read before the split.
  const sections = useMemo(() => {
    const previousRanks = divisionRanksOf(previousColumn);
    const key = { GE: 'ge', VIS: 'vis', MUS: 'mus' }[sortBy];
    return groupByClass(column?.entries || [], (entry) => entry.division).map(({ cls, rows }) => {
      const ranked = rows.map((entry, index) => {
        const previousRank = previousRanks.get(entry.uid);
        return {
          entry,
          captions: captionsOf(entry),
          place: index + 1,
          delta: previousRank == null ? null : previousRank - (index + 1),
        };
      });
      return {
        cls,
        label: CLASS_LABELS[cls] || null,
        tops: captionTops(ranked.map((r) => r.captions)),
        rows: key
          ? [...ranked].sort((a, b) => (b.captions[key] ?? -1) - (a.captions[key] ?? -1))
          : ranked,
      };
    });
  }, [column, previousColumn, sortBy]);

  if (!column || !(column.entries || []).length) return null;

  const activeCap = sortBy === 'total' ? null : sortBy;
  const suffix = sortBy === 'total' ? 'Standings' : `${sortBy} Leaders`;
  const title = `Podium Class · ${suffix}`;
  const subtitle = `${periodLabel} · ${column.fieldSize} corps`;

  // One share block per division, mirroring the on-screen split.
  const shareText = () =>
    sections
      .map((section) =>
        formatStandingsAsText(
          {
            title: `${section.label || 'Podium Class'} · ${suffix}`,
            subtitle,
            seasonName,
          },
          section.rows.map(({ entry, captions, place }, idx) => ({
            place: sortBy === 'total' ? place : idx + 1,
            corpsName: entry.corpsName,
            total: entry.total,
            captions,
          }))
        )
      )
      .join('\n\n');

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

      {/* One block per division — its own header, ranking and box-toppers,
          the same split the recap sheets and the fantasy classes show. */}
      {sections.map((section) => (
        <div key={section.cls || 'all'} className="space-y-1.5">
          {section.label && (
            <div className="flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
                {section.label}
              </span>
              <span className="text-[9px] text-muted tabular-nums">
                {section.rows.length} corps
              </span>
            </div>
          )}

          <BoxScoreHead
            active={activeCap}
            totalLabel="Score"
            trailing={<span className={TREND_W} aria-hidden="true" />}
          />

          <div>
            {section.rows.map(({ entry, captions, place, delta }, idx) => {
              const isUserCorps =
                userCorpsName && entry.corpsName?.toLowerCase() === userCorpsName.toLowerCase();

              return (
                <div
                  key={entry.uid || entry.corpsName || idx}
                  className={`flex items-center gap-2 px-1 py-1.5 border-b border-line-subtle last:border-b-0 ${
                    isUserCorps ? 'bg-interactive/10' : ''
                  }`}
                >
                  {/* Username + profile link + avatar under the corps name,
                      exactly like the recap rows and the fantasy standings. */}
                  <CorpsIdentity
                    place={sortBy === 'total' ? place : idx + 1}
                    name={entry.corpsName}
                    isMine={isUserCorps}
                    displayName={entry.displayName}
                    uid={entry.uid}
                    avatarUrl={entry.avatarUrl}
                  />
                  <div className="flex items-center gap-1.5 flex-shrink-0 text-[11px]">
                    <CaptionValue
                      value={captions?.ge}
                      isTop={captions?.ge === section.tops.ge}
                      active={activeCap === 'GE'}
                    />
                    <CaptionValue
                      value={captions?.vis}
                      isTop={captions?.vis === section.tops.vis}
                      active={activeCap === 'VIS'}
                    />
                    <CaptionValue
                      value={captions?.mus}
                      isTop={captions?.mus === section.tops.mus}
                      active={activeCap === 'MUS'}
                    />
                    <span className={`${TOTAL_W} text-right font-bold text-white tabular-nums`}>
                      {typeof entry.total === 'number' ? entry.total.toFixed(3) : '—'}
                    </span>
                    <span className={`${TREND_W} flex items-center justify-center flex-shrink-0`}>
                      <TrendIndicator delta={delta} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <SheetFooter
        note="Split by division · box-toppers in gold · weekly column in the news"
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

  // The selected snapshot and the one before it — movement inside a division is
  // measured between two adjacent sheets (see divisionRanksOf), so the sheet
  // needs both.
  const { selected, previous } = useMemo(() => {
    const index = snapshots.findIndex((s) => s.key === selectedKey);
    const at = index === -1 ? snapshots.length - 1 : index;
    return {
      selected: snapshots[at] || null,
      previous: at > 0 ? snapshots[at - 1] : null,
    };
  }, [snapshots, selectedKey]);

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
        previousColumn={previous?.column || null}
        periodLabel={selected.periodLabel}
        seasonName={seasonName}
        userCorpsName={userCorpsName}
      />
    </div>
  );
}
