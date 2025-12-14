import React, { forwardRef } from 'react';

// =============================================================================
// CARD COMPONENT - Clean, flat design
// =============================================================================

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean;
  pressable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const paddingStyles: Record<string, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

// Main Card Component
const CardRoot = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      hoverable = false,
      pressable = false,
      padding = 'none',
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`
          bg-[#1A1A1A]
          border border-[#333]
          rounded-md
          ${paddingStyles[padding]}
          ${hoverable ? 'cursor-pointer hover:border-[#444] transition-colors duration-200' : ''}
          ${pressable ? 'cursor-pointer active:scale-[0.99] transition-transform duration-100' : ''}
          ${className}
        `.trim().replace(/\s+/g, ' ')}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardRoot.displayName = 'Card';

// =============================================================================
// CARD HEADER COMPONENT - With border-bottom
// =============================================================================

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-4 py-3 border-b border-[#333] ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// =============================================================================
// CARD BODY COMPONENT - p-4 padding
// =============================================================================

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`p-4 ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

// =============================================================================
// CARD FOOTER COMPONENT
// =============================================================================

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-4 py-3 border-t border-[#333] ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

// =============================================================================
// CARD CONTENT COMPONENT (Legacy support)
// =============================================================================

export interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
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
// COMPOUND COMPONENT EXPORT
// =============================================================================

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Body: CardBody,
  Footer: CardFooter,
});

// Named exports for backwards compatibility
export { CardHeader, CardContent, CardFooter, CardBody };

export default Card;
