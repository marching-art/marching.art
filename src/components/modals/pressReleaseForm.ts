// =============================================================================
// PRESS RELEASE FORM LOGIC
// =============================================================================
// Pure validation + payload shaping for the press-release composer, kept out of
// the component so the rules are unit-tested and mirror the server's
// (functions/src/helpers/newsSubmissionsShared.js) exactly. The client checks
// first for instant feedback; the server re-validates as the source of truth.

import type { PublishPressReleaseData, PressReleaseCorpsClass } from '../../api/pressReleases';

export const PRESS_RELEASE_LIMITS = {
  headlineMin: 6,
  headlineMax: 160,
  summaryMax: 300,
  bodyMin: 40,
  bodyMax: 8000,
} as const;

// Press releases run on their own trust track, separate from news articles.
// Anyone with a corps can compose one: a director's first releases are reviewed
// by an admin before going live, and once this many of THEIR PRESS RELEASES have
// been approved, new ones publish instantly. Mirrors the server's
// PRESS_RELEASE_AUTO_APPROVE_THRESHOLD
// (functions/src/helpers/newsSubmissionsShared.js), which re-checks it as the
// source of truth. Surfaced in the composer so the author knows up front whether
// this release publishes instantly or goes to review.
export const PRESS_RELEASE_AUTO_APPROVE_THRESHOLD = 3;

/**
 * True once the author has enough approved press releases that new ones publish
 * instantly. Below the bar, a release is submitted for admin review instead.
 */
export function pressReleaseAutoPublishes(
  approvedPressReleaseCount: number | null | undefined
): boolean {
  return (
    Math.max(0, Math.floor(approvedPressReleaseCount ?? 0)) >= PRESS_RELEASE_AUTO_APPROVE_THRESHOLD
  );
}

export interface PressReleaseFormState {
  headline: string;
  summary: string;
  body: string;
  imageUrl: string;
  corpsClass?: PressReleaseCorpsClass;
}

export type PressReleaseFormErrors = Partial<
  Record<'headline' | 'summary' | 'body' | 'imageUrl', string>
>;

/** Empty initial form state, optionally pre-selecting a corps class. */
export function emptyPressReleaseForm(corpsClass?: PressReleaseCorpsClass): PressReleaseFormState {
  return { headline: '', summary: '', body: '', imageUrl: '', corpsClass };
}

function isValidHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/**
 * Validate the composer state. Returns a field-keyed error map (empty when the
 * form is publishable), matching the server's bounds so a client-side pass
 * never gets rejected by the backend for length.
 */
export function validatePressReleaseForm(form: PressReleaseFormState): PressReleaseFormErrors {
  const errors: PressReleaseFormErrors = {};
  const L = PRESS_RELEASE_LIMITS;

  const headline = form.headline.trim();
  if (headline.length < L.headlineMin) {
    errors.headline = `Headline must be at least ${L.headlineMin} characters`;
  } else if (headline.length > L.headlineMax) {
    errors.headline = `Headline cannot exceed ${L.headlineMax} characters`;
  }

  const body = form.body.trim();
  if (body.length < L.bodyMin) {
    errors.body = `Your announcement must be at least ${L.bodyMin} characters`;
  } else if (body.length > L.bodyMax) {
    errors.body = `Your announcement cannot exceed ${L.bodyMax} characters`;
  }

  if (form.summary.trim().length > L.summaryMax) {
    errors.summary = `Summary cannot exceed ${L.summaryMax} characters`;
  }

  const imageUrl = form.imageUrl.trim();
  if (imageUrl && !isValidHttpUrl(imageUrl)) {
    errors.imageUrl = 'Enter a valid http(s) image URL, or leave it blank';
  }

  return errors;
}

/** True when the form has no blocking errors. */
export function isPressReleaseFormValid(form: PressReleaseFormState): boolean {
  return Object.keys(validatePressReleaseForm(form)).length === 0;
}

/** Shape the callable payload from validated form state, omitting blanks. */
export function buildPressReleasePayload(form: PressReleaseFormState): PublishPressReleaseData {
  const summary = form.summary.trim();
  const imageUrl = form.imageUrl.trim();
  return {
    headline: form.headline.trim(),
    body: form.body.trim(),
    ...(summary ? { summary } : {}),
    ...(imageUrl ? { imageUrl } : {}),
    ...(form.corpsClass ? { corpsClass: form.corpsClass } : {}),
  };
}
