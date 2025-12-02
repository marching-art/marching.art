import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

// =============================================================================
// CARD COMPONENT
// =============================================================================

export type CardVariant = 'default' | 'glass' | 'glass-dark' | 'premium' | 'outlined';

export interface CardProps extends HTMLMotionProps<'div'> {
  variant?: CardVariant;
  hoverable?: boolean;
  pressable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'bg-charcoal-800 border border-cream-900/20',
  glass: 'glass',
  'glass-dark': 'glass-dark',
  premium: 'bg-gradient-to-br from-gold-900/20 to-cream-900/10 border border-gold-700/30',
  outlined: 'bg-transparent border border-cream-800',
};

const paddingStyles: Record<string, string> = {
  none: 'p-0',
  sm: 'p-4',
  md: 'p-6',
  lg: 'p-8',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = 'default',
      hoverable = false,
      pressable = false,
      padding = 'md',
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const hoverAnimation = hoverable
      ? {
          whileHover: { y: -4, boxShadow: '0 0 20px rgba(255, 212, 77, 0.3)' },
          transition: { duration: 0.2 },
        }
      : {};

    const pressAnimation = pressable
      ? {
          whileTap: { scale: 0.98 },
        }
      : {};

    return (
      <motion.div
        ref={ref}
        {...hoverAnimation}
        {...pressAnimation}
        className={`
          rounded-xl
          transition-all duration-300
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          ${hoverable ? 'cursor-pointer hover:shadow-xl' : ''}
          ${pressable ? 'cursor-pointer' : ''}
          ${className}
        `.trim()}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = 'Card';

// =============================================================================
// CARD HEADER COMPONENT
// =============================================================================

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ title, subtitle, action, icon, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`flex items-center justify-between mb-4 ${className}`}
        {...props}
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className="bg-gradient-to-br from-gold-500 to-gold-600 p-2.5 rounded-lg">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-lg font-display font-bold text-cream-100">{title}</h3>
            {subtitle && (
              <p className="text-sm text-cream-500/70">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div>{action}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// =============================================================================
// CARD CONTENT COMPONENT
// =============================================================================

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={className} {...props}>
        {children}
      </div>
    );
  }
);

CardContent.displayName = 'CardContent';

// =============================================================================
// CARD FOOTER COMPONENT
// =============================================================================

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`mt-4 pt-4 border-t border-cream-900/20 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

export default Card;
