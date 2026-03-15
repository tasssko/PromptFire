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
          text: {
            primary: '#102039',
            secondary: '#2e4461',
          },
          border: {
            subtle: '#d7e0eb',
            default: '#d3dde8',
            strong: '#c8d4e3',
            divider: '#e1e8f0',
          },
          cta: {
            primary: '#174473',
            primaryHover: '#12385f',
            secondary: '#f3f8ff',
            secondaryHover: '#e8f1ff',
          },
        },
      },
      boxShadow: {
        sm: '0 8px 20px rgba(16, 32, 57, 0.08)',
        md: '0 16px 34px rgba(16, 32, 57, 0.12)',
      },
      backgroundImage: {
        'page-shell': 'radial-gradient(circle at top right, #f2f7ff 0%, #f6f4ee 45%, #edf2f6 100%)',
        shell: 'linear-gradient(180deg, #fcfdff 0%, #f6f9fd 100%)',
        'hero-poor': 'linear-gradient(135deg, #411724 0%, #7f1d32 55%, #b4542d 100%)',
        'hero-weak': 'linear-gradient(135deg, #3d1f26 0%, #7b2d35 55%, #be5d2f 100%)',
        'hero-usable': 'linear-gradient(135deg, #0f2f54 0%, #225889 55%, #d59e44 100%)',
        'hero-strong': 'linear-gradient(135deg, #10365e 0%, #1e5479 55%, #3f8d6a 100%)',
        'hero-excellent': 'linear-gradient(135deg, #0d3d4a 0%, #146f73 55%, #67b06b 100%)',
      },
    },
  },
  plugins: [],
};
