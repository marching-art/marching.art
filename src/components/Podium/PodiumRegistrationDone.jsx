// PodiumRegistrationDone — the "on tour" confirmation shown after a successful
// registration (design §5.13): division seat, official home, provisional
// Eastern night, any home-relocation charge, the prior-season budget refund,
// and the staff-retention outcome. Split from PodiumRegistration.jsx for
// file-size hygiene.

import { SPECIALTY_LABELS } from './podiumConstants';

/** Specialty-id -> label, cast to a string map for prop-keyed lookups. */
const SPECIALTY = /** @type {Record<string, string>} */ (SPECIALTY_LABELS);

/** @param {number|null|undefined} n */
const fmt = (n) => (n ?? 0).toLocaleString();

/** @param {{ done: any }} props */
export default function PodiumRegistrationDone({ done }) {
  const retained = done.retainedStaff || [];
  const lapsed = done.lapsedStaff || [];
  /** @type {Record<string, string>} */
  const reasonWord = { unaffordable: 'unfunded', released: 'released', retired: 'retired' };
  return (
    <div className="bg-surface-card border border-line rounded-none p-6 text-center space-y-2">
      <div className="text-lg font-bold text-white">{done.corpsName} is on tour.</div>
      <div className="text-xs text-muted">
        Competing in{' '}
        <span className="text-secondary font-bold">{done.divisionLabel || 'A Class'}</span>
        {done.home && (
          <>
            {' '}
            out of <span className="text-white font-bold">{done.home}</span>
          </>
        )}
        . Your provisional Eastern Classic night:{' '}
        <span className="text-white font-bold">Day {done.easternNight}</span> (night lineups publish
        Day 39). First rehearsal block is waiting below.
      </div>
      {done.homeRelocation && (
        <div className="text-[11px] text-secondary">
          Moved home {done.homeRelocation.miles} mi
          {done.homeRelocation.from ? ` from ${done.homeRelocation.from}` : ''} —{' '}
          <span className="font-bold tabular-nums">−{fmt(done.homeRelocation.fee)} CC</span> moving
          fee.
        </div>
      )}
      {done.budgetRefund > 0 && (
        <div className="text-[11px] text-green-400">
          Last season&apos;s unspent Corps Budget —{' '}
          <span className="font-bold tabular-nums">+{fmt(done.budgetRefund)} CC</span> — was
          refunded to your wallet.
        </div>
      )}
      {(retained.length > 0 || lapsed.length > 0) && (
        <div className="text-[11px] text-muted pt-1">
          {retained.length > 0 && (
            <div>
              Staff retained:{' '}
              <span className="text-secondary">
                {retained.map((/** @type {string} */ s) => SPECIALTY[s] || s).join(', ')}
              </span>
            </div>
          )}
          {lapsed.length > 0 && (
            <div>
              Left the corps:{' '}
              <span className="text-secondary">
                {lapsed
                  .map(
                    (/** @type {any} */ s) =>
                      `${SPECIALTY[s.specialty] || s.specialty} (${reasonWord[s.reason] || s.reason})`
                  )
                  .join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
