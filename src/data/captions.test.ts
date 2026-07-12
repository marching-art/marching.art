import { describe, it, expect } from 'vitest';
import { CAPTIONS, CAPTION_IDS, getCaption } from './captions';

describe('captions canonical source', () => {
  it('has exactly the eight captions in canonical order', () => {
    expect(CAPTION_IDS).toEqual(['GE1', 'GE2', 'VP', 'VA', 'CG', 'B', 'MA', 'P']);
  });

  it('derives CAPTION_IDS from CAPTIONS (single source)', () => {
    expect(CAPTION_IDS).toEqual(CAPTIONS.map((c) => c.id));
  });

  it('groups captions as ge/vis/mus', () => {
    const byGroup = (g: string) => CAPTIONS.filter((c) => c.group === g).map((c) => c.id);
    expect(byGroup('ge')).toEqual(['GE1', 'GE2']);
    expect(byGroup('vis')).toEqual(['VP', 'VA', 'CG']);
    expect(byGroup('mus')).toEqual(['B', 'MA', 'P']);
  });

  it('gives every caption a full name and a matching group label', () => {
    const labels: Record<string, string> = {
      ge: 'General Effect',
      vis: 'Visual',
      mus: 'Music',
    };
    for (const c of CAPTIONS) {
      expect(c.fullName.length).toBeGreaterThan(0);
      expect(c.groupLabel).toBe(labels[c.group]);
    }
  });

  it('looks up a caption by id', () => {
    expect(getCaption('B')?.fullName).toBe('Brass');
    expect(getCaption('nope')).toBeUndefined();
  });
});
