// =============================================================================
// GAME GUIDE DATA - SHARED BY /guide (in-app) AND /how-to-play (public)
// =============================================================================
// Kept in its own module (not exported from a component file) so game facts
// stay in one place without breaking React fast refresh.

import { CAPTIONS as CAPTION_DEFS } from '../data/captions';

// The guide labels each caption by id + full name (from the canonical source)
// with its own longer explanatory copy.
const GUIDE_CAPTION_DESCRIPTIONS = {
  GE1: 'Overall show design and creativity',
  GE2: 'Performance quality and audience impact',
  VP: 'Marching and movement execution',
  VA: 'Visual design and staging',
  CG: 'Flag, rifle, and saber performance',
  B: 'Horn line performance quality',
  MA: 'Musical arrangement and design',
  P: 'Battery and front ensemble',
};

export const CAPTIONS = CAPTION_DEFS.map((c) => ({
  abbr: c.id,
  name: c.fullName,
  desc: GUIDE_CAPTION_DESCRIPTIONS[c.id],
}));

export const CLASSES = [
  {
    id: 'soundSport',
    name: 'SoundSport',
    points: 90,
    unlock: 'Default',
    color: 'green',
    desc: 'Entry level - earns medal ratings, never a rank',
  },
  {
    id: 'aClass',
    name: 'A Class',
    points: 60,
    unlock: '1 season or Level 3',
    color: 'blue',
    desc: 'Tighter budget, strategic drafting',
  },
  {
    id: 'openClass',
    name: 'Open Class',
    points: 120,
    unlock: '2 seasons or Level 5',
    color: 'purple',
    desc: 'Expanded options, more competition',
  },
  {
    id: 'worldClass',
    name: 'World Class',
    points: 150,
    unlock: '3 seasons or Level 10',
    color: 'yellow',
    desc: 'Elite competition, maximum flexibility',
  },
];

// SoundSport is scored out of 100 and earns a medal RATING instead of a rank.
// The tier boundaries are canonical in src/utils/scoresUtils.ts
// getSoundSportRating (Gold >= 85 / Silver >= 75 / Bronze >= 65) — mirror them
// here so the guide can never drift from the score the game actually awards.
export const RATINGS = [
  {
    tier: 'Gold',
    min: 85,
    color: 'yellow',
    blurb: 'An outstanding run — top marks across the board.',
  },
  { tier: 'Silver', min: 75, color: 'gray', blurb: 'A strong, polished performance.' },
  { tier: 'Bronze', min: 65, color: 'orange', blurb: 'A solid showing that meets the standard.' },
  {
    tier: 'Participation',
    min: 0,
    color: 'white',
    blurb: 'Every corps that competes is recognized.',
  },
];

// How a nightly corps score is built — mirrors the engine in
// functions/src/helpers/scoring.js (each caption capped at 20; GE at full
// weight, Visual and Music summed then halved; total capped at 100).
export const SCORING_MODEL = [
  { group: 'General Effect', captions: 'GE1 + GE2', max: 40, note: 'Counts at full value' },
  { group: 'Visual', captions: 'VP + VA + CG', max: 30, note: 'Summed, then halved' },
  { group: 'Music', captions: 'B + MA + P', max: 30, note: 'Summed, then halved' },
];

// The player journey, in order — the spine of the guide's Overview section.
export const JOURNEY = [
  {
    n: 1,
    title: 'Start free in SoundSport',
    desc: 'Every director begins here: a 90-point budget and low-pressure medal ratings.',
  },
  {
    n: 2,
    title: 'Draft & compete',
    desc: 'Pick 8 caption performances, register for shows, and earn a nightly score out of 100.',
  },
  {
    n: 3,
    title: 'Unlock the ranked classes',
    desc: 'Complete seasons, hit level milestones, or spend CorpsCoin to open A, Open, and World.',
  },
  {
    n: 4,
    title: 'Build a legacy',
    desc: 'Climb from Rookie to Eternal, take finals medals, and fill your Trophy Case for good.',
  },
];

// Podium reputation ladder — names are canonical in
// src/components/Podium/podiumConstants.js REP_TIER_NAMES.
export const REP_TIERS = [
  'Community Corps',
  'Regional Contender',
  'National Contender',
  'Finalist',
  'Medalist',
  'Elite',
  'Champion Status',
];

export const GLOSSARY = [
  {
    term: 'DCI',
    def: 'Drum Corps International - the governing body for competitive drum corps in North America',
  },
  {
    term: 'Caption',
    def: 'A scoring category (GE, Visual, Music, etc.) - judges score each caption separately',
  },
  {
    term: 'General Effect',
    def: 'How the overall show impacts the audience emotionally and artistically',
  },
  { term: 'Visual', def: 'Marching, staging, and choreography quality' },
  { term: 'Color Guard', def: 'The flag, rifle, and saber performers who add visual artistry' },
  {
    term: 'Finals',
    def: 'Championship competition held in August - the culmination of the DCI season',
  },
  { term: 'World Class', def: 'The top competitive tier in real DCI (and our game!)' },
  { term: 'Open Class', def: 'Developing corps working toward World Class' },
];

export const FAQ = [
  {
    q: 'How are scores calculated?',
    a: 'Each night your corps earns a score out of 100, using the same 40/30/30 split real DCI does. Your two General Effect captions (GE1, GE2) count at full value, up to 40 points. Your three Visual captions (VP, VA, CG) are added together and halved into a 30-point block, and your three Music captions (B, MA, P) the same. Every caption is capped, and the total can never exceed 100. Scores come straight from the historical (or live) performances you drafted — no purchase, streak, or show concept can change them.',
  },
  {
    q: 'What score do I need for a Gold rating?',
    a: 'SoundSport earns a medal rating instead of a rank: Gold at 85 and above, Silver at 75, Bronze at 65, and Participation for every corps that competes. Because SoundSport is scored out of 100 like every class, a clean, well-drafted lineup is what pushes you into the medals.',
  },
  {
    q: 'Can I change my lineup?',
    a: 'Yes! Caption changes are unlimited for the first two weeks, through Day 14 at 8:00 PM ET. From Week 3 on you get 3 changes per week per class — use them one at a time or all at once. Changes always lock from Saturday 8:00 PM ET until scores are processed (9:00 PM ET in the off-season — a one-hour lock — or around 2:00 AM ET in live season). No changes are allowed on Days 43-44. During Championship Week (Days 45-49) each competing class gets 2 changes per day, resetting nightly at 8:00 PM ET — only Open and A Class compete on Days 45-46, all classes on Day 47, and World Class and SoundSport in the Days 48-49 Finals. That works out to the same 6 total changes for every class across the days it is guaranteed to compete, so it stays fair even if an Open or A Class corps advances to Finals.',
  },
  {
    q: 'What happens when a season ends?',
    a: 'Leaderboards reset and a new season begins. Your XP, level, unlocked classes, and CorpsCoin carry over.',
  },
  {
    q: 'How do I unlock higher classes?',
    a: 'Three ways, any one is enough: complete seasons (1 season unlocks A Class, 2 unlock Open, 3 unlock World — a season counts when you competed in at least one show), reach the required level early (3/5/10), or spend CorpsCoin (1,000/2,500/5,000 CC) to skip ahead. Classes remain unlocked permanently.',
  },
  {
    q: 'Why do some Level 1 directors have multiple classes?',
    a: 'Classes and levels are separate tracks. A class unlocks by seasons completed, by level, or by CorpsCoin — so a director can hold several classes while still climbing levels. Level is pure XP.',
  },
  {
    q: 'Can I compete in multiple classes?',
    a: 'Yes! You can have a separate corps in each unlocked class, each with its own lineup and rankings.',
  },
];
