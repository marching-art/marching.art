// historical_scores/{year} event ordering and the legacy↔sharded union.
//
// Mirrors functions/src/helpers/historicalScores.js (mergeEventLists /
// compareEventsChronologically) so the client sees exactly the events, in
// exactly the order, the backend scores from. Pure — no Firestore — so the
// api/season loader stays thin and this stays unit-testable.
//
// Why order matters: the pre-sharding array format was appended in scrape
// order, so every reader could rely on a year's events arriving by date. A
// subcollection read returns documents by id (a content hash — random with
// respect to date). Anything that reads "the first show" or "the last score"
// off the list ends must get chronological input, so the loader guarantees
// it here rather than trusting each consumer to sort.

import type { DocumentData } from 'firebase/firestore';

/** The epoch instant an event is keyed on; NaN when the date can't be parsed. */
function eventInstant(date: unknown): number {
  if (date && typeof date === 'object' && 'toMillis' in date) {
    const millis = (date as { toMillis: () => number }).toMillis();
    return typeof millis === 'number' ? millis : NaN;
  }
  return new Date(date as string).getTime();
}

/** The (eventName, instant) identity the backend dedupes on. */
function eventMatchKey(e: DocumentData): string {
  const ms = eventInstant(e.date);
  return Number.isNaN(ms) ? `${e.eventName} raw:${String(e.date)}` : `${e.eventName} ${ms}`;
}

/**
 * Chronological event order: by date, then competition day, then name.
 * Unparseable dates sort last; the name tiebreak keeps the order stable.
 */
export function compareEventsChronologically(a: DocumentData, b: DocumentData): number {
  const aMs = eventInstant(a?.date);
  const bMs = eventInstant(b?.date);
  const aValid = !Number.isNaN(aMs);
  const bValid = !Number.isNaN(bMs);
  if (aValid && bValid && aMs !== bMs) return aMs - bMs;
  if (aValid !== bValid) return aValid ? -1 : 1;

  const aDay = typeof a?.offSeasonDay === 'number' ? a.offSeasonDay : -Infinity;
  const bDay = typeof b?.offSeasonDay === 'number' ? b.offSeasonDay : -Infinity;
  if (aDay !== bDay) return aDay - bDay;

  return String(a?.eventName ?? '').localeCompare(String(b?.eventName ?? ''));
}

/**
 * Union a year's not-yet-migrated legacy `data` array with its sharded
 * `events` subcollection, the sharded copy winning on an (eventName, date)
 * conflict, returned in chronological order whatever order either input had.
 */
export function mergeHistoricalEventLists(
  legacy: DocumentData[],
  sub: DocumentData[]
): DocumentData[] {
  const byKey = new Map<string, DocumentData>();
  for (const e of legacy) byKey.set(eventMatchKey(e), e);
  for (const e of sub) byKey.set(eventMatchKey(e), e);
  return [...byKey.values()].sort(compareEventsChronologically);
}
