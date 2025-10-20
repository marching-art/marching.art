import React from 'react';
import { logEvent } from '../firebase';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error caught by boundary:', error, errorInfo);
    }
    
    // Log to Firebase Analytics in production
    if (process.env.NODE_ENV === 'production') {
      logEvent('exception', {
        description: error.toString(),
        fatal: false
      });
    }
    
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  handleReset = () => {
    this.setState({ 
      hasError: false,
      error: null,
      errorInfo: null
    });
    
    // Reload the page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background dark:bg-background-dark p-4">
          <div className="max-w-md w-full bg-surface dark:bg-surface-dark rounded-theme border border-accent dark:border-accent-dark p-6 space-y-4">
            <div className="text-center">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                We're sorry for the inconvenience. The error has been logged and we'll look into it.
              </p>
            </div>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="bg-red-50 dark:bg-red-900/20 p-4 rounded-theme text-xs">
                <summary className="cursor-pointer font-semibold text-red-800 dark:text-red-200 mb-2">
                  Error Details (Development Only)
                </summary>
                <pre className="text-red-700 dark:text-red-300 overflow-auto whitespace-pre-wrap break-words">
                  {this.state.error.toString()}
                  {this.state.errorInfo && this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 bg-primary dark:bg-primary-dark hover:opacity-90 text-white font-bold py-2 px-4 rounded-theme transition-opacity"
              >
                Reload Page
              </button>
              <button
                onClick={() => window.history.back()}
                className="flex-1 bg-secondary dark:bg-secondary-dark hover:opacity-90 text-white font-bold py-2 px-4 rounded-theme transition-opacity"
              >
                Go Back
              </button>
            </div>
            
            <p className="text-center text-xs text-text-secondary dark:text-text-secondary-dark">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;