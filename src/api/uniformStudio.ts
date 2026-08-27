// =============================================================================
// UNIFORM STUDIO API — wardrobe reads + server-mediated writes
// =============================================================================
// Designs are owner-readable directly from Firestore, but every write goes
// through a callable: the server validates shape/size, enforces the wardrobe
// cap, and is the only writer of the equipped snapshot on the profile
// (corps.{class}.uniform is pinned server-only in firestore.rules).

import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { db, paths } from './client';
import { createCallable } from './callable';
import { normalizeUniformCode } from '../utils/uniform';
import type { UniformDesignV2 } from '../types/uniform';

export interface WardrobeDesign extends UniformDesignV2 {
  id: string;
  /** Minted share code, once mintUniformCode has run for this design. */
  shareCode?: string;
}

/** All of the signed-in director's saved designs, newest first. */
export async function listWardrobe(uid: string): Promise<WardrobeDesign[]> {
  const snap = await getDocs(
    query(collection(db, paths.userWardrobe(uid)), orderBy('updatedAt', 'desc'))
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as UniformDesignV2) }));
}

export interface SaveUniformDesignData {
  /** Omit to create; pass an existing id to overwrite that design. */
  designId?: string;
  design: UniformDesignV2;
}

export interface SaveUniformDesignResult {
  designId: string;
  message: string;
}

export const saveUniformDesign = createCallable<SaveUniformDesignData, SaveUniformDesignResult>(
  'saveUniformDesign'
);

export interface EquipUniformDesignData {
  /** null with slot 'alternate' or 'guard' clears that slot. */
  designId: string | null;
  corpsClass: string;
  /** Which slot to fill: the identity uniform (default), the alternate look,
   *  or the color guard's per-season show look. */
  slot?: 'primary' | 'alternate' | 'guard';
}

export interface EquipUniformDesignResult {
  message: string;
}

export const equipUniformDesign = createCallable<EquipUniformDesignData, EquipUniformDesignResult>(
  'equipUniformDesign'
);

export interface DeleteUniformDesignData {
  designId: string;
}

export const deleteUniformDesign = createCallable<DeleteUniformDesignData, { message: string }>(
  'deleteUniformDesign'
);

// =============================================================================
// UNIFORM CODES (docs/UNIFORM_STUDIO.md §7.1)
// =============================================================================

export const mintUniformCode = createCallable<{ designId: string }, { code: string }>(
  'mintUniformCode'
);

export interface UniformCodeDoc {
  design: UniformDesignV2;
  creatorUid: string;
  creatorName: string;
  designName: string;
  createdAt: string;
}

/** Look up a shared design by its code (world-readable). Null when unknown. */
export async function fetchUniformCode(code: string): Promise<UniformCodeDoc | null> {
  const normalized = normalizeUniformCode(code);
  if (!normalized) return null;
  const snap = await getDoc(doc(db, paths.uniformCode(normalized)));
  return snap.exists() ? (snap.data() as UniformCodeDoc) : null;
}
