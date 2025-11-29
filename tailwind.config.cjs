/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Classic Prestige Theme - Forest Green, Cream, Gold, Black
        forest: {
          800: '#113321', // Slightly lighter (hover states)
          900: '#0A2214', // Deepest background green
        },
        cream: {
          50: 'var(--cream-50)',
          100: '#F4F1E8', // Primary card background
          200: '#E0D8C0', // Secondary text / muted backgrounds
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
          400: '#EEDC82', // Light gold (borders, accents)
          500: '#D4AF37', // Primary polished gold (active states, buttons)
          DEFAULT: '#D4AF37',
          600: '#BFA132', // Darker gold (text, icons)
          700: '#FFC100',
          800: '#D9A300',
          900: '#4A3F10', // Deep gold shadow color
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
        },
        black: {
          DEFAULT: '#1A1A1A', // Primary text on cream
          stadium: '#0F0F0F', // Deep background gradient end
        },
        red: {
          alert: '#DC2626', // Urgent tasks, downward trends
        }
      },
      fontFamily: {
        'display': ['Montserrat', 'system-ui', 'sans-serif'],
        'body': ['Inter', 'system-ui', 'sans-serif'],
        'mono': ['Fira Code', 'monospace'],
        // Classic Prestige Typography
        'oswald': ['Oswald', 'system-ui', 'sans-serif'], // Headers / Impact
        'montserrat': ['Montserrat', 'system-ui', 'sans-serif'], // Body / Data
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-in': 'slideIn 0.4s ease-out',
        'pulse-gold': 'pulseGold 2s ease-in-out infinite', // Slow, subtle outer glow for urgent items
        'pulse-red-glow': 'pulseRedGlow 2s ease-in-out infinite', // Pulsing red glow for urgent tasks
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
          '0%, 100%': {
            boxShadow: '0 0 5px rgba(212, 175, 55, 0.3), 0 0 10px rgba(212, 175, 55, 0.2)'
          },
          '50%': {
            boxShadow: '0 0 15px rgba(212, 175, 55, 0.5), 0 0 25px rgba(212, 175, 55, 0.3)'
          }
        },
        pulseRedGlow: {
          '0%, 100%': {
            boxShadow: '0 0 10px rgba(220, 38, 38, 0.2)'
          },
          '50%': {
            boxShadow: '0 0 15px rgba(220, 38, 38, 0.3), 0 0 25px rgba(220, 38, 38, 0.15)'
          }
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
        // Classic Prestige Deep Gold Shadow (warm, heavy shadow for layered physical feel)
        'gold-deep': '0 10px 15px -3px rgba(74, 63, 16, 0.4), 0 4px 6px -2px rgba(74, 63, 16, 0.2)',
        'elevation-1': '0 2px 4px rgba(0,0,0,0.1)',
        'elevation-2': '0 4px 8px rgba(0,0,0,0.12)',
        'elevation-3': '0 8px 16px rgba(0,0,0,0.14)',
        'elevation-4': '0 16px 32px rgba(0,0,0,0.16)',
        'elevation-5': '0 24px 48px rgba(0,0,0,0.18)'
      },
      backdropBlur: {
        'xs': '2px'
      }
    },
  },
  plugins: [],
}
