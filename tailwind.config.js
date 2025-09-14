/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class", // This is the line that enables dark mode
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      // Add this font family section
      fontFamily: {
        sans: ['"Inter"', 'sans-serif'], // A strong, clean sans-serif for headings
        mono: ['"Roboto Mono"', 'monospace'], // A clear monospace for all data/stats
      },
      colors: {
        // A single, vibrant accent. Let's use an electric green.
        'brand-accent': {
          DEFAULT: '#00FF7F', // Spring Green
          dark: '#39FF14',   // Neon Green
        },
        // Backgrounds are just black and white. No soft grays.
        'brand-background': {
          DEFAULT: '#FFFFFF', // White
          dark: '#0A0A0A',    // Near Black
        },
        // Surfaces are either the background color or a very subtle off-white/gray for hierarchy.
        'brand-surface': {
          DEFAULT: '#F5F5F5', 
          dark: '#141414',
        },
        // Text is simple and high-contrast.
        'brand-text': {
          primary: '#0A0A0A',
          'primary-dark': '#EAEAEA',
          secondary: '#555555',
          'secondary-dark': '#999999',
        },
      },
      // Optional: Add a hard-edged shadow for a retro effect
      boxShadow: {
        'hard': '4px 4px 0px #0A0A0A',
        'hard-dark': '4px 4px 0px #EAEAEA',
      }
    },
  },
  plugins: [],
}