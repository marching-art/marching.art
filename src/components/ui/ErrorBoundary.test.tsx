// =============================================================================
// ERROR BOUNDARY COMPONENT TESTS
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  ErrorBoundary,
  ErrorFallback,
  FeatureErrorBoundary,
} from './ErrorBoundary';

// Component that throws an error
const ThrowError = ({ shouldThrow = true }: { shouldThrow?: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary', () => {
  // Suppress console.error for error boundary tests
  const originalError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  describe('rendering', () => {
    it('renders children when no error', () => {
      render(
        <ErrorBoundary>
          <div>Child content</div>
        </ErrorBoundary>
      );
      expect(screen.getByText('Child content')).toBeInTheDocument();
    });

    it('renders fallback when error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders custom fallback when provided', () => {
      render(
        <ErrorBoundary fallback={<div>Custom error UI</div>}>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(screen.getByText('Custom error UI')).toBeInTheDocument();
    });

    it('renders feature name in error message', () => {
      render(
        <ErrorBoundary featureName="Dashboard">
          <ThrowError />
        </ErrorBoundary>
      );
      expect(screen.getByText('Dashboard Error')).toBeInTheDocument();
    });
  });

  describe('error handling', () => {
    it('calls onError callback when error occurs', () => {
      const onError = vi.fn();
      render(
        <ErrorBoundary onError={onError}>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(onError).toHaveBeenCalled();
      expect(onError.mock.calls[0][0].message).toBe('Test error');
    });

    it('logs error to console', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('reset functionality', () => {
    it('shows Try Again button', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('resets error state when Try Again is clicked', () => {
      let shouldThrow = true;
      const TestComponent = () => {
        if (shouldThrow) {
          throw new Error('Test');
        }
        return <div>Recovered</div>;
      };

      const { rerender } = render(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Fix the error condition
      shouldThrow = false;

      // Click Try Again
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      // Re-render to pick up the fix
      rerender(
        <ErrorBoundary>
          <TestComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Recovered')).toBeInTheDocument();
    });
  });

  describe('resetKeys', () => {
    it('resets when resetKeys change', () => {
      let shouldThrow = true;
      const TestComponent = () => {
        if (shouldThrow) {
          throw new Error('Test');
        }
        return <div>Success</div>;
      };

      const { rerender } = render(
        <ErrorBoundary resetKeys={[1]}>
          <TestComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Fix error and change reset key
      shouldThrow = false;
      rerender(
        <ErrorBoundary resetKeys={[2]}>
          <TestComponent />
        </ErrorBoundary>
      );

      expect(screen.getByText('Success')).toBeInTheDocument();
    });
  });
});

describe('ErrorFallback', () => {
  describe('rendering', () => {
    it('renders default error message', () => {
      render(<ErrorFallback error={null} />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders feature-specific error message', () => {
      render(<ErrorFallback error={null} featureName="Profile" />);
      expect(screen.getByText('Profile Error')).toBeInTheDocument();
      expect(
        screen.getByText(/we encountered an error loading profile/i)
      ).toBeInTheDocument();
    });

    it('shows alert icon', () => {
      const { container } = render(<ErrorFallback error={null} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('buttons', () => {
    it('shows Try Again button when onReset is provided', () => {
      const onReset = vi.fn();
      render(<ErrorFallback error={null} onReset={onReset} />);
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
    });

    it('does not show Try Again button when onReset is not provided', () => {
      render(<ErrorFallback error={null} />);
      expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument();
    });

    it('shows Go Home button by default', () => {
      render(<ErrorFallback error={null} />);
      expect(screen.getByRole('button', { name: /go home/i })).toBeInTheDocument();
    });

    it('hides Go Home button when showHomeButton is false', () => {
      render(<ErrorFallback error={null} showHomeButton={false} />);
      expect(screen.queryByRole('button', { name: /go home/i })).not.toBeInTheDocument();
    });

    it('calls onReset when Try Again is clicked', () => {
      const onReset = vi.fn();
      render(<ErrorFallback error={null} onReset={onReset} />);
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));
      expect(onReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('error details in development', () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('shows error details in development', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Test error message');
      error.stack = 'Error: Test error message\n    at TestComponent';

      render(<ErrorFallback error={error} />);

      // Details should be expandable
      const details = screen.getByText('Error details (dev only)');
      expect(details).toBeInTheDocument();
    });
  });
});

describe('FeatureErrorBoundary', () => {
  const originalError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalError;
  });

  it('wraps children in error boundary', () => {
    render(
      <FeatureErrorBoundary featureName="Stats">
        <div>Stats content</div>
      </FeatureErrorBoundary>
    );
    expect(screen.getByText('Stats content')).toBeInTheDocument();
  });

  it('shows feature-specific error on failure', () => {
    render(
      <FeatureErrorBoundary featureName="Leaderboard">
        <ThrowError />
      </FeatureErrorBoundary>
    );
    expect(screen.getByText('Leaderboard Error')).toBeInTheDocument();
  });

  it('passes onError callback', () => {
    const onError = vi.fn();
    render(
      <FeatureErrorBoundary featureName="Test" onError={onError}>
        <ThrowError />
      </FeatureErrorBoundary>
    );
    expect(onError).toHaveBeenCalled();
  });
});
