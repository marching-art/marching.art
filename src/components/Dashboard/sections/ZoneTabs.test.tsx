import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('../../../hooks/useHaptic', () => ({ triggerHaptic: vi.fn() }));

import ZoneTabs from './ZoneTabs';
import { DASHBOARD_ZONES } from '../../../utils/dashboardZones';

const onChange = vi.fn();

const renderTabs = (props: Partial<React.ComponentProps<typeof ZoneTabs>> = {}) =>
  render(<ZoneTabs active="corps" onChange={onChange} {...props} />);

describe('ZoneTabs', () => {
  beforeEach(() => onChange.mockReset());

  it('offers every zone as a tab', () => {
    renderTabs();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent?.trim())).toEqual(DASHBOARD_ZONES.map((z) => z.label));
  });

  it('marks only the active zone selected, and points it at its panel', () => {
    renderTabs({ active: 'today' });
    const today = screen.getByRole('tab', { name: /Today/ });
    expect(today).toHaveAttribute('aria-selected', 'true');
    expect(today).toHaveAttribute('aria-controls', 'zone-today');
    expect(screen.getByRole('tab', { name: /My Corps/ })).toHaveAttribute('aria-selected', 'false');
  });

  it('reports the zone that was tapped', () => {
    renderTabs();
    fireEvent.click(screen.getByRole('tab', { name: /Season/ }));
    expect(onChange).toHaveBeenCalledWith('season');
  });

  it('keeps one tab stop for the group and moves within it by arrow key', () => {
    // Roving tabindex — the standard tablist keyboard contract.
    renderTabs({ active: 'corps' });
    const tabs = screen.getAllByRole('tab');
    expect(tabs.filter((t) => t.getAttribute('tabindex') === '0')).toHaveLength(1);

    fireEvent.keyDown(tabs[0], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('today');
  });

  it('wraps around at both ends', () => {
    renderTabs({ active: 'corps' });
    fireEvent.keyDown(screen.getAllByRole('tab')[0], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('season');
  });

  it('jumps to the first and last zone with Home and End', () => {
    renderTabs({ active: 'today' });
    const tabs = screen.getAllByRole('tab');
    fireEvent.keyDown(tabs[1], { key: 'End' });
    expect(onChange).toHaveBeenCalledWith('season');
    fireEvent.keyDown(tabs[1], { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith('corps');
  });

  it('ignores keys that are not navigation', () => {
    renderTabs();
    fireEvent.keyDown(screen.getAllByRole('tab')[0], { key: 'a' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('dots a zone with something waiting that you are not looking at', () => {
    const { container } = renderTabs({ active: 'corps', attention: { today: true } });
    expect(screen.getByRole('tab', { name: /Today/ }).querySelector('span > span')).not.toBeNull();
    expect(container.querySelectorAll('[role="tab"] span > span')).toHaveLength(1);
  });

  it('drops the dot once you open that zone', () => {
    // The open tab's content already says whatever the dot would.
    const { container } = renderTabs({ active: 'today', attention: { today: true } });
    expect(container.querySelectorAll('[role="tab"] span > span')).toHaveLength(0);
  });

  it('stays out of the desktop layout', () => {
    const { container } = renderTabs();
    expect(container.querySelector('[role="tablist"]')).toHaveClass('lg:hidden');
  });
});
