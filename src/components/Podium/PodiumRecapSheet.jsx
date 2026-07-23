// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// PodiumRecapSheet — the DCI-style box score for Podium Class shows
// (Phase 2, design §5.4): full caption columns, bolded box-toppers, event
// masthead, wordmark footer. Reads the public podium-recaps collection.
//
// Podium is scored PER SHOW (a recap day carries `shows: [{eventName, location,
// results}]`), so each day renders one box score per show. Rows can be sorted
// by class (division) or by any caption. Full captions are shown because
// Podium is a virtual engine — nothing to harvest, unlike the drafted fantasy
// classes (which stay GE/Vis/Mus-only).

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { db } from '../../api';
import { TeamAvatar } from '../ui/TeamAvatar';
import { ShareButton } from '../scores/SheetPrimitives';
import { SHEET_CARD } from '../scores/sheetTokens';
import { useHorizontalTabSlide } from '../scores/useHorizontalTabSlide';
import { PODIUM_CAPTIONS } from './podiumConstants';

const MAJOR_MASTHEADS = {
  28: { name: 'marching.art Southwestern Championship', site: 'Dallas, TX' },
  35: { name: 'marching.art Southeastern Championship', site: 'Atlanta, GA' },
  41: { name: 'marching.art Eastern Classic — Night 1', site: 'Allentown, PA' },
  42: { name: 'marching.art Eastern Classic — Night 2', site: 'Allentown, PA' },
  47: { name: 'marching.art World Championship Prelims', site: 'Podium Class' },
  48: { name: 'marching.art World Championship Semifinals', site: 'Podium Class' },
  49: { name: 'marching.art World Championship Finals', site: 'Podium Class' },
};

function fallbackMasthead(day) {
  return MAJOR_MASTHEADS[day] || { name: 'Podium Class Tour Stop', site: `Day ${day}` };
}

/**
 * A recap day's shows, normalized. New recaps carry `shows: [...]`; legacy
 * per-day recaps carried a flat `results` — wrap those as one synthetic show.
 */
function showsOf(recap) {
  if (Array.isArray(recap?.shows)) return recap.shows;
  if (Array.isArray(recap?.results)) {
    return [{ eventName: null, location: null, results: recap.results }];
  }
  return [];
}

const DIVISION_ORDER = { worldClass: 0, openClass: 1, aClass: 2 };

function sortResults(results, sortBy) {
  const rows = [...results];
  if (sortBy === 'class') {
    return rows.sort(
      (a, b) =>
        DIVISION_ORDER[a.division || 'aClass'] - DIVISION_ORDER[b.division || 'aClass'] ||
        b.totalScore - a.totalScore
    );
  }
  if (sortBy === 'total') return rows.sort((a, b) => b.totalScore - a.totalScore);
  // Caption sort: highest value in the chosen caption first.
  return rows.sort((a, b) => (b.captions?.[sortBy] ?? 0) - (a.captions?.[sortBy] ?? 0));
}

/**
 * Format a single show as a monospace text sheet — pastes cleanly into Discord
 * (wrap in a code block) and group chats, the way FMA recaps circulated. One
 * block per show, matching the per-show cards on screen.
 */
function formatShowAsText(show, day, seasonName) {
  const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');
  const head = fallbackMasthead(day);
  const lines = [
    `${show.eventName || head.name}${show.location ? ` — ${show.location}` : ''} · Day ${day} of 49`,
    '',
  ];
  for (const row of [...(show.results || [])].sort((a, b) => a.place - b.place)) {
    lines.push(
      `${String(row.place).padStart(2)}. ${(row.corpsName || 'Unknown').padEnd(24).slice(0, 24)} ${fmt(row.totalScore).padStart(7)}  (GE ${fmt(row.geScore)} · VIS ${fmt(row.visualScore)} · MUS ${fmt(row.musicScore)})`
    );
  }
  lines.push('');
  lines.push(`marching.art${seasonName ? ` · ${seasonName}` : ''} — Podium Class`);
  return '```\n' + lines.join('\n') + '\n```';
}

/** Bold the top value in each caption column — real recaps mark box-toppers. */
function useBoxToppers(results) {
  return useMemo(() => {
    const tops = {};
    for (const caption of PODIUM_CAPTIONS) {
      tops[caption] = Math.max(0, ...results.map((r) => r.captions?.[caption] ?? 0));
    }
    return tops;
  }, [results]);
}

const SORT_OPTIONS = [
  { id: 'class', label: 'Class' },
  { id: 'total', label: 'Total' },
  ...PODIUM_CAPTIONS.map((c) => ({ id: c, label: c })),
];

function SortBar({ sortBy, onChange }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
      <span className="text-[9px] uppercase tracking-wider text-muted pr-1 flex-shrink-0">
        Sort
      </span>
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          aria-pressed={sortBy === opt.id}
          className={`flex-shrink-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-none transition-colors press-feedback ${
            sortBy === opt.id
              ? 'bg-interactive text-white'
              : 'bg-surface-raised text-muted hover:text-secondary'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// One show = one card (matching the fantasy recap cards): its own frame,
// masthead, box score, and footer/share. The day's sort control lives above
// the cards, so a card is a pure box score.
function ShowCard({ show, day, sortBy, seasonName, userCorpsName }) {
  const results = useMemo(() => sortResults(show.results || [], sortBy), [show.results, sortBy]);
  const tops = useBoxToppers(results);
  const showDivisionTag = useMemo(
    () => new Set(results.map((r) => r.division || 'aClass')).size > 1,
    [results]
  );
  const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');
  const head = fallbackMasthead(day);

  return (
    <div className={`${SHEET_CARD} space-y-2.5`}>
      {/* Per-show masthead */}
      <div className="flex items-baseline justify-between border-b border-line-muted pb-1.5">
        <div className="text-[13px] font-bold text-white truncate">
          {show.eventName || head.name}
        </div>
        {(show.location || head.site) && (
          <div className="text-[10px] uppercase tracking-wider text-muted flex-shrink-0 pl-2">
            {show.location || head.site}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        {/* Fixed layout + shared colgroup so every show's caption columns line
            up vertically regardless of corps-name length (names truncate). */}
        <table className="w-full table-fixed text-[11px] tabular-nums whitespace-nowrap">
          <colgroup>
            <col style={{ width: '200px' }} />
            {PODIUM_CAPTIONS.map((caption) => (
              <col key={caption} style={{ width: '54px' }} />
            ))}
            <col style={{ width: '54px' }} />
            <col style={{ width: '54px' }} />
            <col style={{ width: '54px' }} />
            <col style={{ width: '62px' }} />
          </colgroup>
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-muted border-b border-line">
              <th className="text-left py-1.5 pr-2 sticky left-0 bg-surface-card">Pl · Corps</th>
              {PODIUM_CAPTIONS.map((caption) => (
                <th
                  key={caption}
                  className={`px-1.5 text-right ${sortBy === caption ? 'text-interactive' : ''}`}
                >
                  {caption}
                </th>
              ))}
              <th className="px-1.5 text-right text-muted">GE</th>
              <th className="px-1.5 text-right text-muted">VIS</th>
              <th className="px-1.5 text-right text-muted">MUS</th>
              <th className="pl-2 text-right text-white">Total</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => {
              const isMine = userCorpsName && row.corpsName === userCorpsName;
              return (
                <tr
                  key={row.uid}
                  className={`border-b border-line-subtle ${isMine ? 'bg-interactive/10' : ''}`}
                >
                  <td className="py-1.5 pr-2 sticky left-0 bg-surface-card">
                    {/* Place · avatar · corps name — the corps avatar is shown
                        the same way as the other classes (see CorpsIdentity in
                        ScoresParts). */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-muted flex-shrink-0">{row.place}.</span>
                      <TeamAvatar name={row.corpsName} logoUrl={row.avatarUrl} size="xs" />
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1.5 min-w-0">
                          <span
                            className={`font-bold truncate ${isMine ? 'text-interactive' : 'text-white'}`}
                          >
                            {row.corpsName}
                          </span>
                          {showDivisionTag && (
                            <span className="text-[8px] font-bold uppercase text-muted flex-shrink-0">
                              {(row.division || 'aClass').replace('Class', '')}
                            </span>
                          )}
                        </div>
                        {/* Director credit + profile link under the corps name —
                            displayed the same way as the other classes. */}
                        {row.displayName &&
                          (row.uid ? (
                            <Link
                              to={`/profile/${row.uid}`}
                              className="block text-[10px] text-muted hover:text-interactive truncate"
                            >
                              {row.displayName}
                            </Link>
                          ) : (
                            <span className="block text-[10px] text-muted truncate">
                              {row.displayName}
                            </span>
                          ))}
                      </div>
                    </div>
                  </td>
                  {PODIUM_CAPTIONS.map((caption) => {
                    const value = row.captions?.[caption];
                    const isTop = value != null && value === tops[caption];
                    return (
                      <td
                        key={caption}
                        className={`px-1.5 text-right ${
                          isTop
                            ? 'font-bold text-brand'
                            : sortBy === caption
                              ? 'text-white'
                              : 'text-secondary'
                        }`}
                      >
                        {fmt(value)}
                      </td>
                    );
                  })}
                  <td className="px-1.5 text-right text-muted">{fmt(row.geScore)}</td>
                  <td className="px-1.5 text-right text-muted">{fmt(row.visualScore)}</td>
                  <td className="px-1.5 text-right text-muted">{fmt(row.musicScore)}</td>
                  <td className="pl-2 text-right font-bold text-white">{fmt(row.totalScore)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Wordmark footer + per-show share — same spot as the fantasy cards */}
      <div className="flex justify-between items-center gap-2 pt-1 text-[9px] uppercase tracking-wider text-muted">
        <span className="truncate">
          Box-toppers in <span className="text-brand font-bold">gold</span> · full captions — Podium
          Class only
        </span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <ShareButton getText={() => formatShowAsText(show, day, seasonName)} />
          <span className="font-bold text-muted">
            marching.art{seasonName ? ` · ${seasonName}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

// The Podium Report (the weekly power-rankings column) now lives on its own
// Scores tab — see components/Podium/PodiumReportSheet. This sheet renders only
// the per-show recap box scores.

export default function PodiumRecapSheet({ seasonUid, seasonName, userCorpsName }) {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState([]); // [{day, recap}]
  const [selectedDay, setSelectedDay] = useState(null);
  const [sortBy, setSortBy] = useState('total');
  // Keep the highlighted day visible on mobile (the strip runs D1→D49 and the
  // latest day defaults selected, so without this it sits off the right edge).
  const { containerRef: dayStripRef, selectedRef: selectedDayRef } = useHorizontalTabSlide(
    `${selectedDay}:${days.length}`
  );

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
        setSelectedDay(loaded.length > 0 ? loaded[loaded.length - 1].day : null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [seasonUid]);

  if (loading) {
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted" />
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-muted">
        No Podium Class results yet this season — the first recap sheet posts after the next scored
        show.
      </div>
    );
  }

  const selected = days.find((d) => d.day === selectedDay) || days[days.length - 1];
  const shows = showsOf(selected.recap);

  return (
    <div className="p-3 md:p-4 space-y-3">
      {/* Day selector — auto-slides so the highlighted day stays visible */}
      <div ref={dayStripRef} className="flex gap-1 overflow-x-auto scrollbar-hide">
        {days.map(({ day }) => (
          <button
            key={day}
            ref={day === selected.day ? selectedDayRef : null}
            onClick={() => setSelectedDay(day)}
            className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-none tabular-nums transition-colors press-feedback ${
              day === selected.day
                ? 'bg-interactive text-white'
                : 'text-muted hover:text-white hover:bg-white/5 border border-line'
            }`}
          >
            D{day}
          </button>
        ))}
      </div>

      {/* Sort control — outside the frames, like the fantasy tab */}
      <div className="flex items-center justify-between gap-2">
        <SortBar sortBy={sortBy} onChange={setSortBy} />
        <div className="text-[9px] uppercase tracking-wider text-secondary font-bold flex-shrink-0">
          Official Recap
        </div>
      </div>

      {/* One framed card per show (matching the fantasy recap cards) */}
      {shows.length === 0 ? (
        <div className="p-8 text-center text-[11px] text-muted">
          No shows scored on Day {selected.day}.
        </div>
      ) : (
        shows.map((show, idx) => (
          <ShowCard
            key={show.eventName || idx}
            show={show}
            day={selected.day}
            sortBy={sortBy}
            seasonName={seasonName}
            userCorpsName={userCorpsName}
          />
        ))
      )}

      {/* Joint-rehearsal feed (§5.12): public smoke, private fire — who shared a
          floor, never the scrimmage numbers. Its own frame, below the shows. */}
      {(selected.recap.jointRehearsals || []).length > 0 && (
        <div className={`${SHEET_CARD} space-y-1`}>
          <div className="text-[9px] font-bold uppercase tracking-wider text-muted">
            Joint Rehearsals
          </div>
          {selected.recap.jointRehearsals.map((item, idx) => (
            <div key={idx} className="text-[10px] text-muted italic">
              {item.corpsA} and {item.corpsB} held a joint rehearsal
              {item.city ? ` in ${item.city}` : ''}.
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
