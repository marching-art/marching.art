// Root application error boundary (outermost catch-all in App.jsx).
//
// The boundary mechanics live in ui/ErrorBoundary (the single boundary class
// in the app); this file only contributes the full-screen fallback. Because
// this boundary sits outside the router and motion/theme providers, the
// fallback deliberately uses plain buttons and window.location navigation —
// no framer-motion, no useNavigate.

import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import { ErrorBoundary as BaseErrorBoundary } from './ui/ErrorBoundary';

const AppErrorFallback: React.FC<{ error: Error | null }> = ({ error }) => (
  <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-[#1a1a1a] rounded-sm border border-[#333] p-8 text-center">
      <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-sm flex items-center justify-center mx-auto mb-6">
        <AlertTriangle className="w-8 h-8 text-red-400" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>

      <p className="text-gray-400 mb-6">
        An unexpected error occurred. Please try refreshing the page or return to the home page.
      </p>

      {import.meta.env.DEV && error && (
        <div className="bg-[#0a0a0a] border border-[#333] rounded-sm p-4 mb-6 text-left">
          <p className="text-red-400 text-sm font-mono break-all">{error.toString()}</p>
        </div>
      )}

      <div className="flex gap-3 justify-center">
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-4 py-2 bg-[#0057B8] border border-[#0057B8] text-white rounded-sm font-semibold hover:bg-[#0057B8]/90 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>

        <button
          onClick={() => {
            window.location.href = '/';
          }}
          className="flex items-center gap-2 px-4 py-2 bg-transparent border border-white/20 text-white rounded-sm font-semibold hover:bg-white/5 hover:border-white/40 transition-colors"
        >
          <Home className="w-4 h-4" />
          Home
        </button>
      </div>
    </div>
  </div>
);

const ErrorBoundary: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BaseErrorBoundary fallbackRender={(error) => <AppErrorFallback error={error} />}>
    {children}
  </BaseErrorBoundary>
);

export default ErrorBoundary;
