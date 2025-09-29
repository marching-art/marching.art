/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary brand color - gold from CSS variables
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-dark) / <alpha-value>)',
        },
        // Secondary brand color - brown from CSS variables
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          dark: 'rgb(var(--color-secondary-dark) / <alpha-value>)',
        },
        // Accent color - tan from CSS variables
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          dark: 'rgb(var(--color-accent-dark) / <alpha-value>)',
        },
        // Background colors from CSS variables
        background: {
          DEFAULT: 'rgb(var(--color-background) / <alpha-value>)',
          dark: 'rgb(var(--color-background-dark) / <alpha-value>)',
        },
        // Surface colors from CSS variables
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          dark: 'rgb(var(--color-surface-dark) / <alpha-value>)',
        },
        // Text colors from CSS variables
        'text-primary': {
          DEFAULT: 'rgb(var(--text-primary) / <alpha-value>)',
          dark: 'rgb(var(--text-primary-dark) / <alpha-value>)',
        },
        'text-secondary': {
          DEFAULT: 'rgb(var(--text-secondary) / <alpha-value>)',
          dark: 'rgb(var(--text-secondary-dark) / <alpha-value>)',
        },
        // On-color classes for text on colored backgrounds
        'on-primary': 'rgb(var(--on-primary) / <alpha-value>)',
        'on-secondary': 'rgb(var(--on-secondary) / <alpha-value>)',
        
        // Class-specific colors for compatibility
        'class-world': '#8B5CF6', // Purple
        'class-open': '#3B82F6',  // Blue
        'class-a': '#10B981',     // Green
        'class-soundsport': '#F59E0B', // Orange
        
        // Status colors
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6'
      },
      
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif']
      },
      
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem'
      },
      
      borderRadius: {
        'theme': '0.75rem'
      },
      
      boxShadow: {
        'theme': '0 4px 10px rgba(0, 0, 0, 0.05)',
        'theme-dark': '0 4px 10px rgba(0, 0, 0, 0.4)',
        'glow': '0 0 20px rgba(255, 107, 53, 0.3)'
      },
      
      textShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 2px 4px rgba(0, 0, 0, 0.10)',
        'lg': '0 8px 16px rgba(0, 0, 0, 0.15)'
      },
      
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'bounce-subtle': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out'
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      },
      
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding'
      }
    }
  },
  plugins: [
    // Text shadow plugin
    plugin(function ({ matchUtilities, theme }) {
      matchUtilities(
        {
          'text-shadow': (value) => ({
            textShadow: value,
          }),
        },
        { values: theme('textShadow') }
      )
    }),
    // Custom utilities
    function({ addUtilities }) {
      const newUtilities = {
        '.line-clamp-2': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '2'
        },
        '.line-clamp-3': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '3'
        },
        '.gradient-primary': {
          background: 'linear-gradient(135deg, rgb(var(--color-primary)) 0%, rgb(var(--color-primary-dark)) 100%)'
        },
        '.gradient-surface': {
          background: 'linear-gradient(135deg, rgb(var(--color-surface-dark)) 0%, rgb(var(--color-background-dark)) 100%)'
        }
      };
      addUtilities(newUtilities);
    }
  ]
};