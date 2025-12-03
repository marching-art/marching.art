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
        // Theme-aware colors using CSS variables
        cream: {
          50: 'var(--cream-50)',
          100: 'var(--cream-100)',
          200: 'var(--cream-200)',
          300: 'var(--cream-300)',
          400: 'var(--cream-400)',
          500: 'var(--cream-500)',
          DEFAULT: 'var(--cream-500)',
          600: 'var(--cream-600)',
          700: 'var(--cream-700)',
          800: 'var(--cream-800)',
          900: 'var(--cream-900)'
        },
        gold: {
          50: '#FFFDF5',
          100: '#FFF9E6',
          200: '#FFF0BF',
          300: '#FFE799',
          400: 'var(--gold-400)',
          500: 'var(--gold-500)',
          DEFAULT: 'var(--gold-500)',
          600: '#FFCA26',
          700: '#FFC100',
          800: '#D9A300',
          900: '#B38600'
        },
        charcoal: {
          50: 'var(--charcoal-50)',
          100: 'var(--charcoal-100)',
          200: 'var(--charcoal-200)',
          300: 'var(--charcoal-300)',
          400: 'var(--charcoal-400)',
          500: 'var(--charcoal-500)',
          600: 'var(--charcoal-600)',
          700: 'var(--charcoal-700)',
          800: 'var(--charcoal-800)',
          900: 'var(--charcoal-900)',
          950: 'var(--charcoal-950)'
        }
      },
      fontFamily: {
        'display': ['Oswald', 'Barlow Condensed', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['Fira Code', 'monospace']
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
        'bounce-slow': 'bounce 2s infinite'
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
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'gradient-gold': 'linear-gradient(135deg, #FFD44D 0%, #FFCA26 50%, #D9A300 100%)',
        'gradient-cream': 'linear-gradient(135deg, #FAF6EA 0%, #E5D396 50%, #C3A54E 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1A1A1A 0%, #3B3B3B 50%, #545454 100%)',
        'shimmer-gradient': 'linear-gradient(to right, transparent 0%, rgba(255, 212, 77, 0.2) 50%, transparent 100%)'
      },
      boxShadow: {
        'glow': '0 0 20px rgba(255, 212, 77, 0.5)',
        'glow-lg': '0 0 40px rgba(255, 212, 77, 0.6)',
        'inner-glow': 'inset 0 0 20px rgba(255, 212, 77, 0.2)',
        'elevation-1': '0 2px 4px rgba(0,0,0,0.1)',
        'elevation-2': '0 4px 8px rgba(0,0,0,0.12)',
        'elevation-3': '0 8px 16px rgba(0,0,0,0.14)',
        'elevation-4': '0 16px 32px rgba(0,0,0,0.16)',
        'elevation-5': '0 24px 48px rgba(0,0,0,0.18)',
        // Brutalist shadows
        'brutal': '4px 4px 0px 0px rgba(0,0,0,1)',
        'brutal-lg': '6px 6px 0px 0px rgba(0,0,0,1)',
        'brutal-xl': '8px 8px 0px 0px rgba(0,0,0,1)',
        'brutal-gold': '4px 4px 0px 0px rgba(255,212,77,1)',
        'brutal-gold-lg': '6px 6px 0px 0px rgba(255,212,77,1)'
      },
      backdropBlur: {
        'xs': '2px'
      }
    },
  },
  plugins: [],
}
