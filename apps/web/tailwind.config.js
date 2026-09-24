/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: {
          base: 'var(--bg-base)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
        },
        accent: {
          primary: 'var(--accent-primary)',
          hover: 'var(--accent-primary-hover)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
        },
        border: {
          subtle: 'var(--border-subtle)',
        },
        status: {
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          error: 'var(--status-error)',
          pending: 'var(--status-pending)',
        },
        ad: {
          bg: 'var(--ad-neutral-bg)',
          border: 'var(--ad-neutral-border)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'h1': ['32px', { lineHeight: '40px', fontWeight: '600' }],
        'h2': ['20px', { lineHeight: '28px', fontWeight: '600' }],
        'body': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'helper': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'code-lg': ['56px', { lineHeight: '1', fontWeight: '700', letterSpacing: '+4px' }],
        'pill': ['12px', { lineHeight: '16px', fontWeight: '500' }],
      },
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '40px',
      },
      borderRadius: {
        'card': '12px',
        'button': '8px',
        'pill': '999px',
      },
      maxWidth: {
        'content': '960px',
      },
      screens: {
        'sm': '640px',
      },
    },
  },
  plugins: [],
};
