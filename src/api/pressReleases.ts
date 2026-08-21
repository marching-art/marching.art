// =============================================================================
// PRESS RELEASES API
// =============================================================================
// Director-authored press releases about their OWN organization. Unlike news
// submissions (which cover the shared world and are admin-reviewed), a press
// release publishes instantly — the backend enforces corps ownership, a write
// budget, and after-the-fact moderation instead of a review queue.

import { createCallable } from './callable';

/**
 * A corps class the release can be bylined to, matching the server's keys.
 * Includes `podiumClass`: a Podium director speaks for their own corps too
 * (PODIUM.md §5.8), and a Podium-only director has no other corps to issue from.
 */
export type PressReleaseCorpsClass =
  | 'worldClass'
  | 'openClass'
  | 'aClass'
  | 'soundSport'
  | 'podiumClass';

export interface PublishPressReleaseData {
  headline: string;
  body: string;
  summary?: string;
  imageUrl?: string | null;
  /** Which owned corps issues the release; server falls back to highest class. */
  corpsClass?: PressReleaseCorpsClass;
}

export interface PublishPressReleaseResult {
  success: boolean;
  message: string;
  /** Composite feed id: `{seasonId}_day_{n}_press_{id}`. */
  articleId?: string;
  articlePath?: string;
}

export interface DeletePressReleaseData {
  articleId: string;
}

export interface DeletePressReleaseResult {
  success: boolean;
  message: string;
}

/** Publish a press release. Live the instant it resolves — no review queue. */
export const publishPressRelease = createCallable<
  PublishPressReleaseData,
  PublishPressReleaseResult
>('publishPressRelease');

/** Remove a press release you authored (admins may remove any). Soft-delete. */
export const deleteMyPressRelease = createCallable<
  DeletePressReleaseData,
  DeletePressReleaseResult
>('deleteMyPressRelease');
