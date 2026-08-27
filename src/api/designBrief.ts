// =============================================================================
// DESIGN BRIEF API — the weekly styling side game (docs/UNIFORM_STUDIO.md §7.4)
// =============================================================================
// Both calls are server-mediated: the brief pool and the trait scoring live
// only in functions/src/helpers/designBrief.js, so the client can never drift
// from the scorer — it just renders what the server says.

import { createCallable } from './callable';

export interface BriefWant {
  label: string;
  points: number;
}

export interface BriefView {
  weekId: string;
  id: string;
  title: string;
  blurb: string;
  wants: BriefWant[];
}

export interface BriefEntry {
  uid?: string;
  username: string;
  designName: string;
  designId?: string;
  colors: string[] | null;
  score: number;
  submissions?: number;
  updatedAt?: string;
}

export const getDesignBrief = createCallable<
  { limit?: number },
  { brief: BriefView; myEntry: BriefEntry | null; top: BriefEntry[] }
>('getDesignBrief');

export const submitDesignBrief = createCallable<
  { designId: string },
  {
    brief: BriefView;
    score: number;
    best: number;
    matched: BriefWant[];
    missed: BriefWant[];
    paid: boolean;
    message: string;
  }
>('submitDesignBrief');
