import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // Log error to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-main flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-charcoal-800 rounded-sm border border-cream-500/20 p-8 text-center">
            <div className="w-16 h-16 bg-red-500/20 rounded-sm flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>

            <h1 className="text-2xl font-display font-bold text-cream-100 mb-2">
              Something went wrong
            </h1>

            <p className="text-cream-400 mb-6">
              An unexpected error occurred. Please try refreshing the page or return to the home page.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <div className="bg-charcoal-900 rounded-sm p-4 mb-6 text-left">
                <p className="text-red-400 text-sm font-mono break-all">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 px-4 py-2 bg-gold-500 text-charcoal-900 rounded-sm font-medium hover:bg-gold-400 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex items-center gap-2 px-4 py-2 bg-charcoal-700 text-cream-100 rounded-sm font-medium hover:bg-charcoal-600 transition-colors"
              >
                <Home className="w-4 h-4" />
                Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
