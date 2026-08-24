// =============================================================================
// PRESS RELEASES API
// =============================================================================
// Director-authored press releases about their OWN organization, on a trust
// track separate from news submissions. A director's first releases are
// admin-reviewed; once enough have been approved, new releases publish
// instantly. The backend enforces corps ownership, a write budget, and — for
// trusted authors — after-the-fact moderation instead of a review queue.

import { createCallable } from './callable';

/**
 * A corps class the release can be bylined to, matching the server's keys.
 * Includes `podiumClass`: a Podium director speaks for their own corps too
 * (PODIUM.md §5.8), and a Podium-only director has no other corps to issue from.
 */
export type PressReleaseCorpsClass =
  'worldClass' | 'openClass' | 'aClass' | 'soundSport' | 'podiumClass';

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
  /** Composite feed id: `{seasonId}_day_{n}_press_{id}`. Absent on the review path. */
  articleId?: string;
  articlePath?: string;
  /** Set instead of articleId when the release was queued for admin review. */
  submissionId?: string;
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
