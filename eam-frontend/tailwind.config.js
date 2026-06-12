/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'tmc-blue': '#30528A',
        'tmc-dark': '#1e293b',
        'tmc-light': '#f8fafc',
        'tmc-gold': '#A78759',
      },
      fontFamily: {
        sans: ['Inter', 'Poppins', 'sans-serif'],
      },
      // 🔥 TAMBAHIN INI BIAR ANIMASI LU JALAN 🔥
      keyframes: {
        slideUpFade: {
          '0%': { opacity: 0, transform: 'translateY(20px)' },
          '100%': { opacity: 1, transform: 'translateY(0)' },
        }
      }
    },
  },
  plugins: [],
}