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
        // NIGHT MODE STADIUM HUD DESIGN SYSTEM
        // Single dark theme - "Always night at the stadium"
        // ===========================================

        // BASE COLORS
        black: '#000000',
        white: '#FFFFFF',

        // PRIMARY (Electric Gold) - For actions and data highlights
        primary: '#FACC15',
        'primary-content': '#0A0A0A',

        // SURFACE COLORS - Deep charcoal base
        background: '#0A0A0A',
        surface: '#111827',
        'surface-highlight': '#1F2937',

        // TEXT COLORS - Cream hierarchy
        main: '#F5F5DC',
        muted: 'rgba(245, 245, 220, 0.6)',

        // STATUS COLORS
        success: '#22c55e',
        error: '#ef4444',

        // ===========================================
        // STADIUM HUD FOUNDATION
        // Deep atmospheric backgrounds
        // ===========================================
        'stadium-black': '#0A0A0A',
        'stadium-charcoal': '#111827',

        // ===========================================
        // COLOR SCALES
        // ===========================================

        // CREAM SCALE - Body text and labels (softer than pure white)
        cream: {
          50: '#FEFDF8',
          100: '#FDF9ED',
          200: '#FAF3DC',
          300: '#F5ECCC',
          400: '#F0E4BB',
          500: '#EADCAB',
          DEFAULT: '#F5F5DC',            // Primary body text
          muted: 'rgba(245, 245, 220, 0.6)', // Secondary labels
          600: '#D4C48A',
          700: '#BEAC6A',
          800: '#A8944A',
          900: '#7A6C36'
        },

        // GOLD SCALE - Electric Gold for data highlights and CTAs
        gold: {
          50: '#FFFEF5',
          100: '#FFFBEB',
          200: '#FEF3C7',
          300: '#FDE68A',
          400: '#FACC15',                // Primary Electric Gold
          500: '#EAB308',                // CTA buttons, glow effects
          DEFAULT: '#FACC15',
          600: '#CA8A04',
          700: '#A16207',
          800: '#854D0E',
          900: '#713F12'
        },

        // CHARCOAL SCALE - Deep atmospheric backgrounds
        charcoal: {
          50: '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#111827',
          950: '#0A0A0A'
        },

        // Semantic aliases for single dark mode
        'text-main': '#F5F5DC',
        'text-secondary': '#EADCAB',
        'text-muted': 'rgba(245, 245, 220, 0.6)',
        'text-inverse': '#0A0A0A',
        danger: '#ef4444',
        warning: '#f59e0b',
        'border-default': 'rgba(255, 255, 255, 0.1)',
        'border-muted': 'rgba(255, 255, 255, 0.05)',
        'surface-secondary': '#111827',
        'surface-tertiary': '#1F2937',
        'primary-muted': 'rgba(250, 204, 21, 0.15)',
      },
      boxShadow: {
        // STADIUM HUD GLOW SHADOWS - Soft golden glows for premium sports feel
        'none': 'none',

        // ===========================================
        // GOLD GLOW SHADOWS (Stadium HUD Design Guide)
        // ===========================================
        'gold-glow-sm': '0 0 10px rgba(234, 179, 8, 0.3)',   // Subtle highlights
        'gold-glow-md': '0 0 15px rgba(234, 179, 8, 0.4)',   // Primary buttons, active cards
        'gold-glow-lg': '0 0 25px rgba(234, 179, 8, 0.6)',   // Major achievements, hover states

        // Legacy glow aliases (for backwards compatibility)
        'glow-sm': '0 0 10px rgba(234, 179, 8, 0.2)',
        'glow': '0 0 15px rgba(234, 179, 8, 0.3)',
        'glow-md': '0 0 20px rgba(234, 179, 8, 0.35)',
        'glow-lg': '0 0 25px rgba(234, 179, 8, 0.4)',
        'glow-xl': '0 0 35px rgba(234, 179, 8, 0.5)',
        // Hover glow states (intensified)
        'glow-hover': '0 0 25px rgba(234, 179, 8, 0.5)',
        'glow-hover-lg': '0 0 35px rgba(234, 179, 8, 0.6)',
        // Glass panel shadows - subtle depth
        'glass': '0 4px 30px rgba(0, 0, 0, 0.3)',
        'glass-lg': '0 8px 40px rgba(0, 0, 0, 0.4)',
        // Card shadows with subtle glow
        'card': '0 4px 20px rgba(0, 0, 0, 0.25), 0 0 10px rgba(234, 179, 8, 0.1)',
        'card-hover': '0 8px 30px rgba(0, 0, 0, 0.3), 0 0 20px rgba(234, 179, 8, 0.2)',
        // Status glow variants
        'glow-success': '0 0 15px rgba(34, 197, 94, 0.4)',
        'glow-danger': '0 0 15px rgba(239, 68, 68, 0.4)',
        'glow-warning': '0 0 15px rgba(245, 158, 11, 0.4)',
        // Legacy brutalist shadows (deprecated - kept for backwards compatibility)
        'hard': '4px 4px 0px 0px #000000',
        'hard-sm': '2px 2px 0px 0px #000000',
        'brutal-xs': '2px 2px 0px 0px #000000',
        'brutal-sm': '3px 3px 0px 0px #000000',
        'brutal': '4px 4px 0px 0px #000000',
        'brutal-md': '4px 4px 0px 0px #000000',
        'brutal-lg': '6px 6px 0px 0px #000000',
        'brutal-xl': '8px 8px 0px 0px #000000',
        'brutal-gold-xs': '2px 2px 0px 0px #FFD700',
        'brutal-gold-sm': '3px 3px 0px 0px #FFD700',
        'brutal-gold': '4px 4px 0px 0px #FFD700',
        'brutal-gold-md': '4px 4px 0px 0px #FFD700',
        'brutal-gold-lg': '6px 6px 0px 0px #FFD700',
        'brutal-gold-xl': '8px 8px 0px 0px #FFD700',
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
        'sm': '6px',
        DEFAULT: '8px',
        'md': '10px',
        'lg': '12px',
        'xl': '16px',        // Glassmorphism panels
        '2xl': '20px',       // Large hero cards
        '3xl': '24px',       // Extra large elements
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
        // System Boot animations - snappy, mechanical feel
        'slide-in-bottom': 'slideInBottom 0.35s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
        'slide-in-top': 'slideInTop 0.3s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
        'boot-grid': 'bootGrid 0.4s cubic-bezier(0.25, 0.1, 0.25, 1.0)',
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
        // System Boot keyframes
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
        bootGrid: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
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
        // STADIUM HUD - Stadium lights atmospheric backgrounds
        'stadium-lights': 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(234, 179, 8, 0.15) 0%, transparent 50%)',
        'stadium-lights-subtle': 'radial-gradient(ellipse 100% 60% at 50% -10%, rgba(234, 179, 8, 0.08) 0%, transparent 40%)',
        'stadium-glow': 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(255, 212, 77, 0.2) 0%, transparent 60%)',
        // Glass panel gradient overlays
        'glass-shine': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)',
        'glass-border': 'linear-gradient(135deg, rgba(255,255,255,0.15) 0%, rgba(255,255,255,0.05) 100%)',
      },
      backdropBlur: {
        'xs': '2px',
        'sm': '4px',
        DEFAULT: '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
      }
    },
  },
  plugins: [],
}
