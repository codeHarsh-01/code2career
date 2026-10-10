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
        arena: {
          bg: '#0B0F19',
          card: '#111827',
          cardBorder: '#1F293D',
          accent: '#6366F1',
          accentGlow: '#818CF8',
          user: '#10B981',
          ai1: '#3B82F6',
          ai2: '#EC4899',
          ai3: '#F59E0B',
          ai4: '#8B5CF6',
          ai5: '#06B6D4',
        }
      },
      animation: {
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'soundwave-1': 'soundwave 1.2s ease-in-out infinite alternate',
        'soundwave-2': 'soundwave 0.8s ease-in-out infinite alternate 0.2s',
        'soundwave-3': 'soundwave 1.5s ease-in-out infinite alternate 0.4s',
        'soundwave-4': 'soundwave 0.9s ease-in-out infinite alternate 0.1s',
      },
      keyframes: {
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 15px rgba(99, 102, 241, 0.6), 0 0 30px rgba(99, 102, 241, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(99, 102, 241, 0.9), 0 0 60px rgba(99, 102, 241, 0.5)' },
        },
        soundwave: {
          '0%': { height: '6px' },
          '100%': { height: '28px' },
        }
      }
    },
  },
  plugins: [],
}
