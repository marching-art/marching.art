// PodiumShowPicker — read-only tour summary (Phase 2, design §5.11).
//
// Podium now registers for a SPECIFIC show the same way fantasy corps do:
// from the Schedule page, click a show and add the corps. This panel is no
// longer an editable day-grid — it just summarizes the shows the corps is
// committed to (self-picked plus the auto-attended majors & championship week)
// and links to the Schedule page to change them.

import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Lock, ChevronRight } from 'lucide-react';

export default function PodiumShowPicker({ podium }) {
  const state = podium.data?.state;
  const competitionDay = podium.data?.competitionDay ?? 0;

  // Self-picked shows: { day: { eventName, location } } -> sorted rows.
  const picks = useMemo(() => {
    const selected = state?.selectedShows || {};
    return Object.entries(selected)
      .map(([day, pick]) => ({ day: Number(day), ...pick }))
      .sort((a, b) => a.day - b.day);
  }, [state]);

  // Auto-attended days (majors + championship week) the director can't change.
  const autoRows = useMemo(
    () =>
      [...new Set(podium.data?.autoDays || [])]
        .sort((a, b) => a - b)
        .map((day) => ({ day })),
    [podium.data?.autoDays]
  );

  if (!state) return null;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Tour Schedule
        </h3>
        <Link
          to="/schedule"
          className="flex items-center gap-1 text-[10px] font-bold uppercase text-[#4d9fff] hover:text-white press-feedback"
        >
          <CalendarDays className="w-3 h-3" />
          Add shows
          <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      {picks.length === 0 ? (
        <p className="text-[11px] text-gray-500">
          No shows chosen yet. Open the <span className="text-[#4d9fff]">Schedule</span> page,
          pick a show, and add your Podium corps — same as any other class.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {picks.map((p) => (
            <li
              key={p.day}
              className={`flex items-center gap-2 text-[11px] ${
                p.day < competitionDay ? 'text-gray-600' : 'text-gray-300'
              }`}
            >
              <span className="w-10 shrink-0 font-data tabular-nums text-gray-500">
                Day {p.day}
              </span>
              <span className="font-bold text-white truncate">{p.eventName}</span>
              {p.location && <span className="text-gray-500 truncate">· {p.location}</span>}
            </li>
          ))}
        </ul>
      )}

      {autoRows.length > 0 && (
        <div className="pt-2 border-t border-[#2a2a2a]">
          <div className="flex items-center gap-1 text-[9px] font-bold uppercase text-[#c9a227] mb-1">
            <Lock className="w-2.5 h-2.5" /> Auto-attended
          </div>
          <div className="flex flex-wrap gap-1">
            {autoRows.map((r) => (
              <span
                key={r.day}
                className="px-1.5 py-0.5 rounded-sm bg-[#8a6d1a]/20 text-[#c9a227] text-[9px] font-bold tabular-nums"
              >
                Day {r.day}
              </span>
            ))}
          </div>
          <p className="mt-1 text-[9px] text-gray-600">
            Majors &amp; championship week are attended automatically.
          </p>
        </div>
      )}
    </div>
  );
}
