import { Timestamp } from 'firebase/firestore';

import type { CorpsClass } from './corps';
import type { LifetimeStats } from './user';

// =============================================================================
// LEAGUE TYPES
// =============================================================================

export interface League {
  id: string;
  name: string;
  description: string;
  /** The league owner — one director, the only one who can hand it over. */
  creatorId: string;
  /** Additional directors who can run the league (see utils/leaguePermissions). */
  commissioners?: string[];
  createdAt: Timestamp;

  // Membership
  members: string[];
  maxMembers: number;
  isPublic: boolean;
  /** Discovery taxonomy set by the commissioner (updateLeagueSettings). */
  tag?: 'competitive' | 'casual' | 'roleplay' | 'dynasty' | null;
  /** Auto-provisioned beginner league (callable/rookieLeague.js). */
  isRookieCircuit?: boolean;
  /** Commissioner's pinned note, shown above every tab. */
  announcement?: { text: string; setBy?: string; setAt?: Timestamp } | null;
  /** Legacy only — new leagues keep the code in meta/private (see useLeagueInviteCode). */
  inviteCode?: string;

  // Season participation
  /** Which season this league is currently playing (advanced at rollover). */
  seasonId?: string;
  seasonActivity?: LeagueSeasonActivity;

  // Settings
  settings: LeagueSettings;
}

/**
 * Season-scoped participation, materialized by the backend
 * (functions/src/helpers/leagueActivity.js).
 *
 * The roster is permanent but participation is not: a director's corps name
 * survives season rollover, so `members` alone says nothing about who is
 * actually playing right now. Public discovery filters on `activeMemberCount`
 * and league UI reports it, so a league whose members haven't returned since
 * the season reset reads as empty instead of advertising a full roster.
 *
 * The block is absent until the backend first writes it. Absent means UNKNOWN,
 * never zero — discovery and the league cards both show such a league rather
 * than hiding it (src/utils/leagueActivity.ts, getPublicLeagues).
 */
export interface LeagueSeasonActivity {
  /** The season this block describes; stale blocks are refreshed nightly. */
  seasonUid: string;
  /** Members registered for `seasonUid`. */
  activeMembers: string[];
  activeMemberCount: number;
  /** Full roster size, so the UI can show "2 of 12" rather than hiding members. */
  totalMemberCount: number;
  updatedAt: Timestamp;
}

export interface LeagueSettings {
  /**
   * How many regular-season seeds reach Finals, where the title is decided
   * (functions/src/helpers/leagueChampion.js). The one league setting that
   * changes how a season ends.
   *
   * `matchupType` and `playoffSize` used to live here too and were read by
   * nothing — settings a commissioner appeared to choose that could not affect
   * their league. They are gone. `scoringFormat` came back below, with an
   * implementation behind it.
   */
  finalsSize: number;
  prizePool: number;
  /** CorpsCoin fee charged to every joiner (creator included), paid into the prize pool */
  entryFee?: number;
  /**
   * How this league decides its weekly matchups. Absent means `total` — one
   * comparison of the week's score, the default.
   *
   * Bought for ONE season by the commissioner (callable/leagueFormat.js), which
   * is why it is paired with the season it was bought for: resolution requires
   * BOTH, so a value left behind by a previous season can never switch a league
   * into a paid format nobody bought. See docs/CAPTION_WARS_SPEC.md.
   */
  scoringFormat?: 'total' | 'captionWars';
  scoringFormatSeasonUid?: string;
}

export interface LeagueStanding {
  uid: string;
  displayName: string;
  corpsName: string;
  corpsClass: CorpsClass;

  // Points
  circuitPoints: number;
  totalSeasonScore: number;

  // Medals
  medals: {
    gold: number;
    silver: number;
    bronze: number;
  };

  // Stats
  tourStops: number;
  seasonHighScore: number;
  averagePlacement: number;
}

// =============================================================================
// MATCHUP TYPES
// =============================================================================

export type MatchupStatus = 'scheduled' | 'live' | 'completed';

export interface Matchup {
  id: string;
  leagueId: string;
  week: number;
  seasonId: string;

  // Participants
  homeUserId: string;
  awayUserId: string;

  // Status
  status: MatchupStatus;
  startTime?: Timestamp;
  endTime?: Timestamp;

  // Scores (updated during/after week)
  homeScore: number;
  awayScore: number;

  // Result (after completion)
  winnerId?: string;
  margin?: number;

  // Metadata
  createdAt: Timestamp;
  updatedAt?: Timestamp;
}

export interface MatchupResult {
  matchupId: string;
  week: number;

  // User info
  homeUser: {
    uid: string;
    displayName: string;
    corpsName: string;
  };
  awayUser: {
    uid: string;
    displayName: string;
    corpsName: string;
  };

  // Final scores
  homeScore: number;
  awayScore: number;

  // Winner
  winnerId: string;
  winnerName: string;
  margin: number;
}

export interface HeadToHeadRecord {
  user1Id: string;
  user2Id: string;
  user1Wins: number;
  user2Wins: number;
  ties: number;
  totalMatchups: number;
  lastMatchup?: MatchupResult;
}

export interface MatchupNotification {
  id: string;
  matchupId: string;
  userId: string;
  type: 'score_update' | 'matchup_start' | 'matchup_end' | 'opponent_lead';
  message: string;
  read: boolean;
  createdAt: Timestamp;
}

// =============================================================================
// LEAGUE NOTIFICATION TYPES
// =============================================================================

export type LeagueNotificationType =
  | 'matchup_result' // Matchup results posted
  | 'standings_change' // Someone passed you in standings
  | 'new_message' // New message in league chat
  | 'trade_proposal' // Trade proposal received
  | 'trade_response' // Trade accepted/rejected
  | 'member_joined' // New member joined league
  | 'rivalry_matchup' // Matchup with a rival
  | 'league_invite'; // Invited to join a league (written server-side)

export interface LeagueNotification {
  id: string;
  leagueId: string;
  leagueName: string;
  userId: string;
  type: LeagueNotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;

  // Optional contextual data
  metadata?: {
    // For matchup results
    matchupId?: string;
    week?: number;
    opponentId?: string;
    opponentName?: string;
    userScore?: number;
    opponentScore?: number;
    won?: boolean;

    // For standings changes
    previousRank?: number;
    newRank?: number;
    passedBy?: string;

    // For trades
    tradeId?: string;
    tradingWith?: string;

    // For rivalry
    isRival?: boolean;
    rivalryRecord?: string;
  };
}

export interface LeagueActivity {
  id: string;
  leagueId: string;
  type: LeagueNotificationType | 'show_result' | 'week_start' | 'week_end';
  timestamp: Timestamp;
  actorId?: string;
  actorName?: string;
  title: string;
  description: string;

  // Contextual data
  metadata?: Record<string, unknown>;
}

export interface RivalryData {
  rivalId: string;
  rivalName: string;
  matchupCount: number;
  userWins: number;
  rivalWins: number;
  ties: number;
  lastMatchupWeek?: number;
  streak?: {
    count: number;
    type: 'W' | 'L';
  };
}

// =============================================================================
// LEADERBOARD TYPES
// =============================================================================

export interface LeaderboardEntry {
  id: string;
  rank: number;
  uid: string;
  username: string;
  userTitle?: string;
  corpsName?: string;
  corpsClass?: CorpsClass;
  score: number;
  trophies?: number;
  lifetimeStats?: LifetimeStats;
}

export type LeaderboardType = 'overall' | 'weekly' | 'monthly' | 'lifetime';
