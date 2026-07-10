// PodiumRecapSheet — the DCI-style box score for Podium Class shows
// (Phase 2, design §5.4): full caption columns, bolded box-toppers, event
// masthead, wordmark footer. Reads the public podium-recaps collection.

import React, { useEffect, useMemo, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { Loader2 } from 'lucide-react';
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

function mastheadFor(day) {
  return MAJOR_MASTHEADS[day] || { name: `Podium Class Tour Stop`, site: `Day ${day}` };
}

/** Bold the top value in each caption column — real recaps mark box-toppers. */
function useBoxToppers(results) {
  return useMemo(() => {
    const tops = {};
    for (const caption of PODIUM_CAPTIONS) {
      tops[caption] = Math.max(...results.map((r) => r.captions?.[caption] ?? 0));
    }
    return tops;
  }, [results]);
}

function SheetTable({ recap, userCorpsName }) {
  const results = recap.results || [];
  const tops = useBoxToppers(results);
  const fmt = (v) => (typeof v === 'number' ? v.toFixed(2) : '—');

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] tabular-nums whitespace-nowrap">
        <thead>
          <tr className="text-[9px] uppercase tracking-wider text-gray-500 border-b border-[#333]">
            <th className="text-left py-1.5 pr-2 sticky left-0 bg-[#1a1a1a]">Pl · Corps</th>
            {PODIUM_CAPTIONS.map((caption) => (
              <th key={caption} className="px-1.5 text-right">
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
                </td>
                {PODIUM_CAPTIONS.map((caption) => {
                  const value = row.captions?.[caption];
                  const isTop = value != null && value === tops[caption];
                  return (
                    <td
                      key={caption}
                      className={`px-1.5 text-right ${isTop ? 'font-bold text-[#c9a227]' : 'text-gray-300'}`}
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
  );
}

export default function PodiumRecapSheet({ seasonUid, seasonName, userCorpsName }) {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState([]); // [{day, recap}]
  const [selectedDay, setSelectedDay] = useState(null);

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
  const masthead = mastheadFor(selected.day);

  return (
    <div className="p-3 md:p-4 space-y-3">
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

      {/* The sheet */}
      <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4 space-y-3">
        {/* Masthead */}
        <div className="flex items-baseline justify-between border-b border-[#333] pb-2">
          <div>
            <div className="text-sm font-bold text-white">{masthead.name}</div>
            <div className="text-[10px] uppercase tracking-wider text-gray-500">
              {masthead.site} · Day {selected.day} of 49
            </div>
          </div>
          <div className="text-[9px] uppercase tracking-wider text-[#c9a227] font-bold">
            Official Recap
          </div>
        </div>

        <SheetTable recap={selected.recap} userCorpsName={userCorpsName} />

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
