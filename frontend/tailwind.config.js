/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Manrope', '"Segoe UI"', 'system-ui', 'sans-serif'],
        display: ['Inter', 'Manrope', '"Segoe UI"', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        background: 'var(--background)',
        card: 'var(--card)',
        sidebar: 'var(--sidebar)',
        primary: {
          DEFAULT: 'var(--primary)',
          foreground: 'var(--primary-foreground)',
        },
        brand: {
          50: '#EFF6FF',
          100: '#DBEAFE',
          200: '#BFDBFE',
          300: '#93C5FD',
          400: '#60A5FA',
          500: '#3B82F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        border: 'var(--border-color)',
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        info: 'var(--info)',
      },
      spacing: {
        sidebar: '280px',
        topbar: '72px',
      },
      borderRadius: {
        card: '12px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.08), 0 4px 12px rgba(15, 23, 42, 0.04)',
        'card-hover': '0 4px 10px rgba(31, 41, 55, 0.08), 0 14px 28px rgba(31, 41, 55, 0.08)',
      },
    },
  },
  plugins: [],
}
