// =============================================================================
// CARD COMPONENT - ESPN RIGID BOX STYLE
// =============================================================================
// Rigid boxes, not floating bubbles. No shadows, no glow.
// Laws: No padding in body (p-0), let child content define spacing

import React, { forwardRef } from 'react';

// =============================================================================
// TYPES
// =============================================================================

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Make card clickable with hover state */
  hoverable?: boolean;
  /** Make card act as a button */
  pressable?: boolean;
  children: React.ReactNode;
}

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Header content - use with CardTitle or custom content */
  children: React.ReactNode;
  /** Right-side actions slot */
  action?: React.ReactNode;
}

export interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {
  children: React.ReactNode;
}

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

// =============================================================================
// CARD ROOT - bg-[#1a1a1a] border border-[#333] rounded-sm
// =============================================================================

const CardRoot = forwardRef<HTMLDivElement, CardProps>(
  ({ hoverable = false, pressable = false, children, className = '', onClick, ...props }, ref) => {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (pressable && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        onClick?.(e as unknown as React.MouseEvent<HTMLDivElement>);
      }
    };

    return (
      <div
        ref={ref}
        role={pressable ? 'button' : undefined}
        tabIndex={pressable ? 0 : undefined}
        onKeyDown={pressable ? handleKeyDown : undefined}
        onClick={onClick}
        className={`
          bg-[#1a1a1a] border border-[#333] rounded-sm
          ${hoverable ? 'cursor-pointer hover:border-[#555]' : ''}
          ${pressable ? 'cursor-pointer active:bg-[#222] focus:outline-none focus:border-[#0057B8]' : ''}
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
// CARD HEADER - px-3 py-2 border-b border-[#333] bg-[#222]
// =============================================================================

const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, action, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-3 py-2 border-b border-[#333] bg-[#222] flex justify-between items-center ${className}`}
        {...props}
      >
        <div className="flex items-center gap-2">{children}</div>
        {action && <div className="flex items-center gap-1">{action}</div>}
      </div>
    );
  }
);

CardHeader.displayName = 'CardHeader';

// =============================================================================
// CARD TITLE - text-xs font-bold uppercase text-gray-400
// =============================================================================

const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={`text-xs font-bold uppercase text-gray-400 tracking-wider ${className}`}
        {...props}
      >
        {children}
      </h3>
    );
  }
);

CardTitle.displayName = 'CardTitle';

// =============================================================================
// CARD BODY - p-0 (child content defines padding)
// =============================================================================

const CardBody = forwardRef<HTMLDivElement, CardBodyProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div ref={ref} className={className} {...props}>
        {children}
      </div>
    );
  }
);

CardBody.displayName = 'CardBody';

// =============================================================================
// CARD FOOTER - px-3 py-2 border-t border-[#333] bg-[#222]
// =============================================================================

const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={`px-3 py-2 border-t border-[#333] bg-[#222] ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

CardFooter.displayName = 'CardFooter';

// =============================================================================
// CARD CONTENT (Legacy - alias for CardBody)
// =============================================================================

const CardContent = CardBody;
CardContent.displayName = 'CardContent';

// =============================================================================
// COMPOUND COMPONENT EXPORT
// =============================================================================

export const Card = Object.assign(CardRoot, {
  Header: CardHeader,
  Title: CardTitle,
  Body: CardBody,
  Footer: CardFooter,
});

// Named exports for backwards compatibility
export { CardHeader, CardTitle, CardContent, CardFooter, CardBody };

export default Card;
