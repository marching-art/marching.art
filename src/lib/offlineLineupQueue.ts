// =============================================================================
// OFFLINE LINEUP QUEUE
// =============================================================================
// Lineup edits are the one write users genuinely attempt with no signal (at a
// stadium, on the bus). When saveLineup can't reach the backend, the lineup is
// stored locally (latest save per user+class wins) and replayed automatically
// when the browser reports connectivity. Replay re-runs the normal callable,
// so all backend enforcement (change windows, trade limits) still applies —
// a rejected replay surfaces the backend's error to the user instead of
// silently dropping the save.

import toast from 'react-hot-toast';
import { saveLineup } from '../api/functions';
import { CORPS_CLASS_LABELS } from '../utils/corps';

const STORAGE_KEY = 'offline-lineup-queue-v1';

interface QueuedSave {
  uid: string;
  corpsClass: string;
  lineup: Record<string, string>;
  queuedAt: number;
}

type QueueMap = Record<string, QueuedSave>;

const readQueue = (): QueueMap => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') as QueueMap;
  } catch {
    return {};
  }
};

const writeQueue = (queue: QueueMap): void => {
  try {
    if (Object.keys(queue).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    }
  } catch {
    // Storage full/blocked — nothing else to do; the user already saw the
    // "saved locally" message only if the write succeeded (see queueLineupSave).
  }
};

/** Store a lineup save to submit later. Latest save per user+class wins. */
export const queueLineupSave = (
  uid: string,
  corpsClass: string,
  lineup: Record<string, string>
) => {
  const queue = readQueue();
  queue[`${uid}|${corpsClass}`] = { uid, corpsClass, lineup, queuedAt: Date.now() };
  writeQueue(queue);
};

export const hasQueuedLineupSaves = (uid: string): boolean =>
  Object.values(readQueue()).some((entry) => entry.uid === uid);

let replaying = false;

/**
 * Submit any queued saves for the signed-in user. Runs the real saveLineup
 * callable; success and backend rejections both dequeue (the backend verdict
 * is final), while network failures stay queued for the next attempt.
 */
export const replayQueuedLineupSaves = async (uid: string | undefined): Promise<void> => {
  if (!uid || replaying || !navigator.onLine) return;
  const queue = readQueue();
  const mine = Object.entries(queue).filter(([, entry]) => entry.uid === uid);
  if (mine.length === 0) return;

  replaying = true;
  try {
    for (const [key, entry] of mine) {
      try {
        await saveLineup({ lineup: entry.lineup, corpsClass: entry.corpsClass });
        delete queue[key];
        writeQueue(queue);
        toast.success(
          `Offline lineup for ${CORPS_CLASS_LABELS[entry.corpsClass] || entry.corpsClass} submitted!`
        );
      } catch (error) {
        if (!navigator.onLine) return; // connection dropped again — keep queued
        // Reached the backend and was rejected (window closed, limit hit…):
        // the verdict is final, so dequeue and tell the user.
        delete queue[key];
        writeQueue(queue);
        const message = error instanceof Error ? error.message : 'Save was rejected';
        toast.error(
          `Your offline lineup for ${CORPS_CLASS_LABELS[entry.corpsClass] || entry.corpsClass} couldn't be submitted: ${message}`,
          { duration: 8000 }
        );
      }
    }
  } finally {
    replaying = false;
  }
};

/**
 * Start replaying whenever connectivity returns. Returns a cleanup function.
 * Call once per signed-in session (App-level effect).
 */
export const initOfflineLineupReplay = (uid: string): (() => void) => {
  const replay = () => void replayQueuedLineupSaves(uid);
  // Flush anything left over from a previous offline session
  replay();
  window.addEventListener('online', replay);
  return () => window.removeEventListener('online', replay);
};
