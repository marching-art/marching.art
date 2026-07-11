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
import { collection, getDocs } from 'firebase/firestore';
import { Loader2, Share2, Check } from 'lucide-react';
import { db } from '../../api';
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
 * Format a recap day as a monospace text sheet — pastes cleanly into Discord
 * (wrap in a code block) and group chats, the way FMA recaps circulated.
 */
function formatRecapAsText(recap, day, seasonName) {
  const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');
  const lines = [];
  for (const show of showsOf(recap)) {
    const head = fallbackMasthead(day);
    lines.push(
      `${show.eventName || head.name}${show.location ? ` — ${show.location}` : ''} · Day ${day} of 49`
    );
    lines.push('');
    for (const row of [...(show.results || [])].sort((a, b) => a.place - b.place)) {
      lines.push(
        `${String(row.place).padStart(2)}. ${(row.corpsName || 'Unknown').padEnd(24).slice(0, 24)} ${fmt(row.totalScore).padStart(7)}  (GE ${fmt(row.geScore)} · VIS ${fmt(row.visualScore)} · MUS ${fmt(row.musicScore)})`
      );
    }
    lines.push('');
  }
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
      <span className="text-[9px] uppercase tracking-wider text-gray-600 pr-1 flex-shrink-0">
        Sort
      </span>
      {SORT_OPTIONS.map((opt) => (
        <button
          key={opt.id}
          onClick={() => onChange(opt.id)}
          aria-pressed={sortBy === opt.id}
          className={`flex-shrink-0 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider rounded-sm transition-colors press-feedback ${
            sortBy === opt.id
              ? 'bg-[#8a6d1a] text-white'
              : 'bg-[#222] text-gray-500 hover:text-gray-300'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function ShowTable({ show, day, sortBy, userCorpsName }) {
  const results = useMemo(() => sortResults(show.results || [], sortBy), [show.results, sortBy]);
  const tops = useBoxToppers(results);
  const showDivisionTag = useMemo(
    () => new Set(results.map((r) => r.division || 'aClass')).size > 1,
    [results]
  );
  const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');
  const head = fallbackMasthead(day);

  return (
    <div className="space-y-2">
      {/* Per-show masthead */}
      <div className="flex items-baseline justify-between border-b border-[#2a2a2a] pb-1.5">
        <div className="text-[13px] font-bold text-white truncate">
          {show.eventName || head.name}
        </div>
        {(show.location || head.site) && (
          <div className="text-[10px] uppercase tracking-wider text-gray-500 flex-shrink-0 pl-2">
            {show.location || head.site}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] tabular-nums whitespace-nowrap">
          <thead>
            <tr className="text-[9px] uppercase tracking-wider text-gray-500 border-b border-[#333]">
              <th className="text-left py-1.5 pr-2 sticky left-0 bg-[#1a1a1a]">Pl · Corps</th>
              {PODIUM_CAPTIONS.map((caption) => (
                <th
                  key={caption}
                  className={`px-1.5 text-right ${sortBy === caption ? 'text-[#c9a227]' : ''}`}
                >
                  {caption}
                </th>
              ))}
              <th className="px-1.5 text-right text-gray-400">GE</th>
              <th className="px-1.5 text-right text-gray-400">VIS</th>
              <th className="px-1.5 text-right text-gray-400">MUS</th>
              <th className="pl-2 text-right text-white">Total</th>
            </tr>
          </thead>
          <tbody>
            {results.map((row) => {
              const isMine = userCorpsName && row.corpsName === userCorpsName;
              return (
                <tr
                  key={row.uid}
                  className={`border-b border-[#242424] ${isMine ? 'bg-[#0057B8]/10' : ''}`}
                >
                  <td className="py-1.5 pr-2 sticky left-0 bg-[#1a1a1a]">
                    <span className="text-gray-500 mr-1.5">{row.place}.</span>
                    <span className={`font-bold ${isMine ? 'text-[#4d9fff]' : 'text-white'}`}>
                      {row.corpsName}
                    </span>
                    {showDivisionTag && (
                      <span className="ml-1.5 text-[8px] font-bold uppercase text-gray-600">
                        {(row.division || 'aClass').replace('Class', '')}
                      </span>
                    )}
                  </td>
                  {PODIUM_CAPTIONS.map((caption) => {
                    const value = row.captions?.[caption];
                    const isTop = value != null && value === tops[caption];
                    return (
                      <td
                        key={caption}
                        className={`px-1.5 text-right ${
                          isTop
                            ? 'font-bold text-[#c9a227]'
                            : sortBy === caption
                              ? 'text-white'
                              : 'text-gray-300'
                        }`}
                      >
                        {fmt(value)}
                      </td>
                    );
                  })}
                  <td className="px-1.5 text-right text-gray-400">{fmt(row.geScore)}</td>
                  <td className="px-1.5 text-right text-gray-400">{fmt(row.visualScore)}</td>
                  <td className="px-1.5 text-right text-gray-400">{fmt(row.musicScore)}</td>
                  <td className="pl-2 text-right font-bold text-white">{fmt(row.totalScore)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// The Podium Report (Phase 7.3): the latest week's deterministic
// power-rankings column, rendered above the recap sheets.
function PodiumReport({ column, userCorpsName }) {
  if (!column || !(column.entries || []).length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[#c9a227]/30 rounded-sm p-4 space-y-2">
      <div className="flex items-baseline justify-between border-b border-[#333] pb-2">
        <div>
          <div className="text-sm font-bold text-white">The Podium Report</div>
          <div className="text-[10px] uppercase tracking-wider text-gray-500">
            Power Rankings · Week {column.week} · {column.fieldSize} corps
          </div>
        </div>
        <span className="text-[9px] uppercase tracking-wider text-[#c9a227] font-bold">Column</span>
      </div>
      <div className="space-y-1">
        {column.entries.map((entry) => {
          const isMine = userCorpsName && entry.corpsName === userCorpsName;
          const move =
            entry.delta == null ? (
              <span className="text-gray-600">·</span>
            ) : entry.delta > 0 ? (
              <span className="text-green-400">▲{entry.delta}</span>
            ) : entry.delta < 0 ? (
              <span className="text-red-400">▼{-entry.delta}</span>
            ) : (
              <span className="text-gray-600">—</span>
            );
          return (
            <div
              key={entry.uid}
              className={`flex items-center gap-2 text-[11px] tabular-nums ${
                isMine ? 'bg-[#0057B8]/10 -mx-1 px-1 rounded-sm' : ''
              }`}
            >
              <span className="w-5 text-right text-gray-500 font-bold">{entry.rank}.</span>
              <span className="w-7 text-[10px]">{move}</span>
              <span
                className={`flex-1 min-w-0 truncate font-bold ${isMine ? 'text-[#4d9fff]' : 'text-white'}`}
              >
                {entry.corpsName}
              </span>
              <span className="text-gray-400 text-[10px] italic truncate hidden sm:block">
                {entry.note}
              </span>
              <span className="text-white font-bold">
                {typeof entry.total === 'number' ? entry.total.toFixed(3) : '—'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PodiumRecapSheet({ seasonUid, seasonName, userCorpsName }) {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState([]); // [{day, recap}]
  const [selectedDay, setSelectedDay] = useState(null);
  const [report, setReport] = useState(null); // latest power-rankings column
  const [sortBy, setSortBy] = useState('total');
  const [copied, setCopied] = useState(false);

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
        // Latest power-rankings column (best-effort; the sheet stands alone).
        try {
          const power = await getDocs(collection(db, 'podium-recaps', seasonUid, 'power'));
          if (!cancelled && !power.empty) {
            const weeks = power.docs
              .map((doc) => doc.data())
              .sort((a, b) => (b.week || 0) - (a.week || 0));
            setReport(weeks[0]);
          }
        } catch {
          /* column is decorative */
        }
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
        <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="p-8 text-center text-xs text-gray-500">
        No Podium Class results yet this season — the first recap sheet posts after the next scored
        show.
      </div>
    );
  }

  const selected = days.find((d) => d.day === selectedDay) || days[days.length - 1];
  const shows = showsOf(selected.recap);

  return (
    <div className="p-3 md:p-4 space-y-3">
      {/* The Podium Report — latest weekly power rankings */}
      <PodiumReport column={report} userCorpsName={userCorpsName} />

      {/* Day selector */}
      <div className="flex gap-1 overflow-x-auto scrollbar-hide">
        {days.map(({ day }) => (
          <button
            key={day}
            onClick={() => setSelectedDay(day)}
            className={`flex-shrink-0 text-[10px] font-bold px-2.5 py-1 rounded-sm tabular-nums transition-colors press-feedback ${
              day === selected.day
                ? 'bg-[#8a6d1a] text-white'
                : 'text-gray-500 hover:text-white hover:bg-white/5 border border-[#333]'
            }`}
          >
            D{day}
          </button>
        ))}
      </div>

      {/* The sheet — one box score per show */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <SortBar sortBy={sortBy} onChange={setSortBy} />
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={async () => {
                const text = formatRecapAsText(selected.recap, selected.day, seasonName);
                try {
                  if (navigator.share && /Mobi/i.test(navigator.userAgent)) {
                    await navigator.share({ text });
                  } else {
                    await navigator.clipboard.writeText(text);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                } catch {
                  /* user dismissed the share sheet */
                }
              }}
              title="Copy the sheet as Discord-ready text"
              className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-sm border border-[#333] text-gray-400 hover:text-white hover:border-[#c9a227] press-feedback"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-400" />
              ) : (
                <Share2 className="w-3 h-3" />
              )}
              {copied ? 'Copied' : 'Share'}
            </button>
            <div className="text-[9px] uppercase tracking-wider text-[#c9a227] font-bold">
              Official Recap
            </div>
          </div>
        </div>

        {shows.length === 0 ? (
          <div className="text-[11px] text-gray-500">No shows scored on Day {selected.day}.</div>
        ) : (
          shows.map((show, idx) => (
            <ShowTable
              key={show.eventName || idx}
              show={show}
              day={selected.day}
              sortBy={sortBy}
              userCorpsName={userCorpsName}
            />
          ))
        )}

        {/* Joint-rehearsal feed lines (§5.12): public smoke, private fire —
            who shared a floor, never the scrimmage numbers. */}
        {(selected.recap.jointRehearsals || []).map((item, idx) => (
          <div key={idx} className="text-[10px] text-gray-500 italic">
            {item.corpsA} and {item.corpsB} held a joint rehearsal
            {item.city ? ` in ${item.city}` : ''}.
          </div>
        ))}

        {/* Wordmark footer — every screenshot is an advertisement */}
        <div className="flex justify-between items-center pt-1 text-[9px] uppercase tracking-wider text-gray-600">
          <span>
            Box-toppers in <span className="text-[#c9a227] font-bold">gold</span> · full captions —
            Podium Class only
          </span>
          <span className="font-bold text-gray-500">
            marching.art{seasonName ? ` · ${seasonName}` : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
