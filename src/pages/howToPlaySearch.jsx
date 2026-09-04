// GAME GUIDE — SEARCH (/how-to-play, signed in). Flat index across the guide's data; each
// result jumps to a section. Split out of howToPlaySections.jsx so that file
// holds only section bodies. Game facts come from howToPlayData.js /
// progressionGuide.js so search can never drift from the rendered guide.

import React from 'react';
import {
  CAPTIONS,
  CLASSES,
  GLOSSARY,
  FAQ,
  RATINGS,
  REGISTRATION_WINDOWS,
  SEASON_START_OPTIONS,
  MIDSEASON_CORPS_RULES,
  LEAGUE_BASICS,
  LEAGUE_WEEK_RULES,
  LEAGUE_POSTSEASON,
  LEAGUE_CLUBHOUSE,
  LEAGUE_COMMISSIONER_TOOLS,
  STANDINGS_TIEBREAKERS,
  CAPTION_WARS_CATEGORIES,
  CAPTION_WARS_RULES,
  CAPTION_WARS_PURCHASE,
} from './howToPlayData';
import { XP_SOURCE_GUIDE, PROGRESSION_AXES } from '../data/progressionGuide';

const SEARCH_SOURCES = [
  ...CAPTIONS.map((c) => ({
    id: 'captions',
    section: 'Captions',
    title: `${c.abbr} — ${c.name}`,
    text: c.desc,
  })),
  ...CLASSES.map((c) => ({
    id: 'classes',
    section: 'Classes',
    title: c.name,
    text: `${c.desc}. Budget: ${c.points} points. Unlock: ${c.unlock}.`,
  })),
  ...RATINGS.map((r) => ({
    id: 'classes',
    section: 'SoundSport Ratings',
    title: `${r.tier} rating`,
    text: `${r.min === 0 ? 'Any score' : `${r.min}+ points`}. ${r.blurb}`,
  })),
  ...PROGRESSION_AXES.map((a) => ({
    id: 'progression',
    section: 'Progression',
    title: a.label,
    text: a.meaning,
  })),
  ...XP_SOURCE_GUIDE.map((s) => ({
    id: 'progression',
    section: 'Earning XP',
    title: s.label,
    text: `${typeof s.xp === 'number' ? `${s.xp} XP` : s.xp}. ${s.cadence}`,
  })),
  ...SEASON_START_OPTIONS.map((o) => ({
    id: 'season',
    section: 'Season-Start Options',
    title: `${o.action} your corps`,
    text: o.desc,
  })),
  ...REGISTRATION_WINDOWS.map((w) => ({
    id: 'season',
    section: 'Registration Windows',
    title: `${w.name} registration`,
    text:
      w.lockWeeks === 0
        ? 'New corps can register all season long.'
        : `Closes to new corps ${w.lockWeeks} weeks before finals.`,
  })),
  ...MIDSEASON_CORPS_RULES.map((r) => ({
    id: 'season',
    section: 'Mid-Season Rules',
    title: r.title,
    text: r.desc,
  })),
  // Leagues. Every entry a member might go looking for mid-argument — how a
  // week is decided, what breaks a tie, who gets paid — jumps to the section
  // that says so.
  ...LEAGUE_BASICS.map((b) => ({
    id: 'leagues',
    section: 'Leagues',
    title: b.title,
    text: b.desc,
  })),
  ...LEAGUE_WEEK_RULES.map((r) => ({
    id: 'leagues',
    section: 'League Matchups',
    title: r.title,
    text: r.desc,
  })),
  ...STANDINGS_TIEBREAKERS.map((t, i) => ({
    id: 'leagues',
    section: 'Standings Tiebreakers',
    title: `${i + 1}. ${t.rule}`,
    text: t.desc,
  })),
  ...LEAGUE_POSTSEASON.map((p) => ({
    id: 'leagues',
    section: 'League Finals',
    title: p.title,
    text: p.desc,
  })),
  ...LEAGUE_CLUBHOUSE.map((c) => ({
    id: 'leagues',
    section: 'League Clubhouse',
    title: c.title,
    text: c.desc,
  })),
  ...LEAGUE_COMMISSIONER_TOOLS.map((c) => ({
    id: 'leagues',
    section: 'Commissioner Tools',
    title: c.title,
    text: c.desc,
  })),
  // Caption Wars. The categories carry the "caption wars" phrase in their text
  // so searching the format's name finds the format, not only its rules.
  ...CAPTION_WARS_CATEGORIES.map((cat) => ({
    id: 'captionWars',
    section: 'Caption Wars',
    title: `${cat.label} category`,
    text: `One of the three Caption Wars categories, worth up to ${cat.max} points a show. Built from ${cat.captions}.`,
  })),
  ...CAPTION_WARS_RULES.map((r) => ({
    id: 'captionWars',
    section: 'Caption Wars',
    title: r.title,
    text: r.desc,
  })),
  ...CAPTION_WARS_PURCHASE.map((p) => ({
    id: 'captionWars',
    section: 'Caption Wars Cost',
    title: p.title,
    text: p.desc,
  })),
  ...GLOSSARY.map((g) => ({ id: 'glossary', section: 'Glossary', title: g.term, text: g.def })),
  ...FAQ.map((f) => ({ id: 'faq', section: 'FAQ', title: f.q, text: f.a })),
];

/**
 * @param {{query: string, onNavigate: (id: string) => void}} props
 */
export const SearchResults = ({ query, onNavigate }) => {
  const q = query.toLowerCase();
  // The section label counts as part of an entry. A player searching "caption
  // wars" or "standings" wants that whole part of the guide, and the individual
  // rules under those headings — "Win two, win the week" — do not repeat the
  // name of the thing they belong to.
  const results = SEARCH_SOURCES.filter(
    (e) =>
      e.title.toLowerCase().includes(q) ||
      e.text.toLowerCase().includes(q) ||
      e.section.toLowerCase().includes(q)
  );

  if (results.length === 0) {
    return (
      <p className="text-sm text-muted text-center py-12">
        No results for &ldquo;{query}&rdquo; — try the section list instead.
      </p>
    );
  }

  return (
    <div className="space-y-2 max-w-2xl">
      {results.map((r) => (
        <button
          key={`${r.id}-${r.title}`}
          onClick={() => onNavigate(r.id)}
          className="w-full text-left bg-surface-sunken border border-white/10 rounded-none px-4 py-3 hover:bg-white/5 transition-colors"
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-interactive">
            {r.section}
          </span>
          <p className="text-sm font-bold text-white mt-0.5">{r.title}</p>
          <p className="text-xs text-muted mt-0.5 line-clamp-2">{r.text}</p>
        </button>
      ))}
    </div>
  );
};
