/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'console-charcoal': '#232324',
        'nav-ink': '#0e0e10',
        'recess-black': '#181818',
        'wire-gray': '#5c5c61',
        'bone-white': '#fafafa',
        'off-white': '#ebeced',
        'mute-gray': '#a1a1aa',
        'smoke': '#454546',
        'ash': '#696970',
        'true-black': '#000000',
      },
      fontFamily: {
        sans: ['GeistSans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['GeistMono', 'JetBrains Mono', 'IBM Plex Mono', 'monospace'],
      },
      borderRadius: {
        'tag': '4px',
        'card': '12px',
        'icon': '4px',
        'input': '4px',
        'btn': '9999px',
        'large-btn': '100px',
      },
      boxShadow: {
        'pill': 'rgba(0,0,0,0.1) 0px 1px 3px 0px, rgba(0,0,0,0.1) 0px 1px 2px -1px',
      },
      letterSpacing: {
        'tightest': '-0.3em',
        'tighter-ui': '-0.025em',
      }
    },
  },
  plugins: [],
}
