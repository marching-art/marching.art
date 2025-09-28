/** @type {import('tailwindcss').Config} */
const plugin = require('tailwindcss/plugin');

module.exports = {
  darkMode: 'class',
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      // Gaming-specific animations
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 3s infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite alternate',
        'slide-in-bottom': 'slide-in-bottom 0.5s ease-out',
        'slide-in-right': 'slide-in-right 0.5s ease-out',
        'slide-in-left': 'slide-in-left 0.5s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
      },
      
      // Enhanced text shadows for gaming UI
      textShadow: {
        DEFAULT: '2px 2px 4px rgb(0 0 0 / 0.5)',
        lg: '3px 3px 6px rgb(0 0 0 / 0.5)',
        xl: '4px 4px 8px rgb(0 0 0 / 0.6)',
        glow: '0 0 10px rgb(var(--color-primary) / 0.5)',
        'glow-strong': '0 0 20px rgb(var(--color-primary) / 0.8)',
      },

      // Extended color palette
      colors: {
        // Primary brand color - gold
        primary: {
          50: 'rgb(254 252 232)',
          100: 'rgb(254 249 195)',
          200: 'rgb(254 240 138)',
          300: 'rgb(253 224 71)',
          400: 'rgb(250 204 21)',
          500: 'rgb(var(--color-primary) / <alpha-value>)',
          600: 'rgb(217 119 6)',
          700: 'rgb(180 83 9)',
          800: 'rgb(146 64 14)',
          900: 'rgb(120 53 15)',
          950: 'rgb(69 26 3)',
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-dark) / <alpha-value>)',
        },
        
        // Secondary brand color - brown/tan
        secondary: {
          50: 'rgb(250 245 255)',
          100: 'rgb(243 232 255)',
          200: 'rgb(233 213 255)',
          300: 'rgb(196 181 253)',
          400: 'rgb(168 162 158)',
          500: 'rgb(var(--color-secondary) / <alpha-value>)',
          600: 'rgb(120 53 15)',
          700: 'rgb(101 53 33)',
          800: 'rgb(87 40 25)',
          900: 'rgb(76 29 24)',
          950: 'rgb(45 12 9)',
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          dark: 'rgb(var(--color-secondary-dark) / <alpha-value>)',
        },
        
        // Accent color
        accent: {
          50: 'rgb(254 252 232)',
          100: 'rgb(254 249 195)',
          200: 'rgb(254 240 138)',
          300: 'rgb(220 200 170)',
          400: 'rgb(180 160 140)',
          500: 'rgb(var(--color-accent) / <alpha-value>)',
          600: 'rgb(101 67 33)',
          700: 'rgb(87 55 28)',
          800: 'rgb(73 45 23)',
          900: 'rgb(59 35 18)',
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          dark: 'rgb(var(--color-accent-dark) / <alpha-value>)',
        },
        
        // Background colors
        background: {
          DEFAULT: 'rgb(var(--color-background) / <alpha-value>)',
          dark: 'rgb(var(--color-background-dark) / <alpha-value>)',
        },
        
        // Surface colors for cards, modals
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
        
        // On-color text for buttons
        'on-primary': 'rgb(var(--on-primary) / <alpha-value>)',
        'on-secondary': 'rgb(var(--on-secondary) / <alpha-value>)',

        // Gaming status colors
        success: {
          DEFAULT: 'rgb(34 197 94)',
          dark: 'rgb(22 163 74)',
        },
        warning: {
          DEFAULT: 'rgb(251 191 36)',
          dark: 'rgb(245 158 11)',
        },
        error: {
          DEFAULT: 'rgb(239 68 68)',
          dark: 'rgb(220 38 38)',
        },
        info: {
          DEFAULT: 'rgb(59 130 246)',
          dark: 'rgb(37 99 235)',
        },

        // Class-specific colors
        'world-class': 'rgb(147 51 234)', // Purple
        'open-class': 'rgb(37 99 235)',   // Blue
        'a-class': 'rgb(34 197 94)',      // Green
        'soundsport': 'rgb(249 115 22)',  // Orange
      },

      // Enhanced border radius for modern look
      borderRadius: {
        'theme': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },

      // Enhanced box shadows for depth
      boxShadow: {
        'theme': '0 4px 10px rgba(0, 0, 0, 0.05)',
        'theme-dark': '0 4px 10px rgba(0, 0, 0, 0.4)',
        'glow': '0 0 20px rgba(var(--color-primary), 0.3)',
        'glow-strong': '0 0 30px rgba(var(--color-primary), 0.5)',
        'glow-accent': '0 0 20px rgba(var(--color-accent), 0.4)',
        'inner-glow': 'inset 0 0 20px rgba(var(--color-primary), 0.1)',
        'card': '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        'card-hover': '0 20px 25px -5px rgba(0, 0, 0, 0.15), 0 10px 10px -5px rgba(0, 0, 0, 0.08)',
      },

      // Enhanced spacing scale
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem',
      },

      // Enhanced font family
      fontFamily: {
        'gaming': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        'display': ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },

      // Enhanced font sizes
      fontSize: {
        '2xs': '0.625rem',
        '5xl': '3rem',
        '6xl': '3.75rem',
        '7xl': '4.5rem',
        '8xl': '6rem',
        '9xl': '8rem',
      },

      // Enhanced line heights
      lineHeight: {
        '12': '3rem',
        '16': '4rem',
      },

      // Enhanced z-index scale
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },

      // Backdrop blur values
      backdropBlur: {
        xs: '2px',
      },

      // Custom transforms
      scale: {
        '102': '1.02',
        '103': '1.03',
      },

      // Custom gradients (handled via CSS variables in index.css)
      backgroundImage: {
        'gradient-gaming': 'linear-gradient(135deg, rgba(var(--color-primary), 0.1) 0%, rgba(var(--color-secondary), 0.1) 100%)',
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
    },
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

    // Custom utility classes plugin
    plugin(function ({ addUtilities, theme }) {
      addUtilities({
        // Gaming button effects
        '.btn-glow': {
          boxShadow: '0 0 20px rgba(var(--color-primary), 0.3)',
          transition: 'all 0.3s ease',
        },
        '.btn-glow:hover': {
          boxShadow: '0 0 30px rgba(var(--color-primary), 0.5)',
          transform: 'translateY(-2px)',
        },

        // Card hover effects
        '.card-lift': {
          transition: 'all 0.3s ease',
        },
        '.card-lift:hover': {
          transform: 'translateY(-5px)',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
        },

        // Glass morphism effect
        '.glass': {
          backgroundColor: 'rgba(var(--color-surface), 0.8)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        },

        // Gradient text utilities
        '.text-gradient-primary': {
          background: 'linear-gradient(135deg, rgb(var(--color-primary)), rgb(var(--color-secondary)))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        },

        '.text-gradient-accent': {
          background: 'linear-gradient(135deg, rgb(var(--color-accent)), rgb(var(--color-primary)))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        },

        // Animation delay utilities
        '.animation-delay-1000': {
          animationDelay: '1s',
        },
        '.animation-delay-2000': {
          animationDelay: '2s',
        },
        '.animation-delay-4000': {
          animationDelay: '4s',
        },

        // Custom scrollbar
        '.scrollbar-gaming': {
          '&::-webkit-scrollbar': {
            width: '8px',
            height: '8px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'rgb(var(--color-surface))',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgb(var(--color-accent))',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: 'rgb(var(--color-primary))',
          },
        },
      })
    }),

    // Animation keyframes plugin
    plugin(function ({ addUtilities }) {
      addUtilities({
        '@keyframes float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        '@keyframes glow-pulse': {
          '0%': { boxShadow: '0 0 20px rgba(var(--color-primary), 0.3)' },
          '100%': { boxShadow: '0 0 30px rgba(var(--color-primary), 0.6)' },
        },
        '@keyframes slide-in-bottom': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        '@keyframes slide-in-right': {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        '@keyframes slide-in-left': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        '@keyframes fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        '@keyframes scale-in': {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        '@keyframes wiggle': {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        '@keyframes shimmer': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      })
    }),
  ],
}