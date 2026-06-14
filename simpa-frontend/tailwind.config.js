/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          blue:   '#2563eb',
          green:  '#10b981',
          amber:  '#f59e0b',
          purple: '#a855f7',
        },
        dark: {
          900: '#0f172a',
          800: '#111827',
          700: '#1e293b',
          600: '#334155',
          500: '#475569',
        },
      },
    },
  },
  plugins: [],
}
