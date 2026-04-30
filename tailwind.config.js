/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        kami: {
          bg: '#0a0a0f',
          surface: '#12121a',
          border: '#1e1e2e',
          accent: '#7c3aed',
          accentHover: '#6d28d9',
          text: '#e2e8f0',
          muted: '#64748b',
          user: '#1e1b4b',
          assistant: '#171720',
          success: '#10b981',
          warning: '#f59e0b',
          danger: '#ef4444',

          // Bento landing palette (Sprint 5 / Day 18). The chat shell
          // still uses kami.bg/surface/accent above; restyling that is
          // a follow-up spec.
          sepiaBg: '#1a1410',
          cellBase: '#221a14',
          cellElevated: '#2a2117',
          cellBorder: 'rgba(245, 230, 211, 0.12)',
          cream: '#F5E6D3',
          creamMuted: 'rgba(245, 230, 211, 0.6)',
          amber: '#FFA500',
          amberGlow: 'rgba(255, 165, 0, 0.15)',
          amberHaze: 'rgba(255, 165, 0, 0.05)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
        display: ['Unbounded', 'sans-serif'],
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        smooth: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'cascade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        blink: {
          '0%, 50%': { opacity: '1' },
          '50.01%, 100%': { opacity: '0' },
        },
        'pulse-dot': {
          '0%': { boxShadow: '0 0 0 0 rgba(255, 165, 0, 0.4)' },
          '100%': { boxShadow: '0 0 0 8px rgba(255, 165, 0, 0)' },
        },
      },
      animation: {
        'cascade-up': 'cascade-up 800ms cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards',
        'cascade-up-compact': 'cascade-up 600ms cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards',
        'cascade-up-mini': 'cascade-up 400ms cubic-bezier(0.175, 0.885, 0.32, 1.275) backwards',
        blink: 'blink 1s step-end infinite',
        'pulse-dot': 'pulse-dot 2s ease-out infinite',
      },
    },
  },
  plugins: [],
}
