import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';
import { Loader2, LucideIcon } from 'lucide-react';

// =============================================================================
// BUTTON COMPONENT
// =============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
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

// Button variant styles
const variantStyles: Record<ButtonVariant, string> = {
  primary: 'bg-[#0057B8] text-white border border-[#0057B8] hover:bg-[#004a9e]',
  secondary: 'bg-transparent border border-cream-500/30 text-cream hover:bg-white/5 hover:border-cream-500/50',
  ghost: 'bg-transparent text-cream/80 border border-transparent hover:bg-white/10 hover:text-cream',
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
          rounded-lg font-semibold
          transition-all duration-300 ease-out
          focus:outline-none focus:ring-2 focus:ring-[#0057B8]/50 focus:ring-offset-2 focus:ring-offset-charcoal-950
          disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none
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
