import React from 'react';
import type { LucideIcon } from 'lucide-react';

// =============================================================================
// PAGE HEADER COMPONENT
// =============================================================================
// Shared fixed header for GameShell pages. Matches the ESPN-terminal look
// established by the Schedule and Scores pages so every page reads as one
// system: tight #1a1a1a bar, an accent icon, an uppercase title, an optional
// subtitle, and up to a few right-aligned stats.
//
// Laws: no glow, no shadow, sharp corners, dense spacing.

export interface PageHeaderStat {
  /** Small uppercase caption above the value */
  label: string;
  /** The value itself (string, number, or a formatted node) */
  value: React.ReactNode;
  /** Optional override for the value color/emphasis */
  valueClassName?: string;
}

export interface PageHeaderProps {
  /** Accent icon rendered at the left of the header */
  icon: LucideIcon;
  /** Tailwind classes for the icon (defaults to the brand blue) */
  iconClassName?: string;
  /** Uppercase title */
  title: string;
  /** Optional subtitle line beneath the title */
  subtitle?: React.ReactNode;
  /** Optional right-aligned stat pairs (rendered when `children` is absent) */
  stats?: PageHeaderStat[];
  /** Custom right-side content; takes precedence over `stats` */
  children?: React.ReactNode;
  /** Extra classes for the outer bar */
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  icon: Icon,
  iconClassName = 'text-interactive',
  title,
  subtitle,
  stats,
  children,
  className = '',
}) => {
  return (
    <div className={`flex-shrink-0 bg-surface-card border-b border-line px-4 py-3 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Icon className={`w-5 h-5 flex-shrink-0 ${iconClassName}`} aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white uppercase tracking-wider truncate">
              {title}
            </h1>
            {subtitle && <div className="text-[10px] text-muted truncate">{subtitle}</div>}
          </div>
        </div>

        {children
          ? children
          : stats &&
            stats.length > 0 && (
              <div className="flex items-center gap-4 text-xs flex-shrink-0">
                {stats.map((stat, idx) => (
                  <div key={idx} className="text-right">
                    <div className="text-[10px] text-muted uppercase">{stat.label}</div>
                    <div
                      className={`font-bold font-data tabular-nums ${
                        stat.valueClassName || 'text-white'
                      }`}
                    >
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>
            )}
      </div>
    </div>
  );
};

export default PageHeader;
