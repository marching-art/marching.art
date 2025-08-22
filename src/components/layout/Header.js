import React, { useState } from 'react';
import LogoIcon from '../ui/LogoIcon';
import Icon from '../ui/Icon';

const Header = ({ isLoggedIn, isAdmin, onLoginClick, onSignUpClick, onLogout, setPage, profile, theme, toggleTheme }) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Coffee cup icon SVG path
    const coffeeIconPath = "M10.75 10.75V10.75C10.75 11.3023 11.1977 11.75 11.75 11.75H14.25C14.8023 11.75 15.25 11.3023 15.25 10.75V4.75C15.25 4.19772 14.8023 3.75 14.25 3.75H11.75C11.1977 3.75 10.75 4.19772 10.75 4.75V10.75ZM15.25 6.75H17.25C18.3546 6.75 19.25 7.64543 19.25 8.75V8.75C19.25 9.85457 18.3546 10.75 17.25 10.75H15.25";

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
                {/* --- NEW BUTTON ADDED HERE --- */}
                <a href="http://buymeacoffee.com/marching.art" target="_blank" rel="noopener noreferrer">
                    <button className="p-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-yellow-300 focus:outline-none focus:ring-2 focus:ring-yellow-500">
                        <Icon path={coffeeIconPath} />
                    </button>
                </a>
            </div>

            <div className="md:hidden flex items-center">
                <button onClick={toggleTheme} className="p-2 mr-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-yellow-300">
                    {theme === 'light' ? <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /> : <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" />}
                </button>
                 {/* --- NEW BUTTON ADDED HERE (FOR MOBILE) --- */}
                <a href="http://buymeacoffee.com/marching.art" target="_blank" rel="noopener noreferrer" className="p-2 mr-2 rounded-md bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-yellow-300">
                    <Icon path={coffeeIconPath} />
                </a>
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
