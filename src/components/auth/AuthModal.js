import React, { useState, useEffect } from 'react';
import Modal from '../ui/Modal'; // Assuming your generic Modal is in a ui folder
import LoginForm from './LoginForm';
import SignUpForm from './SignUpForm';

const AuthModal = ({ isOpen, onClose, initialView, onAuthSuccess }) => {
    const [view, setView] = useState(initialView);

    useEffect(() => {
        // This ensures the modal resets to the correct view if it's closed and re-opened
        setView(initialView);
    }, [initialView, isOpen]);

    const switchToSignUp = () => setView('signup');
    const switchToLogin = () => setView('login');

    // The title of the modal changes depending on the current view
    const title = view === 'login' ? 'Log In to Your Account' : 'Create an Account';

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={title}>
            {view === 'login' ? (
                <LoginForm 
                    onLoginSuccess={onAuthSuccess} 
                    switchToSignUp={switchToSignUp} 
                />
            ) : (
                <SignUpForm 
                    onSignUpSuccess={onAuthSuccess} 
                    switchToLogin={switchToLogin} 
                />
            )}
        </Modal>
    );
};

export default AuthModal;