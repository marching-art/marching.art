// Share actions for score sheets, articles, and champions.
//
// Two flavors live here:
//   - shareOrCopy(text, url?) — the score sheets' "Discord-ready text" share,
//     optionally carrying a link. Returns true only when text was copied so
//     callers can flash a "Copied" state.
//   - shareLink({title, url}) — link-first sharing with toast feedback
//     (articles, champion plaques).
//
// The URLs come from the builders below: in-app shares hand out /share/*
// URLs instead of SPA routes because social scrapers don't execute the SPA's
// JS — only the share endpoint (functions/src/triggers/shareCards.js) serves
// OG tags and a live score-card og:image, so those links unfurl with actual
// standings. Humans who click one are redirected to the app route.

import toast from 'react-hot-toast';

/** Origin for share links — host-relative so both hosting domains work. */
const origin = () =>
  typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://marching.art';

export const articleShareUrl = (articleId: string): string =>
  `${origin()}/share/article/${articleId}`;

export const scoresShareUrl = (seasonId: string, day: number, classKey: string): string =>
  `${origin()}/share/scores/${seasonId}/${day}/${classKey}`;

export const championShareUrl = (seasonId: string, classKey: string): string =>
  `${origin()}/share/champion/${seasonId}/${classKey}`;

/**
 * Share sheet text (native share sheet on mobile, clipboard elsewhere).
 * When `url` is provided it rides along — natively via the share payload,
 * on the clipboard appended after the text — so pasting into Discord/Slack
 * unfurls the live score card under the monospace block.
 *
 * Returns `true` only when the text was copied to the clipboard, so the
 * caller can flash a transient "Copied" state. A native share (or a
 * dismissed/blocked share sheet) returns `false`.
 */
export async function shareOrCopy(text: string, url?: string | null): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.share && /Mobi/i.test(navigator.userAgent)) {
      await navigator.share(url ? { text, url } : { text });
      return false;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url ? `${text}\n\n${url}` : text);
      return true;
    }
  } catch {
    /* user dismissed the share sheet, or clipboard was blocked */
  }
  return false;
}

/**
 * Share a URL via the native share sheet on mobile, falling back to a
 * clipboard copy with toast feedback (the Web Share API is unreliable on
 * desktop browsers). Mirrors the Article page's long-standing behavior.
 */
export async function shareLink({ title, url }: { title?: string; url: string }): Promise<void> {
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

  if (navigator.share && isMobile) {
    try {
      await navigator.share({ title, text: title, url });
    } catch (err) {
      // AbortError means the user closed the sheet — do nothing. Anything
      // else (blocked by policy, etc.) falls back to the clipboard.
      if ((err as DOMException).name !== 'AbortError') {
        await copyToClipboard();
      }
    }
  } else {
    await copyToClipboard();
  }
}
