// src/components/ui/LoadingScreen.js
import React from 'react';

const LoadingScreen = ({ message = "Loading..." }) => {
    return (
        <div className="min-h-screen bg-background dark:bg-background-dark flex items-center justify-center">
            <div className="text-center">
                <div className="mb-8">
                    {/* Animated drum corps icon */}
                    <div className="w-16 h-16 mx-auto mb-4 relative">
                        <div className="absolute inset-0 border-4 border-primary/30 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <div className="absolute inset-2 bg-primary rounded-full flex items-center justify-center text-white text-xl">
                            🥁
                        </div>
                    </div>
                </div>
                
                <h2 className="text-2xl font-bold text-text-primary dark:text-text-primary-dark mb-2">
                    {message}
                </h2>
                
                <div className="w-64 h-2 bg-surface dark:bg-surface-dark rounded-full overflow-hidden mx-auto">
                    <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '100%' }}></div>
                </div>
                
                <p className="text-text-secondary dark:text-text-secondary-dark mt-4 animate-pulse">
                    Preparing your marching arts experience...
                </p>
            </div>
        </div>
    );
};

export default LoadingScreen;