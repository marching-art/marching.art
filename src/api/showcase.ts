// =============================================================================
// SHOWCASE API — the monthly community-voted contest (UNIFORM_STUDIO.md §7.4)
// =============================================================================
// Everything is server-mediated: entries and ballots are server-only so the
// pairwise vote stays anonymous, and the server deals every pair — the client
// never queries the entry pool directly.

import { createCallable } from './callable';
import type { FigureConfig, UniformColorway } from '../types/uniform';

export interface ShowcaseCycle {
  monthId: string;
  phase: 'submissions' | 'voting';
  votingOpensDay: number;
  theme: { id: string; title: string; blurb: string };
}

export interface ShowcaseDesign {
  schema: 2;
  name: string;
  colorway: UniformColorway;
  figure: FigureConfig;
}

export interface ShowcaseWinner {
  rank: number;
  uid: string;
  username: string;
  designName: string;
  colors: string[] | null;
  wins: number;
  losses: number;
  design: ShowcaseDesign | null;
}

export interface ShowcaseResults {
  monthId: string;
  theme: { id: string; title: string; blurb: string };
  winners: ShowcaseWinner[];
  entryCount: number;
  finalizedAt: string;
}

export const getShowcase = createCallable<
  Record<string, never>,
  {
    cycle: ShowcaseCycle;
    entryCount: number;
    myEntry: { designName: string; submittedAt: string } | null;
    myVoteCount: number;
    lastResults: ShowcaseResults | null;
  }
>('getShowcase');

export const submitShowcaseEntry = createCallable<
  { designId: string },
  { message: string; paid: boolean }
>('submitShowcaseEntry');

export const getShowcasePair = createCallable<
  Record<string, never>,
  { monthId: string; pair: Array<{ key: 'a' | 'b'; design: ShowcaseDesign }> }
>('getShowcasePair');

export const castShowcaseVote = createCallable<
  { pick: 'a' | 'b' },
  { message: string; paid: boolean; voteCount: number }
>('castShowcaseVote');
