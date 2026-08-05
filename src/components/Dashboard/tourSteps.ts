// =============================================================================
// ONBOARDING TOUR — the steps, per device
// =============================================================================
// Two explicit lists rather than one list with device flags, because the two
// tours genuinely differ: they visit different things, in a different order,
// for different reasons.
//
// Desktop shows all four zones at once, so its tour is a guided read of a
// layout already on screen — that list is unchanged.
//
// Mobile has no such layout to read. It has a hero that names the next move,
// a scorecard, and three tabbed sections, so its tour teaches the *controls*:
// where the answer to "what now" lives, what a lineup is, that there are two
// more sections behind the tabs, and that the lineup is always one tap away on
// the nav. It also runs in the order a phone actually scrolls, instead of the
// desktop reading order, which used to send the tour jumping down three
// screens and back up.
//
// A step may name the mobile zone its target lives in; the dashboard switches
// to that zone before the step runs, or the tour would point at a hidden
// element (utils/dashboardZones).

import type { DashboardZoneId } from '../../utils/dashboardZones';

export type TourIcon =
  'sparkles' | 'target' | 'music' | 'layers' | 'compass' | 'trophy' | 'calendar' | 'users';

export interface TourStep {
  id: string;
  title: string;
  description: string;
  icon: TourIcon;
  /** CSS selector for the element to highlight, or null for a plain card. */
  target: string | null;
  /** Desktop tooltip placement. Mobile ignores it — the card is docked. */
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** Mobile zone that must be showing for `target` to exist. */
  zone?: DashboardZoneId;
}

export const DESKTOP_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Your Dashboard!',
    description: "This is your command center. Let's take a quick tour of the key features.",
    icon: 'sparkles',
    target: null,
    position: 'center',
  },
  {
    id: 'control-bar',
    title: 'Corps Command Bar',
    description:
      'Switch between your corps and competition classes here, and keep an eye on your CorpsCoin and XP as you play.',
    icon: 'users',
    target: '[data-tour="control-bar"]',
    position: 'bottom',
  },
  {
    id: 'lineup',
    title: 'Your Active Lineup',
    description:
      'These are your eight caption picks. Tap any caption row (or Manage) to change a selection — your score comes from how these corps perform.',
    icon: 'music',
    target: '[data-tour="lineup"]',
    position: 'bottom',
  },
  {
    id: 'recent-results',
    title: 'Recent Results',
    description:
      'After each show is scored, your results land here so you can see how your lineup performed night to night.',
    icon: 'calendar',
    target: '[data-tour="recent-results"]',
    position: 'top',
  },
  {
    id: 'scorecard',
    title: 'Season Scorecard',
    description:
      'Track your season score and rank here. Daily challenges and rivals live in this sidebar too — check back every day!',
    icon: 'trophy',
    target: '[data-tour="scorecard"]',
    position: 'left',
  },
];

export const MOBILE_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to your dashboard',
    description:
      "Four quick stops and you'll know where everything lives. You can skip at any time.",
    icon: 'sparkles',
    target: null,
    position: 'center',
  },
  {
    id: 'next-action',
    title: 'Start here, always',
    description:
      "Next Up names the single most useful thing you can do right now, and the button does it. When you're not sure what to do, this is the answer.",
    icon: 'target',
    target: '[data-tour="next-action"]',
    position: 'bottom',
  },
  {
    id: 'lineup',
    title: 'Your lineup is the game',
    description:
      'Eight caption slots, each filled with a historical corps. Their performances become your score — so an empty slot scores nothing. Tap any row to change a pick.',
    icon: 'music',
    target: '[data-tour="lineup"]',
    position: 'bottom',
    zone: 'corps',
  },
  {
    id: 'zone-tabs',
    title: 'Two more sections',
    description:
      "Today holds your daily challenges and rewards. Season holds your rivals, your progress, and how last night's shows went.",
    icon: 'layers',
    target: '[data-tour="zone-tabs"]',
    position: 'bottom',
  },
  {
    id: 'bottom-nav',
    title: 'Everything is one tap away',
    description:
      'Lineup opens the editor from anywhere. A dot means that tab needs your attention.',
    icon: 'compass',
    target: '[data-tour="bottom-nav"]',
    position: 'top',
  },
];
