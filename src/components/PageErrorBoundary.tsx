// =============================================================================
// PAGE ERROR BOUNDARY
// =============================================================================
// Wraps individual pages with error boundaries for graceful error handling
// Usage: <PageErrorBoundary name="Dashboard"><Dashboard /></PageErrorBoundary>

import React, { startTransition } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary as BaseErrorBoundary } from './ui/ErrorBoundary';

// =============================================================================
// PAGE ERROR FALLBACK
// =============================================================================

interface PageErrorFallbackProps {
  error: Error | null;
  pageName: string;
  onReset?: () => void;
}

const PageErrorFallback: React.FC<PageErrorFallbackProps> = ({
  error,
  pageName,
  onReset,
}) => {
  const navigate = useNavigate();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[60vh] flex items-center justify-center p-8"
    >
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="bg-red-900/20 p-6 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          <AlertTriangle className="w-12 h-12 text-red-400" />
        </div>

        {/* Error Message */}
        <h2 className="text-2xl font-display font-bold text-cream-100 mb-3">
          {pageName} Error
        </h2>
        <p className="text-cream-400 mb-6">
          We encountered an issue loading this page. This might be a temporary
          problem - please try again.
        </p>

        {/* Error Details (dev only) */}
        {error && process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="text-sm text-cream-500 cursor-pointer hover:text-cream-300 mb-2">
              Technical Details
            </summary>
            <pre className="p-4 bg-charcoal-900 rounded-lg text-xs text-red-400 overflow-auto max-h-40 whitespace-pre-wrap">
              {error.message}
              {error.stack && `\n\nStack trace:\n${error.stack}`}
            </pre>
          </details>
        )}

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onReset && (
            <button
              onClick={onReset}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold bg-gradient-gold text-charcoal-900 hover:shadow-glow transition-all"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
          )}
          <button
            onClick={() => startTransition(() => navigate(-1))}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold bg-charcoal-700 text-cream-200 hover:bg-charcoal-600 transition-all"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
          <button
            onClick={() => startTransition(() => navigate('/dashboard'))}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold border border-cream-700 text-cream-300 hover:bg-cream-900/20 transition-all"
          >
            <Home className="w-5 h-5" />
            Dashboard
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// =============================================================================
// PAGE ERROR BOUNDARY COMPONENT
// =============================================================================

interface PageErrorBoundaryProps {
  name: string;
  children: React.ReactNode;
}

interface PageErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class PageErrorBoundary extends React.Component<
  PageErrorBoundaryProps,
  PageErrorBoundaryState
> {
  constructor(props: PageErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): PageErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`[${this.props.name}] Error:`, error);
    console.error(`[${this.props.name}] Component Stack:`, errorInfo.componentStack);

    // Here you could send to an error tracking service
    // e.g., Sentry, LogRocket, etc.
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <PageErrorFallbackWrapper
          error={this.state.error}
          pageName={this.props.name}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// Wrapper to use hooks in fallback
const PageErrorFallbackWrapper: React.FC<PageErrorFallbackProps> = (props) => {
  return <PageErrorFallback {...props} />;
};

// =============================================================================
// HIGHER-ORDER COMPONENT
// =============================================================================

/**
 * HOC to wrap a page component with an error boundary
 * Usage: const SafeDashboard = withPageErrorBoundary(Dashboard, 'Dashboard');
 */
export function withPageErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  pageName: string
): React.FC<P> {
  const WrappedComponent: React.FC<P> = (props) => (
    <PageErrorBoundary name={pageName}>
      <Component {...props} />
    </PageErrorBoundary>
  );

  WrappedComponent.displayName = `withPageErrorBoundary(${
    Component.displayName || Component.name || 'Component'
  })`;

  return WrappedComponent;
}

export default PageErrorBoundary;
