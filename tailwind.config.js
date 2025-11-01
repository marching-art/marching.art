/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        // Primary: Radiant Gold
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-dark) / <alpha-value>)',
        },
        // Secondary: Brown
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          dark: 'rgb(var(--color-secondary-dark) / <alpha-value>)',
        },
        // Accent: Warm Tan
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          dark: 'rgb(var(--color-accent-dark) / <alpha-value>)',
        },
        // Background
        background: {
          DEFAULT: 'rgb(var(--color-background) / <alpha-value>)',
          dark: 'rgb(var(--color-background-dark) / <alpha-value>)',
        },
        // Surface
        surface: {
          DEFAULT: 'rgb(var(--color-surface) / <alpha-value>)',
          dark: 'rgb(var(--color-surface-dark) / <alpha-value>)',
        },
        // Text colors
        'text-primary': {
          DEFAULT: 'rgb(var(--text-primary) / <alpha-value>)',
          dark: 'rgb(var(--text-primary-dark) / <alpha-value>)',
        },
        'text-secondary': {
          DEFAULT: 'rgb(var(--text-secondary) / <alpha-value>)',
          dark: 'rgb(var(--text-secondary-dark) / <alpha-value>)',
        },
        // On-colors for buttons
        'on-primary': 'rgb(var(--on-primary) / <alpha-value>)',
        'on-secondary': 'rgb(var(--on-secondary) / <alpha-value>)',
      },
      borderRadius: {
        'theme': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'theme': '0 4px 20px rgba(0, 0, 0, 0.08)',
        'theme-dark': '0 4px 20px rgba(0, 0, 0, 0.5)',
        'glow-sm': '0 0 15px rgba(255, 185, 15, 0.3)',
        'glow': '0 0 20px rgba(255, 185, 15, 0.4), 0 0 40px rgba(255, 185, 15, 0.2)',
        'glow-lg': '0 0 30px rgba(255, 185, 15, 0.5), 0 0 60px rgba(255, 185, 15, 0.3)',
        'glow-accent': '0 0 20px rgba(168, 85, 247, 0.4), 0 0 40px rgba(168, 85, 247, 0.2)',
        'inner-glow': 'inset 0 0 20px rgba(255, 185, 15, 0.2)',
        'card': '0 10px 30px rgba(0, 0, 0, 0.1)',
        'card-hover': '0 15px 40px rgba(0, 0, 0, 0.15)',
      },
      borderWidth: {
        'theme': '1px',
      },
      animation: {
        'fade-in': 'fadeIn 0.6s ease-out',
        'slide-in-left': 'slideInLeft 0.6s ease-out',
        'slide-in-right': 'slideInRight 0.6s ease-out',
        'float': 'float 3s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmerMove 3s infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-subtle': 'bounce 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '1', filter: 'brightness(1)' },
          '50%': { opacity: '0.8', filter: 'brightness(1.2)' },
        },
        shimmerMove: {
          '0%': { left: '-150%' },
          '100%': { left: '150%' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'shimmer': 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.3) 50%, transparent 100%)',
      },
      backdropBlur: {
        xs: '4px',
      },
      transitionTimingFunction: {
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      scale: {
        '102': '1.02',
      },
    },
  },
  plugins: [],
}
