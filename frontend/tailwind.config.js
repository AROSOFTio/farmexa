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
