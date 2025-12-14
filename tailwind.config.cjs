/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  // Single dark mode - always active via data-theme="dark"
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // ===========================================
        // ESPN FANTASY - PROFESSIONAL DATA DESIGN SYSTEM
        // High density, no blooms, no gradients, high contrast
        // ===========================================

        // BASE COLORS
        black: '#000000',
        white: '#FFFFFF',

        // PRIMARY BRAND (DCI Blue)
        'dci-blue': '#0057B8',
        primary: '#0057B8',
        'primary-content': '#FFFFFF',

        // SURFACE COLORS - Deep neutral backgrounds
        background: '#0A0A0A',
        surface: {
          DEFAULT: '#0A0A0A',    // App Background
          card: '#1A1A1A',       // Card Background
          elevated: '#2A2A2A',   // Elevated elements
        },
        'surface-secondary': '#1A1A1A',
        'surface-tertiary': '#2A2A2A',

        // TEXT COLORS - High contrast hierarchy
        text: {
          DEFAULT: '#FFFFFF',    // Primary text
          primary: '#FFFFFF',
          secondary: '#B3B3B3',  // Secondary text
          muted: '#808080',      // Muted/disabled text
        },
        main: '#FFFFFF',
        muted: '#808080',
        'text-main': '#FFFFFF',
        'text-secondary': '#B3B3B3',
        'text-muted': '#808080',
        'text-inverse': '#0A0A0A',

        // TREND COLORS - Data status indicators
        trend: {
          up: '#00C853',         // Green - positive
          down: '#FF5252',       // Red - negative
          neutral: '#9E9E9E',    // Gray - no change
        },

        // STATUS COLORS (mapped to trend colors)
        success: '#00C853',
        error: '#FF5252',
        danger: '#FF5252',
        warning: '#FF9800',

        // BORDER COLORS
        'border-default': 'rgba(255, 255, 255, 0.1)',
        'border-muted': 'rgba(255, 255, 255, 0.05)',

        // CHARCOAL SCALE - For fine-grained control
        charcoal: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#2A2A2A',
          900: '#1A1A1A',
          950: '#0A0A0A'
        },
      },
      boxShadow: {
        // STANDARD BLACK SHADOWS - Clean, professional depth
        'none': 'none',
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        DEFAULT: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.05)',
        // Card shadows - standard elevation
        'card': '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
        'card-hover': '0 10px 15px -3px rgba(0, 0, 0, 0.25)',
      },
      borderWidth: {
        DEFAULT: '1px',
        '2': '2px',
        '3': '3px',
      },
      borderRadius: {
        'none': '0',
        'sm': '6px',
        DEFAULT: '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
        'full': '9999px',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Roboto Mono"', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
        'display': ['Oswald', 'Barlow Condensed', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
        'data': ['JetBrains Mono', 'Fira Code', 'Roboto Mono', 'monospace'],
      },
      fontSize: {
        // Tabular-nums variants for data display
        'stat-xs': ['0.75rem', { fontVariantNumeric: 'tabular-nums' }],
        'stat-lg': ['1.25rem', { fontVariantNumeric: 'tabular-nums', fontWeight: '700' }],
      },
      letterSpacing: {
        'tighter': '-0.05em',
        'tight': '-0.025em',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.4s ease-out',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 8s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
        'ping-slow': 'pingSlow 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        // System animations - snappy, mechanical feel
        'slide-in-bottom': 'slideInBottom 0.35s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
        'slide-in-top': 'slideInTop 0.3s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' }
        },
        slideInBottom: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' }
        },
        slideInTop: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' }
        },
        pingSlow: {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '75%, 100%': { transform: 'scale(1.5)', opacity: '0' }
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        DEFAULT: '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
      },
      height: {
        'dvh': '100dvh',
        'screen': '100vh',
      },
      minHeight: {
        'dvh': '100dvh',
        'screen': '100vh',
      },
      maxHeight: {
        'dvh': '100dvh',
        'screen': '100vh',
      },
      gridTemplateColumns: {
        'bento-12': 'repeat(12, minmax(0, 1fr))',
        'bento-nav': '80px repeat(11, minmax(0, 1fr))',
        'bento-nav-expanded': '240px repeat(11, minmax(0, 1fr))',
      },
      gridTemplateRows: {
        'bento-full': '56px minmax(0, 1fr) 32px',
        'bento-no-header': 'minmax(0, 1fr) 32px',
        'bento-no-ticker': '56px minmax(0, 1fr)',
        'bento-minimal': 'minmax(0, 1fr)',
      },
    },
  },
  plugins: [],
}
