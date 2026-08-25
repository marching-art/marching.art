// =============================================================================
// UNIFORM STUDIO API — wardrobe reads + server-mediated writes
// =============================================================================
// Designs are owner-readable directly from Firestore, but every write goes
// through a callable: the server validates shape/size, enforces the wardrobe
// cap, and is the only writer of the equipped snapshot on the profile
// (corps.{class}.uniform is pinned server-only in firestore.rules).

import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { db, paths } from './client';
import { createCallable } from './callable';
import type { UniformDesignV2 } from '../types/uniform';

export interface WardrobeDesign extends UniformDesignV2 {
  id: string;
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
  designId: string;
  corpsClass: string;
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
