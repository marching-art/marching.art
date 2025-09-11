/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // This is the line that enables dark mode
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        'brand-primary': {
          DEFAULT: '#1E3A8A', // A strong, deep blue
          dark: '#3B82F6',   // A brighter blue for dark mode contrast
        },
        'brand-secondary': {
          DEFAULT: '#FBBF24', // A rich, vibrant gold
          dark: '#FCD34D',   // A slightly lighter gold for dark mode
        },
        'brand-accent': {
          DEFAULT: '#9CA3AF', // A neutral gray for borders and secondary text
          dark: '#6B7280',   // A darker gray for dark mode
        },
        'brand-background': {
          DEFAULT: '#FFFFFF',
          dark: '#111827', // A very dark gray, almost black
        },
        'brand-surface': {
          DEFAULT: '#F9FAFB', // A very light gray for cards/sections
          dark: '#1F2937',   // A dark gray for cards in dark mode
        },
        'brand-text': {
          primary: '#1F2937',
          'primary-dark': '#F9FAFB',
          secondary: '#4B5563',
          'secondary-dark': '#D1D5DB',
        },
      },
    },
  },
  plugins: [],
}