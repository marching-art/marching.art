// PodiumReportSheet — The Podium Report (Phase 7.3, design §7): the latest
// week's deterministic power-rankings column, on its own Scores tab.
//
// Split out of PodiumRecapSheet so the recap box scores and the weekly column
// no longer stack on one tab (the column pushed the sheets far down the page,
// and both grow with the field). Reads the public
// `podium-recaps/{seasonUid}/power` collection and renders the newest week.

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
import { db } from '../../api';

// The Podium Report: the latest week's deterministic power-rankings column.
function PodiumReport({ column, userCorpsName }) {
  if (!column || !(column.entries || []).length) return null;
  return (
    <div className="bg-surface-card border border-line rounded-none p-4 space-y-2">
      <div className="flex items-baseline justify-between border-b border-line pb-2">
        <div>
          <div className="text-sm font-bold text-white">The Podium Report</div>
          <div className="text-[10px] uppercase tracking-wider text-muted">
            Power Rankings · Week {column.week} · {column.fieldSize} corps
          </div>
        </div>
        <span className="text-[9px] uppercase tracking-wider text-secondary font-bold">Column</span>
      </div>
      <div className="space-y-1">
        {column.entries.map((entry) => {
          const isMine = userCorpsName && entry.corpsName === userCorpsName;
          const move =
            entry.delta == null ? (
              <span className="text-muted">·</span>
            ) : entry.delta > 0 ? (
              <span className="text-green-400">▲{entry.delta}</span>
            ) : entry.delta < 0 ? (
              <span className="text-red-400">▼{-entry.delta}</span>
            ) : (
              <span className="text-muted">—</span>
            );
          return (
            <div
              key={entry.uid}
              className={`flex items-center gap-2 text-[11px] tabular-nums ${
                isMine ? 'bg-interactive/10 -mx-1 px-1 rounded-none' : ''
              }`}
            >
              <span className="w-5 text-right text-muted font-bold">{entry.rank}.</span>
              <span className="w-7 text-[10px]">{move}</span>
              <span
                className={`flex-1 min-w-0 truncate font-bold ${isMine ? 'text-interactive' : 'text-white'}`}
              >
                {entry.corpsName}
              </span>
              <span className="text-muted text-[10px] italic truncate hidden sm:block">
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

export default function PodiumReportSheet({ seasonUid, seasonName, userCorpsName }) {
  const [loading, setLoading] = useState(true);
  const [weeks, setWeeks] = useState([]); // all published columns, newest first
  const [selectedWeek, setSelectedWeek] = useState(null);

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
        No Podium Report yet this season — the first power-rankings column posts after the opening
        competition week.
      </div>
    );
  }

  return (
    <div className="p-3 md:p-4 space-y-3">
      {/* Week selector — earlier columns stay browsable once more than one posts */}
      {weeks.length > 1 && (
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {weeks.map((w) => (
            <button
              key={w.week}
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

      <PodiumReport column={selected} userCorpsName={userCorpsName} />

      {/* Wordmark footer — every screenshot is an advertisement */}
      <div className="flex justify-between items-center pt-1 text-[9px] uppercase tracking-wider text-muted">
        <span>Deterministic weekly power rankings — Podium Class</span>
        <span className="font-bold text-muted">
          marching.art{seasonName ? ` · ${seasonName}` : ''}
        </span>
      </div>
    </div>
  );
}
