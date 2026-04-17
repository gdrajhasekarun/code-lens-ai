import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-base': '#0d1117',
        'bg-surface': '#161b22',
        'bg-overlay': '#21262d',
        'border-subtle': '#21262d',
        'border-default': '#30363d',
        'text-primary': '#e6edf3',
        'text-secondary': '#8b949e',
        'text-muted': '#484f58',
        accent: '#BA7517',
      },
      fontFamily: {
        mono: ["'Cascadia Code'", "'Fira Code'", "'Courier New'", 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
