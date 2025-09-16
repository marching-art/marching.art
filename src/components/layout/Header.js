import React, { useState } from 'react';
import LogoIcon from '../ui/LogoIcon';
import Icon from '../ui/Icon';

const Header = ({
    isLoggedIn,
    isAdmin,
    onLoginClick,
    onSignUpClick,
    onLogout,
    setPage,
    profile,
    themeMode,
    toggleThemeMode,
    currentThemeStyle,
    switchThemeStyle
}) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const NavButton = ({ page, children }) => (
        <button onClick={() => setPage(page)} className="text-text-primary hover:text-primary dark:hover:text-primary-dark font-semibold transition-colors">
            {children}
        </button>
    );

    const MobileNavButton = ({ page, children }) => (
         <button onClick={() => { setPage(page); setIsMobileMenuOpen(false); }} className="text-text-primary p-2 text-left rounded-theme hover:bg-surface dark:hover:bg-surface-dark font-semibold">
            {children}
        </button>
    );

    return (
        <header className="bg-surface dark:bg-background-dark border-b-4 border-secondary p-4 flex justify-between items-center shadow-theme relative">
            <div onClick={() => setPage('home')} className="flex items-center space-x-3 cursor-pointer">
                <LogoIcon className="h-9 w-9" />
                <span className="text-xl sm:text-2xl md:text-3xl font-semibold text-text-primary tracking-wide">
                    marching<span className="text-primary dark:text-primary-dark font-bold">.art</span>
                </span>
            </div>
            
            <div className="hidden md:flex items-center space-x-4">
                <nav className="flex items-center space-x-4">
                    <NavButton page="schedule">Schedule</NavButton>
                    <NavButton page="scores">Scores</NavButton>

                    {isLoggedIn ? (
                        <>
                            <NavButton page="dashboard">Dashboard</NavButton>
                            <NavButton page="profile">Profile</NavButton>
                            {isAdmin && <button onClick={() => setPage('admin')} className="text-red-500 font-bold hover:underline">Admin</button>}
                            <button onClick={onLogout} className="border-theme border-accent hover:bg-accent/20 text-text-primary font-bold py-2 px-3 rounded-theme transition-all text-sm">
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <button onClick={onLoginClick} className="text-text-primary hover:text-primary dark:hover:text-primary-dark transition-colors">Log In</button>
                            <button onClick={onSignUpClick} className="bg-primary hover:bg-primary/80 text-on-primary font-bold py-2 px-3 rounded-theme transition-all text-sm">
                                Sign Up
                            </button>
                        </>
                    )}
                </nav>
                 <div className="flex items-center space-x-2">
                    <select
                        value={currentThemeStyle}
                        onChange={(e) => switchThemeStyle(e.target.value)}
                        className="bg-surface dark:bg-surface-dark border-theme border-accent rounded-theme p-2 text-sm font-semibold"
                    >
                        <option value="brand">Brand Theme</option>
                        <option value="brutalist">Brutalist Theme</option>
                    </select>
                    <button onClick={toggleThemeMode} className="p-2 rounded-theme bg-surface dark:bg-surface-dark text-text-secondary focus:outline-none focus:ring-2 focus:ring-secondary">
                        {themeMode === 'light' ? <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /> : <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" />}
                    </button>
                 </div>
            </div>

            <div className="md:hidden flex items-center">
                 <button onClick={toggleThemeMode} className="p-2 mr-2 rounded-theme bg-surface dark:bg-surface-dark text-text-secondary">
                    {themeMode === 'light' ? <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" /> : <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" />}
                </button>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-theme bg-surface dark:bg-surface-dark text-text-secondary">
                    <Icon path="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                </button>
            </div>

            {isMobileMenuOpen && (
                <div className="absolute top-full right-0 mt-2 w-48 bg-surface dark:bg-surface-dark rounded-theme shadow-theme border-theme border-accent z-20">
                    <nav className="flex flex-col p-2">
                        <MobileNavButton page="schedule">Schedule</MobileNavButton>
                        <MobileNavButton page="scores">Scores</MobileNavButton>
                        
                        {isLoggedIn ? (
                            <>
                                <MobileNavButton page="dashboard">Dashboard</MobileNavButton>
                                <MobileNavButton page="profile">Profile</MobileNavButton>
                                {isAdmin && <button onClick={() => { setPage('admin'); setIsMobileMenuOpen(false); }} className="text-red-500 font-bold p-2 text-left rounded-theme hover:bg-surface dark:hover:bg-surface-dark">Admin</button>}
                                <button onClick={() => { onLogout(); setIsMobileMenuOpen(false); }} className="text-text-primary p-2 text-left rounded-theme hover:bg-surface dark:hover:bg-surface-dark">Logout</button>
                            </>
                        ) : (
                            <>
                                <button onClick={() => { onLoginClick(); setIsMobileMenuOpen(false); }} className="text-text-primary p-2 text-left rounded-theme hover:bg-surface dark:hover:bg-surface-dark">Log In</button>
                                <button onClick={() => { onSignUpClick(); setIsMobileMenuOpen(false); }} className="text-text-primary p-2 text-left rounded-theme hover:bg-surface dark:hover:bg-surface-dark">Sign Up</button>
                            </>
                        )}
                        <div className="border-t-theme border-accent mt-2 pt-2">
                             <select
                                value={currentThemeStyle}
                                onChange={(e) => switchThemeStyle(e.target.value)}
                                className="w-full bg-surface dark:bg-surface-dark border-theme border-accent rounded-theme p-2 text-sm font-semibold"
                            >
                                <option value="brand">Brand Theme</option>
                                <option value="brutalist">Brutalist Theme</option>
                            </select>
                        </div>
                    </nav>
                </div>
            )}
        </header>
    );
};
export default Header;