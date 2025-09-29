import React, { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
  // Read initial state from DOM and localStorage
  const [isDark, setIsDark] = useState(() => {
    // Check localStorage first, then DOM
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      return savedTheme === 'dark';
    }
    return document.documentElement.classList.contains('dark');
  });

  // Sync with localStorage changes (from other tabs/windows)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'theme') {
        const newIsDark = e.newValue === 'dark';
        setIsDark(newIsDark);
        
        if (newIsDark) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Ensure component state matches DOM on mount
  useEffect(() => {
    const currentIsDark = document.documentElement.classList.contains('dark');
    if (currentIsDark !== isDark) {
      setIsDark(currentIsDark);
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);
    
    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }

    // Dispatch custom event for any other components that might need to know
    window.dispatchEvent(new CustomEvent('themeChanged', { detail: { isDark: newIsDark } }));
  };

  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-theme bg-surface dark:bg-surface-dark border border-accent dark:border-accent-dark hover:bg-accent dark:hover:bg-accent-dark transition-all duration-200"
      aria-label="Toggle theme"
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? (
        <Sun className="w-5 h-5 text-primary dark:text-primary-dark" />
      ) : (
        <Moon className="w-5 h-5 text-primary" />
      )}
    </button>
  );
};

export default ThemeToggle;