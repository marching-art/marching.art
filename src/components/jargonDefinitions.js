// src/components/jargonDefinitions.js
// Central dictionary of insider terms and their plain-English definitions.
// Kept out of JargonTooltip.jsx so that file only exports components, which
// keeps Vite's fast refresh working (react-refresh/only-export-components).

export const JARGON_DEFINITIONS = {
  director: {
    term: 'Director',
    definition:
      'You! The manager of your fantasy corps. You draft performers and compete against other directors.',
  },
  caption: {
    term: 'Caption',
    definition:
      'A scoring category, like a position in fantasy football. There are 8 captions: GE1, GE2, Visual Proficiency, Visual Analysis, Color Guard, Brass, Music Analysis, and Percussion.',
  },
  corps: {
    term: 'Corps',
    definition:
      'Short for "drum and bugle corps" — elite marching ensembles that compete in DCI. Think marching band, but at the highest competitive level.',
  },
  ge: {
    term: 'GE (General Effect)',
    definition:
      'How the performance feels emotionally. GE judges score the overall impact, entertainment value, and artistic merit of a show.',
  },
  dci: {
    term: 'DCI',
    definition:
      'Drum Corps International — the governing body and competition circuit for elite drum and bugle corps in North America.',
  },
  fantasyDivision: {
    term: 'Fantasy Division',
    definition:
      'The core fantasy game, where you draft an 8-caption lineup under a point cap. It has four classes — SoundSport, A, Open, and World — and SoundSport is Fantasy Division only.',
  },
  podiumDivision: {
    term: 'Podium Division',
    definition:
      'The director-simulation game, where you run a corps season and climb the A → Open → World classes on results. Its own scoring pass, separate from the Fantasy Division.',
  },
  worldClass: {
    term: 'World Class',
    definition:
      'The top competitive class, in both the Fantasy Division and DCI. Corps like Blue Devils, Carolina Crown, and Bluecoats compete here.',
  },
  openClass: {
    term: 'Open Class',
    definition:
      'The second-tier competitive class, in both the Fantasy Division and DCI. Smaller corps building toward World Class compete here.',
  },
  aClass: {
    term: 'A Class',
    definition:
      'A mid-tier class between SoundSport and Open Class, with a larger budget than SoundSport. Unlocked as you level up.',
  },
  soundsport: {
    term: 'SoundSport',
    definition:
      'The entry-level class in the Fantasy Division. New directors start here with a 90-point budget before leveling up. SoundSport is Fantasy Division only.',
  },
  xp: {
    term: 'XP',
    definition:
      'Experience points earned by playing. Gain XP to level up and unlock higher classes with bigger budgets.',
  },
  corpscoin: {
    term: 'CorpsCoin',
    definition:
      'In-game currency earned through achievements. Use it to unlock special features and customizations.',
  },
};
