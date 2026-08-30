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
        ios: {
          blue: '#007AFF',
          purple: '#5856D6',
          green: '#34C759',
          orange: '#FF9500',
          red: '#FF3B30',
          teal: '#5AC8FA',
          pink: '#FF2D55',
          indigo: '#AF52DE',
          yellow: '#FFCC00',
          gray: {
            50: '#F9FAFB',
            100: '#F2F2F7',
            200: '#E5E5EA',
            300: '#D1D1D6',
            400: '#C7C7CC',
            500: '#8E8E93',
            600: '#636366',
            700: '#48484A',
            800: '#2C2C2E',
            900: '#1C1C1E',
            950: '#000000',
          }
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'system-ui',
          'sans-serif'
        ],
      },
      boxShadow: {
        'ios': '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.03)',
        'ios-hover': '0 10px 25px -3px rgba(0, 0, 0, 0.08), 0 4px 10px -2px rgba(0, 0, 0, 0.04)',
        'ios-modal': '0 20px 40px -4px rgba(0, 0, 0, 0.15)',
      }
    },
  },
  plugins: [],
}
