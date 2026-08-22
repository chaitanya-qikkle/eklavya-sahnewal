/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'nav-text': '#073566',
        midnight: '#050c19',
        'slate-glow': '#2f9bff',
      },
      backgroundImage: {
        'yard-photo': "linear-gradient(180deg, rgba(5,12,25,0.92), rgba(5,12,25,0.96)), url('/bg.jpg')",
      },
      fontFamily: {
        brand: ['"Segoe UI"', 'Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

