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
import { Users, Loader2, UserMinus, GraduationCap } from 'lucide-react';
import {
  getPodiumStaffMarket,
  hirePodiumStaff,
  releasePodiumStaff,
  retrainPodiumStaff,
} from '../../api/podium';
import { SPECIALTY_LABELS, TIER_LABELS } from './podiumConstants';

const TIER_STYLES = {
  apprentice: 'text-muted',
  journeyman: 'text-secondary',
  veteran: 'text-interactive',
  master: 'text-purple-300',
  legend: 'text-brand',
};

// Experience levels, least → most experienced. The label IS the staffer's
// identity in the grid — no names.
const TIER_ORDER = ['apprentice', 'journeyman', 'veteran', 'master', 'legend'];

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
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [contractSeasons, setContractSeasons] = useState(1);
  const [retraining, setRetraining] = useState(null); // staffId being retrained

  useEffect(() => {
    if (catalog) return;
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
  }, [catalog]);

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

  const specialties = Object.keys(SPECIALTY_LABELS);
  const hiredCount = specialties.filter((s) => roster[s]).length;
  const openSpecialties = specialties.filter((s) => !roster[s]);

  const optionsFor = (specialty) =>
    (catalog || [])
      .filter((o) => o.specialty === specialty)
      .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));

  return (
    <div className="bg-surface-card border border-line rounded-none p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
          <Users className="w-3 h-3" /> Staff ({hiredCount}/10)
        </span>
        <span className="flex items-center gap-2 text-[9px] uppercase tracking-wider text-muted">
          <span className="hidden sm:inline">
            {hiredCount === 10
              ? 'roster full'
              : `${10 - hiredCount} seat${10 - hiredCount > 1 ? 's' : ''} open`}
          </span>
        </span>
      </div>

      {/* Contract length — applies to every hire below */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[9px] font-bold uppercase tracking-wider text-muted">Contract</span>
        {CONTRACT_LENGTHS.map((seasons) => (
          <button
            key={seasons}
            onClick={() => setContractSeasons(seasons)}
            className={`text-[10px] font-bold px-2 py-0.5 rounded-none border press-feedback ${
              contractSeasons === seasons
                ? 'border-interactive bg-interactive/15 text-white'
                : 'border-line text-muted hover:text-white'
            }`}
          >
            {seasons} season{seasons > 1 ? 's' : ''}
          </button>
        ))}
        <span className="text-[9px] text-muted basis-full sm:basis-auto sm:flex-1">
          Longer contracts lock the salary against the raises tenure brings — retain a staffer and
          they grow from Apprentice toward Legend.
        </span>
      </div>

      {!catalog && !error && (
        <div className="text-[9px] uppercase tracking-wider text-muted flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Loading catalog…
        </div>
      )}
      {catalog && catalog.length === 0 && !error && (
        <div className="text-[11px] text-muted py-1">
          No staff catalog available right now. If this persists, the staff service may still be
          deploying — try again shortly.
        </div>
      )}

      {/* Seat grid — one card per specialty; the roster overview and the
          hiring board in one. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-2">
        {specialties.map((specialty) => {
          const member = roster[specialty];
          const filled = Boolean(member);
          const options = optionsFor(specialty);
          return (
            <div
              key={specialty}
              className={`rounded-none border p-2.5 flex flex-col gap-1.5 ${
                filled
                  ? 'border-line bg-surface-sunken'
                  : 'border-dashed border-line-muted bg-surface-sunken'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted truncate">
                  {SPECIALTY_LABELS[specialty] || specialty}
                </span>
                {filled ? (
                  <span
                    className={`text-[10px] font-bold shrink-0 ${TIER_STYLES[member.tier] || 'text-white'}`}
                  >
                    {TIER_LABELS[member.tier] || member.tier}
                  </span>
                ) : (
                  <span className="text-[9px] uppercase tracking-wider text-muted shrink-0">
                    Vacant
                  </span>
                )}
              </div>

              {filled ? (
                <>
                  <div
                    className="flex items-center justify-between gap-2 text-[10px] tabular-nums text-muted"
                    title={resumeSummary(member)}
                  >
                    <span>
                      yr {(member.careerSeasons || 0) + 1}
                      {member.contract &&
                        ` · ${member.contract.remaining}/${member.contract.seasons} locked`}
                      {member.retrain && ' · retraining'}
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      <button
                        disabled={busy !== null}
                        onClick={() => setRetraining((v) => (v === member.id ? null : member.id))}
                        title="Retrain into a new specialty (reduced boost this season)"
                        className={`press-feedback ${
                          retraining === member.id
                            ? 'text-interactive'
                            : 'text-muted hover:text-white'
                        }`}
                      >
                        <GraduationCap className="w-3 h-3" />
                      </button>
                      <button
                        disabled={busy !== null}
                        onClick={() =>
                          act(`release_${specialty}`, () => releasePodiumStaff({ specialty }))
                        }
                        title="Release this staffer — frees the seat, ends their tenure (no refund)"
                        className="text-muted hover:text-red-400 press-feedback"
                      >
                        {busy === `release_${specialty}` ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <UserMinus className="w-3 h-3" />
                        )}
                      </button>
                    </span>
                  </div>
                  {retraining === member.id && (
                    <div className="flex flex-wrap items-center gap-1 pt-0.5 border-t border-line-muted">
                      <span className="text-[9px] uppercase font-bold text-muted w-full">
                        Retrain to:
                      </span>
                      {openSpecialties.length === 0 ? (
                        <span className="text-[9px] text-muted">No open seats to move into.</span>
                      ) : (
                        openSpecialties.map((target) => (
                          <button
                            key={target}
                            disabled={busy !== null}
                            onClick={() =>
                              act(`retrain_${target}`, async () => {
                                await retrainPodiumStaff({
                                  staffId: retraining,
                                  toSpecialty: target,
                                });
                                setRetraining(null);
                              })
                            }
                            className="text-[9px] px-1.5 py-0.5 rounded-none border border-line text-muted hover:text-white hover:border-interactive press-feedback"
                          >
                            {SPECIALTY_LABELS[target]}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </>
              ) : options.length > 0 ? (
                <div className="flex flex-col gap-1">
                  {options.map((option) => {
                    const key = `hire_${specialty}_${option.tier}`;
                    return (
                      <button
                        key={option.tier}
                        disabled={busy !== null}
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
                        className="flex items-center justify-between gap-2 text-[10px] px-2 py-1 rounded-none border border-line text-secondary hover:border-interactive hover:text-white tabular-nums press-feedback"
                      >
                        {busy === key ? (
                          <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                        ) : (
                          <>
                            <span className={`font-bold ${TIER_STYLES[option.tier]}`}>
                              {TIER_LABELS[option.tier]}
                            </span>
                            <span className="text-muted">
                              +{Math.round(option.boost * 100)}% · {option.salary}/season
                            </span>
                          </>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : catalog ? (
                <span className="text-[9px] text-muted">No candidates listed.</span>
              ) : (
                <span className="text-[9px] text-muted">Open seat — loading catalog…</span>
              )}
            </div>
          );
        })}
      </div>

      {error && <div className="text-[11px] text-red-400">{error}</div>}
    </div>
  );
}
