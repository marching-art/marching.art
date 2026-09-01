// =============================================================================
// DESIGN EXCHANGE API — gallery reads + server-mediated writes
// =============================================================================
// Entries are world-readable straight from Firestore (rules: public read,
// callable-only writes), so browsing costs no function invocations. Every
// mutation — publish, unpublish, like, save-a-copy, report — goes through a
// callable that validates, throttles, and keeps the one-per-user counters
// honest (functions/src/callable/designExchange.js).

import { collection, doc, getDoc, getDocs, limit, orderBy, query } from 'firebase/firestore';
import { db, paths } from './client';
import { createCallable } from './callable';
import type { FigureConfig, UniformColorway } from '../types/uniform';

export interface ExchangeEntry {
  id: string;
  design: {
    schema: 2;
    name: string;
    colorway: UniformColorway;
    figure: FigureConfig;
  };
  designName: string;
  creatorUid: string;
  creatorName: string;
  likes: number;
  saves: number;
  createdAt: string;
  updatedAt: string;
}

export type ExchangeSort = 'new' | 'top';

/** Browse the gallery: newest first, or most-saved first. */
export async function listExchange(sort: ExchangeSort, max = 30): Promise<ExchangeEntry[]> {
  const field = sort === 'top' ? 'saves' : 'createdAt';
  const snap = await getDocs(
    query(collection(db, paths.exchangeEntries()), orderBy(field, 'desc'), limit(max))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ExchangeEntry, 'id'>) }));
}

/** Which of the given entries the signed-in viewer has already liked. */
export async function fetchMyLikes(entryIds: string[], uid: string): Promise<Set<string>> {
  const results = await Promise.all(
    entryIds.map(async (id) => {
      try {
        const snap = await getDoc(doc(db, paths.exchangeLike(id, uid)));
        return snap.exists() ? id : null;
      } catch {
        return null;
      }
    })
  );
  return new Set(results.filter((id): id is string => id !== null));
}

export const publishUniformDesign = createCallable<
  { designId: string },
  { entryId: string; message: string }
>('publishUniformDesign');

export const unpublishUniformDesign = createCallable<{ entryId: string }, { message: string }>(
  'unpublishUniformDesign'
);

export const likeExchangeDesign = createCallable<
  { entryId: string; liked: boolean },
  { liked: boolean; message: string }
>('likeExchangeDesign');

export const saveExchangeDesign = createCallable<
  { entryId: string },
  { designId: string; message: string }
>('saveExchangeDesign');

export const reportExchangeDesign = createCallable<
  { entryId: string; reason?: string },
  { message: string }
>('reportExchangeDesign');

/** Admin takedown of any gallery entry (moderation; likes/saves/reports go with it). */
export const adminRemoveExchangeDesign = createCallable<{ entryId: string }, { message: string }>(
  'adminRemoveExchangeDesign'
);
