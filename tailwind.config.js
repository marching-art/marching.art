/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class', // Enable dark mode with a class
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand color - now gold
        primary: {
          DEFAULT: 'rgb(var(--color-primary) / <alpha-value>)',
          dark: 'rgb(var(--color-primary-dark) / <alpha-value>)',
        },
        // Secondary brand color - now a medium brown/tan
        secondary: {
          DEFAULT: 'rgb(var(--color-secondary) / <alpha-value>)',
          dark: 'rgb(var(--color-secondary-dark) / <alpha-value>)',
        },
        // Accent color for borders, minor elements - now a lighter, warm grey/tan
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          dark: 'rgb(var(--color-accent-dark) / <alpha-value>)',
        },
        // Background color - light for light mode, very dark brown for dark mode
        background: {
          DEFAULT: 'rgb(var(--color-background) / <alpha-value>)',
          dark: 'rgb(var(--color-background-dark) / <alpha-value>)',
        },
        // Surface color for cards, modals - slightly darker than background in light mode, dark brown in dark mode
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
        // On-color for text/icons placed on primary/secondary buttons/elements
        'on-primary': 'rgb(var(--on-primary) / <alpha-value>)', // Typically white or very light
        'on-secondary': 'rgb(var(--on-secondary) / <alpha-value>)', // Typically white or very light
      },
      borderRadius: {
        'theme': '0.75rem', // A slightly larger border radius for a softer look
      },
      boxShadow: {
        'theme': '0 4px 10px rgba(0, 0, 0, 0.05)', // A subtle shadow for depth
        'theme-dark': '0 4px 10px rgba(0, 0, 0, 0.4)', // Darker shadow for dark mode
      },
      borderWidth: {
        'theme': '1px', // Standard border width for elements
      }
    },
  },
  plugins: [],
  purge: {
    enabled: process.env.NODE_ENV === 'production',
    content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  },
}