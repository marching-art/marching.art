// The World Championship rounds — ONE field, no classes.
//
// Days 47, 48 and 49 are the three nights of the marching.art World
// Championship: Prelims, Semifinals and Finals. Every corps that reaches a
// round competes on a level playing field — World, Open and A Class together,
// ranked 1 through N on the one sheet — and carries the same title for having
// been there: a World Prelims Performer, a World Semifinalist, a World
// Finalist, and at the top of the Finals sheet the World Champion. Both
// divisions run the identical bracket, so the Fantasy and Podium sheets read
// the same table.
//
// Days 45/46 (the Open & A Class Prelims and Finals) are NOT here on purpose:
// those two nights are two separate competitions, and their sheets stay split
// by class.
//
// Twin of functions/src/helpers/worldChampionship.js (the server's one rule for
// the Discord drop, the public results pages and the share cards);
// worldChampionship.test.js on the server side pins the two equal.

export interface WorldChampionshipRound {
  /** The competition day the round is played on. */
  day: 47 | 48 | 49;
  round: 'Prelims' | 'Semifinals' | 'Finals';
  /** The fantasy/Podium event name for the night. */
  eventName: string;
  /** Short sheet title — "World Championship Semifinals". */
  title: string;
  /** What everyone on the sheet is — "World Semifinalists". */
  participants: string;
  /** The singular — "World Semifinalist". */
  participant: string;
  /** The title first place carries, Finals only — "World Champion". */
  winner: string | null;
}

export const WORLD_CHAMPIONSHIP_ROUNDS: Readonly<Record<number, WorldChampionshipRound>> = {
  47: {
    day: 47,
    round: 'Prelims',
    eventName: 'marching.art World Championship Prelims',
    title: 'World Championship Prelims',
    participants: 'World Prelims Performers',
    participant: 'World Prelims Performer',
    winner: null,
  },
  48: {
    day: 48,
    round: 'Semifinals',
    eventName: 'marching.art World Championship Semifinals',
    title: 'World Championship Semifinals',
    participants: 'World Semifinalists',
    participant: 'World Semifinalist',
    winner: null,
  },
  49: {
    day: 49,
    round: 'Finals',
    eventName: 'marching.art World Championship Finals',
    title: 'World Championship Finals',
    participants: 'World Finalists',
    participant: 'World Finalist',
    winner: 'World Champion',
  },
};

/** The three World Championship nights, in order. */
export const WORLD_CHAMPIONSHIP_DAYS: readonly number[] = [47, 48, 49];

/**
 * The key a World round's single combined field is filed under wherever a
 * night's standings are keyed by class — notably the `/share/scores/…/{key}`
 * card URL. Deliberately not a class: nothing about the round is.
 */
export const WORLD_FIELD_KEY = 'worldChampionship';

const WORLD_EVENT_PATTERN = /world\s+championship/i;

/**
 * The World Championship round played on `day`, or null on every other night.
 * When an `eventName` is supplied it has to be the World Championship show: a
 * live season maps every scraped DCI event to its calendar day, so an
 * unrelated show that lands on day 47 keeps its class sections.
 */
export function worldChampionshipRound(
  day: number | string | null | undefined,
  eventName: string | null | undefined = null
): WorldChampionshipRound | null {
  const round = WORLD_CHAMPIONSHIP_ROUNDS[Number(day)];
  if (!round) return null;
  if (eventName && !WORLD_EVENT_PATTERN.test(String(eventName))) return null;
  return round;
}

/** True when `day` (and, when given, `eventName`) is a World Championship night. */
export function isWorldChampionshipRound(
  day: number | string | null | undefined,
  eventName: string | null | undefined = null
): boolean {
  return worldChampionshipRound(day, eventName) !== null;
}

/**
 * The title a placement on a World round's sheet carries: "World Champion" for
 * first at Finals, otherwise the round's participant title.
 */
export function worldChampionshipTitle(
  day: number | string | null | undefined,
  place: number | null | undefined
): string | null {
  const round = worldChampionshipRound(day);
  if (!round) return null;
  return place === 1 && round.winner ? round.winner : round.participant;
}
