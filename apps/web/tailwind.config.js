/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        background: 'var(--mw-color-background)',
        sidebar: 'var(--mw-color-sidebar)',
        surface: 'var(--mw-color-surface)',
        'surface-muted': 'var(--mw-color-surface-muted)',
        'surface-hover': 'var(--mw-color-surface-hover)',
        'nav-pill': 'var(--mw-color-nav-pill)',
        border: 'var(--mw-color-border)',
        'border-secondary': 'var(--mw-color-border-secondary)',
        tree: 'var(--mw-color-tree)',
        text: 'var(--mw-color-text)',
        'text-muted': 'var(--mw-color-text-muted)',
        'text-disabled': 'var(--mw-color-text-disabled)',
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
        pill: 'var(--mw-radius-pill)',
      },
      boxShadow: {
        sm: 'var(--mw-shadow-sm)',
        md: 'var(--mw-shadow-md)',
        pill: 'var(--mw-shadow-pill)',
      },
    },
  },
  plugins: [],
};
