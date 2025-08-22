import React, { useState, useEffect, useRef } from 'react';
import LogoIcon from '../ui/LogoIcon';
import Icon from '../ui/Icon';

// Define the component for the Buy Me a Coffee button directly in this file.
// This keeps the logic self-contained and allows it to be reused for both mobile and desktop views.
const BuyMeACoffeeButton = () => {
    const bmcRef = useRef(null);

    useEffect(() => {
        // Create a script element
        const script = document.createElement('script');
        script.src = "https://cdnjs.buymeacoffee.com/1.0.0/button.prod.min.js";
        script.async = true;

        // Set the data attributes from your original script tag
        script.dataset.name = "bmc-button";
        script.dataset.slug = "marching.art";
        script.dataset.color = "#FFDD00";
        script.dataset.emoji = "";
        script.dataset.font = "Cookie";
        script.dataset.text = ""; // The script will default to "Buy me a coffee"
        script.dataset.outlineColor = "#000000";
        script.dataset.fontColor = "#000000";
        script.dataset.coffeeColor = "#ffffff";

        // Append the script to this component's container div
        if (bmcRef.current) {
            bmcRef.current.appendChild(script);
        }

        // Cleanup: remove the script when the component unmounts
        return () => {
            if (bmcRef.current && bmcRef.current.firstChild) {
                bmcRef.current.removeChild(bmcRef.current.firstChild);
            }
        };
    }, []); // The empty array ensures this effect runs only once after the component mounts

    return <div ref={bmcRef}></div>;
};


const Header = ({ isLoggedIn, isAdmin, onLoginClick, onSignUpClick, onLogout, setPage, profile, theme, toggleTheme }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    return (
        <header className="bg-gray-100 dark:bg-black border-b-4 border-yellow-500 p-4 flex justify-between items-center shadow-md relative">
            <div onClick={() => setPage('home')} className="flex items-center space-x-3 cursor-pointer">
                <LogoIcon className="h-9 w-9" />
                <span className="text-xl sm:text-2xl md:text-3xl font-semibold text-gray-800 dark:text-white tracking-wide">
                    marching<span className="text-yellow-600 dark:text-yellow-500 font-bold">.art</span>
                </span>
            </div>
            
            <div className="hidden md:flex items-center space-x-2 md:space-x-4">
                <nav className="flex items-center space-x-2 md:space-x-4">
                    {isLoggedIn ? (
                        <>
                            {isAdmin && <button onClick={() => setPage('admin')} className="text-red-500 font-bold hover:underline">Admin</button>}
                            <button onClick={() => setPage('dashboard')} className="text-gray-700 dark:text-yellow-300 hover:text-black dark:hover:text-white transition-colors">Dashboard</button>
                            <button onClick={() => setPage('profile')} className="text-gray-700 dark:text-yellow-300 hover:text-black dark:hover:text-white transition-colors">Profile</button>
                            <button onClick={onLogout} className="bg-gray-300 dark:bg-yellow-700 hover:bg-gray-400 dark:hover:bg-yellow-600 text-gray-800 dark:text-white font-bold py-2 px-3 rounded border-b-2 border-gray-400 dark:border-yellow-800 transition-all text-sm">
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={onLoginClick} className="text-gray-700 dark:text-yellow-300 hover:text-black dark:hover:text-white transition-colors">Log In</button>
                            <button onClick={onSignUpClick} className="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-3 rounded border-b-4 border-yellow-800 hover:border-yellow-700 transition-all text-sm">
                                Sign Up
                            </button>
                        </>
                    )}
                </nav>
                 <button onClick={toggleTheme} className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-500">
                    {theme === 'light' ? <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /> : <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" />}
                </button>
                {/* --- Use the integrated button component --- */}
                <BuyMeACoffeeButton />
            </div>

            <div className="md:hidden flex items-center">
                <button onClick={toggleTheme} className="p-2 mr-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-yellow-300">
                    {theme === 'light' ? <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /> : <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" />}
                </button>
                 {/* --- Use the integrated button component for mobile --- */}
                <div className="mr-2">
                    <BuyMeACoffeeButton />
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-yellow-300">
                    <Icon path="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </button>
            </div>

            {isMobileMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg border border-gray-200 dark:border-yellow-700 z-20">
                    <nav className="flex flex-col p-2">
                        {isLoggedIn ? (
                            <>
                                {isAdmin && <button onClick={() => { setPage('admin'); setIsMobileMenuOpen(false); }} className="text-red-500 font-bold p-2 text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700">Admin</button>}
                                <button onClick={() => { setPage('dashboard'); setIsMobileMenuOpen(false); }} className="text-gray-700 dark:text-yellow-300 p-2 text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700">Dashboard</button>
                                <button onClick={() => { setPage('profile'); setIsMobileMenuOpen(false); }} className="text-gray-700 dark:text-yellow-300 p-2 text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700">Profile</button>
                                <button onClick={() => { onLogout(); setIsMobileMenuOpen(false); }} className="text-gray-700 dark:text-yellow-300 p-2 text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700">Logout</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => { onLoginClick(); setIsMobileMenuOpen(false); }} className="text-gray-700 dark:text-yellow-300 p-2 text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700">Log In</button>
                                <button onClick={() => { onSignUpClick(); setIsMobileMenuOpen(false); }} className="text-gray-700 dark:text-yellow-300 p-2 text-left rounded hover:bg-gray-100 dark:hover:bg-gray-700">Sign Up</button>
                            </>
                        )}
                    </nav>
                </div>
            )}
        </header>
    );
};
export default Header;