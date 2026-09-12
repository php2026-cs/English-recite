/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#faf9df', 100: '#efedbb', 200: '#d8d49a', 300: '#b4ac49',
          500: '#ded700', 600: '#ffed29', 700: '#35352b', 800: '#272820'
        },
        slate: { 50: '#f3f3ef', 100: '#eaeae4', 200: '#d8d9d1', 300: '#b5b7ae', 400: '#7e8178', 500: '#64685f', 600: '#51554d', 700: '#3b4037', 800: '#292d27', 900: '#191d18' }
      },
      borderRadius: { lg: '3px', xl: '4px', '2xl': '4px', '3xl': '6px' },
      boxShadow: {
        soft: '0 2px 0 rgba(25,29,24,.08)'
      }
    }
  },
  plugins: []
};
