/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Sansation', 'Inter', 'system-ui', 'sans-serif'],
        arabic: ['Alyamama', 'Cairo', 'sans-serif'],
      },
      /**
       * VaultShare design tokens — sourced from src/styles/theme.css
       * Use these in Tailwind classes: bg-vs-primary, text-vs-text, etc.
       * To change a color, edit src/styles/theme.css (not here).
       */
      colors: {
        vs: {
          primary: 'rgb(var(--vs-primary-rgb) / <alpha-value>)',
          'primary-hover': 'var(--vs-primary-hover)',
          'primary-light': 'var(--vs-primary-light)',
          secondary: 'rgb(var(--vs-secondary-rgb) / <alpha-value>)',

          bg: 'var(--vs-bg)',
          'bg-subtle': 'var(--vs-bg-subtle)',
          'bg-muted': 'var(--vs-bg-muted)',

          border: 'rgb(var(--vs-border-rgb) / <alpha-value>)',
          'border-strong': 'rgb(var(--vs-border-strong-rgb) / <alpha-value>)',

          text: 'var(--vs-text)',
          'text-muted': 'var(--vs-text-muted)',
          'text-subtle': 'var(--vs-text-subtle)',

          danger: 'rgb(var(--vs-danger-rgb) / <alpha-value>)',
          'danger-bg': 'var(--vs-danger-bg)',
          'danger-border': 'var(--vs-danger-border)',

          success: 'var(--vs-success)',
          'success-bg': 'var(--vs-success-bg)',

          warning: 'var(--vs-warning)',
          'warning-bg': 'var(--vs-warning-bg)',

          'header-bg': 'var(--vs-header-bg)',
          'header-border': 'rgb(var(--vs-header-border-rgb) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}
