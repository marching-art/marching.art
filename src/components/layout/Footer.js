import React from 'react';

const Footer = () => {
    return (
        <footer className="bg-brand-surface dark:bg-brand-background-dark border-t-2 border-brand-secondary dark:border-brand-secondary-dark p-4 text-center text-brand-text-secondary dark:text-brand-text-secondary-dark mt-auto">
            <div className="mb-2">
                <a href="https://discord.gg/YvFRJ97A5H" target="_blank" rel="noopener noreferrer" className="text-brand-primary dark:text-brand-primary-dark hover:underline font-semibold">
                    Join the Community on Discord
                </a>
                
                <span className="mx-2 text-gray-400 dark:text-brand-accent-dark">|</span>

                <a href="https://buymeacoffee.com/marching.art" target="_blank" rel="noopener noreferrer" className="text-brand-primary dark:text-brand-primary-dark hover:underline font-semibold">
                    Buy Me a Coffee ☕
                </a>
            </div>
            <p>&copy; {new Date().getFullYear()} marching.art. All Rights Reserved.</p>
        </footer>
    );
};

export default Footer;