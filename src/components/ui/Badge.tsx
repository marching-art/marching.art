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

// Solid color variants with white text for maximum visibility
const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-stone-500 text-white border-stone-600',
  gold: 'bg-amber-500 text-white border-amber-600',
  success: 'bg-green-500 text-white border-green-600',
  danger: 'bg-red-500 text-white border-red-600',
  warning: 'bg-yellow-500 text-white border-yellow-600',
  info: 'bg-blue-500 text-white border-blue-600',
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
        inline-flex items-center font-semibold rounded-full border
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
        text-xs font-medium text-cream-300
        rounded-full bg-charcoal-800 border border-cream-900/20
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
