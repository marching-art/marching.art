import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2, LucideIcon } from 'lucide-react';

// =============================================================================
// BUTTON COMPONENT
// =============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  isDisabled?: boolean;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  fullWidth?: boolean;
  children: React.ReactNode;
}

// Tactical Brutalist variant styles - FLAT solid colors, hard shadows, 2px borders
// NO gradients allowed - all buttons are solid fills
const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-gold-500 text-charcoal-900 border-2 border-neutral-900 dark:border-gold-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,212,77,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,212,77,1)]',
  secondary: 'bg-charcoal-800 text-cream-100 border-2 border-neutral-900 dark:border-gold-500/30 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,212,77,0.5)] hover:bg-charcoal-700 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,212,77,0.5)]',
  outline: 'bg-transparent border-2 border-neutral-900 dark:border-gold-500 text-neutral-900 dark:text-gold-500 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,212,77,0.5)] hover:bg-gold-500 hover:text-charcoal-900 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,212,77,1)]',
  ghost: 'bg-transparent text-cream-300 border-2 border-transparent hover:bg-cream-900/20 shadow-none',
  danger: 'bg-red-600 text-white border-2 border-neutral-900 dark:border-red-600 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(239,68,68,1)] hover:bg-red-700 hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(239,68,68,1)]',
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-2 text-sm min-h-[36px]',
  md: 'px-5 py-3 text-base min-h-[44px]',
  lg: 'px-8 py-4 text-lg min-h-[52px]',
};

const iconSizes: Record<ButtonSize, string> = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      isDisabled = false,
      leftIcon: LeftIcon,
      rightIcon: RightIcon,
      fullWidth = false,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const disabled = isDisabled || isLoading;

    return (
      <motion.button
        ref={ref}
        whileHover={disabled ? undefined : { scale: 1.02 }}
        whileTap={disabled ? undefined : { scale: 0.98 }}
        disabled={disabled}
        className={`
          inline-flex items-center justify-center gap-2
          rounded-sm font-display font-semibold uppercase tracking-tight
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-gold-500 focus:ring-offset-2 focus:ring-offset-charcoal-900
          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `.trim()}
        {...props}
      >
        {isLoading ? (
          <Loader2 className={`${iconSizes[size]} animate-spin`} />
        ) : LeftIcon ? (
          <LeftIcon className={iconSizes[size]} />
        ) : null}

        <span>{children}</span>

        {!isLoading && RightIcon && (
          <RightIcon className={iconSizes[size]} />
        )}
      </motion.button>
    );
  }
);

Button.displayName = 'Button';

// =============================================================================
// ICON BUTTON COMPONENT
// =============================================================================

export interface IconButtonProps extends Omit<ButtonProps, 'children' | 'leftIcon' | 'rightIcon'> {
  icon: LucideIcon;
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, size = 'md', className = '', ...props }, ref) => {
    const iconButtonSizes: Record<ButtonSize, string> = {
      sm: 'p-2 min-h-[36px] min-w-[36px]',
      md: 'p-2.5 min-h-[44px] min-w-[44px]',
      lg: 'p-3 min-h-[52px] min-w-[52px]',
    };

    return (
      <Button
        ref={ref}
        size={size}
        className={`${iconButtonSizes[size]} ${className}`}
        {...props}
      >
        <Icon className={iconSizes[size]} />
      </Button>
    );
  }
);

IconButton.displayName = 'IconButton';

export default Button;
