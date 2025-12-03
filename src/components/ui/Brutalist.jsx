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
  variant = 'default', // 'default' | 'elevated' | 'flat' | 'accent' | 'interactive'
  padding = 'default', // 'none' | 'sm' | 'default' | 'lg'
  border = null, // 'success' | 'danger' | 'warning' | null (override border color)
  dimmed = false, // Apply reduced opacity for locked/past states
  animate = false,
  animateDelay = 0,
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
    interactive: `
      bg-white dark:bg-surface-secondary border-stone-900 dark:border-border-default
      shadow-brutal dark:shadow-brutal-gold cursor-pointer
      hover:shadow-brutal-sm dark:hover:shadow-brutal-gold-sm
      hover:translate-x-[2px] hover:translate-y-[2px]
      active:shadow-none active:translate-x-[4px] active:translate-y-[4px]
    `,
    success: 'bg-green-50 dark:bg-green-500/10 border-green-600 dark:border-green-500 shadow-brutal-success',
    danger: 'bg-red-50 dark:bg-red-500/10 border-red-600 dark:border-red-500 shadow-brutal-danger',
  };

  // Border override classes
  const borderClasses = {
    success: 'border-green-600 dark:border-green-500 border-l-4',
    danger: 'border-red-600 dark:border-red-500 border-l-4',
    warning: 'border-amber-500 dark:border-gold-500 border-l-4',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    default: 'p-4 md:p-5',
    lg: 'p-6 md:p-8',
  };

  const dimmedClass = dimmed ? 'opacity-50 grayscale pointer-events-none' : '';

  let classes = `${baseClasses} ${variantClasses[variant] || variantClasses.default} ${paddingClasses[padding]} ${dimmedClass} ${className}`;

  // Apply border override if specified
  if (border && borderClasses[border]) {
    classes = `${classes} ${borderClasses[border]}`;
  }

  if (animate) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: animateDelay }}
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
  size = 'default', // 'xs' | 'sm' | 'default' | 'lg'
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
    disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none disabled:transform-none
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
    xs: 'px-2 py-1 text-[10px]',
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
  variant = 'default', // 'default' | 'primary' | 'success' | 'danger' | 'warning' | 'muted' | 'outline'
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
    'outline-primary': 'bg-transparent border-2 border-primary text-primary',
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
export const BrutalistDivider = ({ className = '', variant = 'default' }) => {
  const variantClasses = {
    default: 'border-stone-300 dark:border-border-default',
    dashed: 'border-dashed border-stone-300 dark:border-border-default',
    primary: 'border-primary',
  };

  return (
    <hr className={`border-t-2 ${variantClasses[variant]} my-4 ${className}`} />
  );
};

// =============================================================================
// BRUTALIST HEADER
// Standardized page/section header with optional subtitle
// =============================================================================
export const BrutalistHeader = ({
  children,
  subtitle,
  size = 'default', // 'xs' | 'sm' | 'default' | 'lg' | 'xl'
  as: Component = 'h2',
  className = '',
}) => {
  const sizeClasses = {
    xs: 'text-sm md:text-base',
    sm: 'text-lg md:text-xl',
    default: 'text-xl md:text-2xl',
    lg: 'text-2xl md:text-3xl',
    xl: 'text-3xl md:text-4xl',
  };

  return (
    <div className={className}>
      <Component className={`font-display font-black uppercase tracking-tight text-text-main ${sizeClasses[size]}`}>
        {children}
      </Component>
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
  variant = 'default', // 'default' | 'primary' | 'success' | 'danger' | 'muted' | 'warning'
  size = 'default', // 'sm' | 'default' | 'lg'
  className = '',
}) => {
  const variantClasses = {
    default: 'bg-stone-100 dark:bg-surface-tertiary text-text-main border-stone-300 dark:border-border-default',
    primary: 'bg-primary/20 dark:bg-primary/30 text-primary border-primary/50',
    success: 'bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 border-green-300 dark:border-green-500/30',
    danger: 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 border-red-300 dark:border-red-500/30',
    warning: 'bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-500/30',
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

// =============================================================================
// BRUTALIST TIMELINE
// Connected badge-based timeline for week/step navigation
// =============================================================================
export const BrutalistTimeline = ({
  items, // Array of { id, label, status: 'active' | 'complete' | 'upcoming', badge?, onClick }
  className = '',
}) => {
  return (
    <div className={`relative flex items-center justify-between ${className}`}>
      {/* Connecting line */}
      <div className="absolute top-1/2 left-0 right-0 h-1 bg-stone-300 dark:bg-surface-tertiary -translate-y-1/2 z-0" />

      {/* Progress line for completed items */}
      {(() => {
        const lastCompleteIndex = items.reduce((acc, item, idx) =>
          item.status === 'complete' ? idx : acc, -1);
        const progressWidth = lastCompleteIndex >= 0
          ? ((lastCompleteIndex + 0.5) / (items.length - 1)) * 100
          : 0;
        return (
          <div
            className="absolute top-1/2 left-0 h-1 bg-primary -translate-y-1/2 z-0 transition-all duration-300"
            style={{ width: `${progressWidth}%` }}
          />
        );
      })()}

      {items.map((item, index) => {
        const isActive = item.status === 'active';
        const isComplete = item.status === 'complete';

        return (
          <button
            key={item.id}
            onClick={() => item.onClick?.(item.id)}
            className={`
              relative z-10 flex flex-col items-center transition-all duration-200
              ${isActive ? 'scale-110' : 'hover:scale-105'}
            `}
          >
            {/* Timeline Node - Using MetricBadge style */}
            <div className={`
              flex items-center justify-center rounded-full font-display font-black transition-all duration-200
              ${isActive
                ? 'w-14 h-14 md:w-16 md:h-16 bg-primary text-text-inverse shadow-brutal dark:shadow-brutal-gold ring-4 ring-primary/30'
                : isComplete
                ? 'w-10 h-10 md:w-12 md:h-12 bg-stone-400 dark:bg-surface-tertiary text-white dark:text-text-muted'
                : 'w-10 h-10 md:w-12 md:h-12 bg-white dark:bg-surface border-2 border-stone-300 dark:border-border-default text-text-muted'
              }
            `}>
              <span className={isActive ? 'text-xl md:text-2xl' : 'text-sm md:text-base'}>
                {item.label}
              </span>
            </div>

            {/* Status Label */}
            <div className={`mt-2 text-[10px] font-display font-bold uppercase tracking-wider ${
              isActive ? 'text-primary' : 'text-text-muted'
            }`}>
              {isActive ? 'Active' : isComplete ? 'Done' : 'Week'}
            </div>

            {/* Badge Count */}
            {item.badge > 0 && (
              <div className="mt-1">
                <span className="inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-green-500 text-white">
                  {item.badge}
                </span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
};

// =============================================================================
// BRUTALIST TIP
// Info/tip box with icon
// =============================================================================
export const BrutalistTip = ({
  children,
  icon: Icon,
  variant = 'info', // 'info' | 'warning' | 'success'
  className = '',
}) => {
  const variantClasses = {
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-300',
    warning: 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300',
    success: 'bg-green-500/10 border-green-500/30 text-green-700 dark:text-green-300',
  };

  const iconColors = {
    info: 'text-blue-600 dark:text-blue-400',
    warning: 'text-amber-600 dark:text-amber-400',
    success: 'text-green-600 dark:text-green-400',
  };

  return (
    <div className={`flex items-center gap-2 p-3 rounded-sm border-2 text-xs font-display ${variantClasses[variant]} ${className}`}>
      {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${iconColors[variant]}`} />}
      <span>{children}</span>
    </div>
  );
};

// =============================================================================
// BRUTALIST STAMP
// Rotated stamp effect for status overlays (REGISTERED, SOLD, etc.)
// =============================================================================
export const BrutalistStamp = ({
  children,
  variant = 'success', // 'success' | 'danger' | 'warning' | 'muted'
  className = '',
}) => {
  const variantClasses = {
    success: 'bg-green-600 text-white border-green-800',
    danger: 'bg-red-600 text-white border-red-800',
    warning: 'bg-amber-500 text-slate-900 border-amber-700',
    muted: 'bg-stone-500 text-white border-stone-700',
  };

  return (
    <div className={`transform rotate-12 ${className}`}>
      <div className={`px-3 py-1.5 text-xs font-display font-black uppercase tracking-widest shadow-brutal-sm border-2 ${variantClasses[variant]}`}>
        {children}
      </div>
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
  BrutalistTimeline,
  BrutalistTip,
  BrutalistStamp,
};
