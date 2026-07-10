// Podium Class UI constants (Phase 2). Block metadata mirrors the engine's
// balanceConfig block definitions — labels and effect summaries only; all
// yields are computed server-side.

export const PODIUM_CAPTIONS = ['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P'];

export const BLOCKS = [
  {
    id: 'warmup',
    label: 'Stretch / PT',
    detail: 'Cuts stamina cost of remaining blocks; fights grind fatigue',
    captions: [],
  },
  { id: 'visualBasics', label: 'Visual Basics', detail: 'VP focus · VA, CG', captions: ['VP'] },
  {
    id: 'visualEnsemble',
    label: 'Visual Ensemble',
    detail: 'GE2 + VA focus · VP, CG',
    captions: ['GE2', 'VA'],
  },
  {
    id: 'guardSectionals',
    label: 'Guard Sectionals',
    detail: 'CG focus · VA, GE2',
    captions: ['CG'],
  },
  {
    id: 'brassSectionals',
    label: 'Brass Sectionals',
    detail: 'B focus · GE1, MA',
    captions: ['B'],
  },
  {
    id: 'percussionSectionals',
    label: 'Percussion Sectionals',
    detail: 'Battery + front ensemble · P focus, MA',
    captions: ['P'],
  },
  {
    id: 'fullEnsemble',
    label: 'Full Ensemble',
    detail: 'GE1 + GE2 + MA focus · everything else',
    captions: ['GE1', 'GE2', 'MA'],
  },
];

export const CAPTION_LABELS = {
  GE1: 'General Effect 1',
  GE2: 'General Effect 2',
  VP: 'Visual Proficiency',
  VA: 'Visual Analysis',
  CG: 'Color Guard',
  B: 'Brass',
  MA: 'Music Analysis',
  P: 'Percussion',
};

export const CHALLENGE_PRESETS = {
  balanced: { label: 'Balanced', levels: 5 },
  safe: { label: 'Early & Clean', levels: 3 },
  ambitious: { label: 'August Book', levels: 7 },
};

export const AUDITION_PRESETS = [
  { id: 'balanced', label: 'Balanced', points: {} },
  { id: 'music', label: 'Music-forward', points: { B: 20, P: 15, MA: 15 } },
  { id: 'visual', label: 'Visual-forward', points: { VP: 20, VA: 15, CG: 15 } },
];

// Venue tiers for director-hosted events (all classes). Display copy of the
// server's balanceConfig.hostedEvents — pricing/validation are authoritative
// server-side in the hostEvent callable.
export const VENUE_TIERS = [
  {
    id: 'highSchool',
    label: 'High School Stadium',
    rentalCC: 200,
    capacity: 15,
    payoutPerCorpsCC: 20,
  },
  { id: 'collegeBowl', label: 'College Bowl', rentalCC: 500, capacity: 30, payoutPerCorpsCC: 25 },
  { id: 'nflStadium', label: 'NFL Stadium', rentalCC: 1000, capacity: 60, payoutPerCorpsCC: 30 },
];

export const HOSTING_RULES = {
  minDaysAhead: 2,
  lastHostableDay: 44,
  majorDays: [28, 35, 41, 42],
  nameMin: 3,
  nameMax: 60,
};

// Podium Rookie Journey — client mirror of PODIUM_JOURNEY_STEPS in
// functions/src/helpers/journey.js (ids/rewards must stay in sync; the
// server verifies and pays).
export const PODIUM_JOURNEY = [
  {
    id: 'podium_found',
    title: 'Found a Corps',
    detail: 'Name, challenge, hometown',
    xp: 50,
    coin: 50,
  },
  {
    id: 'podium_rehearse',
    title: 'First Blocks',
    detail: 'Allocate a rehearsal block',
    xp: 50,
    coin: 25,
  },
  {
    id: 'podium_template',
    title: 'Hire the Assistant',
    detail: 'Save a plan template',
    xp: 50,
    coin: 25,
  },
  { id: 'podium_tour', title: 'Route the Tour', detail: 'Pick your first shows', xp: 50, coin: 25 },
  {
    id: 'podium_score',
    title: 'First Box Score',
    detail: 'Perform and read your recap',
    xp: 75,
    coin: 50,
  },
  {
    id: 'podium_joint',
    title: 'Shake Hands',
    detail: 'Complete a joint rehearsal',
    xp: 75,
    coin: 50,
  },
  {
    id: 'podium_season',
    title: 'Survive the Grind',
    detail: 'Finish a full season',
    xp: 100,
    coin: 100,
  },
];

export const REP_TIER_NAMES = {
  1: 'Community Corps',
  2: 'Regional Contender',
  3: 'National Contender',
  4: 'Finalist',
  5: 'Medalist',
  6: 'Elite',
  7: 'Champion Status',
};
