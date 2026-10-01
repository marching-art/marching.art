// Schedule-page tour insights on a show: what the Podium corps' leg INTO the
// show would cost from its previous stop (mileage, travel stamina, heat, any
// flight, the day's closest show) and which of the director's rivals are on
// the bill. Shared by the show cards and the registration modal.

import React from 'react';
import { Bus, Plane, Sun, Swords } from 'lucide-react';
import { TRAVEL_TIER_LABELS } from '../Podium/podiumConstants';

/** @typedef {import('../../api/podium').PodiumShowTravelLeg} PodiumShowTravelLeg */
/** @typedef {import('../../api/functions').RivalAttendee} RivalAttendee */

/** @param {number} n */
const fmt1 = (n) => (Math.round(n * 10) / 10).toString();

/**
 * What the leg INTO this show would cost the Podium corps, from where it will
 * be standing the night before (its previous stop, or its current location) —
 * mileage, travel stamina, heat, any flight — and the hop on to its next
 * booked stop. Lets a director build the tour day by day off the cards.
 * @param {{ travel: PodiumShowTravelLeg }} props
 */
export const TravelLine = ({ travel }) => {
  const tier = (travel.tier && TRAVEL_TIER_LABELS[travel.tier]) || travel.tier || '';
  const from = travel.fromHome
    ? `home · ${travel.fromCity}`
    : travel.fromDay != null
      ? `D${travel.fromDay} · ${travel.fromCity}`
      : travel.fromCity;
  const onward = travel.onward;
  const detail = [
    from ? `from ${from}` : null,
    travel.airfareEligible && travel.airfareStaminaCost != null
      ? `fly for ${travel.airfareCost} CC → −${fmt1(travel.airfareStaminaCost)}`
      : null,
    onward
      ? `then ${onward.miles} mi${onward.mandatoryFlight ? ' (flight)' : ''} on to ${onward.city} (D${onward.day}, −${fmt1(onward.staminaCost)})`
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <div className="min-w-0" title={`Podium travel ${detail}`}>
      <div className="flex items-center gap-1.5 tabular-nums">
        {travel.mandatoryFlight ? (
          <Plane className="w-3 h-3 flex-shrink-0 text-red-400" aria-hidden="true" />
        ) : (
          <Bus className="w-3 h-3 flex-shrink-0 text-interactive" aria-hidden="true" />
        )}
        <span className="text-secondary truncate">
          {travel.miles > 0 ? `${tier} · ${travel.miles} mi` : 'Same city'}
        </span>
        {travel.staminaCost > 0 && (
          <span className="text-red-400/80 flex-shrink-0">−{fmt1(travel.staminaCost)} stam</span>
        )}
        {travel.heat > 0 && (
          <span
            className="inline-flex items-center gap-0.5 text-orange-400 flex-shrink-0"
            title="Heat index — extra stamina at this venue"
          >
            <Sun className="w-3 h-3" aria-hidden="true" />
            {fmt1(travel.heat)}
          </span>
        )}
        {travel.mandatoryFlight && (
          <span className="text-red-400 font-bold flex-shrink-0">{travel.coinCost} CC flight</span>
        )}
        {travel.closest && (
          <span className="ml-auto flex-shrink-0 px-1 py-px text-[8px] font-bold uppercase tracking-wider bg-green-500/10 text-green-400">
            Closest
          </span>
        )}
      </div>
      {detail && <div className="text-[9px] text-muted truncate">{detail}</div>}
    </div>
  );
};

/** @param {RivalAttendee} rival */
const rivalGap = (rival) => {
  if (rival.scoreDelta == null) return '';
  const sign = rival.scoreDelta > 0 ? '+' : '';
  const basis = rival.basis === 'lastSeason' ? ' last season' : '';
  return ` (${sign}${rival.scoreDelta.toFixed(3)}${basis})`;
};

/**
 * "Rival attending" — a director the nightly rivals job paired with one of
 * this director's corps (closest score this season, or last season's before
 * anyone has scored) is on this show's bill.
 * @param {{ rivals: RivalAttendee[] }} props
 */
const RivalLine = ({ rivals }) => {
  const names = [...new Map(rivals.map((r) => [`${r.uid}|${r.corpsClass}`, r])).values()];
  return (
    <div
      className="flex items-center gap-1.5 min-w-0"
      title={names
        .map((r) => `${r.corpsName}${r.username ? ` (@${r.username})` : ''}${rivalGap(r)}`)
        .join('\n')}
    >
      <Swords className="w-3 h-3 flex-shrink-0 text-red-500" aria-hidden="true" />
      <span className="flex-shrink-0 text-[9px] font-bold uppercase tracking-wider text-red-400">
        {names.length > 1 ? `${names.length} rivals` : 'Rival'} attending
      </span>
      <span className="text-secondary truncate">{names.map((r) => r.corpsName).join(', ')}</span>
    </div>
  );
};

/**
 * @param {{ travel?: PodiumShowTravelLeg | null, rivals?: RivalAttendee[] | null }} props
 */
export const ShowInsights = ({ travel, rivals }) => {
  const hasRivals = Array.isArray(rivals) && rivals.length > 0;
  if (!travel && !hasRivals) return null;
  return (
    <div className="px-4 py-1.5 border-b border-line bg-surface-sunken/60 space-y-1 text-[10px]">
      {travel && <TravelLine travel={travel} />}
      {hasRivals && <RivalLine rivals={/** @type {RivalAttendee[]} */ (rivals)} />}
    </div>
  );
};
