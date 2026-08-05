// Mobile-only segmented control over the dashboard's three lower zones.
//
// Controlled rather than self-managed: the Next Action hero can ask for a panel
// that lives in a zone the director is not currently looking at, and the
// dashboard has to be able to switch here on their behalf. That is also why
// this is not the shared ui/Tabs primitive, which owns its own state and pairs
// with TabContent — these zones stay where they are in the desktop grid and are
// only shown or hidden, so there is no content to move inside a tab panel.
//
// The zone list and the default live in utils/dashboardZones.

import React from 'react';
import { triggerHaptic } from '../../../hooks/useHaptic';
import { DASHBOARD_ZONES, type DashboardZoneId } from '../../../utils/dashboardZones';

export interface ZoneTabsProps {
  active: DashboardZoneId;
  onChange: (zone: DashboardZoneId) => void;
  /** Zones with something needing attention, shown as a dot on the tab. */
  attention?: Partial<Record<DashboardZoneId, boolean>>;
}

const ZoneTabs: React.FC<ZoneTabsProps> = ({ active, onChange, attention }) => {
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const index = DASHBOARD_ZONES.findIndex((zone) => zone.id === active);
    if (index === -1) return;

    let next: number | null = null;
    if (event.key === 'ArrowRight') next = (index + 1) % DASHBOARD_ZONES.length;
    if (event.key === 'ArrowLeft')
      next = (index - 1 + DASHBOARD_ZONES.length) % DASHBOARD_ZONES.length;
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = DASHBOARD_ZONES.length - 1;
    if (next === null) return;

    event.preventDefault();
    onChange(DASHBOARD_ZONES[next].id);
  };

  return (
    <div
      role="tablist"
      aria-label="Dashboard sections"
      onKeyDown={handleKeyDown}
      className="lg:hidden flex bg-surface-card border border-line"
    >
      {DASHBOARD_ZONES.map((zone) => {
        const isActive = zone.id === active;
        return (
          <button
            key={zone.id}
            type="button"
            role="tab"
            id={`zone-tab-${zone.id}`}
            aria-selected={isActive}
            aria-controls={zone.elementId}
            // Roving tabindex: one stop for the whole group, arrows move within.
            tabIndex={isActive ? 0 : -1}
            onClick={() => {
              triggerHaptic('light');
              onChange(zone.id);
            }}
            className={`flex-1 min-h-touch px-2 text-[11px] font-bold uppercase tracking-wider transition-colors duration-150 press-feedback ${
              isActive
                ? 'bg-interactive text-white'
                : 'text-muted hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="inline-flex items-center justify-center gap-1.5">
              {zone.label}
              {/* Only on zones you are NOT looking at. A dot on the open tab
                  says nothing the visible content does not already say. */}
              {!isActive && attention?.[zone.id] && (
                <span className="w-1.5 h-1.5 rounded-full bg-warning" aria-hidden="true" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export default ZoneTabs;
