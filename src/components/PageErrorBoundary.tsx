// =============================================================================
// PAGE ERROR BOUNDARY
// =============================================================================
// Wraps individual pages with error boundaries for graceful error handling.
// Usage: <PageErrorBoundary name="Dashboard"><Dashboard /></PageErrorBoundary>
//
// The boundary mechanics live in ui/ErrorBoundary (the single boundary class
// in the app); this file only contributes the page-level fallback UI, which
// differs from the inline feature fallback by offering router navigation.

import React, { startTransition } from 'react';
import { m } from 'framer-motion';
import { AlertTriangle, RefreshCw, Home, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ErrorBoundary } from './ui/ErrorBoundary';

// =============================================================================
// PAGE ERROR FALLBACK
// =============================================================================

interface PageErrorFallbackProps {
  error: Error | null;
  pageName: string;
  onReset?: () => void;
}

const PageErrorFallback: React.FC<PageErrorFallbackProps> = ({ error, pageName, onReset }) => {
  const navigate = useNavigate();

  return (
    <m.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="min-h-[60vh] flex items-center justify-center p-8"
    >
      <div className="max-w-md w-full text-center">
        {/* Error Icon */}
        <div className="bg-red-500/10 border border-red-500/30 p-6 rounded-sm w-24 h-24 mx-auto mb-6 flex items-center justify-center">
          <AlertTriangle className="w-12 h-12 text-red-400" />
        </div>

        {/* Error Message */}
        <h2 className="text-2xl font-bold text-white mb-3">{pageName} Error</h2>
        <p className="text-gray-400 mb-6">
          We encountered an issue loading this page. This might be a temporary problem - please try
          again.
        </p>

        {/* Error Details (dev only) */}
        {error && process.env.NODE_ENV === 'development' && (
          <details className="mb-6 text-left">
            <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-300 mb-2">
              Technical Details
            </summary>
            <pre className="p-4 bg-[#0a0a0a] border border-[#333] rounded-sm text-xs text-red-400 overflow-auto max-h-40 whitespace-pre-wrap">
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
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm font-semibold bg-[#0057B8] border border-[#0057B8] text-white hover:bg-[#0057B8]/90 transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
              Try Again
            </button>
          )}
          <button
            onClick={() => startTransition(() => navigate(-1))}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm font-semibold bg-transparent border border-white/20 text-white hover:bg-white/5 hover:border-white/40 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            Go Back
          </button>
          <button
            onClick={() => startTransition(() => navigate('/dashboard'))}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-sm font-semibold bg-transparent border border-[#333] text-gray-300 hover:bg-white/5 hover:border-[#555] transition-colors"
          >
            <Home className="w-5 h-5" />
            Dashboard
          </button>
        </div>
      </div>
    </m.div>
  );
};

// =============================================================================
// PAGE ERROR BOUNDARY COMPONENT
// =============================================================================

interface PageErrorBoundaryProps {
  name: string;
  children: React.ReactNode;
}

export const PageErrorBoundary: React.FC<PageErrorBoundaryProps> = ({ name, children }) => (
  <ErrorBoundary
    onError={(error, errorInfo) => {
      console.error(`[${name}] Error:`, error);
      console.error(`[${name}] Component Stack:`, errorInfo.componentStack);
    }}
    fallbackRender={(error, reset) => (
      <PageErrorFallback error={error} pageName={name} onReset={reset} />
    )}
  >
    {children}
  </ErrorBoundary>
);

export default PageErrorBoundary;
