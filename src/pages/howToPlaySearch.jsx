// @ts-nocheck -- grandfathered before checkJs; remove when this file is typed or cleaned up
// GAME GUIDE — SEARCH (/guide). Flat index across the guide's data; each
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
  ...GLOSSARY.map((g) => ({ id: 'glossary', section: 'Glossary', title: g.term, text: g.def })),
  ...FAQ.map((f) => ({ id: 'faq', section: 'FAQ', title: f.q, text: f.a })),
];

export const SearchResults = ({ query, onNavigate }) => {
  const q = query.toLowerCase();
  const results = SEARCH_SOURCES.filter(
    (e) => e.title.toLowerCase().includes(q) || e.text.toLowerCase().includes(q)
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
