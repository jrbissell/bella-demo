/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
      },
      colors: {
        warm: {
          50:  '#fdf3ec',
          100: '#faf9f6',
          200: '#ede8e0',
          300: '#b5a89e',
          400: '#7c6f67',
          500: '#e07a3a',
          600: '#c5602a',
          700: '#2d2420',
        },
        sage: {
          100: '#eaf5ee',
          500: '#5a9e72',
          600: '#4a8760',
        },
        honey: {
          100: '#fef9e7',
          500: '#d4a017',
          600: '#b8870f',
        },
      },
    },
  },
  plugins: [],
}
