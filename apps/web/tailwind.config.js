/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0d0d1a',
        'background-light': '#1a1a2e',
        surface: 'rgba(22, 33, 62, 0.6)',
        primary: '#e94560',
        'primary-dark': '#c73a52',
        secondary: '#9b59b6',
        'secondary-dark': '#8e44ad',
        glass: {
          DEFAULT: 'rgba(22, 33, 62, 0.4)',
          light: 'rgba(22, 33, 62, 0.6)',
          border: 'rgba(255, 255, 255, 0.08)',
          'border-light': 'rgba(255, 255, 255, 0.12)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-primary': 'linear-gradient(135deg, #e94560 0%, #9b59b6 100%)',
      },
    },
  },
  plugins: [],
}
