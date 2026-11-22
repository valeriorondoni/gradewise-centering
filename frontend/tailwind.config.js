/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      colors: {
        navy: {
          900: '#0D2230',
          800: '#143144',
          700: '#1C4159',
        },
        mint: {
          50: '#F2FAF7',
          100: '#E5F4EE',
          200: '#C8E9DC',
        },
      },
    },
  },
  plugins: [],
};
