// =============================================================================
// SCHEDULE PAGE CONSTANTS
// =============================================================================
// Extracted verbatim from Schedule.jsx. Kept in a plain .js module so the
// component files export only components (react-refresh rule).

export const CLASS_CONFIG = {
  worldClass: {
    name: 'World',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  openClass: {
    name: 'Open',
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/30',
  },
  aClass: {
    name: 'A Class',
    color: 'text-interactive',
    bgColor: 'bg-interactive/10',
    borderColor: 'border-interactive/30',
  },
  soundSport: {
    name: 'SS',
    color: 'text-green-500',
    bgColor: 'bg-green-500/10',
    borderColor: 'border-green-500/30',
  },
  podiumClass: {
    name: 'Podium',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
  },
};

// Championship Week (Week 7) event configuration lives with the other fixed
// event names (utils/eventNames.ts) so the dashboard can render the same
// hard-coded names; re-exported here for the schedule page's callers.
export { CHAMPIONSHIP_EVENTS } from '../utils/eventNames';
