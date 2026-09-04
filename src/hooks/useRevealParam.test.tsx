import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { useRevealParam } from './useRevealParam';

let lastSearch = '';

const Probe = ({ ready, revealPanel }: { ready: boolean; revealPanel: (id: string) => void }) => {
  useRevealParam({ ready, revealPanel });
  lastSearch = useLocation().search;
  return null;
};

const mount = (search: string, ready: boolean, revealPanel = vi.fn()) => {
  const utils = render(
    <MemoryRouter initialEntries={[`/dashboard${search}`]}>
      <Probe ready={ready} revealPanel={revealPanel} />
    </MemoryRouter>
  );
  return { ...utils, revealPanel };
};

describe('useRevealParam', () => {
  it('reveals the named panel once the dashboard is ready, then drops the param', () => {
    const { revealPanel } = mount('?reveal=journey-panel', true);
    expect(revealPanel).toHaveBeenCalledWith('journey-panel');
    expect(lastSearch).toBe('');
  });

  it('waits for the panels to exist before revealing', () => {
    const revealPanel = vi.fn();
    const { rerender } = mount('?reveal=journey-panel', false, revealPanel);
    expect(revealPanel).not.toHaveBeenCalled();
    expect(lastSearch).toBe('?reveal=journey-panel');

    rerender(
      <MemoryRouter initialEntries={['/dashboard?reveal=journey-panel']}>
        <Probe ready revealPanel={revealPanel} />
      </MemoryRouter>
    );
    expect(revealPanel).toHaveBeenCalledWith('journey-panel');
  });

  it('leaves other query params alone', () => {
    mount('?reveal=journey-panel&panel=lineup', true);
    expect(lastSearch).toBe('?panel=lineup');
  });

  it('does nothing without a reveal param', () => {
    const { revealPanel } = mount('', true);
    expect(revealPanel).not.toHaveBeenCalled();
  });
});
