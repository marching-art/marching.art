import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error boundary caught error:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
          <div className="max-w-md w-full bg-surface dark:bg-surface-dark p-6 rounded-theme border border-red-500 text-center">
            <h2 className="text-xl font-bold text-red-600 mb-4">Something went wrong</h2>
            <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
              We're sorry, but something unexpected happened.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme"
            >
              Reload Page
            </button>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-sm">Error Details</summary>
                <pre className="text-xs mt-2 p-2 bg-background dark:bg-background-dark rounded overflow-auto">
                  {this.state.error && this.state.error.toString()}
                  <br />
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}