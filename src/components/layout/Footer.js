import React from 'react';

const Footer = () => {
    return (
        <footer className="bg-gray-100 dark:bg-black border-t-2 border-yellow-600 dark:border-yellow-700 p-4 text-center text-gray-600 dark:text-yellow-500 mt-auto">
            <div className="mb-2">
                <a href="https://discord.gg/YvFRJ97A5H" target="_blank" rel="noopener noreferrer" className="text-indigo-500 dark:text-indigo-400 hover:underline font-semibold">
                    Join the Community on Discord
                </a>
            </div>
            <p>&copy; {new Date().getFullYear()} marching.art. All Rights Reserved.</p>
        </footer>
    );
};
export default Footer;