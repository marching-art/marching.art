import { describe, it, expect } from 'vitest';
import { derivePodiumChallengeFacts } from './podiumChallenges';

describe('derivePodiumChallengeFacts', () => {
  it('reads shows from selectedShowDays', () => {
    const facts = derivePodiumChallengeFacts({
      exists: true,
      state: { selectedShowDays: [3, 10], showConcept: 'Blue Ritual' },
    });
    expect(facts).toEqual({ hasShows: true, hasConcept: true });
  });

  it('falls back to the selectedShows map when the day list is absent', () => {
    const facts = derivePodiumChallengeFacts({
      exists: true,
      state: { selectedShows: { 3: { eventName: 'Allentown' } } },
    });
    expect(facts?.hasShows).toBe(true);
    expect(facts?.hasConcept).toBe(false);
  });

  it('treats no picks as no shows', () => {
    const facts = derivePodiumChallengeFacts({
      exists: true,
      state: { selectedShows: {}, selectedShowDays: [] },
    });
    expect(facts?.hasShows).toBe(false);
  });

  it('treats a blank concept string as no concept', () => {
    expect(
      derivePodiumChallengeFacts({ exists: true, state: { showConcept: '   ' } })?.hasConcept
    ).toBe(false);
  });

  it('returns null when the director has no Podium corps', () => {
    // null, not {false,false} — callers treat "no corps" differently from
    // "corps with nothing set".
    expect(derivePodiumChallengeFacts(null)).toBeNull();
    expect(derivePodiumChallengeFacts({ exists: false })).toBeNull();
    expect(derivePodiumChallengeFacts({ exists: true, state: null })).toBeNull();
  });
});
