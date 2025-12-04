/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // PURE BLACK & WHITE for maximum contrast
        black: '#000000',
        white: '#FFFFFF',
        // BRAND COLORS
        primary: '#FFD700', // Gold/Yellow
        'primary-content': '#000000', // Text on primary must be black
        // SURFACE COLORS (The Paper)
        background: '#FDFBF7', // The beige background
        surface: '#FFFFFF',    // Cards must be white
        'surface-highlight': '#F2F0E9',
        // TEXT COLORS
        main: '#000000',       // Main text is PURE BLACK
        muted: '#525252',      // Secondary text is dark grey (no light greys)
        // STATUS
        success: '#22c55e',
        error: '#ef4444',

        // ===========================================
        // LEGACY COLOR SCALES (for backwards compatibility)
        // ===========================================
        cream: {
          50: '#FDFBF7',
          100: '#FAF6EA',
          200: '#F2F0E9',
          300: '#E5D396',
          400: '#D4C078',
          500: '#C3A54E',
          DEFAULT: '#C3A54E',
          600: '#A38A3F',
          700: '#836F32',
          800: '#635426',
          900: '#43391A'
        },
        gold: {
          50: '#FFFDF5',
          100: '#FFF9E6',
          200: '#FFF0BF',
          300: '#FFE799',
          400: '#FFD44D',
          500: '#FFD700',
          DEFAULT: '#FFD700',
          600: '#FFCA26',
          700: '#FFC100',
          800: '#D9A300',
          900: '#B38600'
        },
        charcoal: {
          50: '#F5F5F5',
          100: '#E5E5E5',
          200: '#D4D4D4',
          300: '#A3A3A3',
          400: '#737373',
          500: '#525252',
          600: '#404040',
          700: '#262626',
          800: '#171717',
          900: '#0A0A0A',
          950: '#000000'
        },
        // Semantic aliases for backwards compatibility
        'text-main': '#000000',
        'text-secondary': '#525252',
        'text-muted': '#525252',
        'text-inverse': '#FFFFFF',
        danger: '#ef4444',
        warning: '#f59e0b',
        'border-default': '#000000',
        'border-muted': '#525252',
        'surface-secondary': '#FFFFFF',
        'surface-tertiary': '#F2F0E9',
        'primary-muted': 'rgba(255, 215, 0, 0.2)',
      },
      boxShadow: {
        // THE BRUTALIST SHADOW - This is non-negotiable
        'hard': '4px 4px 0px 0px #000000',
        'hard-sm': '2px 2px 0px 0px #000000',
        'none': 'none',
        // Hard offset brutalist shadows - Black (light mode)
        'brutal-xs': '2px 2px 0px 0px #000000',
        'brutal-sm': '3px 3px 0px 0px #000000',
        'brutal': '4px 4px 0px 0px #000000',
        'brutal-md': '4px 4px 0px 0px #000000',
        'brutal-lg': '6px 6px 0px 0px #000000',
        'brutal-xl': '8px 8px 0px 0px #000000',
        // Gold variants for dark mode
        'brutal-gold-xs': '2px 2px 0px 0px #FFD700',
        'brutal-gold-sm': '3px 3px 0px 0px #FFD700',
        'brutal-gold': '4px 4px 0px 0px #FFD700',
        'brutal-gold-md': '4px 4px 0px 0px #FFD700',
        'brutal-gold-lg': '6px 6px 0px 0px #FFD700',
        'brutal-gold-xl': '8px 8px 0px 0px #FFD700',
        // Status color variants
        'brutal-danger': '4px 4px 0px 0px #ef4444',
        'brutal-danger-lg': '6px 6px 0px 0px #ef4444',
        'brutal-success': '4px 4px 0px 0px #22c55e',
        'brutal-success-lg': '6px 6px 0px 0px #22c55e',
        'brutal-warning': '4px 4px 0px 0px #f59e0b',
        'brutal-warning-lg': '6px 6px 0px 0px #f59e0b',
      },
      borderWidth: {
        DEFAULT: '2px', // Global default border is 2px
        '3': '3px',
      },
      borderRadius: {
        'none': '0',
        'sm': '4px', // Slight rounding only
        DEFAULT: '4px',
        'md': '4px',
        'lg': '4px',
        'xl': '4px',
        '2xl': '4px',
        'full': '9999px',
      },
      fontFamily: {
        // Force Monospace for data
        mono: ['"JetBrains Mono"', '"Roboto Mono"', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
        'display': ['Oswald', 'Barlow Condensed', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
        'data': ['JetBrains Mono', 'Fira Code', 'Roboto Mono', 'monospace'],
      },
      letterSpacing: {
        'tighter': '-0.05em',
        'tight': '-0.025em',
        'brutal': '-0.04em',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.4s ease-out',
        'pulse-gold': 'pulseGold 2s infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 8s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
        'ping-slow': 'pingSlow 2s cubic-bezier(0, 0, 0.2, 1) infinite',
        'hazard': 'hazardScroll 1s linear infinite',
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
        pulseGold: {
          '0%, 100%': { backgroundColor: 'rgba(255, 212, 77, 0.1)' },
          '50%': { backgroundColor: 'rgba(255, 212, 77, 0.3)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' }
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(255, 212, 77, 0.5), 0 0 20px rgba(255, 212, 77, 0.3)' },
          '100%': { boxShadow: '0 0 20px rgba(255, 212, 77, 0.8), 0 0 40px rgba(255, 212, 77, 0.5)' }
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' }
        },
        pingSlow: {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '75%, 100%': { transform: 'scale(1.5)', opacity: '0' }
        },
        hazardScroll: {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '20px 0' }
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-gold': 'linear-gradient(135deg, #FFD44D 0%, #FFCA26 50%, #D9A300 100%)',
        'gradient-cream': 'linear-gradient(135deg, #FAF6EA 0%, #E5D396 50%, #C3A54E 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1A1A1A 0%, #3B3B3B 50%, #545454 100%)',
        'shimmer-gradient': 'linear-gradient(to right, transparent 0%, rgba(255, 212, 77, 0.2) 50%, transparent 100%)',
        'hazard-stripe': 'repeating-linear-gradient(45deg, #FFD700, #FFD700 10px, #000000 10px, #000000 20px)',
      },
      backdropBlur: {
        'xs': '2px'
      }
    },
  },
  plugins: [],
}
