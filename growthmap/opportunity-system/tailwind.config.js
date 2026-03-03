/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#eef1f5',
          100: '#dfe2e8',
          200: '#c8cdd8',
          300: '#a0a8b8',
          400: '#7c8598',
          500: '#5a6478',
          600: '#3d4a5c',
          700: '#2d3748',
          800: '#1b2536',
          900: '#0f1926',
        },
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
