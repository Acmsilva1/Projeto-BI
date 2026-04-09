/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--app-bg)',
          surface: 'var(--app-surface)',
          elevated: 'var(--app-elevated)',
          border: 'var(--app-border)',
          fg: 'var(--app-fg)',
          muted: 'var(--app-muted)',
        },
        pipeline: {
          panel: 'var(--dash-panel)',
          live: 'var(--dash-live)',
          critical: 'var(--dash-critical)',
          urgent: 'var(--dash-accent-urgent)',
        },
        hospital: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        emergency: {
          500: '#ef4444',
          600: '#dc2626',
        },
        /** Tabelas Gerência — ver `index.css` (--table-*) por tema */
        table: {
          grid: 'var(--table-grid)',
          'grid-strong': 'var(--table-grid-strong)',
          row: 'var(--table-row-sep)',
          thead: 'var(--table-thead-b)',
          total: 'var(--table-total-sep)',
          'header-fg': 'var(--table-header-fg)',
          'header-muted': 'var(--table-header-muted)',
          'zebra-odd': 'var(--table-zebra-odd)',
          'zebra-even': 'var(--table-zebra-even)',
          'row-hover': 'var(--table-row-hover)',
          'total-bg': 'var(--table-total-bg)',
          'footer-bg': 'var(--table-footer-bg)',
          'footer-b': 'var(--table-footer-b)',
          'head-metric': 'var(--table-head-metric-bg)',
          'cell-neutral': 'var(--table-cell-neutral)',
          nested: 'var(--table-nested-bg)',
        },
      },
      borderRadius: {
        xl: 'var(--radius)',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      },
      keyframes: {
        foguinho: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)', filter: 'brightness(1)' },
          '50%': { opacity: '0.9', transform: 'scale(1.2)', filter: 'brightness(1.25)' },
        },
        raio: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.85', transform: 'scale(1.25)' },
        },
        'glow-pulse': {
          '0%, 100%': { filter: 'brightness(1)' },
          '50%': { filter: 'brightness(1.15)' },
        },
      },
      animation: {
        foguinho: 'foguinho 1s ease-in-out infinite',
        raio: 'raio 0.9s ease-in-out infinite',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
