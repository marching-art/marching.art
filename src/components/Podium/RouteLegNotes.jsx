// Travel notes on the Upcoming Route sheet (CorpsConditionPanel): the flight /
// airfare line for a leg, rendered just ABOVE the stop that leg travels to.

import React from 'react';
import { Loader2, Plane } from 'lucide-react';

/** @typedef {import('../../api/podium').PodiumRouteLeg} PodiumRouteLeg */

// The hop a travel note describes, "From → To". Every note sits ABOVE the stop
// it travels to, so the flight into Hawaii reads before the Hawaii show and the
// flight home reads after it — the order the corps actually rides them.
/** @param {{ leg: PodiumRouteLeg }} props */
function LegRoute({ leg }) {
  if (!leg.fromCity) return null;
  return (
    <span className="text-secondary">
      {leg.fromCity} → {leg.city}
      {' · '}
    </span>
  );
}

// Airfare affordance above a long leg (design §5.3): fly to halve the travel-
// stamina hit for a CorpsCoin fare charged from the Corps Budget. Booking is
// free and reversible here — the fare only lands at the nightly processor,
// priced against the leg the corps actually flies. Shown only on eligible
// (over-the-floor) legs; disabled to book when the Budget can't cover the fare.
/**
 * An over-ocean leg (to/from Hawaii): the flight isn't optional, so there's no
 * toggle — just the fare the nightly run will charge and the full stamina hit.
 * @param {{ leg: PodiumRouteLeg }} props
 */
export function MandatoryFlightNote({ leg }) {
  return (
    <div className="px-3 py-1 border-t border-line-subtle bg-surface-sunken/40 flex items-center gap-1.5 text-[9px] text-muted">
      <Plane className="w-3 h-3 shrink-0 text-red-400" />
      <span className="min-w-0 leading-snug">
        <LegRoute leg={leg} />
        Over-ocean flight required —{' '}
        <span className="text-red-400 font-bold">{leg.coinCost} CC</span> from Budget, full −
        {leg.staminaCost} travel stamina (no flight discount).
      </span>
    </div>
  );
}

/**
 * @param {{
 *   leg: PodiumRouteLeg,
 *   budgetBalance: number,
 *   busy: boolean,
 *   disabled: boolean,
 *   onToggle: (fly: boolean) => void,
 * }} props
 */
export function AirfareRow({ leg, budgetBalance, busy, disabled, onToggle }) {
  const affordable = budgetBalance >= (leg.airfareCost || 0);
  const flownStamina = leg.airfareStaminaCost != null ? leg.airfareStaminaCost : leg.staminaCost;
  const saved = Math.round((leg.staminaCost - flownStamina) * 10) / 10;
  return (
    <div className="px-3 py-1 border-t border-line-subtle bg-surface-sunken/40 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-[9px] text-muted min-w-0">
        <Plane className="w-3 h-3 shrink-0 text-interactive" />
        {leg.airfarePurchased ? (
          <span className="min-w-0 leading-snug">
            <LegRoute leg={leg} />
            Flying — <span className="text-interactive font-bold">{leg.airfareCost} CC</span> from
            Budget, travel stamina halved to −{flownStamina}.
          </span>
        ) : (
          <span className="min-w-0 leading-snug">
            <LegRoute leg={leg} />
            Fly this leg — <span className="text-white font-bold">{leg.airfareCost} CC</span> to
            save {saved} stamina
            {!affordable ? <span className="text-red-400/80"> · Budget too low</span> : null}.
          </span>
        )}
      </div>
      <button
        disabled={disabled || (!leg.airfarePurchased && !affordable)}
        onClick={() => onToggle(!leg.airfarePurchased)}
        className={`shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded-none press-feedback disabled:opacity-40 ${
          leg.airfarePurchased
            ? 'border border-line text-muted hover:text-white'
            : 'bg-interactive text-white hover:bg-interactive-hover'
        }`}
      >
        {busy ? (
          <Loader2 className="w-3 h-3 animate-spin" />
        ) : leg.airfarePurchased ? (
          'Cancel'
        ) : (
          'Fly'
        )}
      </button>
    </div>
  );
}

// Tonight's long leg: airfare booking closed with the day (setPodiumAirfare only
// books days still ahead of today), so say what the nightly run will do —
// fly it if a flight was booked, otherwise ride the bus — with no toggle.
/** @param {{leg: PodiumRouteLeg}} props */
export function TodayAirfareNote({ leg }) {
  return (
    <div className="px-3 py-1 border-t border-line-subtle bg-surface-sunken/40 flex items-center gap-1.5 text-[9px] text-muted">
      <Plane
        className={`w-3 h-3 shrink-0 ${leg.airfarePurchased ? 'text-interactive' : 'text-muted'}`}
      />
      {leg.airfarePurchased ? (
        <span className="min-w-0 leading-snug">
          <LegRoute leg={leg} />
          Flying tonight — <span className="text-interactive font-bold">
            {leg.airfareCost} CC
          </span>{' '}
          from Budget, travel stamina halved to −{leg.airfareStaminaCost}.
        </span>
      ) : (
        <span className="min-w-0 leading-snug">
          <LegRoute leg={leg} />
          Riding the bus tonight — airfare closes once the show day begins.
        </span>
      )}
    </div>
  );
}

// A previously-booked fly intent whose leg has since rerouted under the airfare
// floor (design §5.3). The flag lingers harmlessly — the nightly processor
// prices airfare on the REALIZED leg and simply won't fly a short one, so no
// CorpsCoin is ever charged — but the route portal must SAY that rather than
// silently dropping the "Flying" badge, which reads like a vanished purchase.
// Offers a one-click clear to tidy the stale flag (re-book later if it reroutes
// long again — toggling airfare is always free and reversible).
/** @param {{busy: boolean, disabled: boolean, onClear: () => void}} props */
export function StrandedAirfareNote({ busy, disabled, onClear }) {
  return (
    <div className="px-3 py-1 border-t border-line-subtle bg-surface-sunken/40 flex items-center justify-between gap-2">
      <div className="flex items-center gap-1.5 text-[9px] text-muted min-w-0">
        <Plane className="w-3 h-3 shrink-0 text-muted" />
        <span className="min-w-0 leading-snug">
          Booked to fly, but this leg is now too short — the flight won&apos;t apply and{' '}
          <span className="text-white font-bold">no CC will be charged</span>.
        </span>
      </div>
      <button
        disabled={disabled}
        onClick={onClear}
        className="shrink-0 text-[9px] font-bold uppercase px-2 py-0.5 rounded-none border border-line text-muted hover:text-white press-feedback disabled:opacity-40"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Clear'}
      </button>
    </div>
  );
}
