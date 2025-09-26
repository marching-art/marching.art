// src/components/ui/ConnectionStatus.js - Updated to use userStore directly
import React, { useState, useEffect } from 'react';
import { useUserStore } from '../../store/userStore';
import Icon from './Icon';

const ConnectionStatus = () => {
    const { connectionError, retryConnection, clearError } = useUserStore();
    const [isRetrying, setIsRetrying] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    const handleRetry = async () => {
        setIsRetrying(true);
        try {
            if (retryConnection) {
                await retryConnection();
            }
            setTimeout(() => {
                setIsRetrying(false);
            }, 1000);
        } catch (error) {
            console.error('Retry failed:', error);
            setIsRetrying(false);
        }
    };

    const handleDismiss = () => {
        if (clearError) {
            clearError();
        }
    };

    useEffect(() => {
        // Auto-retry connection errors after 30 seconds
        if (connectionError) {
            const timer = setTimeout(() => {
                handleRetry();
            }, 30000);

            return () => clearTimeout(timer);
        }
    }, [connectionError]);

    if (!connectionError) return null;

    const getErrorMessage = () => {
        switch (connectionError) {
            case 'Authentication error occurred':
                return {
                    title: 'Authentication Issue',
                    message: 'There was a problem with your login session.',
                    solution: 'Please try signing out and back in.'
                };
            case 'Access denied to profile data':
                return {
                    title: 'Access Denied',
                    message: 'Unable to access your profile data.',
                    solution: 'Please check your account permissions or contact support.'
                };
            case 'Service temporarily unavailable':
                return {
                    title: 'Service Unavailable',
                    message: 'Our servers are temporarily unavailable.',
                    solution: 'We\'re working to restore service. Please try again in a few moments.'
                };
            case 'Connection error occurred':
            default:
                return {
                    title: 'Connection Problem',
                    message: 'Unable to connect to our servers.',
                    solution: 'Please check your internet connection and try again.'
                };
        }
    };

    const errorDetails = getErrorMessage();

    return (
        <div className="fixed top-20 right-4 max-w-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-theme shadow-lg z-50 animate-fade-in">
            <div className="p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                        <Icon 
                            name="wifi-off" 
                            className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" 
                        />
                        <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-red-800 dark:text-red-200 text-sm">
                                {errorDetails.title}
                            </h4>
                            <p className="text-red-700 dark:text-red-300 text-xs mt-1">
                                {errorDetails.message}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-800/40 rounded text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                        title="Dismiss"
                    >
                        <Icon name="x" className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-3 flex items-center gap-2">
                    <button
                        onClick={handleRetry}
                        disabled={isRetrying}
                        className={`px-3 py-1 text-xs font-medium rounded border transition-colors ${
                            isRetrying
                                ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-300 dark:border-gray-600 cursor-not-allowed'
                                : 'bg-red-100 dark:bg-red-800/40 text-red-800 dark:text-red-200 border-red-300 dark:border-red-600 hover:bg-red-200 dark:hover:bg-red-800/60'
                        }`}
                    >
                        {isRetrying ? (
                            <>
                                <Icon name="loader" className="h-3 w-3 inline mr-1 animate-spin" />
                                Retrying...
                            </>
                        ) : (
                            <>
                                <Icon name="refresh-cw" className="h-3 w-3 inline mr-1" />
                                Retry
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="px-3 py-1 text-xs font-medium rounded border bg-red-100 dark:bg-red-800/40 text-red-800 dark:text-red-200 border-red-300 dark:border-red-600 hover:bg-red-200 dark:hover:bg-red-800/60 transition-colors"
                    >
                        {showDetails ? 'Less' : 'More'} Info
                    </button>
                </div>

                {showDetails && (
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-700">
                        <p className="text-red-700 dark:text-red-300 text-xs">
                            <strong>Solution:</strong> {errorDetails.solution}
                        </p>
                        <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                            <strong>Technical Details:</strong>
                            <br />
                            <code className="bg-red-100 dark:bg-red-900/40 px-1 py-0.5 rounded text-xs">
                                {connectionError}
                            </code>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConnectionStatus;