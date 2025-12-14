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

// Premium refined: Subtle backgrounds, soft borders, no shadows
const variantStyles: Record<BadgeVariant, string> = {
  default: 'bg-white/10 text-cream border border-white/20',
  gold: 'bg-gold-500/15 text-gold-400 border border-gold-500/30',
  success: 'bg-green-500/15 text-green-400 border border-green-500/30',
  danger: 'bg-red-500/15 text-red-400 border border-red-500/30',
  warning: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
  info: 'bg-blue-500/15 text-blue-400 border border-blue-500/30',
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
        inline-flex items-center font-medium rounded-full
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
        text-xs font-medium text-cream/80
        rounded-full bg-white/10 border border-white/15
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
