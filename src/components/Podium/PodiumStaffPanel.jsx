// PodiumStaffPanel — the staff labor market (Phase 4, design §5.6; careers
// per decision 28): your roster of up to 10 seats (8 caption techs + Tour
// Manager + Program Coordinator), the season's shared free-agency market,
// and the mid-season transfer market.
//
// Staff are presented GENERICALLY — a director chooses a role (specialty)
// at an experience level (tier), never a named person. The persistent-career
// backend still tracks each hire, but its fabricated names, traits, and
// resumes are deliberately kept out of the grid: the only things a director
// decides on are what a staffer does and how experienced they are.

import React, { useEffect, useState } from 'react';
import { Users, Loader2, ChevronDown, ChevronUp, ArrowLeftRight, GraduationCap } from 'lucide-react';
import {
  getPodiumStaffMarket,
  hirePodiumStaff,
  postPodiumStaff,
  buyPodiumStaffContract,
  retrainPodiumStaff,
} from '../../api/podium';
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

// Experience levels, least → most experienced. The label IS the staffer's
// identity in the grid — no names.
const TIER_ORDER = ['apprentice', 'journeyman', 'veteran', 'master', 'legend'];
const TIER_LABELS = {
  apprentice: 'Apprentice',
  journeyman: 'Journeyman',
  veteran: 'Veteran',
  master: 'Master',
  legend: 'Legend',
};

const CONTRACT_LENGTHS = [1, 2, 3];

/**
 * Collapse a specialty's market pool to one generic option per experience
 * level. Directors pick a level, not a person, so identical-tier persons
 * (career backend scarcity) show once; hiring targets the cheapest still-
 * available staffer of that tier. Returns options ordered least → most
 * experienced, each carrying whether the level is still hireable.
 */
function experienceLevels(pool) {
  const byTier = new Map();
  for (const person of pool) {
    const bucket = byTier.get(person.tier) || [];
    bucket.push(person);
    byTier.set(person.tier, bucket);
  }
  return TIER_ORDER.filter((tier) => byTier.has(tier)).map((tier) => {
    const candidates = byTier.get(tier);
    const open = candidates
      .filter((p) => !p.signedBy)
      .sort((a, b) => a.salary - b.salary);
    const cheapest = open[0] || [...candidates].sort((a, b) => a.salary - b.salary)[0];
    return {
      tier,
      hire: open[0] || null, // the person we sign when this level is chosen
      salary: cheapest.salary,
      boost: cheapest.boost,
      available: open.length > 0,
    };
  });
}

export default function PodiumStaffPanel({ podium }) {
  const state = podium.data?.state;
  const [market, setMarket] = useState(null);
  const [transfers, setTransfers] = useState([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [contractSeasons, setContractSeasons] = useState(1);
  const [retraining, setRetraining] = useState(null); // staffId being retrained

  useEffect(() => {
    if (!open || market) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await getPodiumStaffMarket();
        if (!cancelled) {
          setMarket(result.data.market);
          setTransfers(result.data.transfers || []);
        }
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

  const act = async (key, fn) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
      setMarket(null); // refetch on next open — market state changed
      await podium.reload();
    } catch (err) {
      setError(err?.message || 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  const hiredCount = Object.keys(roster).length;
  const openSpecialties = Object.keys(SPECIALTY_LABELS).filter((s) => !roster[s]);

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

      {/* Roster (always visible when staffed; actions appear when open) */}
      {hiredCount > 0 && (
        <div className="space-y-1">
          {Object.entries(roster).map(([specialty, member]) => (
            <div key={specialty} className="flex items-center gap-2 text-[10px] tabular-nums">
              <span className="text-gray-500 w-28 shrink-0 truncate">
                {SPECIALTY_LABELS[specialty] || specialty}:
              </span>
              <span className={`font-bold ${TIER_STYLES[member.tier] || 'text-white'}`}>
                {TIER_LABELS[member.tier] || member.tier}
              </span>
              <span className="text-gray-600">
                {member.contract &&
                  `${member.contract.remaining}/${member.contract.seasons} season${member.contract.seasons > 1 ? 's' : ''} left`}
                {member.retrain && (member.contract ? ' · retraining' : 'retraining')}
              </span>
              {open && (
                <span className="ml-auto flex items-center gap-1">
                  <button
                    disabled={busy !== null}
                    onClick={() =>
                      setRetraining((v) => (v === member.id ? null : member.id))
                    }
                    title="Retrain into a new specialty (reduced boost this season)"
                    className="text-gray-500 hover:text-white press-feedback"
                  >
                    <GraduationCap className="w-3 h-3" />
                  </button>
                  <button
                    disabled={busy !== null}
                    onClick={() =>
                      act(`post_${member.id}`, () => postPodiumStaff({ staffId: member.id }))
                    }
                    title="Post this contract on the transfer market"
                    className="text-gray-500 hover:text-white press-feedback"
                  >
                    {busy === `post_${member.id}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <ArrowLeftRight className="w-3 h-3" />
                    )}
                  </button>
                </span>
              )}
            </div>
          ))}
          {retraining && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[9px] uppercase font-bold text-gray-600">Retrain to:</span>
              {openSpecialties.map((specialty) => (
                <button
                  key={specialty}
                  disabled={busy !== null}
                  onClick={() =>
                    act(`retrain_${specialty}`, async () => {
                      await retrainPodiumStaff({ staffId: retraining, toSpecialty: specialty });
                      setRetraining(null);
                    })
                  }
                  className="text-[9px] px-1.5 py-0.5 rounded-sm border border-[#333] text-gray-400 hover:text-white hover:border-[#0057B8] press-feedback"
                >
                  {SPECIALTY_LABELS[specialty]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {open && (
        <div className="space-y-3">
          {/* Contract length */}
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold uppercase tracking-wider text-gray-600">
              Contract
            </span>
            {CONTRACT_LENGTHS.map((seasons) => (
              <button
                key={seasons}
                onClick={() => setContractSeasons(seasons)}
                className={`text-[10px] font-bold px-2 py-0.5 rounded-sm border press-feedback ${
                  contractSeasons === seasons
                    ? 'border-[#0057B8] bg-[#0057B8]/15 text-white'
                    : 'border-[#333] text-gray-500 hover:text-white'
                }`}
              >
                {seasons} season{seasons > 1 ? 's' : ''}
              </button>
            ))}
            <span className="text-[9px] text-gray-600">
              Salary locks at signing — a hedge against tenure raises. Each season is paid from
              that season&apos;s budget.
            </span>
          </div>

          {/* Transfer market */}
          {transfers.length > 0 && (
            <div>
              <div className="text-[9px] font-bold uppercase tracking-wider text-[#c9a227] mb-1">
                Transfer market — contracts posted mid-season
              </div>
              <div className="flex flex-wrap gap-1.5">
                {transfers.map((listing) => (
                  <button
                    key={listing.staffId}
                    disabled={busy !== null}
                    onClick={() =>
                      act(`buy_${listing.staffId}`, () =>
                        buyPodiumStaffContract({ staffId: listing.staffId })
                      )
                    }
                    title={`Posted by ${listing.fromCorpsName || 'a rival corps'} — buyout covers the rest of the season`}
                    className="text-[10px] px-2 py-1 rounded-sm border border-[#5a4a12] text-gray-300 hover:border-[#c9a227] hover:text-white tabular-nums press-feedback"
                  >
                    {busy === `buy_${listing.staffId}` ? (
                      <Loader2 className="w-3 h-3 animate-spin inline" />
                    ) : (
                      <>
                        <span className={`font-bold ${TIER_STYLES[listing.member?.tier]}`}>
                          {TIER_LABELS[listing.member?.tier] || listing.member?.tier}
                        </span>
                        <span className="text-gray-600">
                          {' '}
                          {SPECIALTY_LABELS[listing.member?.specialty]} · buyout {listing.buyout}
                        </span>
                      </>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

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
                    {experienceLevels(pool).map((level) => {
                      const busyKey = level.hire?.id;
                      return (
                        <button
                          key={`${specialty}_${level.tier}`}
                          disabled={busy !== null || seatFilled || !level.available}
                          onClick={() =>
                            level.hire &&
                            act(level.hire.id, () =>
                              hirePodiumStaff({ staffId: level.hire.id, seasons: contractSeasons })
                            )
                          }
                          title={`${TIER_LABELS[level.tier]} ${SPECIALTY_LABELS[specialty]} · +${Math.round(level.boost * 100)}% rehearsal yield · ${level.salary}/season`}
                          className={`text-[10px] px-2 py-1 rounded-sm border tabular-nums press-feedback ${
                            !level.available
                              ? 'border-[#242424] text-gray-700'
                              : seatFilled
                                ? 'border-[#242424] text-gray-600'
                                : 'border-[#333] text-gray-300 hover:border-[#0057B8] hover:text-white'
                          }`}
                        >
                          {busyKey && busy === busyKey ? (
                            <Loader2 className="w-3 h-3 animate-spin inline" />
                          ) : (
                            <>
                              <span className={`font-bold ${TIER_STYLES[level.tier]}`}>
                                {TIER_LABELS[level.tier]}
                              </span>
                              <span className="text-gray-600">
                                {' '}
                                · +{Math.round(level.boost * 100)}% · {level.salary}/season
                              </span>
                              {!level.available && <span className="text-gray-700"> · taken</span>}
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
