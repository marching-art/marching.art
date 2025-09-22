// tailwind.config.js - Complete Tailwind Configuration for Ultimate Fantasy Drum Corps Game
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      // Enhanced Color System
      colors: {
        // Primary brand colors
        primary: {
          50: '#fef7ee',
          100: '#fdecd3',
          200: '#fbd4a5',
          300: '#f8b76d',
          400: '#f49232',
          500: '#f1750a',
          600: '#e25d00',
          700: '#bb4602',
          800: '#953708',
          900: '#7a2e0a',
          DEFAULT: '#f1750a',
          dark: '#f49232'
        },
        secondary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          DEFAULT: '#0ea5e9',
          dark: '#38bdf8'
        },
        
        // Semantic colors
        success: {
          50: '#f0fdf4',
          100: '#dcfce7',
          200: '#bbf7d0',
          300: '#86efac',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d',
          DEFAULT: '#22c55e'
        },
        warning: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          DEFAULT: '#f59e0b'
        },
        error: {
          50: '#fef2f2',
          100: '#fee2e2',
          200: '#fecaca',
          300: '#fca5a5',
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
          700: '#b91c1c',
          800: '#991b1b',
          900: '#7f1d1d',
          DEFAULT: '#ef4444'
        },
        info: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
          DEFAULT: '#0ea5e9'
        },

        // Enhanced theme colors
        background: {
          DEFAULT: '#ffffff',
          dark: '#0f172a'
        },
        surface: {
          DEFAULT: '#f8fafc',
          dark: '#1e293b'
        },
        accent: {
          DEFAULT: '#e2e8f0',
          dark: '#334155'
        },

        // Text colors
        'text-primary': {
          DEFAULT: '#1e293b',
          dark: '#f1f5f9'
        },
        'text-secondary': {
          DEFAULT: '#64748b',
          dark: '#94a3b8'
        },
        'text-tertiary': {
          DEFAULT: '#94a3b8',
          dark: '#64748b'
        },

        // Interactive colors
        'on-primary': '#ffffff',
        'on-secondary': '#ffffff',
        'on-surface': '#1e293b',
        'on-background': '#1e293b',

        // Corps class colors
        'world-class': '#fbbf24',
        'open-class': '#3b82f6',
        'a-class': '#10b981',

        // Special gradients
        'gradient-start': '#f1750a',
        'gradient-end': '#0ea5e9'
      },

      // Enhanced Typography
      fontFamily: {
        sans: [
          'Inter', 
          '-apple-system', 
          'BlinkMacSystemFont', 
          'Segoe UI', 
          'Roboto', 
          'sans-serif'
        ],
        display: [
          'Inter', 
          'system-ui', 
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono', 
          'Fira Code', 
          'Monaco', 
          'Consolas', 
          'monospace'
        ]
      },

      fontSize: {
        'xs': ['0.75rem', { lineHeight: '1rem' }],
        'sm': ['0.875rem', { lineHeight: '1.25rem' }],
        'base': ['1rem', { lineHeight: '1.5rem' }],
        'lg': ['1.125rem', { lineHeight: '1.75rem' }],
        'xl': ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }]
      },

      // Enhanced Spacing
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem'
      },

      // Enhanced Border Radius
      borderRadius: {
        'none': '0',
        'sm': '0.125rem',
        'DEFAULT': '0.375rem',
        'md': '0.5rem',
        'lg': '0.75rem',
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
        'theme': '1rem', // Custom theme radius
        'full': '9999px'
      },

      // Enhanced Shadows
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        'inner': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        'none': 'none',
        'theme': '0 4px 20px rgba(0, 0, 0, 0.1)', // Custom theme shadow
        'glow': '0 0 20px rgba(241, 117, 10, 0.3)', // Primary glow
        'glow-secondary': '0 0 20px rgba(14, 165, 233, 0.3)' // Secondary glow
      },

      // Enhanced Gradients
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #f1750a 0%, #f49232 100%)',
        'gradient-secondary': 'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
        'gradient-success': 'linear-gradient(135deg, #22c55e 0%, #4ade80 100%)',
        'gradient-hero': 'linear-gradient(135deg, #f1750a 0%, #0ea5e9 50%, #f1750a 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)'
      },

      // Enhanced Animations
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'fade-out': 'fadeOut 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-left': 'slideLeft 0.3s ease-out',
        'slide-right': 'slideRight 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'scale-out': 'scaleOut 0.2s ease-out',
        'bounce-subtle': 'bounceSubtle 2s infinite',
        'pulse-glow': 'pulseGlow 2s infinite',
        'float': 'float 3s ease-in-out infinite',
        'wiggle': 'wiggle 1s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'gradient-x': 'gradient-x 3s ease infinite',
        'gradient-y': 'gradient-y 3s ease infinite',
        'rotate-slow': 'rotate 8s linear infinite',
        'ping-slow': 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite'
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' }
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideLeft: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        slideRight: {
          '0%': { transform: 'translateX(-20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        },
        scaleOut: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(0.95)', opacity: '0' }
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' }
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgba(241, 117, 10, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(241, 117, 10, 0.6)' }
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' }
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' }
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' }
        },
        'gradient-x': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'left center'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'right center'
          }
        },
        'gradient-y': {
          '0%, 100%': {
            'background-size': '200% 200%',
            'background-position': 'center top'
          },
          '50%': {
            'background-size': '200% 200%',
            'background-position': 'center bottom'
          }
        }
      },

      // Enhanced Transitions
      transitionDuration: {
        '0': '0ms',
        '75': '75ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '300': '300ms',
        '500': '500ms',
        '700': '700ms',
        '1000': '1000ms',
        '2000': '2000ms'
      },

      // Enhanced Z-index
      zIndex: {
        '0': '0',
        '10': '10',
        '20': '20',
        '30': '30',
        '40': '40',
        '50': '50',
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
        'auto': 'auto',
        'tooltip': '1000',
        'modal': '2000',
        'notification': '3000'
      },

      // Enhanced Backdrop Filters
      backdropBlur: {
        'none': 'none',
        'sm': '4px',
        'DEFAULT': '8px',
        'md': '12px',
        'lg': '16px',
        'xl': '24px',
        '2xl': '40px',
        '3xl': '64px'
      },

      // Custom CSS Variables
      screens: {
        'xs': '475px',
        'sm': '640px',
        'md': '768px',
        'lg': '1024px',
        'xl': '1280px',
        '2xl': '1536px',
        '3xl': '1920px'
      },

      // Enhanced Grid
      gridTemplateColumns: {
        '13': 'repeat(13, minmax(0, 1fr))',
        '14': 'repeat(14, minmax(0, 1fr))',
        '15': 'repeat(15, minmax(0, 1fr))',
        '16': 'repeat(16, minmax(0, 1fr))'
      },

      // Enhanced Aspect Ratios
      aspectRatio: {
        'auto': 'auto',
        'square': '1 / 1',
        'video': '16 / 9',
        'portrait': '3 / 4',
        'landscape': '4 / 3',
        'ultrawide': '21 / 9'
      }
    }
  },
  plugins: [
    require('@tailwindcss/forms')({
      strategy: 'class'
    }),
    require('@tailwindcss/typography'),
    require('@tailwindcss/aspect-ratio'),
    require('@tailwindcss/container-queries'),
    
    // Custom plugin for theme utilities
    function({ addUtilities, addComponents, theme }) {
      // Custom utilities
      addUtilities({
        '.text-gradient': {
          'background': 'linear-gradient(135deg, #f1750a 0%, #0ea5e9 100%)',
          '-webkit-background-clip': 'text',
          '-webkit-text-fill-color': 'transparent',
          'background-clip': 'text'
        },
        '.bg-glass': {
          'background': 'rgba(255, 255, 255, 0.1)',
          'backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(255, 255, 255, 0.2)'
        },
        '.bg-glass-dark': {
          'background': 'rgba(0, 0, 0, 0.1)',
          'backdrop-filter': 'blur(10px)',
          'border': '1px solid rgba(255, 255, 255, 0.1)'
        },
        '.scrollbar-hide': {
          '-ms-overflow-style': 'none',
          'scrollbar-width': 'none',
          '&::-webkit-scrollbar': {
            display: 'none'
          }
        },
        '.scrollbar-thin': {
          'scrollbar-width': 'thin',
          '&::-webkit-scrollbar': {
            width: '6px',
            height: '6px'
          },
          '&::-webkit-scrollbar-track': {
            background: theme('colors.gray.100')
          },
          '&::-webkit-scrollbar-thumb': {
            background: theme('colors.gray.400'),
            'border-radius': '3px'
          }
        }
      });

      // Custom components
      addComponents({
        '.btn': {
          'padding': '0.5rem 1rem',
          'border-radius': theme('borderRadius.theme'),
          'font-weight': '600',
          'transition': 'all 0.2s ease-in-out',
          'cursor': 'pointer',
          'display': 'inline-flex',
          'align-items': 'center',
          'justify-content': 'center',
          'gap': '0.5rem',
          '&:disabled': {
            'opacity': '0.5',
            'cursor': 'not-allowed'
          }
        },
        '.btn-primary': {
          'background': theme('colors.primary.DEFAULT'),
          'color': theme('colors.on-primary'),
          '&:hover:not(:disabled)': {
            'background': theme('colors.primary.600'),
            'transform': 'translateY(-1px)',
            'box-shadow': theme('boxShadow.glow')
          }
        },
        '.btn-secondary': {
          'background': theme('colors.secondary.DEFAULT'),
          'color': theme('colors.on-secondary'),
          '&:hover:not(:disabled)': {
            'background': theme('colors.secondary.600'),
            'transform': 'translateY(-1px)',
            'box-shadow': theme('boxShadow.glow-secondary')
          }
        },
        '.btn-outline': {
          'background': 'transparent',
          'border': `2px solid ${theme('colors.primary.DEFAULT')}`,
          'color': theme('colors.primary.DEFAULT'),
          '&:hover:not(:disabled)': {
            'background': theme('colors.primary.DEFAULT'),
            'color': theme('colors.on-primary')
          }
        },
        '.card': {
          'background': theme('colors.surface.DEFAULT'),
          'border-radius': theme('borderRadius.theme'),
          'border': `1px solid ${theme('colors.accent.DEFAULT')}`,
          'box-shadow': theme('boxShadow.theme'),
          'padding': '1.5rem'
        },
        '.card-dark': {
          'background': theme('colors.surface.dark'),
          'border': `1px solid ${theme('colors.accent.dark')}`,
          'color': theme('colors.text-primary.dark')
        },
        '.input': {
          'width': '100%',
          'padding': '0.75rem',
          'border': `1px solid ${theme('colors.accent.DEFAULT')}`,
          'border-radius': theme('borderRadius.theme'),
          'background': theme('colors.background.DEFAULT'),
          'color': theme('colors.text-primary.DEFAULT'),
          'transition': 'all 0.2s ease-in-out',
          '&:focus': {
            'outline': 'none',
            'border-color': theme('colors.primary.DEFAULT'),
            'ring': `2px ${theme('colors.primary.DEFAULT')}`,
            'ring-opacity': '0.2'
          }
        },
        '.loading-skeleton': {
          'background': 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
          'background-size': '200% 100%',
          'animation': 'shimmer 2s infinite'
        }
      });
    }
  ]
};