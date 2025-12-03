// src/components/ui/Brutalist.jsx
// Reusable Brutalist Design System Components
import React from 'react';
import { motion } from 'framer-motion';

// =============================================================================
// BRUTALIST CARD
// A wrapper that applies consistent brutalist styling: border, bg, shadow
// =============================================================================
export const BrutalistCard = ({
  children,
  className = '',
  variant = 'default', // 'default' | 'elevated' | 'flat' | 'accent'
  padding = 'default', // 'none' | 'sm' | 'default' | 'lg'
  animate = false,
  onClick,
  as: Component = 'div',
  ...props
}) => {
  const baseClasses = 'rounded-sm border-2 transition-all duration-200';

  const variantClasses = {
    default: 'bg-white dark:bg-surface-secondary border-stone-900 dark:border-border-default shadow-brutal dark:shadow-brutal-gold',
    elevated: 'bg-white dark:bg-surface-secondary border-stone-900 dark:border-border-default shadow-brutal-lg dark:shadow-brutal-gold-lg',
    flat: 'bg-white dark:bg-surface-secondary border-stone-200 dark:border-border-default',
    accent: 'bg-primary/10 dark:bg-primary/20 border-primary shadow-brutal dark:shadow-brutal-gold',
    success: 'bg-green-50 dark:bg-green-500/10 border-green-600 dark:border-green-500 shadow-brutal-success',
    danger: 'bg-red-50 dark:bg-red-500/10 border-red-600 dark:border-red-500 shadow-brutal-danger',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    default: 'p-4 md:p-5',
    lg: 'p-6 md:p-8',
  };

  const classes = `${baseClasses} ${variantClasses[variant] || variantClasses.default} ${paddingClasses[padding]} ${className}`;

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={classes}
        onClick={onClick}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <Component className={classes} onClick={onClick} {...props}>
      {children}
    </Component>
  );
};

// =============================================================================
// BRUTALIST BUTTON
// Standardized button with hover states (shadow reduction), disabled states,
// and multiple variants (solid, outline, ghost)
// =============================================================================
export const BrutalistButton = ({
  children,
  variant = 'solid', // 'solid' | 'outline' | 'ghost' | 'danger' | 'success'
  size = 'default', // 'sm' | 'default' | 'lg'
  disabled = false,
  loading = false,
  fullWidth = false,
  className = '',
  as: Component = 'button',
  ...props
}) => {
  const baseClasses = `
    inline-flex items-center justify-center gap-2
    font-display font-bold uppercase tracking-wider
    border-2 rounded-sm
    transition-all duration-150
    focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none
  `;

  // Hover: reduce shadow offset for "press" effect
  const variantClasses = {
    solid: `
      bg-primary text-text-inverse border-stone-900
      shadow-brutal dark:shadow-brutal-gold
      hover:shadow-brutal-sm dark:hover:shadow-brutal-gold-sm
      hover:translate-x-[2px] hover:translate-y-[2px]
      active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
    `,
    outline: `
      bg-transparent text-text-main border-stone-900 dark:border-border-default
      shadow-brutal dark:shadow-brutal-gold
      hover:bg-stone-100 dark:hover:bg-surface-tertiary
      hover:shadow-brutal-sm dark:hover:shadow-brutal-gold-sm
      hover:translate-x-[2px] hover:translate-y-[2px]
      active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
    `,
    ghost: `
      bg-transparent text-text-muted border-transparent
      hover:text-text-main hover:bg-stone-100 dark:hover:bg-surface-tertiary
    `,
    danger: `
      bg-danger text-white border-red-800
      shadow-brutal-danger
      hover:shadow-brutal-sm dark:hover:shadow-brutal-gold-sm
      hover:translate-x-[2px] hover:translate-y-[2px]
      active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
    `,
    success: `
      bg-success text-white border-green-800
      shadow-brutal-success
      hover:shadow-brutal-sm dark:hover:shadow-brutal-gold-sm
      hover:translate-x-[2px] hover:translate-y-[2px]
      active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
    `,
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    default: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  const classes = `
    ${baseClasses}
    ${variantClasses[variant] || variantClasses.solid}
    ${sizeClasses[size]}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `.replace(/\s+/g, ' ').trim();

  return (
    <Component
      className={classes}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      )}
      {children}
    </Component>
  );
};

// =============================================================================
// METRIC BADGE
// Standard pill/box for scores, status tags, and counts
// =============================================================================
export const MetricBadge = ({
  children,
  variant = 'default', // 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'muted'
  size = 'default', // 'sm' | 'default' | 'lg'
  icon: Icon,
  className = '',
  ...props
}) => {
  const baseClasses = 'inline-flex items-center gap-1.5 font-display font-bold uppercase tracking-wider rounded-full';

  const variantClasses = {
    default: 'bg-stone-100 dark:bg-surface-tertiary text-text-main border border-stone-300 dark:border-border-default',
    primary: 'bg-primary text-text-inverse',
    success: 'bg-green-500 text-white',
    danger: 'bg-red-500 text-white',
    warning: 'bg-amber-500 text-slate-900',
    muted: 'bg-stone-500 text-white',
    info: 'bg-blue-500 text-white',
    outline: 'bg-transparent border-2 border-stone-900 dark:border-border-default text-text-main',
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-[10px]',
    default: 'px-3 py-1 text-xs',
    lg: 'px-4 py-1.5 text-sm',
  };

  const classes = `${baseClasses} ${variantClasses[variant] || variantClasses.default} ${sizeClasses[size]} ${className}`;

  return (
    <span className={classes} {...props}>
      {Icon && <Icon className={size === 'sm' ? 'w-3 h-3' : size === 'lg' ? 'w-5 h-5' : 'w-4 h-4'} />}
      {children}
    </span>
  );
};

// =============================================================================
// BRUTALIST DIVIDER
// A simple themed horizontal divider
// =============================================================================
export const BrutalistDivider = ({ className = '' }) => (
  <hr className={`border-t-2 border-stone-300 dark:border-border-default my-4 ${className}`} />
);

// =============================================================================
// BRUTALIST HEADER
// Standardized page/section header with optional subtitle
// =============================================================================
export const BrutalistHeader = ({
  children,
  subtitle,
  size = 'default', // 'sm' | 'default' | 'lg' | 'xl'
  className = '',
}) => {
  const sizeClasses = {
    sm: 'text-lg md:text-xl',
    default: 'text-xl md:text-2xl',
    lg: 'text-2xl md:text-3xl',
    xl: 'text-3xl md:text-4xl',
  };

  return (
    <div className={className}>
      <h2 className={`font-display font-black uppercase tracking-tight text-text-main ${sizeClasses[size]}`}>
        {children}
      </h2>
      {subtitle && (
        <p className="text-sm text-text-muted font-medium mt-1">{subtitle}</p>
      )}
    </div>
  );
};

// =============================================================================
// BRUTALIST ICON BOX
// Icon container with consistent brutalist styling
// =============================================================================
export const BrutalistIconBox = ({
  icon: Icon,
  variant = 'default', // 'default' | 'primary' | 'success' | 'danger' | 'muted'
  size = 'default', // 'sm' | 'default' | 'lg'
  className = '',
}) => {
  const variantClasses = {
    default: 'bg-stone-100 dark:bg-surface-tertiary text-text-main border-stone-300 dark:border-border-default',
    primary: 'bg-primary/20 dark:bg-primary/30 text-primary border-primary/50',
    success: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 border-green-300 dark:border-green-500/30',
    danger: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/30',
    muted: 'bg-stone-200 dark:bg-surface-highlight text-text-muted border-stone-300 dark:border-border-default',
  };

  const sizeClasses = {
    sm: 'p-1.5',
    default: 'p-2',
    lg: 'p-3',
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    default: 'w-5 h-5',
    lg: 'w-6 h-6',
  };

  return (
    <div className={`rounded-sm border-2 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}>
      {Icon && <Icon className={iconSizes[size]} />}
    </div>
  );
};

export default {
  BrutalistCard,
  BrutalistButton,
  MetricBadge,
  BrutalistDivider,
  BrutalistHeader,
  BrutalistIconBox,
};
