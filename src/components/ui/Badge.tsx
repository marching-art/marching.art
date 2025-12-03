import React from 'react';

// =============================================================================
// BADGE COMPONENT
// =============================================================================

export type BadgeVariant = 'default' | 'gold' | 'success' | 'danger' | 'warning' | 'info';
export type BadgeSize = 'sm' | 'md' | 'lg';

export interface BadgeProps {
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: React.ReactNode;
  className?: string;
}

// Tactical Brutalist: Solid flat colors, 2px borders, hard shadows
const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-stone-500 text-white border-2 border-neutral-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
  gold: 'bg-amber-500 text-charcoal-900 border-2 border-neutral-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
  success: 'bg-green-500 text-white border-2 border-neutral-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
  danger: 'bg-red-500 text-white border-2 border-neutral-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
  warning: 'bg-yellow-500 text-charcoal-900 border-2 border-neutral-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
  info: 'bg-blue-500 text-white border-2 border-neutral-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]',
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-3 py-1 text-xs',
  lg: 'px-4 py-1.5 text-sm',
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  size = 'md',
  children,
  className = '',
}) => {
  return (
    <span
      className={`
        inline-flex items-center font-display font-semibold uppercase tracking-tight rounded-sm
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
    >
      {children}
    </span>
  );
};

// =============================================================================
// STATUS BADGE COMPONENT
// =============================================================================

export type StatusType = 'online' | 'offline' | 'busy' | 'away';

export interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showDot?: boolean;
  className?: string;
}

const statusColors: Record<StatusType, string> = {
  online: 'bg-green-500',
  offline: 'bg-gray-500',
  busy: 'bg-red-500',
  away: 'bg-yellow-500',
};

const statusLabels: Record<StatusType, string> = {
  online: 'Online',
  offline: 'Offline',
  busy: 'Busy',
  away: 'Away',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  showDot = true,
  className = '',
}) => {
  return (
    <span
      className={`
        inline-flex items-center gap-2 px-2.5 py-1
        text-xs font-display font-medium uppercase tracking-tight text-cream-300
        rounded-sm bg-charcoal-800 border-2 border-neutral-900 dark:border-gold-500/30
        shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] dark:shadow-[2px_2px_0px_0px_rgba(255,212,77,0.5)]
        ${className}
      `}
    >
      {showDot && (
        <span className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
      )}
      {label || statusLabels[status]}
    </span>
  );
};

export default Badge;
