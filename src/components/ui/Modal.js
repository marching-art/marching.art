import React from 'react';
import Icon from './Icon';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;
    
    const sizeClasses = { md: 'max-w-md', lg: 'max-w-3xl', xl: 'max-w-5xl' };
    
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`bg-background dark:bg-surface-dark border-theme border-secondary rounded-theme shadow-theme w-full ${sizeClasses[size]} p-6 relative text-text-primary`}>
                <button onClick={onClose} className="absolute top-3 right-3 text-text-secondary hover:text-text-primary transition-colors">
                    <Icon path="M6 18L18 6M6 6l12 12" />
                </button>
                <h2 className="text-2xl font-bold mb-4 text-secondary dark:text-secondary-dark tracking-wider">{title}</h2>
                {children}
            </div>
        </div>
    );
};

export default Modal;