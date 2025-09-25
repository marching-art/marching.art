// src/components/ui/ErrorBoundary.js - Comprehensive error boundary
import React from 'react';
import Icon from './Icon';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null,
            retryCount: 0
        };
    }

    static getDerivedStateFromError(error) {
        // Update state so the next render will show the fallback UI
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error for debugging
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        
        this.setState({
            error,
            errorInfo,
            hasError: true
        });

        // Log to external service if available
        if (window.gtag) {
            window.gtag('event', 'exception', {
                description: error.toString(),
                fatal: false
            });
        }
    }

    handleRetry = () => {
        this.setState(prevState => ({
            hasError: false,
            error: null,
            errorInfo: null,
            retryCount: prevState.retryCount + 1
        }));
    }

    handleReload = () => {
        window.location.reload();
    }

    render() {
        if (this.state.hasError) {
            const { error, errorInfo, retryCount } = this.state;
            const isDevelopment = process.env.NODE_ENV === 'development';
            
            return (
                <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                    <div className="max-w-2xl mx-auto text-center">
                        <div className="bg-surface dark:bg-surface-dark p-8 rounded-theme border border-accent dark:border-accent-dark shadow-theme">
                            <div className="mb-6">
                                <Icon 
                                    name="alert-triangle" 
                                    className="h-16 w-16 text-red-500 mx-auto mb-4" 
                                />
                                <h1 className="text-3xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                                    Oops! Something went wrong
                                </h1>
                                <p className="text-text-secondary dark:text-text-secondary-dark">
                                    We encountered an unexpected error. Our team has been notified and is working on a fix.
                                </p>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                                <button
                                    onClick={this.handleRetry}
                                    className="px-6 py-3 bg-primary text-on-primary rounded-theme hover:bg-primary/90 transition-colors font-medium"
                                >
                                    Try Again
                                </button>
                                <button
                                    onClick={this.handleReload}
                                    className="px-6 py-3 bg-accent dark:bg-accent-dark text-text-primary dark:text-text-primary-dark rounded-theme hover:bg-accent/80 dark:hover:bg-accent-dark/80 transition-colors font-medium"
                                >
                                    Reload Page
                                </button>
                            </div>

                            {retryCount > 2 && (
                                <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-theme">
                                    <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                                        <Icon name="info" className="h-4 w-4 inline mr-2" />
                                        If the problem persists, try refreshing the page or clearing your browser cache.
                                    </p>
                                </div>
                            )}

                            {isDevelopment && error && (
                                <details className="text-left mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-theme">
                                    <summary className="cursor-pointer font-semibold text-red-800 dark:text-red-200 mb-2">
                                        Developer Info (Click to expand)
                                    </summary>
                                    <div className="text-sm text-red-700 dark:text-red-300 font-mono">
                                        <div className="mb-2">
                                            <strong>Error:</strong> {error.toString()}
                                        </div>
                                        {errorInfo && errorInfo.componentStack && (
                                            <div>
                                                <strong>Component Stack:</strong>
                                                <pre className="whitespace-pre-wrap text-xs mt-1">
                                                    {errorInfo.componentStack}
                                                </pre>
                                            </div>
                                        )}
                                    </div>
                                </details>
                            )}

                            <div className="mt-6 pt-6 border-t border-accent dark:border-accent-dark">
                                <p className="text-sm text-text-secondary dark:text-text-secondary-dark">
                                    Need help? Contact support at{' '}
                                    <a 
                                        href="mailto:support@marching.art" 
                                        className="text-primary hover:underline"
                                    >
                                        support@marching.art
                                    </a>
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;