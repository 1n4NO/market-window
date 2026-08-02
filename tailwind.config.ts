import type { Config } from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: ['./index.html', './newtab.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#05080f',
        surface: '#0b1220',
        surface2: '#111a2d',
        line: 'rgba(255,255,255,0.08)',
        text: '#e8edf7',
        muted: '#8e97a8',
        accent: '#4ea3ff',
        accent2: '#8b5cf6',
        success: '#42d07a',
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(255,255,255,0.06), 0 24px 60px rgba(0,0,0,0.35)',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Trebuchet MS', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
