// =============================================================================
// PODIUM CLASS CALLABLES (Phase 2)
// =============================================================================
// Typed wrappers for the Podium Class Cloud Functions. All server-validated;
// gated on game-settings/features.podiumClass.

import { createCallable } from './callable';

export interface PodiumRegistration {
  corpsName: string;
  location?: string;
  showConcept?: string;
  challenge: Record<string, number>; // 8 captions, 1-8
  auditions?: Record<string, number> | null; // points per caption, pool 100
}

export interface PodiumBlockResult {
  success: boolean;
  panel: {
    blockType: string;
    day: number;
    gains: Record<string, { content: number; clean: number }>;
    staminaCost: number;
    repeatMult: number;
  };
  today: {
    calendarDay: number;
    blocksUsed: number;
    blocks: string[];
    restDay: boolean;
    warmupUsed: boolean;
  };
  condition: { stamina: number; morale: number };
  blocksRemaining: number;
}

export interface PodiumRouteLeg {
  day: number;
  city: string;
  tier: string | null;
  miles: number | null;
  coinCost: number;
  staminaCost: number;
  heat: number;
  isMajor: boolean;
}

export interface PodiumStateResponse {
  exists: boolean;
  calendarDay: number;
  competitionDay: number;
  isShowDay?: boolean;
  autoDays?: number[];
  routePreview?: PodiumRouteLeg[];
  state?: Record<string, unknown>;
}

export const registerPodiumCorps = createCallable<
  PodiumRegistration,
  { success: boolean; corpsName: string; easternNight: number }
>('registerPodiumCorps');

export const allocateRehearsalBlock = createCallable<
  { blockType: string; blockIndex?: number },
  PodiumBlockResult
>('allocateRehearsalBlock');

export const setPodiumRestDay = createCallable<void, { success: boolean }>('setPodiumRestDay');

export const setPodiumShows = createCallable<
  { week: number; days: number[] },
  { success: boolean; selectedShowDays: number[] }
>('setPodiumShows');

export const getPodiumState = createCallable<void, PodiumStateResponse>('getPodiumState');

export const setPodiumFoodPlan = createCallable<
  { tier: string },
  { success: boolean; tier: string }
>('setPodiumFoodPlan');

export const setPodiumPlanTemplate = createCallable<
  { blocks: string[] },
  { success: boolean; planTemplate: string[] }
>('setPodiumPlanTemplate');
