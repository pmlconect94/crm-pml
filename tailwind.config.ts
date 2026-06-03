import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          900: '#0A2540',
          800: '#0F2F52',
          700: '#143C66',
          600: '#1C4A7A',
          500: '#2A5E94',
        },
        blue: {
          50:  '#F3F9FF',
          100: '#E6F4FF',
          300: '#5CADFF',
          400: '#1E8BFF',
          500: '#0073E6',
        },
        cyan: {
          500: '#00A3FF',
        },
        ink: {
          50:  '#F8FAFC',
          100: '#F1F5F9',
          200: '#E2E8EF',
          300: '#C4CDD8',
          400: '#94A3B5',
          500: '#6B7A8F',
          600: '#4D5B71',
          700: '#334156',
          800: '#1A2A3F',
          900: '#0B1A2B',
        },
        green: {
          100: '#D1FAE5',
          500: '#10B981',
        },
        amber: {
          100: '#FEF3C7',
          500: '#F59E0B',
        },
        red: {
          100: '#FEE2E2',
          500: '#EF4444',
        },
        violet: {
          100: '#EDE9FE',
          500: '#8B5CF6',
        },
        camanchaca: '#0EA5A1',
      },
      fontFamily: {
        sans: ['Geist', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '20px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(10, 37, 64, 0.06), 0 1px 1px rgba(10, 37, 64, 0.04)',
        md: '0 4px 12px rgba(10, 37, 64, 0.08), 0 2px 4px rgba(10, 37, 64, 0.05)',
        lg: '0 12px 32px rgba(10, 37, 64, 0.12), 0 4px 8px rgba(10, 37, 64, 0.06)',
        xl: '0 24px 48px rgba(10, 37, 64, 0.18)',
      },
    },
  },
  plugins: [],
} satisfies Config;
