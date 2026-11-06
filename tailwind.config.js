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
        brand: {
          void: '#0B0F19',
          dark: '#0F172A',
          card: '#131D31',
          cardHover: '#18243E',
          border: '#1E293B',
          borderGlow: '#334155',
          cyan: '#06B6D4',
          cyanGlow: '#22D3EE',
          lime: '#10B981',
          limeGlow: '#34D399',
          pink: '#F43F5E',
          purple: '#A855F7',
          amber: '#F59E0B'
        }
      },
      boxShadow: {
        'glow-cyan': '0 0 15px -3px rgba(6, 182, 212, 0.4)',
        'glow-lime': '0 0 15px -3px rgba(16, 185, 129, 0.4)',
        'glow-pink': '0 0 15px -3px rgba(244, 63, 94, 0.4)',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Consolas', 'Courier New', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
