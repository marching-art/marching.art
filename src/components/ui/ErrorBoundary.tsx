import React, { Component, ErrorInfo } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { Button } from './Button';

// =============================================================================
// ERROR BOUNDARY COMPONENT
// =============================================================================

export interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  resetKeys?: unknown[];
  featureName?: string;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Reset error state when resetKeys change
    if (this.state.hasError && prevProps.resetKeys !== this.props.resetKeys) {
      const keysChanged = this.props.resetKeys?.some(
        (key, index) => key !== prevProps.resetKeys?.[index]
      );
      if (keysChanged) {
        this.setState({ hasError: false, error: null });
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorFallback
          error={this.state.error}
          featureName={this.props.featureName}
          onReset={this.handleReset}
        />
      );
    }

    return this.props.children;
  }
}

// =============================================================================
// ERROR FALLBACK COMPONENT
// =============================================================================

export interface ErrorFallbackProps {
  error: Error | null;
  featureName?: string;
  onReset?: () => void;
  showHomeButton?: boolean;
}

export const ErrorFallback: React.FC<ErrorFallbackProps> = ({
  error,
  featureName,
  onReset,
  showHomeButton = true,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center p-8 rounded-sm bg-charcoal-800/50 border border-red-900/30"
    >
      <div className="bg-red-900/30 p-4 rounded-sm mb-4">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>

      <h3 className="text-xl font-display font-bold text-cream-100 mb-2">
        {featureName ? `${featureName} Error` : 'Something went wrong'}
      </h3>

      <p className="text-cream-400 text-center mb-4 max-w-md">
        {featureName
          ? `We encountered an error loading ${featureName.toLowerCase()}. Please try again.`
          : 'An unexpected error occurred. Please try again or contact support if the problem persists.'}
      </p>

      {error && process.env.NODE_ENV === 'development' && (
        <details className="mb-4 w-full max-w-md">
          <summary className="text-sm text-cream-500 cursor-pointer hover:text-cream-300">
            Error details (dev only)
          </summary>
          <pre className="mt-2 p-3 bg-charcoal-900 rounded-sm text-xs text-red-400 overflow-auto max-h-40">
            {error.message}
            {'\n\n'}
            {error.stack}
          </pre>
        </details>
      )}

      <div className="flex gap-3">
        {onReset && (
          <Button
            variant="primary"
            size="sm"
            leftIcon={RefreshCw}
            onClick={onReset}
          >
            Try Again
          </Button>
        )}
        {showHomeButton && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={Home}
            onClick={() => (window.location.href = '/dashboard')}
          >
            Go Home
          </Button>
        )}
      </div>
    </motion.div>
  );
};

// =============================================================================
// FEATURE ERROR BOUNDARY WRAPPER
// =============================================================================

export interface FeatureErrorBoundaryProps {
  featureName: string;
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

export const FeatureErrorBoundary: React.FC<FeatureErrorBoundaryProps> = ({
  featureName,
  children,
  onError,
}) => {
  return (
    <ErrorBoundary featureName={featureName} onError={onError}>
      {children}
    </ErrorBoundary>
  );
};

export default ErrorBoundary;
