import React from 'react';
import { useNavigate } from 'react-router-dom';

const Footer = () => {
    const navigate = useNavigate();

    return (
        <footer className="bg-surface dark:bg-surface-dark border-t-theme border-accent dark:border-accent-dark p-4 text-center text-text-secondary dark:text-text-secondary-dark mt-auto">
            <div className="mb-2">
                <a href="https://discord.gg/YvFRJ97A5H" target="_blank" rel="noopener noreferrer" className="text-primary dark:text-primary-dark hover:underline font-semibold">
                    Join the Community on Discord
                </a>
                <span className="mx-2 text-accent dark:text-accent-dark">|</span>
                <a href="https://buymeacoffee.com/marching.art" target="_blank" rel="noopener noreferrer" className="text-primary dark:text-primary-dark hover:underline font-semibold">
                    Buy Me a Coffee ☕
                </a>
            </div>
            <p className="text-sm">&copy; {new Date().getFullYear()} marching.art. All Rights Reserved.</p>
        </footer>
    );
};

export default Footer;