// =============================================================================
// SPINNER COMPONENT TESTS
// =============================================================================

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Spinner, LoadingOverlay, FullPageLoading, Skeleton, SkeletonText } from './Spinner';

describe('Spinner', () => {
  describe('rendering', () => {
    it('renders spinner with role status', () => {
      render(<Spinner />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders with default sr-only text', () => {
      render(<Spinner />);
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders with custom label', () => {
      render(<Spinner label="Processing" />);
      // The label is exposed to screen readers via sr-only text
      expect(screen.getByText('Processing')).toBeInTheDocument();
    });

    it('exposes label as accessible name when provided', () => {
      render(<Spinner label="Loading data" />);
      expect(screen.getByRole('status', { name: 'Loading data' })).toBeInTheDocument();
    });
  });

  describe('sizes', () => {
    it('applies extra small size', () => {
      const { container } = render(<Spinner size="xs" />);
      const icon = container.querySelector('.animate-pulse');
      expect(icon).toHaveClass('w-3', 'h-3');
    });

    it('applies small size', () => {
      const { container } = render(<Spinner size="sm" />);
      const icon = container.querySelector('.animate-pulse');
      expect(icon).toHaveClass('w-4', 'h-4');
    });

    it('applies medium size by default', () => {
      const { container } = render(<Spinner />);
      const icon = container.querySelector('.animate-pulse');
      expect(icon).toHaveClass('w-6', 'h-6');
    });

    it('applies large size', () => {
      const { container } = render(<Spinner size="lg" />);
      const icon = container.querySelector('.animate-pulse');
      expect(icon).toHaveClass('w-8', 'h-8');
    });

    it('applies extra large size', () => {
      const { container } = render(<Spinner size="xl" />);
      const icon = container.querySelector('.animate-pulse');
      expect(icon).toHaveClass('w-12', 'h-12');
    });
  });

  describe('variants', () => {
    it('applies visually distinct styling per variant', () => {
      const classFor = (variant?: 'default' | 'gold' | 'white') => {
        const { container, unmount } = render(<Spinner variant={variant} />);
        // The icon is an SVG, so read the class attribute (className would be
        // an SVGAnimatedString object).
        const className = container.querySelector('.animate-pulse')?.getAttribute('class') ?? '';
        unmount();
        return className;
      };
      const gold = classFor(); // default variant is 'gold'
      const def = classFor('default');
      const white = classFor('white');
      expect(gold).not.toEqual(def);
      expect(def).not.toEqual(white);
      expect(gold).not.toEqual(white);
    });

    it('applies white variant', () => {
      const { container } = render(<Spinner variant="white" />);
      const icon = container.querySelector('.animate-pulse');
      expect(icon).toHaveClass('text-white');
    });
  });

  describe('custom className', () => {
    it('accepts custom className', () => {
      render(<Spinner className="custom-spinner" />);
      expect(screen.getByRole('status')).toHaveClass('custom-spinner');
    });
  });

  describe('animation', () => {
    it('has animate-pulse class', () => {
      const { container } = render(<Spinner />);
      const icon = container.querySelector('.animate-pulse');
      expect(icon).toBeInTheDocument();
    });
  });
});

describe('LoadingOverlay', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(
        <LoadingOverlay isLoading={false}>
          <p>Content</p>
        </LoadingOverlay>
      );
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('shows overlay when loading', () => {
      const { container } = render(
        <LoadingOverlay isLoading={true}>
          <p>Content</p>
        </LoadingOverlay>
      );
      expect(container.querySelector('.bg-charcoal-900\\/60')).toBeInTheDocument();
    });

    it('does not show overlay when not loading', () => {
      const { container } = render(
        <LoadingOverlay isLoading={false}>
          <p>Content</p>
        </LoadingOverlay>
      );
      expect(container.querySelector('.bg-charcoal-900\\/60')).not.toBeInTheDocument();
    });

    it('exposes label as accessible name when loading', () => {
      render(
        <LoadingOverlay isLoading={true} label="Please wait">
          <p>Content</p>
        </LoadingOverlay>
      );
      expect(screen.getByRole('status', { name: 'Please wait' })).toBeInTheDocument();
    });
  });

  describe('blur effect', () => {
    it('applies blur by default', () => {
      const { container } = render(
        <LoadingOverlay isLoading={true}>
          <p>Content</p>
        </LoadingOverlay>
      );
      expect(container.querySelector('.backdrop-blur-sm')).toBeInTheDocument();
    });

    it('does not apply blur when blur is false', () => {
      const { container } = render(
        <LoadingOverlay isLoading={true} blur={false}>
          <p>Content</p>
        </LoadingOverlay>
      );
      expect(container.querySelector('.backdrop-blur-sm')).not.toBeInTheDocument();
    });
  });
});

describe('FullPageLoading', () => {
  describe('rendering', () => {
    it('renders with default label', () => {
      render(<FullPageLoading />);
      // The label is exposed via aria-label on the status wrapper (no visible text)
      expect(screen.getByRole('status', { name: 'Loading...' })).toBeInTheDocument();
    });

    it('renders with custom label', () => {
      render(<FullPageLoading label="Initializing" />);
      // The custom label is exposed via aria-label on the status wrapper
      expect(screen.getByRole('status', { name: 'Initializing' })).toBeInTheDocument();
    });

    it('shows logo by default', () => {
      render(<FullPageLoading />);
      expect(screen.getByRole('img', { name: 'marching.art' })).toBeInTheDocument();
    });

    it('hides logo when showLogo is false', () => {
      render(<FullPageLoading showLogo={false} />);
      expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('is fixed position', () => {
      const { container } = render(<FullPageLoading />);
      expect(container.firstChild).toHaveClass('fixed');
      expect(container.firstChild).toHaveClass('inset-0');
    });

    it('has high z-index', () => {
      const { container } = render(<FullPageLoading />);
      expect(container.firstChild).toHaveClass('z-50');
    });
  });
});

describe('Skeleton', () => {
  describe('rendering', () => {
    it('renders skeleton element', () => {
      const { container } = render(<Skeleton />);
      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });

    it('has charcoal background', () => {
      const { container } = render(<Skeleton />);
      expect(container.firstChild).toHaveClass('bg-charcoal-700');
    });
  });

  describe('dimensions', () => {
    it('applies width as number', () => {
      const { container } = render(<Skeleton width={200} />);
      expect(container.firstChild).toHaveStyle({ width: '200px' });
    });

    it('applies width as string', () => {
      const { container } = render(<Skeleton width="100%" />);
      expect(container.firstChild).toHaveStyle({ width: '100%' });
    });

    it('applies height as number', () => {
      const { container } = render(<Skeleton height={50} />);
      expect(container.firstChild).toHaveStyle({ height: '50px' });
    });

    it('applies height as string', () => {
      const { container } = render(<Skeleton height="2rem" />);
      expect(container.firstChild).toHaveStyle({ height: '2rem' });
    });
  });

  describe('rounded variants', () => {
    it('applies no rounding', () => {
      const { container } = render(<Skeleton rounded="none" />);
      expect(container.firstChild).toHaveClass('rounded-none');
    });

    it('applies small rounding', () => {
      const { container } = render(<Skeleton rounded="sm" />);
      expect(container.firstChild).toHaveClass('rounded');
    });

    it('applies medium rounding by default', () => {
      const { container } = render(<Skeleton />);
      expect(container.firstChild).toHaveClass('rounded-sm');
    });

    it('applies large rounding', () => {
      const { container } = render(<Skeleton rounded="lg" />);
      expect(container.firstChild).toHaveClass('rounded-sm');
    });

    it('applies full rounding', () => {
      const { container } = render(<Skeleton rounded="full" />);
      expect(container.firstChild).toHaveClass('rounded-sm');
    });
  });

  describe('custom className', () => {
    it('accepts custom className', () => {
      const { container } = render(<Skeleton className="custom-skeleton" />);
      expect(container.firstChild).toHaveClass('custom-skeleton');
    });
  });
});

describe('SkeletonText', () => {
  describe('rendering', () => {
    it('renders 3 lines by default', () => {
      const { container } = render(<SkeletonText />);
      const lines = container.querySelectorAll('.animate-pulse');
      expect(lines).toHaveLength(3);
    });

    it('renders custom number of lines', () => {
      const { container } = render(<SkeletonText lines={5} />);
      const lines = container.querySelectorAll('.animate-pulse');
      expect(lines).toHaveLength(5);
    });

    it('renders single line', () => {
      const { container } = render(<SkeletonText lines={1} />);
      const lines = container.querySelectorAll('.animate-pulse');
      expect(lines).toHaveLength(1);
    });
  });

  describe('last line width', () => {
    it('applies default last line width of 60%', () => {
      const { container } = render(<SkeletonText lines={2} />);
      const lines = container.querySelectorAll('.animate-pulse');
      const lastLine = lines[lines.length - 1];
      expect(lastLine).toHaveStyle({ width: '60%' });
    });

    it('applies custom last line width', () => {
      const { container } = render(<SkeletonText lines={2} lastLineWidth="40%" />);
      const lines = container.querySelectorAll('.animate-pulse');
      const lastLine = lines[lines.length - 1];
      expect(lastLine).toHaveStyle({ width: '40%' });
    });

    it('full width for non-last lines', () => {
      const { container } = render(<SkeletonText lines={3} />);
      const lines = container.querySelectorAll('.animate-pulse');
      expect(lines[0]).toHaveStyle({ width: '100%' });
      expect(lines[1]).toHaveStyle({ width: '100%' });
    });
  });

  describe('custom className', () => {
    it('accepts custom className', () => {
      const { container } = render(<SkeletonText className="custom-text" />);
      expect(container.firstChild).toHaveClass('custom-text');
    });
  });
});
