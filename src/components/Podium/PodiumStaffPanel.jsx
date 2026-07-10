// PodiumStaffPanel — the staff labor market (Phase 4, design §5.6): your
// roster of up to 10 seats (8 caption techs + Tour Manager + Program
// Coordinator) and the season's shared free-agency market. Scarcity is real:
// each generated person signs with exactly one corps.

import React, { useEffect, useState } from 'react';
import { Users, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { getPodiumStaffMarket, hirePodiumStaff } from '../../api/podium';
import { CAPTION_LABELS } from './podiumConstants';

const SPECIALTY_LABELS = {
  ...CAPTION_LABELS,
  tourManager: 'Tour Manager',
  programCoordinator: 'Program Coordinator',
};

const TIER_STYLES = {
  apprentice: 'text-gray-400',
  journeyman: 'text-gray-200',
  veteran: 'text-[#4d9fff]',
  master: 'text-purple-300',
  legend: 'text-[#c9a227]',
};

export default function PodiumStaffPanel({ podium }) {
  const state = podium.data?.state;
  const [market, setMarket] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || market) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await getPodiumStaffMarket();
        if (!cancelled) setMarket(result.data.market);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load the staff market.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, market]);

  if (!state) return null;
  const roster = state.staff || {};

  const hire = async (person) => {
    setBusy(person.id);
    setError(null);
    try {
      await hirePodiumStaff({ staffId: person.id });
      setMarket(null); // refetch on next open — signing state changed
      await podium.reload();
    } catch (err) {
      setError(err?.message || 'Hire failed.');
    } finally {
      setBusy(null);
    }
  };

  const hiredCount = Object.keys(roster).length;

  return (
    <div className="bg-[#1a1a1a] border border-[#333] rounded-sm p-4 space-y-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between press-feedback"
      >
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">
          <Users className="w-3 h-3" /> Staff ({hiredCount}/10)
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-500" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
        )}
      </button>

      {/* Roster summary (always visible when staffed) */}
      {hiredCount > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(roster).map(([specialty, member]) => (
            <span key={specialty} className="text-[10px] tabular-nums">
              <span className="text-gray-500">{SPECIALTY_LABELS[specialty] || specialty}:</span>{' '}
              <span className={`font-bold ${TIER_STYLES[member.tier] || 'text-white'}`}>
                {member.name}
              </span>
              <span className="text-gray-600"> · {member.tier}</span>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="space-y-2">
          {!market && !error && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            </div>
          )}
          {market &&
            Object.keys(SPECIALTY_LABELS).map((specialty) => {
              const pool = market.filter((person) => person.specialty === specialty);
              if (pool.length === 0) return null;
              const seatFilled = Boolean(roster[specialty]);
              return (
                <div key={specialty}>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    {SPECIALTY_LABELS[specialty]}
                    {seatFilled && <span className="text-green-500"> · seat filled</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {pool.map((person) => {
                      const gone = person.signedBy && person.signedBy !== state.uid;
                      return (
                        <button
                          key={person.id}
                          disabled={busy !== null || seatFilled || Boolean(person.signedBy)}
                          onClick={() => hire(person)}
                          title={`${person.trait} · +${Math.round(person.boost * 100)}% yield`}
                          className={`text-[10px] px-2 py-1 rounded-sm border tabular-nums press-feedback ${
                            person.signedBy
                              ? 'border-[#242424] text-gray-700 line-through'
                              : seatFilled
                                ? 'border-[#242424] text-gray-600'
                                : 'border-[#333] text-gray-300 hover:border-[#0057B8] hover:text-white'
                          }`}
                        >
                          {busy === person.id ? (
                            <Loader2 className="w-3 h-3 animate-spin inline" />
                          ) : (
                            <>
                              <span className={`font-bold ${TIER_STYLES[person.tier]}`}>
                                {person.name}
                              </span>
                              <span className="text-gray-600">
                                {' '}
                                · {person.tier} · {person.salary}
                              </span>
                              {gone && <span className="text-gray-700"> · signed</span>}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {error && <div className="text-[11px] text-red-400">{error}</div>}
    </div>
  );
}
