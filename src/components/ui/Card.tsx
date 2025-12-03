import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

// =============================================================================
// CARD COMPONENT
// =============================================================================

export type CardVariant = 'default' | 'glass' | 'glass-dark' | 'premium' | 'interactive' | 'outlined';

export interface CardProps extends HTMLMotionProps<'div'> {
  variant?: CardVariant;
  hoverable?: boolean;
  pressable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

// Brutalist variant styles with hard shadows and 2px borders
const variantStyles: Record<CardVariant, string> = {
  default: 'bg-white dark:bg-charcoal-800 border-2 border-slate-900 dark:border-gold-500/30 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,212,77,1)]',
  glass: 'glass border-2 border-slate-900/20 dark:border-gold-500/20',
  'glass-dark': 'glass-dark border-2 border-slate-900/20 dark:border-gold-500/20',
  premium: 'bg-gradient-to-br from-amber-50 dark:from-gold-900/20 to-cream-100 dark:to-cream-900/10 border-2 border-amber-600 dark:border-gold-500 shadow-[4px_4px_0px_0px_rgba(217,163,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,212,77,1)]',
  interactive: 'bg-white dark:bg-charcoal-900/60 border-2 border-slate-900 dark:border-gold-500/30 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,212,77,1)] hover:shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] dark:hover:shadow-[6px_6px_0px_0px_rgba(255,212,77,1)] transition-all',
  outlined: 'bg-transparent border-2 border-slate-900 dark:border-gold-500/50',
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
    // Brutalist hover animation with hard shadow offset
    const hoverAnimation = hoverable
      ? {
          whileHover: { y: -4 },
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
          rounded
          transition-all duration-200
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          ${hoverable ? 'cursor-pointer hover:-translate-y-1' : ''}
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
            <h3 className="text-lg font-display font-bold text-slate-900 dark:text-cream-100">{title}</h3>
            {subtitle && (
              <p className="text-sm text-slate-500 dark:text-cream-500/70">{subtitle}</p>
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
        className={`mt-4 pt-4 border-t-2 border-slate-900/20 dark:border-gold-500/20 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

export default Card;
