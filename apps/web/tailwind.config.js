/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: 'var(--mw-color-background)',
        surface: 'var(--mw-color-surface)',
        'surface-muted': 'var(--mw-color-surface-muted)',
        border: 'var(--mw-color-border)',
        text: 'var(--mw-color-text)',
        'text-muted': 'var(--mw-color-text-muted)',
        accent: 'var(--mw-color-accent)',
        'accent-strong': 'var(--mw-color-accent-strong)',
        'accent-soft': 'var(--mw-color-accent-soft)',
        success: 'var(--mw-color-success)',
        warning: 'var(--mw-color-warning)',
        danger: 'var(--mw-color-danger)',
        info: 'var(--mw-color-info)',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        sm: 'var(--mw-radius-sm)',
        md: 'var(--mw-radius-md)',
        lg: 'var(--mw-radius-lg)',
      },
    },
  },
  plugins: [],
};
