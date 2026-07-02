// =============================================================================
// GAME GUIDE DATA - SHARED BY /guide (in-app) AND /how-to-play (public)
// =============================================================================
// Kept in its own module (not exported from a component file) so game facts
// stay in one place without breaking React fast refresh.

export const CAPTIONS = [
  { abbr: 'GE1', name: 'General Effect 1', desc: 'Overall show design and creativity' },
  { abbr: 'GE2', name: 'General Effect 2', desc: 'Performance quality and audience impact' },
  { abbr: 'VP', name: 'Visual Proficiency', desc: 'Marching and movement execution' },
  { abbr: 'VA', name: 'Visual Analysis', desc: 'Visual design and staging' },
  { abbr: 'CG', name: 'Color Guard', desc: 'Flag, rifle, and saber performance' },
  { abbr: 'B', name: 'Brass', desc: 'Horn line performance quality' },
  { abbr: 'MA', name: 'Music Analysis', desc: 'Musical arrangement and design' },
  { abbr: 'P', name: 'Percussion', desc: 'Battery and front ensemble' },
];

export const CLASSES = [
  {
    id: 'soundSport',
    name: 'SoundSport',
    points: 90,
    unlock: 'Default',
    color: 'green',
    desc: 'Entry level - perfect for learning',
  },
  {
    id: 'aClass',
    name: 'A Class',
    points: 60,
    unlock: 'Level 3',
    color: 'blue',
    desc: 'Tighter budget, strategic drafting',
  },
  {
    id: 'openClass',
    name: 'Open Class',
    points: 120,
    unlock: 'Level 5',
    color: 'purple',
    desc: 'Expanded options, more competition',
  },
  {
    id: 'worldClass',
    name: 'World Class',
    points: 150,
    unlock: 'Level 10',
    color: 'yellow',
    desc: 'Elite competition, maximum flexibility',
  },
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
    a: 'Your corps score is the sum of your 8 caption scores. Each caption score comes from the historical (or live) performance of the corps you selected for that caption.',
  },
  {
    q: 'Can I change my lineup?',
    a: 'Yes! Early in the season you have unlimited changes. As finals approach, changes become limited (3/week mid-season, 2 per round during finals).',
  },
  {
    q: 'What happens when a season ends?',
    a: 'Leaderboards reset and a new season begins. Your XP, level, unlocked classes, and CorpsCoin carry over.',
  },
  {
    q: 'How do I unlock higher classes?',
    a: 'Reach the required level (3/5/10) OR spend CorpsCoin to unlock early. Classes remain unlocked permanently.',
  },
  {
    q: 'Can I compete in multiple classes?',
    a: 'Yes! You can have a separate corps in each unlocked class, each with its own lineup and rankings.',
  },
];
