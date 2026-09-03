// Every hand-rolled dialog must trap focus (WCAG 2.4.3). This is the ratchet
// behind site-review A-H1: a `role="dialog"` overlay that lets Tab wander
// into the obscured page behind it cannot land without touching this list.
//
// A file passes when it calls useFocusTrap itself, or delegates the dialog
// to a hook that does (the allowlist).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(__dirname, '..', '..');

/** Dialogs whose trap lives in a hook the file itself imports. */
const DELEGATED = new Set([
  // useCaptionSelectionModal owns dialogRef + useFocusTrap for this modal.
  'components/CaptionSelection/CaptionSelectionModal.jsx',
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(jsx|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

describe('dialog focus traps', () => {
  it('every role="dialog" file traps focus', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC)) {
      const source = readFileSync(file, 'utf8');
      if (!source.includes('role="dialog"')) continue;
      const rel = relative(SRC, file);
      if (DELEGATED.has(rel)) continue;
      if (!source.includes('useFocusTrap')) offenders.push(rel);
    }
    expect(offenders).toEqual([]);
  });
});
