/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Primary brand colors
        primary: {
          DEFAULT: '#FF6B35', // Vibrant orange
          dark: '#E85A2B',
          light: '#FF8A5C'
        },
        
        // Background colors
        background: {
          DEFAULT: '#FFFFFF',
          dark: '#0F0F23'
        },
        
        // Surface colors (cards, panels)
        surface: {
          DEFAULT: '#F8F9FA',
          dark: '#1A1A2E'
        },
        
        // Text colors
        text: {
          primary: {
            DEFAULT: '#1A1A1A',
            dark: '#FFFFFF'
          },
          secondary: {
            DEFAULT: '#6B7280',
            dark: '#9CA3AF'
          }
        },
        
        // Accent colors
        accent: {
          DEFAULT: '#E5E7EB',
          dark: '#374151'
        },
        
        // On-primary text color
        'on-primary': '#FFFFFF',
        
        // Class-specific colors
        'class-world': '#8B5CF6', // Purple
        'class-open': '#3B82F6',  // Blue
        'class-a': '#10B981',     // Green
        'class-soundsport': '#F59E0B', // Orange
        
        // Status colors
        success: '#10B981',
        warning: '#F59E0B',
        error: '#EF4444',
        info: '#3B82F6'
      },
      
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif']
      },
      
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem'
      },
      
      borderRadius: {
        'theme': '0.75rem'
      },
      
      boxShadow: {
        'theme': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        'theme-dark': '0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)',
        'glow': '0 0 20px rgba(255, 107, 53, 0.3)'
      },
      
      textShadow: {
        'sm': '0 1px 2px rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 2px 4px rgba(0, 0, 0, 0.10)',
        'lg': '0 8px 16px rgba(0, 0, 0, 0.15)'
      },
      
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'bounce-subtle': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out'
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      },
      
      transitionProperty: {
        'height': 'height',
        'spacing': 'margin, padding'
      }
    }
  },
  plugins: [
    function({ addUtilities }) {
      const newUtilities = {
        '.text-shadow': {
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.10)'
        },
        '.text-shadow-lg': {
          textShadow: '0 8px 16px rgba(0, 0, 0, 0.15)'
        },
        '.line-clamp-2': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '2'
        },
        '.line-clamp-3': {
          overflow: 'hidden',
          display: '-webkit-box',
          '-webkit-box-orient': 'vertical',
          '-webkit-line-clamp': '3'
        },
        '.gradient-primary': {
          background: 'linear-gradient(135deg, #FF6B35 0%, #E85A2B 100%)'
        },
        '.gradient-surface': {
          background: 'linear-gradient(135deg, #1A1A2E 0%, #16213E 100%)'
        }
      };
      addUtilities(newUtilities);
    }
  ]
};