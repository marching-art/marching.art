import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { useModalRoute } from './useModalRoute';

const PANELS = ['lineup', 'concept', 'register'];

/**
 * Render the hook inside a memory history, exposing the live location and a
 * navigate() so a test can pop the stack the way a hardware back button does.
 */
function setup(initialEntries: string[] = ['/dashboard']) {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );
  return renderHook(
    () => ({ route: useModalRoute(PANELS), location: useLocation(), navigate: useNavigate() }),
    { wrapper }
  );
}

describe('useModalRoute', () => {
  it('starts closed on a plain URL', () => {
    const { result } = setup();
    expect(result.current.route.panel).toBeNull();
    expect(result.current.route.isOpen('lineup')).toBe(false);
  });

  it('reads an open panel straight from the URL — the link is the state', () => {
    const { result } = setup(['/dashboard?panel=lineup']);
    expect(result.current.route.panel).toBe('lineup');
    expect(result.current.route.isOpen('lineup')).toBe(true);
  });

  it('carries a panel detail, so a link can target one caption slot', () => {
    const { result } = setup(['/dashboard?panel=lineup&slot=GE1']);
    expect(result.current.route.detail).toBe('GE1');
  });

  it('ignores a detail when no panel is open', () => {
    const { result } = setup(['/dashboard?slot=GE1']);
    expect(result.current.route.detail).toBeNull();
  });

  it('ignores a panel it does not recognize', () => {
    // A stale or hand-edited link must not leave the page in a state with no
    // modal to show for it.
    const { result } = setup(['/dashboard?panel=nonsense']);
    expect(result.current.route.panel).toBeNull();
  });

  it('opens by writing the URL', () => {
    const { result } = setup();
    act(() => result.current.route.open('lineup'));
    expect(result.current.location.search).toBe('?panel=lineup');
    expect(result.current.route.isOpen('lineup')).toBe(true);
  });

  it('opens with a detail', () => {
    const { result } = setup();
    act(() => result.current.route.open('lineup', 'MA'));
    expect(result.current.route.panel).toBe('lineup');
    expect(result.current.route.detail).toBe('MA');
  });

  it('drops a stale detail when the next open has none', () => {
    const { result } = setup(['/dashboard?panel=lineup&slot=GE1']);
    act(() => result.current.route.open('lineup'));
    expect(result.current.route.detail).toBeNull();
  });

  it('preserves unrelated query params', () => {
    const { result } = setup(['/dashboard?ref=discord']);
    act(() => result.current.route.open('concept'));
    expect(result.current.location.search).toContain('ref=discord');
    expect(result.current.location.search).toContain('panel=concept');
  });

  it('closes by popping the entry it pushed, so back and the X agree', () => {
    const { result } = setup(['/dashboard']);
    act(() => result.current.route.open('lineup'));
    act(() => result.current.route.close());
    expect(result.current.route.panel).toBeNull();
    expect(result.current.location.search).toBe('');
  });

  it('leaves the pre-open entry reachable after opening and closing', () => {
    // The whole point: opening a modal pushed exactly one entry, and closing
    // consumed exactly that one. Nothing extra is left on the stack.
    const { result } = setup(['/dashboard']);
    act(() => result.current.route.open('lineup'));
    act(() => result.current.route.close());
    expect(result.current.location.pathname).toBe('/dashboard');
    expect(result.current.route.panel).toBeNull();
  });

  it('closes a deep link by rewriting the URL, never by leaving the app', () => {
    // Arriving straight at ?panel=lineup pushed nothing, so there is no entry
    // to pop — going back would exit to wherever the link came from.
    const { result } = setup(['/dashboard?panel=lineup']);
    act(() => result.current.route.close());
    expect(result.current.route.panel).toBeNull();
    expect(result.current.location.pathname).toBe('/dashboard');
  });

  it('closes on a back gesture — the reason any of this exists', () => {
    // A hardware/gesture back pops the entry open() pushed, so the panel
    // closes instead of the dashboard being navigated away from.
    const { result } = setup(['/dashboard']);
    act(() => result.current.route.open('lineup'));
    act(() => result.current.navigate(-1));
    expect(result.current.route.panel).toBeNull();
    expect(result.current.location.pathname).toBe('/dashboard');
  });

  it('does not pop twice after a back gesture already closed the panel', () => {
    // close() must not consume an entry it no longer owns — that would eject
    // the director from the dashboard entirely.
    const { result } = setup(['/dashboard']);

    act(() => result.current.route.open('lineup'));
    act(() => result.current.navigate(-1));
    // The pushed entry is spent; a later close() has nothing of its own to pop.
    act(() => result.current.route.close());

    expect(result.current.route.panel).toBeNull();
    expect(result.current.location.pathname).toBe('/dashboard');
  });

  it('treats a double close as one dismissal', () => {
    // CaptionSelectionModal fires both onSubmit and onClose on every
    // successful save. Popping twice would throw the director off the
    // dashboard for the crime of saving their lineup.
    const { result } = setup(['/dashboard']);
    act(() => result.current.route.open('lineup'));
    act(() => {
      result.current.route.close();
      result.current.route.close();
    });
    expect(result.current.route.panel).toBeNull();
    expect(result.current.location.pathname).toBe('/dashboard');
  });

  it('treats a double close of a deep link as one dismissal too', () => {
    const { result } = setup(['/dashboard?panel=lineup']);
    act(() => {
      result.current.route.close();
      result.current.route.close();
    });
    expect(result.current.route.panel).toBeNull();
    expect(result.current.location.pathname).toBe('/dashboard');
  });

  it('ignores a close when nothing is open', () => {
    const { result } = setup(['/dashboard']);
    act(() => result.current.route.close());
    expect(result.current.location.pathname).toBe('/dashboard');
    expect(result.current.route.panel).toBeNull();
  });

  it('reopens cleanly after a close', () => {
    // The close latch must not survive into the next open.
    const { result } = setup(['/dashboard']);
    act(() => result.current.route.open('lineup'));
    act(() => result.current.route.close());
    act(() => result.current.route.open('lineup'));
    expect(result.current.route.isOpen('lineup')).toBe(true);
    act(() => result.current.route.close());
    expect(result.current.route.panel).toBeNull();
  });

  it('unwinds nested opens one at a time', () => {
    // Two opens pushed two entries, so two closes are needed to get back —
    // each close undoes exactly the step that made it.
    const { result } = setup(['/dashboard']);

    act(() => result.current.route.open('lineup'));
    act(() => result.current.route.open('concept'));
    act(() => result.current.route.close());
    expect(result.current.route.isOpen('lineup')).toBe(true);

    act(() => result.current.route.close());
    expect(result.current.route.panel).toBeNull();
    expect(result.current.location.pathname).toBe('/dashboard');
  });

  it('switches panels without stranding the first one open', () => {
    const { result } = setup();
    act(() => result.current.route.open('lineup'));
    act(() => result.current.route.open('concept'));
    expect(result.current.route.isOpen('concept')).toBe(true);
    expect(result.current.route.isOpen('lineup')).toBe(false);
  });
});
