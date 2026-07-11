// PodiumShowPicker — weekly tour routing (Phase 2, design §5.11): pick up to
// 4 shows in open weeks / 3 in major weeks; the majors and championship week
// are auto-attended and locked. Server validates everything again.

import React, { useMemo, useState } from 'react';
import { Loader2, Lock } from 'lucide-react';

const WEEKS = [1, 2, 3, 4, 5, 6, 7];
const EASTERN_DAYS = [41, 42];

export default function PodiumShowPicker({ podium }) {
  const state = podium.data?.state;
  const autoDays = podium.data?.autoDays || [];
  const competitionDay = podium.data?.competitionDay ?? 0;
  const [draft, setDraft] = useState(null); // {week, days:Set} while editing
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const selectedDays = useMemo(() => new Set(state?.selectedShowDays || []), [state]);
  if (!state) return null;

  const maxPicksForWeek = (week) => (week === 7 ? 0 : week >= 4 ? 3 : 4);
  const weekDays = (week) => Array.from({ length: 7 }, (_, i) => (week - 1) * 7 + i + 1);

  const beginEdit = (week) => {
    // >= competitionDay: the current day's show is still selectable (it locks at
    // the next 2 AM ET score run), matching the schedule modal and server.
    const days = new Set(
      [...selectedDays].filter((d) => Math.ceil(d / 7) === week && d >= competitionDay)
    );
    setDraft({ week, days });
    setError(null);
  };

  const toggleDay = (day) => {
    setDraft((prev) => {
      const days = new Set(prev.days);
      if (days.has(day)) {
        days.delete(day);
      } else if (days.size < maxPicksForWeek(prev.week)) {
        days.add(day);
      }
      return { ...prev, days };
    });
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      await podium.selectShows(draft.week, [...draft.days]);
      setDraft(null);
    } catch (err) {
      setError(err?.message || 'Could not save shows.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
          Tour Schedule
        </h3>
        <span className="text-[9px] uppercase text-gray-600">
          Majors &amp; championship week auto-attended
        </span>
      </div>

      <div className="space-y-2">
        {WEEKS.map((week) => {
          const days = weekDays(week);
          const editing = draft?.week === week;
          const budget = maxPicksForWeek(week);
          const pickedInWeek = editing
            ? draft.days.size
            : [...selectedDays].filter((d) => Math.ceil(d / 7) === week).length;
          const weekPast = days[6] < competitionDay;

          return (
            <div key={week} className="flex items-center gap-2">
              <button
                onClick={() => (editing ? setDraft(null) : beginEdit(week))}
                disabled={weekPast || budget === 0}
                className={`w-20 shrink-0 text-left text-[10px] font-bold uppercase press-feedback ${
                  weekPast || budget === 0
                    ? 'text-gray-700'
                    : editing
                      ? 'text-[#4d9fff]'
                      : 'text-gray-400 hover:text-white'
                }`}
              >
                Week {week}
                <span className="block text-[9px] font-normal text-gray-600 normal-case">
                  {budget === 0 ? 'Champs' : `${pickedInWeek}/${budget} picks`}
                </span>
              </button>

              <div className="flex gap-1 flex-1">
                {days.map((day) => {
                  const isAuto = autoDays.includes(day) || EASTERN_DAYS.includes(day);
                  const isPast = day < competitionDay;
                  const isPicked = editing ? draft.days.has(day) : selectedDays.has(day);
                  const isMyEastern = autoDays.includes(day) && EASTERN_DAYS.includes(day);
                  return (
                    <button
                      key={day}
                      disabled={!editing || isAuto || isPast}
                      onClick={() => toggleDay(day)}
                      title={
                        isMyEastern
                          ? 'Eastern Classic — your assigned night'
                          : isAuto
                            ? 'Auto-attended'
                            : `Day ${day}`
                      }
                      className={`flex-1 h-8 rounded-sm text-[10px] font-bold tabular-nums transition-colors ${
                        isAuto
                          ? 'bg-[#8a6d1a]/25 text-[#c9a227] cursor-default'
                          : isPicked
                            ? 'bg-[#0057B8] text-white'
                            : isPast
                              ? 'bg-[#141414] text-gray-700'
                              : editing
                                ? 'bg-[#222] text-gray-400 hover:bg-[#0057B8]/30 hover:text-white press-feedback'
                                : 'bg-[#1f1f1f] text-gray-600'
                      }`}
                    >
                      {isAuto ? <Lock className="w-3 h-3 mx-auto" /> : day}
                    </button>
                  );
                })}
              </div>

              {editing && (
                <button
                  onClick={save}
                  disabled={busy}
                  className="shrink-0 flex items-center gap-1 text-[10px] font-bold uppercase px-3 py-1.5 rounded-sm bg-[#0057B8] text-white hover:bg-[#0066d6] disabled:opacity-60 press-feedback"
                >
                  {busy && <Loader2 className="w-3 h-3 animate-spin" />} Save
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && <div className="text-[11px] text-red-400">{error}</div>}
    </div>
  );
}
