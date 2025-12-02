// =============================================================================
// BADGE COMPONENT TESTS
// =============================================================================

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge, StatusBadge } from './Badge';

describe('Badge', () => {
  describe('rendering', () => {
    it('renders children correctly', () => {
      render(<Badge>Test Badge</Badge>);
      expect(screen.getByText('Test Badge')).toBeInTheDocument();
    });

    it('renders as a span element', () => {
      render(<Badge>Badge</Badge>);
      expect(screen.getByText('Badge').tagName).toBe('SPAN');
    });
  });

  describe('variants', () => {
    it('applies default variant styles', () => {
      render(<Badge variant="default">Default</Badge>);
      const badge = screen.getByText('Default');
      expect(badge).toHaveClass('bg-cream-900/30');
      expect(badge).toHaveClass('text-cream-300');
    });

    it('applies gold variant styles', () => {
      render(<Badge variant="gold">Gold</Badge>);
      const badge = screen.getByText('Gold');
      expect(badge).toHaveClass('bg-gold-900/30');
      expect(badge).toHaveClass('text-gold-300');
    });

    it('applies success variant styles', () => {
      render(<Badge variant="success">Success</Badge>);
      const badge = screen.getByText('Success');
      expect(badge).toHaveClass('bg-green-900/30');
      expect(badge).toHaveClass('text-green-300');
    });

    it('applies danger variant styles', () => {
      render(<Badge variant="danger">Danger</Badge>);
      const badge = screen.getByText('Danger');
      expect(badge).toHaveClass('bg-red-900/30');
      expect(badge).toHaveClass('text-red-300');
    });

    it('applies warning variant styles', () => {
      render(<Badge variant="warning">Warning</Badge>);
      const badge = screen.getByText('Warning');
      expect(badge).toHaveClass('bg-yellow-900/30');
      expect(badge).toHaveClass('text-yellow-300');
    });

    it('applies info variant styles', () => {
      render(<Badge variant="info">Info</Badge>);
      const badge = screen.getByText('Info');
      expect(badge).toHaveClass('bg-blue-900/30');
      expect(badge).toHaveClass('text-blue-300');
    });
  });

  describe('sizes', () => {
    it('applies small size styles', () => {
      render(<Badge size="sm">Small</Badge>);
      const badge = screen.getByText('Small');
      expect(badge).toHaveClass('px-2');
      expect(badge).toHaveClass('py-0.5');
      expect(badge).toHaveClass('text-xs');
    });

    it('applies medium size styles by default', () => {
      render(<Badge>Medium</Badge>);
      const badge = screen.getByText('Medium');
      expect(badge).toHaveClass('px-3');
      expect(badge).toHaveClass('py-1');
    });

    it('applies large size styles', () => {
      render(<Badge size="lg">Large</Badge>);
      const badge = screen.getByText('Large');
      expect(badge).toHaveClass('px-4');
      expect(badge).toHaveClass('py-1.5');
      expect(badge).toHaveClass('text-sm');
    });
  });

  describe('custom className', () => {
    it('accepts and applies custom className', () => {
      render(<Badge className="custom-class">Custom</Badge>);
      expect(screen.getByText('Custom')).toHaveClass('custom-class');
    });
  });

  describe('base styling', () => {
    it('has rounded-full class', () => {
      render(<Badge>Badge</Badge>);
      expect(screen.getByText('Badge')).toHaveClass('rounded-full');
    });

    it('has border class', () => {
      render(<Badge>Badge</Badge>);
      expect(screen.getByText('Badge')).toHaveClass('border');
    });

    it('has font-semibold class', () => {
      render(<Badge>Badge</Badge>);
      expect(screen.getByText('Badge')).toHaveClass('font-semibold');
    });
  });
});

describe('StatusBadge', () => {
  describe('rendering', () => {
    it('renders with default label for status', () => {
      render(<StatusBadge status="online" />);
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('renders with custom label', () => {
      render(<StatusBadge status="online" label="Active" />);
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  describe('status types', () => {
    it('shows Online for online status', () => {
      render(<StatusBadge status="online" />);
      expect(screen.getByText('Online')).toBeInTheDocument();
    });

    it('shows Offline for offline status', () => {
      render(<StatusBadge status="offline" />);
      expect(screen.getByText('Offline')).toBeInTheDocument();
    });

    it('shows Busy for busy status', () => {
      render(<StatusBadge status="busy" />);
      expect(screen.getByText('Busy')).toBeInTheDocument();
    });

    it('shows Away for away status', () => {
      render(<StatusBadge status="away" />);
      expect(screen.getByText('Away')).toBeInTheDocument();
    });
  });

  describe('status dot', () => {
    it('shows status dot by default', () => {
      const { container } = render(<StatusBadge status="online" />);
      const dot = container.querySelector('.rounded-full.w-2.h-2');
      expect(dot).toBeInTheDocument();
    });

    it('hides status dot when showDot is false', () => {
      const { container } = render(<StatusBadge status="online" showDot={false} />);
      const dot = container.querySelector('.rounded-full.w-2.h-2');
      expect(dot).not.toBeInTheDocument();
    });

    it('applies correct color for online status', () => {
      const { container } = render(<StatusBadge status="online" />);
      const dot = container.querySelector('.bg-green-500');
      expect(dot).toBeInTheDocument();
    });

    it('applies correct color for offline status', () => {
      const { container } = render(<StatusBadge status="offline" />);
      const dot = container.querySelector('.bg-gray-500');
      expect(dot).toBeInTheDocument();
    });

    it('applies correct color for busy status', () => {
      const { container } = render(<StatusBadge status="busy" />);
      const dot = container.querySelector('.bg-red-500');
      expect(dot).toBeInTheDocument();
    });

    it('applies correct color for away status', () => {
      const { container } = render(<StatusBadge status="away" />);
      const dot = container.querySelector('.bg-yellow-500');
      expect(dot).toBeInTheDocument();
    });
  });

  describe('custom className', () => {
    it('accepts and applies custom className', () => {
      const { container } = render(
        <StatusBadge status="online" className="custom-status" />
      );
      expect(container.firstChild).toHaveClass('custom-status');
    });
  });
});
