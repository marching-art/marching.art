/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  // Single dark mode - always active via data-theme="dark"
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    // ===========================================
    // MOBILE-FIRST BREAKPOINTS
    // All styles are mobile-first, scale UP to desktop
    // ===========================================
    screens: {
      xs: '375px', // iPhone SE and up
      sm: '640px', // Large phones / small tablets
      md: '768px', // Tablets
      lg: '1024px', // Desktop
      xl: '1280px', // Large desktop
      '2xl': '1536px', // Extra large desktop
    },
    extend: {
      colors: {
        // ===========================================
        // ESPN FANTASY - PROFESSIONAL DATA DESIGN SYSTEM
        // High density, no blooms, no gradients, high contrast
        // ===========================================

        // BASE COLORS
        black: '#000000',
        white: '#FFFFFF',

        // ===========================================
        // BRAND — permanent gold. The anchor of the visual identity:
        // logo, wordmark, and reward/achievement moments only. Per the
        // unification plan (docs/VISUAL_IDENTITY_UNIFICATION.md), gold is
        // NEVER a generic UI accent — that job belongs to `interactive`.
        // ===========================================
        brand: {
          DEFAULT: '#EAB308', // gold
          strong: '#CA8A04', // hover / active / borders
          subtle: '#A16207', // dim gold
        },

        // ===========================================
        // INTERACTIVE / SELF — azure. Links, primary actions, active nav,
        // focus rings, "your row" highlight. Replaces the legacy #0057B8,
        // which failed WCAG (~2.9:1) on the app background; azure clears
        // ~5.4:1. Warm gold vs. cool azure keeps reward and interaction
        // perceptually distinct.
        // ===========================================
        interactive: {
          DEFAULT: '#3B82F6', // azure
          hover: '#2563EB',
          subtle: '#1D4ED8',
        },

        // Legacy aliases — repointed to azure; migrated away by the sweep.
        'espn-blue': '#3B82F6',
        'dci-blue': '#3B82F6',
        primary: '#3B82F6',
        'primary-content': '#FFFFFF',

        // Panel color
        panel: '#1a1a1a',

        // SURFACE COLORS - Deep neutral backgrounds
        // Canonical neutral ramp (recessed → elevated). The sweep collapses the
        // scattered near-black hexes (#0f0f0f–#252525) onto these five steps.
        background: '#0A0A0A', // App background
        'surface-sunken': '#111111', // Recessed wells, inputs, tracks
        surface: {
          DEFAULT: '#0A0A0A', // App Background
          sunken: '#111111', // Recessed wells
          card: '#1A1A1A', // Card Background
          raised: '#222222', // Card headers/footers, hover, chips
          elevated: '#2A2A2A', // Popovers, menus, top layer
        },
        'surface-secondary': '#1A1A1A',
        'surface-tertiary': '#2A2A2A',
        'surface-card': '#1A1A1A',
        'surface-raised': '#222222',
        'surface-elevated': '#2A2A2A',

        // HAIRLINE BORDERS - one opaque line scale (collapses #222/#333/#444/#555)
        line: {
          subtle: '#242424', // Faint dividers
          muted: '#2A2A2A', // Between subtle and default
          DEFAULT: '#333333', // Standard card/structure hairline
          strong: '#444444', // Emphasis / hover borders
        },

        // TEXT COLORS - High contrast hierarchy
        text: {
          DEFAULT: '#FFFFFF', // Primary text
          primary: '#FFFFFF',
          secondary: '#B3B3B3', // Secondary text
          muted: '#999999', // Muted/disabled text (>=4.5:1 on #0A0A0A per WCAG AA)
        },
        main: '#FFFFFF',
        secondary: '#B3B3B3', // text-secondary (unambiguous single-word key)
        muted: '#999999',
        'text-main': '#FFFFFF',
        'text-secondary': '#B3B3B3',
        'text-muted': '#999999',
        'text-inverse': '#0A0A0A',

        // TREND COLORS - Data status indicators
        trend: {
          up: '#00C853', // Green - positive
          down: '#FF5252', // Red - negative
          neutral: '#9E9E9E', // Gray - no change
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
          950: '#0A0A0A',
        },
      },
      // SHADOWS BANNED - Law 4: No Glow, No Shadow
      boxShadow: {
        none: 'none',
      },
      borderWidth: {
        DEFAULT: '1px',
        2: '2px',
        3: '3px',
      },
      borderRadius: {
        none: '0',
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
        full: '9999px',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"Roboto Mono"', 'monospace'],
        sans: ['"Inter"', 'sans-serif'],
        display: ['Oswald', 'Barlow Condensed', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        data: ['JetBrains Mono', 'Fira Code', 'Roboto Mono', 'monospace'],
      },
      fontSize: {
        // XXS for dense data headers
        xxs: ['10px', '12px'],
        // Tabular-nums variants for data display
        'stat-xs': ['0.75rem', { fontVariantNumeric: 'tabular-nums' }],
        'stat-lg': ['1.25rem', { fontVariantNumeric: 'tabular-nums', fontWeight: '700' }],
      },
      letterSpacing: {
        tighter: '-0.05em',
        tight: '-0.025em',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.4s ease-out',
        // Continuous horizontal ticker scroll. Duration is set inline per
        // instance (scaled to content width) so speed stays consistent.
        marquee: 'marquee linear infinite',
        shimmer: 'shimmer 2s linear infinite',
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
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        // Track holds two identical copies of the ticker content side by side;
        // translating by -50% scrolls exactly one copy width, so the loop is
        // seamless.
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        slideInBottom: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideInTop: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-1000px 0' },
          '100%': { backgroundPosition: '1000px 0' },
        },
        pingSlow: {
          '0%': { transform: 'scale(1)', opacity: '0.5' },
          '75%, 100%': { transform: 'scale(1.5)', opacity: '0' },
        },
      },
      // GRADIENTS & BLUR BANNED - Law 4: No Glow, No Shadow
      backgroundImage: {},
      backdropBlur: {},
      // `screen` maps to dvh so h-screen/min-h-screen track the *visible*
      // viewport on mobile (iOS Safari's dynamic toolbar shrinks it below
      // 100vh; static vh lets bottom-anchored UI get clipped). Browsers
      // without dvh support fall back to the vh declaration listed first.
      height: {
        dvh: '100dvh',
        screen: ['100vh', '100dvh'],
      },
      minHeight: {
        dvh: '100dvh',
        screen: ['100vh', '100dvh'],
      },
      maxHeight: {
        dvh: '100dvh',
        screen: ['100vh', '100dvh'],
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
      // ===========================================
      // MOBILE-FIRST TOUCH UTILITIES
      // ===========================================
      spacing: {
        // Touch target minimum (44px)
        touch: '44px',
        'touch-lg': '48px',
        // Safe area insets
        'safe-top': 'env(safe-area-inset-top)',
        'safe-bottom': 'env(safe-area-inset-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)',
      },
      minWidth: {
        touch: '44px',
        'touch-lg': '48px',
      },
      minHeight: {
        touch: '44px',
        'touch-lg': '48px',
      },
      // Transitions for micro-interactions
      transitionDuration: {
        150: '150ms',
        200: '200ms',
        250: '250ms',
      },
      transitionTimingFunction: {
        touch: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)',
        'bounce-out': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      // Scale transforms for press feedback
      scale: {
        97: '0.97',
        98: '0.98',
        102: '1.02',
        103: '1.03',
      },
    },
  },
  plugins: [],
};
