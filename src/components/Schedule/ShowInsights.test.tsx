// Schedule show-card insights: Podium travel from the previous stop and
// rivals on the bill.

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShowInsights } from './ShowInsights';
import type { PodiumShowTravelLeg } from '../../api/podium';
import type { RivalAttendee } from '../../api/functions';

const leg = (over: Partial<PodiumShowTravelLeg> = {}): PodiumShowTravelLeg => ({
  day: 9,
  fromCity: 'Santa Clara, CA',
  fromDay: 5,
  fromHome: false,
  tier: 'dayTrip',
  miles: 104,
  coinCost: 10,
  staminaCost: 0.4,
  heat: 2.8,
  mandatoryFlight: false,
  airfareEligible: false,
  airfareCost: 0,
  airfareStaminaCost: null,
  onward: null,
  closest: true,
  ...over,
});

const rival = (over: Partial<RivalAttendee> = {}): RivalAttendee => ({
  uid: 'r1',
  username: 'peggy',
  corpsName: 'Altitude',
  corpsClass: 'worldClass',
  versusClass: 'worldClass',
  scoreDelta: 0.25,
  basis: 'season',
  day: 9,
  ...over,
});

describe('ShowInsights', () => {
  it('renders nothing without travel or rivals', () => {
    const { container } = render(<ShowInsights travel={null} rivals={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the leg from the previous stop and marks the closest show', () => {
    render(
      <ShowInsights
        travel={leg({
          onward: {
            day: 12,
            city: 'Stanford, CA',
            miles: 15,
            staminaCost: 0.1,
            mandatoryFlight: false,
          },
        })}
      />
    );
    expect(screen.getByText('Day trip · 104 mi')).toBeTruthy();
    expect(screen.getByText('−0.4 stam')).toBeTruthy();
    expect(screen.getByText('Closest')).toBeTruthy();
    expect(screen.getByText(/from D5 · Santa Clara, CA/)).toBeTruthy();
    expect(screen.getByText(/then 15 mi on to Stanford, CA \(D12/)).toBeTruthy();
  });

  it('flags an over-ocean leg as a required flight with its fare', () => {
    render(
      <ShowInsights travel={leg({ mandatoryFlight: true, coinCost: 1563, closest: false })} />
    );
    expect(screen.getByText('1563 CC flight')).toBeTruthy();
    expect(screen.queryByText('Closest')).toBeNull();
  });

  it('names rivals on the bill, once per corps', () => {
    render(
      <ShowInsights
        rivals={[
          rival(),
          rival({ versusClass: 'openClass' }),
          rival({ uid: 'r2', corpsName: 'Fog City' }),
        ]}
      />
    );
    expect(screen.getByText('2 rivals attending')).toBeTruthy();
    expect(screen.getByText('Altitude, Fog City')).toBeTruthy();
  });
});
