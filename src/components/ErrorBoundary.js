import React from 'react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error Boundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center p-8">
                    <div className="bg-surface dark:bg-surface-dark p-8 rounded-theme border border-red-500 max-w-md">
                        <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
                        <p className="text-text-secondary dark:text-text-secondary-dark mb-4">
                            An unexpected error occurred. Please refresh the page or try again later.
                        </p>
                        <button 
                            onClick={() => window.location.reload()} 
                            className="bg-primary hover:opacity-90 text-on-primary font-bold py-2 px-4 rounded-theme"
                        >
                            Refresh Page
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;