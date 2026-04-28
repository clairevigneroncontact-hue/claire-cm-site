/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,ts}'],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: '#F5EDE4',
          warm: '#EDE6DB',
          border: '#D6CCC0',
        },
        kaki: '#767A55',
        terracotta: {
          DEFAULT: '#8B3E22',
          dark: '#6B2E1A',
        },
        ink: '#2C2416',
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['Manrope', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
