/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      keyframes: {
        'fade-in': {
            '0%': { opacity: '0', transform: 'translateY(-10px)' },
            '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-down': {
          '0%': {
              opacity: '0',
              transform: 'translateY(-20px)'
          },
          '100%': {
              opacity: '1',
              transform: 'translateY(0)'
          },
      }
      },
      animation: {
          'fade-in': 'fade-in 0.5s ease-out',
          'fade-in-down': 'fade-in-down 0.5s ease-out forwards'
      }
    },
  },
  plugins: [],
}