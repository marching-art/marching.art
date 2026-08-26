import { describe, expect, it } from 'vitest';
import { DESIGN_NOTES, designNoteFor } from './designNotes';

describe('design notes', () => {
  it('is deterministic for the same figure state', () => {
    const figure = { skin: '#c9a074', jacket: '#1d2f66', chest: 'sash' as const };
    expect(designNoteFor(figure)).toBe(designNoteFor({ ...figure }));
  });

  it('always returns a note (general pool backs every state)', () => {
    expect(designNoteFor({ skin: '#c9a074' })).toBeTruthy();
    expect(DESIGN_NOTES.filter((n) => n.applies({ skin: '#c9a074' })).length).toBeGreaterThan(0);
  });

  it('surfaces context-matched notes for distinctive states', () => {
    // an aussie figure's pool includes the slouch-hat note
    const aussiePool = DESIGN_NOTES.filter((n) =>
      n.applies({ skin: '#c9a074', hatType: 'aussie' })
    );
    expect(aussiePool.some((n) => n.text.includes('slouch hat'))).toBe(true);
    // a bare figure's pool does not
    const plainPool = DESIGN_NOTES.filter((n) => n.applies({ skin: '#c9a074' }));
    expect(plainPool.some((n) => n.text.includes('slouch hat'))).toBe(false);
  });
});
