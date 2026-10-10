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
        sans: ['IBM Plex Sans Arabic', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        arabic: ['IBM Plex Sans Arabic', 'sans-serif'],
        cairo: ['IBM Plex Sans Arabic', 'sans-serif'], /* توافق خلفي */
      },
      colors: {
        /* أزرق العلامة #2763eb */
        primary: {
          50: '#eef3fe',
          100: '#d9e4fd',
          200: '#b3c9fb',
          300: '#8daef8',
          400: '#6693f4',
          500: '#4078f0',
          600: '#2763eb',
          700: '#1e4fbc',
          800: '#163c8d',
          900: '#0f285e',
        },
        /* أخضر/تركواز العلامة #66d9b3 */
        secondary: {
          50: '#f0faf6',
          100: '#d9f5ea',
          200: '#b3ebd5',
          300: '#8ce1c0',
          400: '#76ddb9',
          500: '#66d9b3',
          600: '#4fc49d',
          700: '#3a9a7a',
          800: '#2a7058',
          900: '#1a4637',
        },
      },
    },
  },
  plugins: [],
}
