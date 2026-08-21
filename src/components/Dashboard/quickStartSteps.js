// =============================================================================
// QUICK START STEPS — one list per game
// =============================================================================
// The Quick Start guide serves two games. Fantasy walks the drafted-lineup loop
// (build a lineup, register for shows, check scores); Podium walks the
// director-sim daily loop (rehearse, compete, set the assistant plan) because
// it has no lineup and no caption budget. Kept out of QuickStartGuide.jsx so the
// component file exports only components (react-refresh) and so both the guide
// and its tests read the same source — the same split tourSteps.ts uses.
//
// The fantasy rule numbers come from the same constants the game enforces
// (WEEKLY_TRADE_LIMIT, getMaxShowsForWeek) so the guide can't drift out of sync
// with actual gameplay.

import { Calendar, Music, Trophy, Target, ClipboardList } from 'lucide-react';
import { WEEKLY_TRADE_LIMIT, CHAMPIONSHIP_TRADE_LIMIT } from '../../utils/seasonClock';
import { getMaxShowsForWeek } from '../../utils/captionPricing';

const REGULAR_WEEK_SHOWS = getMaxShowsForWeek(1);
const FINAL_WEEK_SHOWS = getMaxShowsForWeek(7);

export const QUICK_START_STEPS = [
  {
    id: 'lineup',
    title: 'Build Your Lineup',
    description:
      'Pick historical corps performances for each of the 8 scoring captions. Stay within your draft budget!',
    icon: Music,
    color: 'blue',
    action: { label: 'Edit Lineup', target: 'lineup' },
    tips: [
      'Each caption needs one corps selection',
      'Stronger corps cost more of your budget',
      `Changes are unlimited through Day 14, then limited to ${WEEKLY_TRADE_LIMIT} per week (${CHAMPIONSHIP_TRADE_LIMIT} per day during Championship Week)`,
    ],
  },
  {
    id: 'schedule',
    title: 'Register for Shows',
    description: `Sign up for shows each week to earn scores. You can register for up to ${REGULAR_WEEK_SHOWS} shows per week (${FINAL_WEEK_SHOWS} in Championship Week — championship events are auto-enrolled).`,
    icon: Calendar,
    color: 'purple',
    action: { label: 'View Schedule', target: '/schedule' },
    tips: [
      'Weekend shows often have more participants',
      'Register early to secure your spots',
      'Scores are based on real DCI results',
    ],
  },
  {
    id: 'scores',
    title: 'Check Your Scores',
    description:
      'After shows complete, check how your lineup performed. See detailed breakdowns by caption.',
    icon: Trophy,
    color: 'green',
    action: { label: 'View Scores', target: '/scores' },
    tips: [
      'Scores are calculated from real DCI data',
      'Track your season total over time',
      'Compare your scores with others',
    ],
  },
];

// Podium is a different game — no drafted lineup, no caption budget. Its quick
// start walks the director-sim daily loop instead. The three step ids are the
// completion signals pages/Dashboard derives from podium state
// (rehearsed / registered / plan saved). Action targets that aren't routes
// (podium-planner, podium-plan-editor) scroll to the panel behind the guide via
// the parent's onAction handler; '/schedule' is a plain route link.
export const PODIUM_QUICK_START_STEPS = [
  {
    id: 'rehearse',
    title: 'Rehearse Every Day',
    description:
      "Spend your daily rehearsal blocks to install and clean your show. This is the core of Podium — unspent blocks are growth you don't get back.",
    icon: Target,
    color: 'blue',
    action: { label: 'Open Planner', target: 'podium-planner' },
    tips: [
      'Each block installs new material early in the season and cleans it late',
      'Hammering one block type all day pays less after the first few reps',
      'A caption you ignore starts to decay — spread your attention',
    ],
  },
  {
    id: 'shows',
    title: 'Register for Shows',
    description:
      'Pick your competition nights from the shared schedule. A corps that never takes the field never scores — the three majors and Championship Week auto-enroll.',
    icon: Calendar,
    color: 'purple',
    action: { label: 'View Schedule', target: '/schedule' },
    tips: [
      'Up to 4 shows a week (3 on major weeks, 2 on finals-week open days)',
      'Travel costs Corps Budget and stamina — route from your home city',
      "Majors and Championship Week are automatic — you don't register those",
    ],
  },
  {
    id: 'plan',
    title: 'Set an Assistant Plan',
    description:
      "Save a rehearsal plan and your assistant director runs it on any day you can't log in — at reduced yield, but never a wrecked season.",
    icon: ClipboardList,
    color: 'green',
    action: { label: 'Set a Plan', target: 'podium-plan-editor' },
    tips: [
      'Without a plan, a day you miss is lost growth entirely',
      'Playing yourself always beats the assistant — but it never sleeps',
      'Update the plan any time as your show priorities shift',
    ],
  },
];
