import React, { useState } from 'react';
import LogoIcon from '../ui/LogoIcon';
import Icon from '../ui/Icon';
import NotificationsIcon from '../ui/NotificationsIcon';

const Header = ({
    user,
    onViewLeague,
    isLoggedIn,
    isAdmin,
    onLoginClick,
    onSignUpClick,
    onLogout,
    setPage,
    onViewOwnProfile,
    profile,
    themeMode,
    toggleThemeMode,
}) => {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const NavButton = ({ page, children }) => (
        <button 
            onClick={() => setPage(page)} 
            className="relative text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark font-medium transition-all duration-300 group"
        >
            {children}
            <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent dark:from-primary-dark dark:to-accent-dark group-hover:w-full transition-all duration-300" />
        </button>
    );

    const MobileNavButton = ({ page, children }) => (
        <button 
            onClick={() => { setPage(page); setIsMobileMenuOpen(false); }} 
            className="text-text-primary dark:text-text-primary-dark p-4 text-left rounded-xl hover:bg-gradient-to-r hover:from-primary/10 hover:to-accent/10 dark:hover:from-primary-dark/10 dark:hover:to-accent-dark/10 font-semibold w-full transition-all duration-300 flex items-center space-x-3"
        >
            <span>{children}</span>
        </button>
    );

    return (
        <header className="glass sticky top-0 z-50 border-b border-accent/20 dark:border-accent-dark/20 shadow-lg backdrop-blur-xl">
            <div className="container mx-auto px-6 py-4">
                <div className="flex justify-between items-center">
                    {/* Logo */}
                    <div 
                        onClick={() => setPage('home')} 
                        className="flex items-center space-x-3 cursor-pointer group"
                    >
                        <div className="relative">
                            <LogoIcon className="h-10 w-10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12" />
                            <div className="absolute inset-0 blur-xl bg-primary/20 dark:bg-primary-dark/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">
                            <span className="text-text-primary dark:text-text-primary-dark transition-colors">marching</span>
                            <span className="gradient-text">.art</span>
                        </span>
                    </div>
                    
                    {/* Desktop Navigation */}
                    <nav className="hidden lg:flex items-center space-x-8">
                        <div className="flex items-center space-x-6">
                            <NavButton page="howtoplay">How to Play</NavButton>
                            <NavButton page="schedule">Schedule</NavButton>
                            <NavButton page="scores">Scores</NavButton>
                            <NavButton page="stats">Stats</NavButton>
                            {isLoggedIn && (
                                <>
                                    <NavButton page="leaderboard">Leaderboard</NavButton>
                                    <NavButton page="leagues">Leagues</NavButton>
                                    <NavButton page="dashboard">Dashboard</NavButton>
                                </>
                            )}
                        </div>

                        {/* Auth Buttons */}
                        <div className="flex items-center space-x-4 ml-6 pl-6 border-l border-accent/20 dark:border-accent-dark/20">
                            {isLoggedIn ? (
                                <>
                                    <NotificationsIcon user={user} setPage={setPage} onViewLeague={onViewLeague} />
                                    <button 
                                        onClick={onViewOwnProfile} 
                                        className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark font-medium transition-all duration-300"
                                    >
                                        Profile
                                    </button>
                                    {isAdmin && (
                                        <button 
                                            onClick={() => setPage('admin')} 
                                            className="text-red-500 font-bold hover:text-red-400 transition-colors text-sm"
                                        >
                                            Admin
                                        </button>
                                    )}
                                    <button 
                                        onClick={onLogout} 
                                        className="px-4 py-2 rounded-xl border border-accent/30 dark:border-accent-dark/30 hover:bg-accent/10 dark:hover:bg-accent-dark/10 text-text-secondary dark:text-text-secondary-dark font-semibold transition-all duration-300"
                                    >
                                        Logout
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button 
                                        onClick={onLoginClick} 
                                        className="text-text-secondary dark:text-text-secondary-dark hover:text-primary dark:hover:text-primary-dark transition-all duration-300 font-medium"
                                    >
                                        Log In
                                    </button>
                                    <button 
                                        onClick={onSignUpClick} 
                                        className="btn-fantasy bg-gradient-to-r from-primary to-accent dark:from-primary-dark dark:to-accent-dark text-on-primary font-bold py-2.5 px-6 rounded-xl shadow-glow-sm hover:shadow-glow transition-all duration-300"
                                    >
                                        Sign Up
                                    </button>
                                </>
                            )}
                            
                            {/* Theme Toggle */}
                            <button 
                                onClick={toggleThemeMode} 
                                className="p-2.5 rounded-xl text-text-secondary dark:text-text-secondary-dark hover:bg-accent/10 dark:hover:bg-accent-dark/10 transition-all duration-300 relative group"
                                aria-label="Toggle theme"
                            >
                                <div className="relative w-6 h-6">
                                    {themeMode === 'light' ? (
                                        <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                                    ) : (
                                        <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" />
                                    )}
                                </div>
                                <div className="absolute inset-0 rounded-xl bg-primary/20 dark:bg-primary-dark/20 opacity-0 group-hover:opacity-100 blur transition-opacity duration-300" />
                            </button>
                        </div>
                    </nav>

                    {/* Mobile Menu Button */}
                    <div className="lg:hidden flex items-center space-x-3">
                        <button 
                            onClick={toggleThemeMode} 
                            className="p-2 rounded-xl text-text-secondary dark:text-text-secondary-dark hover:bg-accent/10 dark:hover:bg-accent-dark/10 transition-all"
                            aria-label="Toggle theme"
                        >
                            {themeMode === 'light' ? (
                                <Icon path="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                            ) : (
                                <Icon path="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M12 21a9 9 0 110-18 9 9 0 010 18z" />
                            )}
                        </button>
                        <button 
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} 
                            className="p-2 rounded-xl text-text-secondary dark:text-text-secondary-dark hover:bg-accent/10 dark:hover:bg-accent-dark/10 transition-all"
                            aria-label="Toggle mobile menu"
                        >
                            <Icon path="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {isMobileMenuOpen && (
                <div className="lg:hidden absolute top-full left-0 right-0 mt-2 mx-4">
                    <div className="glass rounded-2xl shadow-xl border border-accent/20 dark:border-accent-dark/20 overflow-hidden animate-fade-in">
                        <nav className="flex flex-col p-2">
                            <MobileNavButton page="howtoplay">
                                How to Play
                            </MobileNavButton>
                            <MobileNavButton page="schedule">
                                Schedule
                            </MobileNavButton>
                            <MobileNavButton page="scores">
                                Scores
                            </MobileNavButton>
                            <MobileNavButton page="stats">
                                Stats
                            </MobileNavButton>
                            
                            {isLoggedIn && (
                                <>
                                    <div className="h-px bg-gradient-to-r from-transparent via-accent/20 dark:via-accent-dark/20 to-transparent my-2" />
                                    <MobileNavButton page="leaderboard">
                                        Leaderboard
                                    </MobileNavButton>
                                    <MobileNavButton page="leagues">
                                        Leagues
                                    </MobileNavButton>
                                    <MobileNavButton page="dashboard">
                                        Dashboard
                                    </MobileNavButton>
                                    <button 
                                        onClick={() => { onViewOwnProfile(); setIsMobileMenuOpen(false); }} 
                                        className="text-text-primary dark:text-text-primary-dark p-4 text-left rounded-xl hover:bg-gradient-to-r hover:from-primary/10 hover:to-accent/10 dark:hover:from-primary-dark/10 dark:hover:to-accent-dark/10 font-semibold w-full transition-all duration-300"
                                    >
                                        Profile
                                    </button>
                                    {isAdmin && (
                                        <button 
                                            onClick={() => { setPage('admin'); setIsMobileMenuOpen(false); }} 
                                            className="text-red-500 font-bold p-4 text-left rounded-xl hover:bg-red-500/10 w-full transition-all"
                                        >
                                            Admin
                                        </button>
                                    )}
                                    <div className="h-px bg-gradient-to-r from-transparent via-accent/20 dark:via-accent-dark/20 to-transparent my-2" />
                                    <button 
                                        onClick={() => { onLogout(); setIsMobileMenuOpen(false); }} 
                                        className="text-text-primary dark:text-text-primary-dark p-4 text-left rounded-xl hover:bg-gradient-to-r hover:from-red-500/10 hover:to-red-500/10 font-semibold w-full transition-all"
                                    >
                                        Logout
                                    </button>
                                </>
                            )}
                            
                            {!isLoggedIn && (
                                <>
                                    <div className="h-px bg-gradient-to-r from-transparent via-accent/20 dark:via-accent-dark/20 to-transparent my-2" />
                                    <button 
                                        onClick={() => { onLoginClick(); setIsMobileMenuOpen(false); }} 
                                        className="text-text-primary dark:text-text-primary-dark p-4 text-left rounded-xl hover:bg-gradient-to-r hover:from-primary/10 hover:to-accent/10 dark:hover:from-primary-dark/10 dark:hover:to-accent-dark/10 font-semibold w-full transition-all"
                                    >
                                        Log In
                                    </button>
                                    <button 
                                        onClick={() => { onSignUpClick(); setIsMobileMenuOpen(false); }} 
                                        className="m-2 btn-fantasy bg-gradient-to-r from-primary to-accent dark:from-primary-dark dark:to-accent-dark text-on-primary font-bold p-4 rounded-xl text-center shadow-glow-sm"
                                    >
                                        Sign Up
                                    </button>
                                </>
                            )}
                        </nav>
                    </div>
                </div>
            )}
        </header>
    );
};

export default Header;
