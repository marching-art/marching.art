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
  // Carried staff to retain next season, in keep-first order (design §5.6).
  // A staffer omitted from the list is voluntarily released; when absent, the
  // roster is kept priciest-first and a shortfall sheds the cheapest.
  staffPriority?: string[];
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
  eventName: string | null;
  city: string;
  tier: string | null;
  miles: number | null;
  coinCost: number;
  staminaCost: number;
  heat: number;
  isMajor: boolean;
}

// Next-season payroll warning (design §5.6): when a corps' aged staff payroll
// can't fit the division commitment cap, the director will have to release or
// retrain someone at re-registration. Surfaced in-season so they can act early.
export interface PodiumStaffOutlook {
  payroll: number; // total aged salary next season
  commitmentCap: number; // the most a director can commit (division-equal)
  shortfall: number; // payroll - cap, floored at 0
  atRisk: boolean; // payroll exceeds the cap
  acknowledged: boolean; // director has dismissed this exact payroll figure
}

export interface PodiumStateResponse {
  exists: boolean;
  calendarDay: number;
  competitionDay: number;
  isShowDay?: boolean;
  autoDays?: number[];
  routePreview?: PodiumRouteLeg[];
  staffOutlook?: PodiumStaffOutlook;
  state?: Record<string, unknown>;
}

export interface PodiumLapsedStaff {
  specialty: string;
  reason: 'unaffordable' | 'released' | 'retired';
}

export const registerPodiumCorps = createCallable<
  PodiumRegistration,
  {
    success: boolean;
    corpsName: string;
    division: string;
    divisionLabel: string;
    easternNight: number;
    retainedStaff: string[];
    lapsedStaff: PodiumLapsedStaff[];
  }
>('registerPodiumCorps');

// A carried staffer's projected next-season cost, for the re-registration
// funding preview (design §5.6). getPodiumRegistrationPreview ages each
// staffer one season so the director can compare payroll against the CC they
// plan to commit BEFORE founding the corps.
export interface PodiumStaffProjection {
  specialty: string;
  id: string | null;
  tier: string;
  nextTier: string | null;
  salary: number;
  nextSalary: number;
  retiring: boolean;
}

export const getPodiumRegistrationPreview = createCallable<
  void,
  {
    success: boolean;
    hasCarriedStaff: boolean;
    division: string;
    divisionLabel: string;
    commitmentCap: number;
    corpsCoin: number;
    payroll: number;
    affordable: boolean;
    staff: PodiumStaffProjection[];
  }
>('getPodiumRegistrationPreview');

export const allocateRehearsalBlock = createCallable<
  { blockType: string; blockIndex?: number },
  PodiumBlockResult
>('allocateRehearsalBlock');

export const setPodiumRestDay = createCallable<void, { success: boolean }>('setPodiumRestDay');

export interface PodiumShowPick {
  day: number;
  eventName: string;
  location?: string;
}

export const setPodiumShows = createCallable<
  { week: number; shows: PodiumShowPick[] },
  {
    success: boolean;
    selectedShows: Record<number, { eventName: string; location: string }>;
    selectedShowDays: number[];
  }
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

// A résumé row banked on a retained staffer's instance each season.
export interface PodiumStaffResumeRow {
  seasonUid: string;
  corpsName: string | null;
  placement: number | null;
}

// A hireable catalog option: a role at an entry experience level. Always
// available — hiring mints a per-corps instance from it. No names.
export interface PodiumStaffCatalogOption {
  specialty: string;
  tier: string;
  salary: number;
  boost: number;
}

export const getPodiumStaffMarket = createCallable<
  void,
  { success: boolean; catalog: PodiumStaffCatalogOption[] }
>('getPodiumStaffMarket');

export const hirePodiumStaff = createCallable<
  { specialty: string; tier: string; seasons?: number },
  {
    success: boolean;
    hired: string;
    staff: Record<string, unknown>;
    budget: Record<string, unknown>;
  }
>('hirePodiumStaff');

export const releasePodiumStaff = createCallable<
  { specialty: string },
  { success: boolean; released: string; staff: Record<string, unknown> }
>('releasePodiumStaff');

// Dismiss the in-season payroll warning for the current projected figure; it
// re-warns if the roster (and thus the payroll) changes.
export const acknowledgePodiumStaffOutlook = createCallable<
  void,
  { success: boolean; acknowledgedPayroll: number }
>('acknowledgePodiumStaffOutlook');

export const retrainPodiumStaff = createCallable<
  { staffId: string; toSpecialty: string },
  { success: boolean; retrained: string; toSpecialty: string; staff: Record<string, unknown> }
>('retrainPodiumStaff');
