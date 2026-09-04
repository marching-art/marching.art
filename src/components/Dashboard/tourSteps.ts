// =============================================================================
// ONBOARDING TOUR — the steps, per device
// =============================================================================
// Two explicit lists rather than one list with device flags, because the two
// tours genuinely differ: they visit different things, in a different order,
// for different reasons.
//
// Desktop shows all four zones at once, so its tour is a guided read of a
// layout already on screen.
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
  | 'sparkles'
  | 'target'
  | 'music'
  | 'layers'
  | 'compass'
  | 'trophy'
  | 'calendar'
  | 'users'
  | 'heart';

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

// No generic welcome card on desktop: the tour fires right after the signup
// celebration already said welcome, so it opens straight on the first thing
// worth pointing at. Mobile keeps its card because it sets up the four-stop
// structure; Podium's names the founded corps.
export const DESKTOP_TOUR_STEPS: TourStep[] = [
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

// =============================================================================
// PODIUM TOUR — the director-sim daily loop
// =============================================================================
// Podium is a different game from the fantasy classes: no drafted lineup, so
// none of the fantasy steps above apply (they point at a caption table that
// isn't there). This tour runs once, right after a director founds their corps
// and the daily-loop panels first render, and teaches the four surfaces the
// game actually loops on: the rehearsal blocks you spend each day, the caption
// book they build and clean, the corps condition that gates every yield, and
// the season-long climb those results add up to.
//
// One list serves both devices: PodiumZone renders the same single column of
// panels on desktop (the left 2/3) and mobile (the My Corps zone), so unlike
// the fantasy tour there is no separate reading order to teach. On mobile those
// panels live in the `corps` zone, so the panel steps name it — the dashboard
// switches there before the step runs (same mechanism as the fantasy mobile
// tour). Desktop ignores the zone hint.
export const PODIUM_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Your corps is founded',
    description:
      "Podium is a director sim, not a draft — you earn every point by how you run the corps. Four quick stops and you'll know the daily loop. Skip any time.",
    icon: 'sparkles',
    target: null,
    position: 'center',
  },
  {
    id: 'podium-rehearsal',
    title: 'Rehearsal is the game',
    description:
      'Every day you get a set of rehearsal blocks. Spend them here — each block installs new show early in the season and cleans it late. This is the one thing to do each day.',
    icon: 'target',
    target: '[data-tour="podium-rehearsal"]',
    position: 'bottom',
    zone: 'corps',
  },
  {
    id: 'podium-captions',
    title: 'Your eight captions',
    description:
      'Each caption grows from the blocks you spend on it — how much show is installed and how clean it is. Ignore one and it starts to decay. This is where your score comes from.',
    icon: 'music',
    target: '[data-tour="podium-captions"]',
    position: 'bottom',
    zone: 'corps',
  },
  {
    id: 'podium-condition',
    title: 'Mind your condition',
    description:
      'Rehearsal costs stamina; grinding at full tilt drains morale. Rest days, nights, and your food plan recover it. Low condition cuts every yield — a tired corps rehearses worse.',
    icon: 'heart',
    target: '[data-tour="podium-condition"]',
    position: 'top',
    zone: 'corps',
  },
  {
    id: 'podium-trajectory',
    title: 'The climb',
    description:
      'Your results, season over season, build reputation and move you between classes. Champion Status takes years — this panel tracks where you stand on the way up.',
    icon: 'trophy',
    target: '[data-tour="podium-trajectory"]',
    position: 'top',
    zone: 'corps',
  },
];

/**
 * The step list for a given tour variant and device.
 *
 * Fantasy splits by device (the desktop grid and the mobile tab bar are
 * genuinely different layouts to teach). Podium does not — its zone is one
 * column either way — so both devices get the same list.
 */
export function getTourSteps(variant: 'fantasy' | 'podium', isMobile: boolean): TourStep[] {
  if (variant === 'podium') return PODIUM_TOUR_STEPS;
  return isMobile ? MOBILE_TOUR_STEPS : DESKTOP_TOUR_STEPS;
}
