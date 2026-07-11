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
    color: 'text-[#0057B8]',
    bgColor: 'bg-[#0057B8]/10',
    borderColor: 'border-[#0057B8]/30',
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

// Championship Week (Week 7) event configuration.
// isChampionship marks these as auto-enrolled anchor events (the Podium corps
// auto-attends its division's championship days); the SoundSport festival is
// still isChampionship but soundSport-only, so Podium never auto-attends it.
export const CHAMPIONSHIP_EVENTS = [
  {
    day: 45,
    eventName: 'Open and A Class Prelims',
    location: 'Marion, IN',
    eligibleClasses: ['openClass', 'aClass'],
    isChampionship: true,
    description: 'All Open and A Class corps compete',
  },
  {
    day: 46,
    eventName: 'Open and A Class Finals',
    location: 'Marion, IN',
    eligibleClasses: ['openClass', 'aClass'],
    isChampionship: true,
    description: 'Top 8 Open Class, Top 4 A Class advance',
  },
  {
    day: 47,
    eventName: 'marching.art World Championship Prelims',
    location: 'Indianapolis, IN',
    eligibleClasses: ['worldClass', 'openClass', 'aClass'],
    isChampionship: true,
    description: 'All World, Open, and A Class corps compete',
  },
  {
    day: 48,
    eventName: 'marching.art World Championship Semifinals',
    location: 'Indianapolis, IN',
    eligibleClasses: ['worldClass', 'openClass', 'aClass'],
    isChampionship: true,
    description: 'Top 25 from Prelims advance',
  },
  {
    day: 49,
    eventName: 'marching.art World Championship Finals',
    location: 'Indianapolis, IN',
    eligibleClasses: ['worldClass', 'openClass', 'aClass'],
    isChampionship: true,
    description: 'Top 12 from Semifinals compete for title',
  },
  {
    day: 49,
    eventName: 'SoundSport International Music & Food Festival',
    location: 'Indianapolis, IN',
    eligibleClasses: ['soundSport'],
    isChampionship: true,
    description: 'All SoundSport corps compete',
  },
];
