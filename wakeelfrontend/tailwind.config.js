/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      /* أوزان أثقل: أصناف مثل font-medium تضبط font-weight صراحةً وتلغي body */
      fontWeight: {
        normal: '500',
        medium: '600',
        semibold: '700',
        bold: '800',
        extrabold: '900',
      },
      fontFamily: {
        sans: ['Cairo', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        cairo: ['Cairo', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#e6f2f9',
          100: '#cce5f3',
          200: '#99cbe7',
          300: '#66b1db',
          400: '#3397cf',
          500: '#0397D9',
          600: '#016AAA',
          700: '#015a91',
          800: '#014978',
          900: '#01385e',
        },
        secondary: {
          50: '#e6f6fc',
          100: '#ccecf9',
          200: '#99d9f3',
          300: '#66c6ed',
          400: '#33b3e7',
          500: '#0397D9',
          600: '#0280b8',
          700: '#026997',
          800: '#015276',
          900: '#013b55',
        },
      },
    },
  },
  plugins: [],
}