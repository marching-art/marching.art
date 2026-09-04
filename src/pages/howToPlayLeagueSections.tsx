// GAME GUIDE — LEAGUE SECTIONS (/how-to-play, signed in). The Leagues and Caption Wars section
// bodies, split out of howToPlaySections.jsx to keep that file under its size
// cap. Ordering + icons live in HowToPlay.jsx's SECTIONS list. Every fact here
// comes from howToPlayData.js, which mirrors the server constants, so the guide
// cannot promise a rule or a payout the game does not honour.

import React from 'react';
import { Users, Swords, Moon } from 'lucide-react';
import { SectionHead, NoteGrid, NoteCard, SubHead } from './howToPlayPrimitives';
import {
  LEAGUE_BASICS,
  LEAGUE_WEEK_RULES,
  LEAGUE_POSTSEASON,
  LEAGUE_CLUBHOUSE,
  LEAGUE_COMMISSIONER_TOOLS,
  STANDINGS_TIEBREAKERS,
  CAPTION_WARS_CATEGORIES,
  CAPTION_WARS_RULES,
  CAPTION_WARS_PURCHASE,
  ONE_NIGHT_RULES,
} from './howToPlayData';

const LeaguesSection = () => (
  <>
    <SectionHead icon={Users} kicker="Play with friends" title="Leagues & Leaderboards" />
    <p className="text-sm text-secondary leading-relaxed mb-4">
      Global leaderboards rank every ranked class as scores come in. A{' '}
      <strong className="text-white">league</strong> is the smaller version you actually live in: a
      roster of directors playing a head-to-head season against each other, with its own standings,
      its own Finals, and its own history that outlives every season you play in it.
    </p>

    <SubHead className="mb-2">Getting into one</SubHead>
    <NoteGrid items={LEAGUE_BASICS} />

    <SubHead>How a week is decided</SubHead>
    <NoteGrid items={LEAGUE_WEEK_RULES} />

    <SubHead>Reading the standings</SubHead>
    <p className="text-[11px] text-muted leading-relaxed mb-2">
      Members are ranked in this order, top to bottom. The table, the Finals cut line, and the
      champion selector all share it, so they can never disagree about who is first.
    </p>
    <ol className="space-y-2">
      {STANDINGS_TIEBREAKERS.map((t, i) => (
        <li key={t.rule} className="flex items-start gap-3">
          <span className="w-6 h-6 flex-shrink-0 flex items-center justify-center bg-interactive/20 text-interactive text-[11px] font-bold rounded-none">
            {i + 1}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold text-secondary">{t.rule}</p>
            <p className="text-[11px] text-muted leading-snug">{t.desc}</p>
          </div>
        </li>
      ))}
    </ol>

    <SubHead>How the season ends</SubHead>
    <NoteGrid items={LEAGUE_POSTSEASON} />

    <SubHead>The clubhouse</SubHead>
    <NoteGrid items={LEAGUE_CLUBHOUSE} />

    <SubHead>If you run the league</SubHead>
    <NoteGrid items={LEAGUE_COMMISSIONER_TOOLS} />
  </>
);

const CaptionWarsSection = () => (
  <>
    <SectionHead icon={Swords} kicker="An alternate league format" title="Caption Wars" />
    <p className="text-sm text-secondary leading-relaxed mb-4">
      A commissioner can decide their league&apos;s weeks a different way. Instead of one comparison
      of the week&apos;s total score, a matchup becomes a{' '}
      <strong className="text-white">best-of-three</strong> across the three caption groups the game
      already scores you on. Win two and you win the week, whatever the totals say. It is a scoring
      format, not a new game mode — everything else about the league is unchanged.
    </p>

    <SubHead className="mb-2">The three categories</SubHead>
    <div className="grid gap-2 sm:grid-cols-3 mb-1">
      {CAPTION_WARS_CATEGORIES.map((cat) => (
        <div key={cat.key} className="bg-surface-sunken border border-white/10 rounded-none p-3">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-bold text-white">{cat.label}</span>
            <span className="text-[11px] font-bold text-interactive">{cat.max} pts</span>
          </div>
          <p className="text-[11px] text-muted mt-1">{cat.captions}</p>
        </div>
      ))}
    </div>
    <p className="text-[11px] text-muted leading-relaxed mb-1">
      Same groups, same ceilings, same numbers as the score out of 100 you already earn — read three
      at a time instead of added up.
    </p>

    <SubHead>The rules</SubHead>
    <div className="space-y-2">
      {CAPTION_WARS_RULES.map((rule) => (
        <NoteCard key={rule.title} title={rule.title}>
          {rule.desc}
        </NoteCard>
      ))}
    </div>

    <SubHead>What it costs the commissioner</SubHead>
    <NoteGrid items={CAPTION_WARS_PURCHASE} />

    <div className="mt-6">
      <SectionHead icon={Moon} kicker="An alternate league format" title="One-Night Slate" />
    </div>
    <p className="text-sm text-secondary leading-relaxed mb-4">
      The other format on the shelf. Instead of summing every show you attend, the week comes down
      to <strong className="text-white">your best single show</strong> — one great night beats a
      week of grinding. Built for leagues whose members can&apos;t all give the game the same number
      of nights.
    </p>
    <div className="space-y-2">
      {ONE_NIGHT_RULES.map((rule) => (
        <NoteCard key={rule.title} title={rule.title}>
          {rule.desc}
        </NoteCard>
      ))}
    </div>
  </>
);

export { LeaguesSection, CaptionWarsSection };
