import React from 'react';
import Icon from './Icon';

const Modal = ({ isOpen, onClose, title, children, size = 'md' }) => {
    if (!isOpen) return null;
    
    const sizeClasses = { md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };
    
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div 
                onClick={(e) => e.stopPropagation()}
                className={`bg-surface dark:bg-surface-dark border-theme border-accent dark:border-accent-dark rounded-theme shadow-theme w-full ${sizeClasses[size]} p-6 relative text-text-primary dark:text-text-primary-dark`}
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-text-secondary dark:text-text-secondary-dark hover:text-text-primary dark:hover:text-text-primary-dark transition-colors">
                    <Icon path="M6 18L18 6M6 6l12 12" />
                </button>
                <h2 className="text-2xl font-bold mb-4 text-primary dark:text-primary-dark">{title}</h2>
                {children}
            </div>
        </div>
    );
};

export default Modal;