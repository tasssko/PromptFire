/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        ui: ['HelveticaNowText', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
        mono: [
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'Liberation Mono',
          'Courier New',
          'monospace',
        ],
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      colors: {
        pf: {
          bg: {
            page: 'var(--bg-page)',
            card: 'var(--bg-card)',
            cardSubtle: 'var(--bg-card-subtle)',
            cardElevated: 'var(--bg-card-elevated)',
          },
          text: {
            primary: 'var(--text-primary)',
            secondary: 'var(--text-secondary)',
            muted: 'var(--text-muted)',
            inverse: 'var(--text-inverse)',
          },
          border: {
            subtle: 'var(--border-subtle)',
            default: 'var(--border-default)',
            strong: 'var(--border-strong)',
            focus: 'var(--border-focus)',
          },
          action: {
            primary: {
              bg: 'var(--action-primary-bg)',
              text: 'var(--action-primary-text)',
              bgHover: 'var(--action-primary-bg-hover)',
            },
            secondary: {
              bg: 'var(--action-secondary-bg)',
              text: 'var(--action-secondary-text)',
              bgHover: 'var(--action-secondary-bg-hover)',
            },
          },
          feedback: {
            high: {
              bg: 'var(--feedback-high-bg)',
              text: 'var(--feedback-high-text)',
            },
            medium: {
              bg: 'var(--feedback-medium-bg)',
              text: 'var(--feedback-medium-text)',
            },
            low: {
              bg: 'var(--feedback-low-bg)',
              text: 'var(--feedback-low-text)',
            },
          },
          surface: {
            default: {
              bg: 'var(--surface-default-bg)',
              border: 'var(--surface-default-border)',
            },
            suggestion: {
              bg: 'var(--surface-suggestion-bg)',
              border: 'var(--surface-suggestion-border)',
            },
            rewrite: {
              bg: 'var(--surface-rewrite-bg)',
              border: 'var(--surface-rewrite-border)',
            },
            verdict: {
              bg: 'var(--surface-verdict-bg)',
              border: 'var(--surface-verdict-border)',
            },
          },
          loading: {
            soft: 'var(--loading-soft)',
            strong: 'var(--loading-strong)',
          },
          status: {
            danger: {
              text: 'var(--status-danger-text)',
            },
          },
        },
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
      },
      backgroundImage: {
        shell: 'var(--bg-shell)',
      },
    },
  },
  plugins: [],
};
