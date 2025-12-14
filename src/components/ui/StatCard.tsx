import React, { forwardRef } from 'react';

// =============================================================================
// STAT CARD COMPONENT - Minimalist stat display
// =============================================================================

export type TrendDirection = 'up' | 'down' | 'neutral';

export interface StatCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Label displayed at the top (uppercase, muted) */
  label: string;
  /** Main value displayed prominently */
  value: string | number;
  /** Optional trend direction indicator */
  trend?: TrendDirection;
  /** Optional trend value/percentage */
  trendValue?: string;
}

const trendColors: Record<TrendDirection, string> = {
  up: 'text-green-500',
  down: 'text-red-500',
  neutral: 'text-[#888]',
};

const trendIcons: Record<TrendDirection, string> = {
  up: '↑',
  down: '↓',
  neutral: '→',
};

export const StatCard = forwardRef<HTMLDivElement, StatCardProps>(
  ({ label, value, trend, trendValue, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`
          bg-[#1A1A1A]
          border border-[#333]
          rounded-md
          p-4
          relative
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        {...props}
      >
        {/* Label - top, uppercase, muted */}
        <div className="text-xs uppercase tracking-wider text-[#888] mb-2">
          {label}
        </div>

        {/* Value - large, tabular-nums for alignment, bold */}
        <div className="text-2xl font-bold text-white tabular-nums">
          {value}
        </div>

        {/* Trend indicator - small, bottom right */}
        {trend && (
          <div
            className={`
              absolute bottom-3 right-4
              text-xs font-medium
              ${trendColors[trend]}
            `.trim().replace(/\s+/g, ' ')}
          >
            <span className="mr-0.5">{trendIcons[trend]}</span>
            {trendValue && <span>{trendValue}</span>}
          </div>
        )}
      </div>
    );
  }
);

StatCard.displayName = 'StatCard';

export default StatCard;
