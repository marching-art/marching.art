// LeagueFinalsBracket - the Finals field, drawn.
//
// The standings table has always drawn a playoff cut line, and `finalsSize` has
// always been stored, but nothing anywhere showed who had actually qualified or
// what qualifying meant. The line pointed at nothing.
//
// It now points here. The backend seeds the finals field from the regular-season
// standings and championship week decides the title among it
// (functions/src/helpers/leagueChampion.js), so this renders exactly that: the
// seeds, who is in, who is on the bubble, and — once the season is archived —
// who won and how.

import React from 'react';
import { Award, Crown, Trophy, Minus } from 'lucide-react';

import { CORPS_CLASS_SHORT_LABELS } from '../../utils/corps';
import type { LeagueChampionEntry } from './LeagueHallOfFame';

export interface FinalsSeed {
  uid: string;
  rank: number;
  wins: number;
  losses: number;
  ties?: number;
  totalPoints?: number;
  corpsClasses?: string[];
}

interface LeagueFinalsBracketProps {
  /** Ranked, active standings rows — already ordered by the league's rule. */
  standings: FinalsSeed[];
  finalsSize: number;
  currentWeek: number;
  /** Total weeks in a season; the last one is championship week. */
  totalWeeks?: number;
  getDisplayName: (uid: string) => string;
  viewerUid?: string;
  /** The archived champion for the season being viewed, if there is one. */
  champion?: LeagueChampionEntry | null;
}

/** How many just-missed seeds to show below the line. */
const BUBBLE_SIZE = 3;

/**
 * Smallest consolation field worth naming — matches MIN_CONSOLATION_FIELD in
 * functions/src/helpers/leagueChampion.js.
 */
const MIN_CONSOLATION_FIELD = 2;

const SeedRow = ({
  seed,
  label,
  getDisplayName,
  viewerUid,
  isChampion,
  qualified,
}: {
  seed: FinalsSeed;
  label: string;
  getDisplayName: (uid: string) => string;
  viewerUid?: string;
  isChampion: boolean;
  qualified: boolean;
}) => {
  const isViewer = seed.uid === viewerUid;
  return (
    <div
      className={`px-3 py-2 flex items-center gap-3 ${
        isChampion
          ? 'bg-brand/10'
          : isViewer
            ? 'bg-purple-500/10'
            : qualified
              ? 'bg-green-500/5'
              : ''
      }`}
    >
      <span
        className={`w-7 text-center text-[11px] font-bold font-data tabular-nums flex-shrink-0 ${
          qualified ? 'text-green-500' : 'text-muted'
        }`}
      >
        {label}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span
            className={`text-sm font-bold truncate ${isViewer ? 'text-purple-400' : 'text-white'}`}
          >
            {getDisplayName(seed.uid)}
          </span>
          {isChampion && <Crown className="w-3 h-3 text-brand flex-shrink-0" />}
        </div>
        {seed.corpsClasses && seed.corpsClasses.length > 0 && (
          <span className="text-[9px] uppercase tracking-wider text-muted">
            {seed.corpsClasses.map((c) => CORPS_CLASS_SHORT_LABELS[c] || c).join(' · ')}
          </span>
        )}
      </div>

      <span className="text-[11px] font-data tabular-nums text-muted flex-shrink-0">
        {seed.wins}-{seed.losses}
        {seed.ties ? `-${seed.ties}` : ''}
      </span>
    </div>
  );
};

const LeagueFinalsBracket = ({
  standings,
  finalsSize,
  currentWeek,
  totalWeeks = 7,
  getDisplayName,
  viewerUid,
  champion = null,
}: LeagueFinalsBracketProps) => {
  const cut = Math.max(1, finalsSize);
  const qualifiers = standings.slice(0, cut);
  const bubble = standings.slice(cut, cut + BUBBLE_SIZE);

  // A league with fewer competing directors than finals spots has no cut to
  // draw — everyone is in, and pretending otherwise is noise.
  const everyoneQualifies = standings.length <= cut;
  const isChampionshipWeek = currentWeek >= totalWeeks;
  const weeksRemaining = Math.max(0, totalWeeks - currentWeek);

  // Everyone below the cut runs a second race on the same week. Without it a
  // league of twenty left eight directors with nothing to play for the moment
  // they were mathematically out — which is the week most of them stop showing
  // up. The bubble seeds are part of this field, not a separate group.
  const consolationField = standings.slice(cut);
  const hasConsolation = consolationField.length >= MIN_CONSOLATION_FIELD;
  const consolationWinner = champion?.consolation?.winnerId || null;

  if (standings.length === 0) return null;

  return (
    <div className="bg-surface-card border border-line">
      <div className="px-4 py-3 border-b border-line bg-surface-raised flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-green-500" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
            Finals Field
          </span>
        </div>
        <span className="text-[10px] text-muted">
          {champion
            ? 'Season complete'
            : isChampionshipWeek
              ? 'Championship week'
              : `${weeksRemaining} ${weeksRemaining === 1 ? 'week' : 'weeks'} to seed`}
        </span>
      </div>

      <div className="px-4 py-2 bg-surface-sunken border-b border-line-subtle">
        <p className="text-[10px] text-muted">
          {everyoneQualifies
            ? 'Every competing director reaches Finals. Championship week decides the title.'
            : `The top ${cut} seeds reach Finals. Championship week decides the title among them — the regular season earns the right to be there.`}
        </p>
      </div>

      <div className="divide-y divide-line-subtle">
        {qualifiers.map((seed) => (
          <SeedRow
            key={seed.uid}
            seed={seed}
            label={`#${seed.rank}`}
            getDisplayName={getDisplayName}
            viewerUid={viewerUid}
            isChampion={!!champion && champion.winnerId === seed.uid}
            qualified
          />
        ))}
      </div>

      {!everyoneQualifies && bubble.length > 0 && (
        <>
          <div className="px-4 py-1.5 bg-surface-sunken border-y border-line-subtle flex items-center gap-2">
            <Minus className="w-3 h-3 text-muted" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-muted">
              {hasConsolation ? 'Consolation — on the bubble' : 'On the bubble'}
            </span>
          </div>
          <div className="divide-y divide-line-subtle opacity-70">
            {bubble.map((seed) => (
              <SeedRow
                key={seed.uid}
                seed={seed}
                label={`#${seed.rank}`}
                getDisplayName={getDisplayName}
                viewerUid={viewerUid}
                isChampion={seed.uid === consolationWinner}
                qualified={false}
              />
            ))}
          </div>
        </>
      )}

      {!everyoneQualifies && hasConsolation && (
        <div className="px-4 py-2.5 border-t border-line bg-surface-sunken flex items-start gap-2">
          <Award className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
          <span className="text-[11px] text-muted">
            {consolationWinner ? (
              <>
                <span className="text-white font-bold">
                  {consolationWinner === viewerUid
                    ? 'You'
                    : champion?.consolation?.winnerUsername || 'Unknown'}
                </span>{' '}
                took the consolation title
                {champion?.consolation?.seed ? ` from #${champion.consolation.seed}` : ''}, best of
                the {consolationField.length} below the cut.
              </>
            ) : (
              <>
                The {consolationField.length} directors below the cut run their own race on
                championship week for the consolation title. No prize pool — the season still ends
                with something to win.
              </>
            )}
          </span>
        </div>
      )}

      {champion?.winnerId && (
        <div className="px-4 py-2.5 border-t border-line bg-brand/5 flex items-center gap-2">
          <Crown className="w-3.5 h-3.5 text-brand flex-shrink-0" />
          <span className="text-[11px] text-muted">
            <span className="text-white font-bold">
              {champion.winnerId === viewerUid ? 'You' : champion.winnerUsername || 'Unknown'}
            </span>{' '}
            {champion.decidedBy === 'finals'
              ? 'won at Finals'
              : 'took the title on the regular season'}
            {champion.seed ? ` from the #${champion.seed} seed` : ''}.
          </span>
        </div>
      )}
    </div>
  );
};

export default LeagueFinalsBracket;
