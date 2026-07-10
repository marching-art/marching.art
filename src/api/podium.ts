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
  budgetCommitment?: number; // CC -> Corps Budget, capped (decision 24)
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

export const commitPodiumBudget = createCallable<
  { amount: number },
  { success: boolean; budget: Record<string, unknown> }
>('commitPodiumBudget');

export const hirePodiumClinician = createCallable<
  { block: string },
  { success: boolean; clinician: Record<string, unknown>; budget: Record<string, unknown> }
>('hirePodiumClinician');

// Hosting is ALL-class (design §5.10): any director with a fielded corps can
// rent a venue and put a show on the season schedule. CorpsCoin economy only.
export const hostEvent = createCallable<
  { eventName: string; venueTier: string; day: number; location: string },
  { success: boolean; eventId: string; day: number; eventName: string }
>('hostEvent');

// Joint rehearsals (design §5.12): the human handshake. Proposals expire
// unanswered at the day's block allocation; accepting freezes the Full
// Ensemble bonus (repeat-pair decayed) and books the scrimmage report.
export interface JointProposal {
  id: string;
  fromUid: string;
  toUid: string;
  fromCorpsName: string | null;
  toCorpsName: string | null;
  day: number;
  status: string;
}

export interface JointScrimmageSide {
  total: number;
  captions: Record<string, number>;
}

export interface JointRehearsalsResponse {
  success: boolean;
  incoming: JointProposal[];
  outgoing: JointProposal[];
  upcoming: {
    day: number;
    partnerUid: string;
    partnerCorpsName: string | null;
    bonusMult: number;
    travelTier: string | null;
    city: string | null;
  } | null;
  scrimmage: {
    day: number;
    partnerCorpsName: string | null;
    mine: JointScrimmageSide;
    theirs: JointScrimmageSide;
  } | null;
  history: Array<{ day: number; partnerUid: string; week: number }>;
  roster: Array<{ uid: string; corpsName: string | null }>;
}

// Fan Favorite (decision 30): two-level cosmetic ballot — prelims at each
// major, finals in championship week. Any signed-in user votes.
export interface FanFavoriteCandidate {
  uid: string;
  corpsName: string | null;
  division: string;
  prelimVotes?: number;
  finalsVotes?: number;
}

export const getFanFavorite = createCallable<
  void,
  {
    success: boolean;
    stage: 'prelims' | 'finals' | 'decided' | null;
    major: number | null;
    candidates: FanFavoriteCandidate[];
    myVote: string | null;
    finalists: FanFavoriteCandidate[];
    winner: FanFavoriteCandidate | null;
  }
>('getFanFavorite');

export const castFanFavoriteVote = createCallable<
  { corpsUid: string },
  { success: boolean; stage: string; vote: string }
>('castFanFavoriteVote');

export const proposeJointRehearsal = createCallable<
  { toUid: string; day: number },
  { success: boolean; proposalId: string; day: number }
>('proposeJointRehearsal');

export const respondJointRehearsal = createCallable<
  { proposalId: string; accept: boolean },
  { success: boolean; status: string; day?: number; travelTier?: string | null }
>('respondJointRehearsal');

export const getJointRehearsals = createCallable<void, JointRehearsalsResponse>(
  'getJointRehearsals'
);

export interface PodiumStaffResumeRow {
  seasonUid: string;
  seasonIndex: number;
  corpsName: string | null;
  division: string;
  placement: number | null;
}

export interface PodiumStaffPerson {
  id: string;
  name: string;
  specialty: string;
  tier: string;
  careerSeasons?: number;
  salary: number;
  boost: number;
  trait: string;
  resume?: PodiumStaffResumeRow[];
  signedBy: string | null;
}

export interface PodiumStaffTransfer {
  staffId: string;
  member: Record<string, unknown> & { name?: string; specialty?: string; tier?: string };
  fromUid: string;
  fromCorpsName: string | null;
  postedDay: number;
  remainingSalary: number;
  buyout: number;
}

export const getPodiumStaffMarket = createCallable<
  void,
  { success: boolean; market: PodiumStaffPerson[]; transfers: PodiumStaffTransfer[] }
>('getPodiumStaffMarket');

export const hirePodiumStaff = createCallable<
  { staffId: string; seasons?: number },
  {
    success: boolean;
    hired: string;
    staff: Record<string, unknown>;
    budget: Record<string, unknown>;
  }
>('hirePodiumStaff');

export const postPodiumStaff = createCallable<
  { staffId: string },
  { success: boolean; posted: string; buyout: number; staff: Record<string, unknown> }
>('postPodiumStaff');

export const buyPodiumStaffContract = createCallable<
  { staffId: string },
  {
    success: boolean;
    hired: string;
    staff: Record<string, unknown>;
    budget: Record<string, unknown>;
  }
>('buyPodiumStaffContract');

export const retrainPodiumStaff = createCallable<
  { staffId: string; toSpecialty: string },
  { success: boolean; retrained: string; toSpecialty: string; staff: Record<string, unknown> }
>('retrainPodiumStaff');
