// src/utils/leagueChatReads.ts
// Per-league chat read markers.
//
// The league card has always rendered an unread dot from
// `league.hasUnreadMessages` — a field nothing in the codebase ever writes, so
// the indicator was dead. A read marker is genuinely per-viewer-per-device and
// changes every time someone glances at a tab, which makes it a poor fit for a
// Firestore write; localStorage is the right store for it.
//
// Every function is defensive about storage being unavailable (Safari private
// mode, blocked cookies, SSR): a chat badge must never be able to throw.

const STORAGE_KEY = 'marchingart.leagueChatReads';

type ReadMap = Record<string, number>;

function readMap(): ReadMap {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed as ReadMap;
  } catch {
    return {};
  }
}

function writeMap(map: ReadMap): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Storage full or unavailable — the badge degrades, nothing breaks.
  }
}

/** Epoch millis of the newest message this device has seen, or 0. */
export function getLeagueChatReadAt(leagueId: string): number {
  if (!leagueId) return 0;
  const value = readMap()[leagueId];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Advance the marker. Never moves backwards. */
export function setLeagueChatReadAt(leagueId: string, timestampMs: number): void {
  if (!leagueId || !Number.isFinite(timestampMs) || timestampMs <= 0) return;
  const map = readMap();
  if ((map[leagueId] || 0) >= timestampMs) return;
  map[leagueId] = timestampMs;
  writeMap(map);
}

/** Drop a league's marker — used when a member leaves it. */
export function clearLeagueChatReadAt(leagueId: string): void {
  if (!leagueId) return;
  const map = readMap();
  if (!(leagueId in map)) return;
  delete map[leagueId];
  writeMap(map);
}
