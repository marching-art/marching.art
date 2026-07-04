// src/components/withPageErrorBoundary.tsx
// HOC that wraps a page component with an error boundary. Kept out of
// PageErrorBoundary.tsx so that file only exports components, which keeps
// Vite's fast refresh working (react-refresh/only-export-components).

import React from 'react';
import PageErrorBoundary from './PageErrorBoundary';

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
