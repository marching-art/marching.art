// Shared "share or copy" helper for the score sheets. On a mobile browser that
// exposes the Web Share API we open the native share sheet; everywhere else we
// copy the text to the clipboard (the sheets format themselves as a
// Discord-ready monospace block). Extracted from PodiumRecapSheet so the Podium
// and Fantasy sheets share one implementation.
//
// Returns `true` only when the text was copied to the clipboard, so the caller
// can flash a transient "Copied" state. A native share (or a dismissed/blocked
// share sheet) returns `false` — there is nothing to acknowledge.

export async function shareOrCopy(text) {
  if (!text) return false;
  try {
    if (typeof navigator !== 'undefined' && navigator.share && /Mobi/i.test(navigator.userAgent)) {
      await navigator.share({ text });
      return false;
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* user dismissed the share sheet, or clipboard was blocked */
  }
  return false;
}
