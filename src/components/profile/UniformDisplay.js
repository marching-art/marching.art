import React from 'react';

const UniformDisplay = ({ uniform }) => {
    if (!uniform) {
        return (
            <div className="w-48 h-64 bg-brand-surface dark:bg-brand-surface-dark rounded-md border-2 border-brand-accent dark:border-brand-accent-dark flex-shrink-0"></div>
        );
    }
    
    return (
        <div className="w-48 h-64 bg-brand-surface dark:bg-brand-surface-dark rounded-md flex flex-col items-center justify-center p-4 relative overflow-hidden flex-shrink-0 border-2 border-brand-accent dark:border-brand-accent-dark">
            <div style={{ backgroundColor: uniform.hatColor }} className="w-16 h-10 rounded-t-md absolute top-8"></div>
            <div style={{ backgroundColor: uniform.plumeColor }} className="w-4 h-12 absolute top-0 left-1/2 -translate-x-1/2 rounded-t-full"></div>
            <div style={{ backgroundColor: uniform.jacketColor1 }} className="w-full h-32 absolute top-16">
                <div style={{ backgroundColor: uniform.jacketColor2 }} className="w-1/2 h-full absolute top-0 left-1/2 -translate-x-1/2"></div>
            </div>
        </div>
    );
};
export default UniformDisplay;