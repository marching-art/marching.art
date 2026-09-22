// PodiumStaffRetention — the carried-staff decision at re-registration
// (design §5.6): who marches next season, who gets re-signed, and who is
// bought out. Staff never enter a pool — a contract locks their PAY, not
// their employment — so this list is the whole between-seasons staffing
// decision: keep (pay the aged salary), re-sign a lapsed lock at today's rate
// for 1..N seasons, or let someone go (buying out any seasons still locked).
// Payroll plus buyouts must fit the commitment; the server applies exactly the
// same greedy plan (staffMarket.projectRetention), so what this shows is what
// happens. Split from PodiumRegistration.jsx for file-size hygiene.

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { SPECIALTY_LABELS, TIER_LABELS } from './podiumConstants';

/** @typedef {import('../../api/podium').PodiumStaffProjection} PodiumStaffProjection */

/** Specialty-id -> label and tier-id -> label, as string maps for keyed lookups. */
const SPECIALTY = /** @type {Record<string, string>} */ (SPECIALTY_LABELS);
const TIER = /** @type {Record<string, string>} */ (TIER_LABELS);

/**
 * @param {{
 *   activeStaff: PodiumStaffProjection[],
 *   retiringStaff: PodiumStaffProjection[],
 *   keptStaff: Set<string>,
 *   toggleKeep: (specialty: string) => void,
 *   renewals: Record<string, number>,
 *   setRenewal: (specialty: string, seasons: number) => void,
 *   contractLengths: number[],
 *   maxContractSeasons: number,
 *   staffCommitment: number,
 *   budgetCommitment: number,
 *   buyoutTotal: number,
 *   shortfall: number,
 *   overBudget: boolean,
 *   maxCommit: number,
 *   verb: string,
 * }} props
 */
export default function PodiumStaffRetention({
  activeStaff,
  retiringStaff,
  keptStaff,
  toggleKeep,
  renewals,
  setRenewal,
  contractLengths,
  maxContractSeasons,
  staffCommitment,
  budgetCommitment,
  buyoutTotal,
  shortfall,
  overBudget,
  maxCommit,
  verb,
}) {
  return (
    <div className="pt-3 border-t border-line space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="text-[10px] font-bold uppercase tracking-wider text-muted">
          Staff payroll — who marches next season
        </label>
        <span
          className={`text-[11px] font-bold tabular-nums ${overBudget ? 'text-red-400' : 'text-green-400'}`}
        >
          {staffCommitment} / {budgetCommitment} CC
        </span>
      </div>
      <p className="text-[10px] text-muted">
        Your staff stay with you season after season — a contract only locks their pay. Tenure
        raised salaries except where a contract still holds one at its signed price. A lapsed
        contract can be re-signed here to lock today&apos;s rate for up to {maxContractSeasons}{' '}
        seasons. Uncheck anyone you&apos;re letting go — their seat reopens, their tenure ends, and
        any seasons still under contract are bought out. Payroll plus buyouts must fit your
        commitment.
      </p>

      {activeStaff.map((s) => {
        const kept = keptStaff.has(s.specialty);
        const promoted = s.nextTier && s.nextTier !== s.tier;
        // A multi-season contract holds this staffer's salary at the
        // price it was signed at, so re-registering them costs the same
        // as last season — no matter how far tenure has raised the
        // underlying rate. Surface it so the lock reads as a lock.
        const contract = s.contract || { seasons: 0, remaining: 0 };
        const locked = s.locked && contract.remaining > 0;
        return (
          <label
            key={s.specialty}
            className={`flex items-center gap-2 px-2 py-1.5 border rounded-none cursor-pointer press-feedback ${
              kept ? 'border-line bg-surface-sunken' : 'border-[#2a1a1a] bg-[#160f0f] opacity-70'
            }`}
          >
            <input
              type="checkbox"
              checked={kept}
              onChange={() => toggleKeep(s.specialty)}
              className="accent-interactive"
            />
            <span className="flex-1 text-[11px] font-bold text-white">
              {SPECIALTY[s.specialty] || s.specialty}
              <span className="ml-2 text-[9px] font-normal text-muted">
                {(s.nextTier && TIER[s.nextTier]) || TIER[s.tier]}
                {promoted && <span className="text-brand"> · promoted from {TIER[s.tier]}</span>}
              </span>
              {locked && (
                <span className="block text-[9px] font-normal text-interactive">
                  Under contract · {contract.remaining} of {contract.seasons} season
                  {contract.seasons > 1 ? 's' : ''} — price locked
                </span>
              )}
              {locked && !kept && s.buyout > 0 && (
                <span className="block text-[9px] font-normal text-red-400">
                  Buyout for the {contract.remaining} contracted season
                  {contract.remaining > 1 ? 's' : ''} you&apos;re walking away from
                </span>
              )}
              {kept && s.renewable && (
                <span
                  className="flex flex-wrap items-center gap-1 pt-1"
                  onClick={(e) => e.preventDefault()}
                >
                  <span className="text-[9px] font-normal text-muted">
                    {renewals[s.specialty]
                      ? `Re-sign · ${s.nextSalary} CC locked for ${renewals[s.specialty]} season${renewals[s.specialty] > 1 ? 's' : ''}`
                      : 'Contract lapsed · pay floats with tenure. Re-sign:'}
                  </span>
                  {[0, ...contractLengths].map((seasons) => {
                    const on = (renewals[s.specialty] || 0) === seasons;
                    return (
                      <button
                        key={seasons}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setRenewal(s.specialty, seasons);
                        }}
                        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-none border press-feedback ${
                          on
                            ? 'border-interactive bg-interactive/15 text-white'
                            : 'border-line text-muted hover:text-white'
                        }`}
                      >
                        {seasons === 0 ? 'No' : `${seasons} yr`}
                      </button>
                    );
                  })}
                </span>
              )}
            </span>
            <span className="text-[11px] tabular-nums text-right shrink-0">
              {!kept && s.buyout > 0 ? (
                <>
                  <span className="text-red-400">{s.buyout} CC</span>
                  <span className="block text-[9px] text-muted">buyout</span>
                </>
              ) : (
                <>
                  <span className={locked ? 'text-interactive' : 'text-secondary'}>
                    {s.nextSalary} CC
                  </span>
                  {locked ? (
                    <span className="block text-[9px] text-muted">locked</span>
                  ) : renewals[s.specialty] ? (
                    <span className="block text-[9px] text-interactive">re-signed</span>
                  ) : (
                    s.nextSalary > s.salary && <span className="text-muted"> (was {s.salary})</span>
                  )}
                </>
              )}
            </span>
          </label>
        );
      })}

      {retiringStaff.map((s) => (
        <div
          key={s.specialty}
          className="flex items-center gap-2 px-2 py-1.5 border border-line-subtle rounded-none opacity-50"
        >
          <span className="flex-1 text-[11px] text-muted">
            {SPECIALTY[s.specialty] || s.specialty}
          </span>
          <span className="text-[9px] uppercase tracking-wider text-muted">
            Retiring · 30-season career
          </span>
        </div>
      ))}

      {overBudget && (
        <div className="flex items-start gap-2 text-[11px] text-red-400 pt-1">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            You&apos;re <span className="font-bold tabular-nums">{shortfall}</span> CC short
            {buyoutTotal > 0 ? ` (including ${buyoutTotal} CC in buyouts)` : ''}. Commit more (up to{' '}
            {maxCommit}) or release an uncontracted staffer to {verb}.
          </span>
        </div>
      )}
    </div>
  );
}
