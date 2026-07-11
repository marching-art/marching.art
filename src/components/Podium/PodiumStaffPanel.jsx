// PodiumStaffPanel — the staff labor catalog: your roster of up to 10 seats
// (8 caption techs + Tour Manager + Program Coordinator) and the always-
// available hiring catalog.
//
// Staff are GENERIC — a director hires a role (specialty) at an entry
// experience level (Apprentice/Journeyman), never a named person. Hiring
// mints a staffer owned by your corps; from then on you EARN their higher
// tiers by retaining them season over season (their tenure, and their price,
// grow with them). No invented names, no scarcity — every role is always
// hireable, so supply scales with the playerbase.

import React, { useEffect, useState } from 'react';
import { Users, Loader2, ChevronDown, ChevronUp, UserMinus, GraduationCap } from 'lucide-react';
import {
  getPodiumStaffMarket,
  hirePodiumStaff,
  releasePodiumStaff,
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

/** Generic résumé — the corps a staffer has served, no names. */
function resumeSummary(member) {
  const rows = member.resume || [];
  if (rows.length === 0) return 'No prior seasons yet';
  return rows
    .map((row) => `${row.corpsName || 'Unknown'}${row.placement ? ` (#${row.placement})` : ''}`)
    .join(' → ');
}

export default function PodiumStaffPanel({ podium }) {
  const state = podium.data?.state;
  const [catalog, setCatalog] = useState(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [contractSeasons, setContractSeasons] = useState(1);
  const [retraining, setRetraining] = useState(null); // staffId being retrained

  useEffect(() => {
    if (!open || catalog) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await getPodiumStaffMarket();
        if (!cancelled) setCatalog(result.data.catalog || []);
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Could not load the staff catalog.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, catalog]);

  if (!state) return null;
  const roster = state.staff || {};

  const act = async (key, fn) => {
    setBusy(key);
    setError(null);
    try {
      await fn();
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
            <div
              key={specialty}
              title={`${TIER_LABELS[member.tier] || member.tier} · year ${(member.careerSeasons || 0) + 1} · ${resumeSummary(member)}`}
              className="flex items-center gap-2 text-[10px] tabular-nums"
            >
              <span className="text-gray-500 w-28 shrink-0 truncate">
                {SPECIALTY_LABELS[specialty] || specialty}:
              </span>
              <span className={`font-bold ${TIER_STYLES[member.tier] || 'text-white'}`}>
                {TIER_LABELS[member.tier] || member.tier}
              </span>
              <span className="text-gray-600">
                yr {(member.careerSeasons || 0) + 1}
                {member.contract &&
                  ` · ${member.contract.remaining}/${member.contract.seasons} locked`}
                {member.retrain && ' · retraining'}
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
                      act(`release_${specialty}`, () => releasePodiumStaff({ specialty }))
                    }
                    title="Release this staffer — frees the seat, ends their tenure (no refund)"
                    className="text-gray-500 hover:text-red-400 press-feedback"
                  >
                    {busy === `release_${specialty}` ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <UserMinus className="w-3 h-3" />
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
              Longer contracts lock the salary against the raises tenure brings — retain a staffer
              and they grow from Apprentice toward Legend.
            </span>
          </div>

          {!catalog && !error && (
            <div className="flex justify-center py-4">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            </div>
          )}
          {catalog &&
            Object.keys(SPECIALTY_LABELS).map((specialty) => {
              const options = catalog
                .filter((o) => o.specialty === specialty)
                .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));
              if (options.length === 0) return null;
              const seatFilled = Boolean(roster[specialty]);
              return (
                <div key={specialty}>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-gray-600 mb-1">
                    {SPECIALTY_LABELS[specialty]}
                    {seatFilled && <span className="text-green-500"> · seat filled</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {options.map((option) => {
                      const key = `hire_${specialty}_${option.tier}`;
                      return (
                        <button
                          key={option.tier}
                          disabled={busy !== null || seatFilled}
                          onClick={() =>
                            act(key, () =>
                              hirePodiumStaff({
                                specialty,
                                tier: option.tier,
                                seasons: contractSeasons,
                              })
                            )
                          }
                          title={`${TIER_LABELS[option.tier]} ${SPECIALTY_LABELS[specialty]} · +${Math.round(option.boost * 100)}% rehearsal yield · ${option.salary}/season`}
                          className={`text-[10px] px-2 py-1 rounded-sm border tabular-nums press-feedback ${
                            seatFilled
                              ? 'border-[#242424] text-gray-600'
                              : 'border-[#333] text-gray-300 hover:border-[#0057B8] hover:text-white'
                          }`}
                        >
                          {busy === key ? (
                            <Loader2 className="w-3 h-3 animate-spin inline" />
                          ) : (
                            <>
                              <span className={`font-bold ${TIER_STYLES[option.tier]}`}>
                                {TIER_LABELS[option.tier]}
                              </span>
                              <span className="text-gray-600">
                                {' '}
                                · +{Math.round(option.boost * 100)}% · {option.salary}/season
                              </span>
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
