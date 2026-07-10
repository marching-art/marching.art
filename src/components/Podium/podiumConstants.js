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

export const REP_TIER_NAMES = {
  1: 'Community Corps',
  2: 'Regional Contender',
  3: 'National Contender',
  4: 'Finalist',
  5: 'Medalist',
  6: 'Elite',
  7: 'Champion Status',
};
