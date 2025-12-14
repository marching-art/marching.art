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

// Premium glass variant styles - Subtle borders, soft shadows, refined aesthetics
const variantStyles: Record<CardVariant, string> = {
  default: 'bg-black/35 backdrop-blur-sm border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.25)]',
  glass: 'bg-black/40 backdrop-blur-md border border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.3)]',
  'glass-dark': 'bg-black/60 backdrop-blur-md border border-white/8 shadow-[0_4px_30px_rgba(0,0,0,0.4)]',
  premium: 'bg-gradient-to-br from-charcoal-900/90 to-black/95 backdrop-blur-lg border border-gold-500/20 shadow-[0_4px_30px_rgba(0,0,0,0.3),0_0_20px_rgba(234,179,8,0.1)]',
  interactive: 'bg-black/35 backdrop-blur-sm border border-white/10 shadow-[0_4px_24px_rgba(0,0,0,0.25)] hover:border-gold-500/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.35),0_0_20px_rgba(234,179,8,0.1)] transition-all duration-300',
  outlined: 'bg-transparent border border-white/15 shadow-[0_2px_15px_rgba(0,0,0,0.2)]',
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
          rounded-xl
          transition-all duration-300 ease-out
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
            <div className="bg-gold-500/15 p-2.5 rounded-lg border border-gold-500/30">
              {icon}
            </div>
          )}
          <div>
            <h3 className="text-lg font-semibold text-cream">{title}</h3>
            {subtitle && (
              <p className="text-sm text-cream/60">{subtitle}</p>
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
        className={`mt-4 pt-4 border-t border-white/10 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

export default Card;
