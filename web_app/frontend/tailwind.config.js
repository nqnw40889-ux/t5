/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        industrial: {
          950: '#070a10',
          900: '#0b0f19',
          850: '#101623',
          800: '#161e31',
          700: '#23304c',
          600: '#33446b',
        },
        brand: {
          emerald: '#10b981',
          teal: '#14b8a6',
          amber: '#f59e0b',
          crimson: '#ef4444',
          cyan: '#06b6d4',
          blue: '#3b82f6',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Fira Code', 'monospace']
      }
    },
  },
  plugins: [],
}
