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
//
// A staffer never leaves for a pool: they stay until released, unaffordable
// at re-registration, or retired. A contract locks their PAY, not their
// employment — each card says where the lock stands, the next rung of the
// career ladder, and (close to the end) when the career retires. Releasing a
// staffer still under contract buys out the seasons left on it, so the release
// control asks first.

import React, { useEffect, useState } from 'react';
import { Users, Loader2, UserMinus, GraduationCap, X } from 'lucide-react';
import {
  getPodiumStaffMarket,
  hirePodiumStaff,
  releasePodiumStaff,
  retrainPodiumStaff,
} from '../../api/podium';
import { SPECIALTY_LABELS, TIER_LABELS } from './podiumConstants';

/** @typedef {import('../../api/podium').PodiumStaffMember} PodiumStaffMember */
/** @typedef {import('../../api/podium').PodiumStaffCareer} PodiumStaffCareer */
/** @typedef {import('../../api/podium').PodiumStaffCatalogOption} PodiumStaffCatalogOption */

/** Specialty-id -> label and tier-id -> label, as string maps for keyed lookups. */
const SPECIALTY = /** @type {Record<string, string>} */ (SPECIALTY_LABELS);
const TIER = /** @type {Record<string, string>} */ (TIER_LABELS);

/** @type {Record<string, string>} */
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

// Fallbacks while the state payload is loading; the server's balance wins.
/** @type {PodiumStaffCareer} */
const DEFAULT_CAREER = {
  maxSeasons: 30,
  retirementNoticeSeasons: 3,
  promotionSeasons: { journeyman: 3, veteran: 8, master: 15, legend: 22 },
  maxContractSeasons: 3,
  buyoutPremium: 0.25,
  tiers: {},
};

/** Generic résumé — the corps a staffer has served, no names. */
/** @param {PodiumStaffMember} member */
function resumeSummary(member) {
  const rows = member.resume || [];
  if (rows.length === 0) return 'No prior seasons yet';
  return rows
    .map((row) => `${row.corpsName || 'Unknown'}${row.placement ? ` (#${row.placement})` : ''}`)
    .join(' → ');
}

/** The best finish on a staffer's résumé, or null with none. */
/** @param {PodiumStaffMember} member */
function bestPlacement(member) {
  /** @type {number[]} */
  const places = [];
  for (const row of member.resume || []) {
    if (typeof row.placement === 'number' && row.placement > 0) places.push(row.placement);
  }
  return places.length ? Math.min(...places) : null;
}

/**
 * The next rung tenure will reach and how many seasons away it is (mirrors
 * staffMarket.nextPromotion). Null at the top of the ladder.
 * @param {PodiumStaffMember} member
 * @param {PodiumStaffCareer} career
 */
function nextPromotion(member, career) {
  const currentRank = TIER_ORDER.indexOf(member.tier || member.hiredTier || 'apprentice');
  const seasons = member.careerSeasons || 0;
  /** @type {{tier: string, seasonsAway: number} | null} */
  let best = null;
  for (const [tier, at] of Object.entries(career.promotionSeasons || {})) {
    if (TIER_ORDER.indexOf(tier) <= currentRank) continue;
    if (best === null || at - seasons < best.seasonsAway) {
      best = { tier, seasonsAway: Math.max(0, at - seasons) };
    }
  }
  return best;
}

/**
 * The buyout owed to release this staffer now: the premium on every locked
 * season beyond the current one (mirrors staffMarket.buyoutFor in-season).
 * @param {PodiumStaffMember} member
 * @param {PodiumStaffCareer} career
 */
function buyoutNow(member, career) {
  const remaining = member.contract?.remaining || 0;
  const beyond = Math.max(0, remaining - 1);
  if (beyond <= 0) return 0;
  return Math.round((member.salaryPerSeason || 0) * (career.buyoutPremium || 0) * beyond);
}

/**
 * One line on where this staffer's contract stands. The lock counts the
 * current season, so `remaining` 1 means it runs out after this one.
 * @param {PodiumStaffMember} member
 */
function contractLine(member) {
  const remaining = member.contract?.remaining || 0;
  if (remaining > 1) {
    return `Contract · ${member.salaryPerSeason} CC locked for ${remaining - 1} more season${remaining > 2 ? 's' : ''}`;
  }
  if (remaining === 1 && (member.contract?.seasons || 0) > 1) {
    return 'Contract ends after this season · re-sign at re-registration to lock the rate';
  }
  return `${member.salaryPerSeason} CC · pay floats with tenure · re-sign at re-registration`;
}

/**
 * `podium` is the usePodium() hook value; only the members this panel touches
 * are named here rather than restating the whole (untyped) hook shape.
 *
 * @param {{podium: {
 *   data?: any,
 *   reload: () => Promise<unknown>,
 * }}} props
 */
export default function PodiumStaffPanel({ podium }) {
  const state = podium.data?.state;
  /** @type {PodiumStaffCareer} */
  const career = podium.data?.staffCareer || DEFAULT_CAREER;
  const [catalog, setCatalog] = useState(/** @type {PodiumStaffCatalogOption[] | null} */ (null));
  const [busy, setBusy] = useState(/** @type {string | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [contractSeasons, setContractSeasons] = useState(1);
  const [retraining, setRetraining] = useState(/** @type {string | null} */ (null)); // staffId
  const [releasing, setReleasing] = useState(/** @type {string | null} */ (null)); // specialty
  const [notice, setNotice] = useState(/** @type {string | null} */ (null));

  useEffect(() => {
    if (catalog) return;
    let cancelled = false;
    (async () => {
      try {
        const result = await getPodiumStaffMarket();
        if (!cancelled) setCatalog(result.data.catalog || []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Could not load the staff catalog.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalog]);

  if (!state) return null;
  /** @type {Record<string, PodiumStaffMember>} */
  const roster = state.staff || {};

  /** @param {string} key @param {() => Promise<unknown>} fn */
  const act = async (key, fn) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      await fn();
      await podium.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusy(null);
    }
  };

  const specialties = Object.keys(SPECIALTY);
  const hiredCount = specialties.filter((s) => roster[s]).length;
  const openSpecialties = specialties.filter((s) => !roster[s]);
  const contractLengths = Array.from({ length: career.maxContractSeasons || 3 }, (_, i) => i + 1);

  /** @param {string} specialty */
  const optionsFor = (specialty) =>
    (catalog || [])
      .filter((o) => o.specialty === specialty)
      .sort((a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier));

  /** @param {string} specialty @param {PodiumStaffMember} member */
  const release = (specialty, member) =>
    act(`release_${specialty}`, async () => {
      const result = await releasePodiumStaff({ specialty });
      setReleasing(null);
      const paid = result.data.buyout || 0;
      setNotice(
        `${SPECIALTY[specialty] || specialty} released${paid > 0 ? ` — ${paid} CC contract buyout paid` : ''}. ` +
          `Their ${(member.careerSeasons || 0) + 1}-season tenure with you ends here.`
      );
    });

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
        {contractLengths.map((seasons) => (
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
          Staff stay with your corps for their whole career — a contract only locks their pay
          against the raises tenure brings, and binds you to it: releasing someone mid-contract buys
          out the seasons left. When it lapses they stay on at the going rate, and you can re-sign
          them at re-registration. Retain a staffer and they grow from Apprentice toward Legend.
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
          const options = optionsFor(specialty);
          if (member) {
            const promotion = nextPromotion(member, career);
            const seasonsLeft = Math.max(
              0,
              (career.maxSeasons || 30) - 1 - (member.careerSeasons || 0)
            );
            const nearRetirement = seasonsLeft <= (career.retirementNoticeSeasons ?? 3);
            const buyout = buyoutNow(member, career);
            const best = bestPlacement(member);
            const confirming = releasing === specialty;
            return (
              <div
                key={specialty}
                className="rounded-none border border-line bg-surface-sunken p-2.5 flex flex-col gap-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted truncate">
                    {SPECIALTY[specialty] || specialty}
                  </span>
                  <span
                    className={`text-[10px] font-bold shrink-0 ${TIER_STYLES[member.tier] || 'text-white'}`}
                  >
                    {TIER[member.tier] || member.tier}
                  </span>
                </div>

                <div
                  className="flex items-center justify-between gap-2 text-[10px] tabular-nums text-muted"
                  title={resumeSummary(member)}
                >
                  <span>
                    yr {(member.careerSeasons || 0) + 1}
                    {best ? ` · best #${best}` : ''}
                    {member.retrain && ' · retraining'}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <button
                      disabled={busy !== null}
                      onClick={() => {
                        setReleasing(null);
                        setRetraining((v) => (v === member.id ? null : member.id));
                      }}
                      title="Retrain into a new specialty (reduced boost this season)"
                      aria-label={`Retrain ${SPECIALTY[specialty] || specialty}`}
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
                      onClick={() => {
                        setRetraining(null);
                        setReleasing((v) => (v === specialty ? null : specialty));
                      }}
                      title={
                        buyout > 0
                          ? `Release this staffer — buys out the ${member.contract?.remaining ? member.contract.remaining - 1 : 0} contracted season(s) beyond this one for ${buyout} CC`
                          : 'Release this staffer — frees the seat, ends their tenure (no refund)'
                      }
                      aria-label={`Release ${SPECIALTY[specialty] || specialty}`}
                      className={`press-feedback ${
                        confirming ? 'text-red-400' : 'text-muted hover:text-red-400'
                      }`}
                    >
                      {busy === `release_${specialty}` ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <UserMinus className="w-3 h-3" />
                      )}
                    </button>
                  </span>
                </div>

                {/* Where the contract stands, the next rung, and the end of the road. */}
                <div className="text-[9px] leading-snug text-muted space-y-0.5">
                  <div
                    className={
                      member.contract && member.contract.remaining > 1 ? 'text-interactive' : ''
                    }
                  >
                    {contractLine(member)}
                  </div>
                  {promotion && (
                    <div>
                      {TIER[promotion.tier] || promotion.tier}{' '}
                      {promotion.seasonsAway === 0
                        ? 'next season'
                        : `in ${promotion.seasonsAway} season${promotion.seasonsAway > 1 ? 's' : ''}`}{' '}
                      of tenure
                      {career.tiers?.[promotion.tier]?.boost
                        ? ` · +${Math.round(career.tiers[promotion.tier].boost * 100)}% yield`
                        : ''}
                    </div>
                  )}
                  {nearRetirement && (
                    <div className="text-warning">
                      {seasonsLeft === 0
                        ? 'Final season — retires at the end of it and the seat reopens'
                        : `Retires after ${seasonsLeft} more season${seasonsLeft > 1 ? 's' : ''} (career ends at ${career.maxSeasons})`}
                    </div>
                  )}
                </div>

                {confirming && (
                  <div className="flex flex-col gap-1 pt-1 border-t border-line-muted">
                    <span className="text-[9px] text-secondary">
                      {buyout > 0
                        ? `Release now and buy out the rest of their contract for ${buyout} CC from your Corps Budget? No refund on this season's salary.`
                        : "Release now? This season's salary is spent, and their tenure with you ends."}
                    </span>
                    <span className="flex items-center gap-1">
                      <button
                        disabled={busy !== null}
                        onClick={() => release(specialty, member)}
                        className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-none border border-red-400/60 text-red-400 hover:bg-red-400/10 press-feedback"
                      >
                        {buyout > 0 ? `Release · ${buyout} CC` : 'Release'}
                      </button>
                      <button
                        disabled={busy !== null}
                        onClick={() => setReleasing(null)}
                        aria-label="Keep this staffer"
                        className="text-[9px] px-1.5 py-0.5 rounded-none border border-line text-muted hover:text-white press-feedback"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  </div>
                )}

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
                                staffId: member.id,
                                toSpecialty: target,
                              });
                              setRetraining(null);
                            })
                          }
                          className="text-[9px] px-1.5 py-0.5 rounded-none border border-line text-muted hover:text-white hover:border-interactive press-feedback"
                        >
                          {SPECIALTY[target]}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          }
          return (
            <div
              key={specialty}
              className="rounded-none border border-dashed border-line-muted bg-surface-sunken p-2.5 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[9px] font-bold uppercase tracking-wider text-muted truncate">
                  {SPECIALTY[specialty] || specialty}
                </span>
                <span className="text-[9px] uppercase tracking-wider text-muted shrink-0">
                  Vacant
                </span>
              </div>
              {options.length > 0 ? (
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
                        title={`${TIER[option.tier]} ${SPECIALTY[specialty]} · +${Math.round(option.boost * 100)}% rehearsal yield · ${option.salary}/season`}
                        className="flex items-center justify-between gap-2 text-[10px] px-2 py-1 rounded-none border border-line text-secondary hover:border-interactive hover:text-white tabular-nums press-feedback"
                      >
                        {busy === key ? (
                          <Loader2 className="w-3 h-3 animate-spin mx-auto" />
                        ) : (
                          <>
                            <span className={`font-bold ${TIER_STYLES[option.tier]}`}>
                              {TIER[option.tier]}
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

      {notice && <div className="text-[11px] text-secondary">{notice}</div>}
      {error && <div className="text-[11px] text-red-400">{error}</div>}
    </div>
  );
}
