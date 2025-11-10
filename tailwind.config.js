/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cream: {
          50: '#FDFBF5',
          100: '#FAF6EA',
          200: '#F5EDD5',
          300: '#F0E4C0',
          400: '#EADCAB',
          500: '#E5D396',
          DEFAULT: '#E5D396',
          600: '#D4BC72',
          700: '#C3A54E',
          800: '#9E8340',
          900: '#796232'
        },
        gold: {
          50: '#FFFDF5',
          100: '#FFF9E6',
          200: '#FFF0BF',
          300: '#FFE799',
          400: '#FFDD73',
          500: '#FFD44D',
          DEFAULT: '#FFD44D',
          600: '#FFCA26',
          700: '#FFC100',
          800: '#D9A300',
          900: '#B38600'
        },
        charcoal: {
          50: '#F5F5F5',
          100: '#E8E8E8',
          200: '#D1D1D1',
          300: '#B8B8B8',
          400: '#9F9F9F',
          500: '#868686',
          600: '#6D6D6D',
          700: '#545454',
          800: '#3B3B3B',
          900: '#1A1A1A',
          950: '#0D0D0D'
        }
      },
      fontFamily: {
        'display': ['Montserrat', 'system-ui', 'sans-serif'],
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
        'elevation-5': '0 24px 48px rgba(0,0,0,0.18)'
      },
      backdropBlur: {
        'xs': '2px'
      }
    },
  },
  plugins: [],
}
