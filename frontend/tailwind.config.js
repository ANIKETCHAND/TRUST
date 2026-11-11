/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        kali: {
          bg: "#0B0F17",
          secondary: "#111827",
          sidebar: "#0D1420",
          card: "#151E2D",
          elevated: "#1B2638",
          border: "#1E293B",
          borderLight: "#2A3B54",
          borderFocus: "#367BF5",
          primary: "#367BF5",
          secondaryBlue: "#2563EB",
          cyan: "#22B8CF",
          secure: "#16A36A",
          warning: "#D99A35",
          critical: "#DC4C55",
          info: "#367BF5",
        },
        cyber: {
          bg: "#0B0F17",
          surface: "#111827",
          card: "#151E2D",
          elevated: "#1B2638",
          border: "#1E293B",
          borderLight: "#2A3B54",
          accent: "#367BF5",
          cyan: "#22B8CF",
          emerald: "#16A36A",
          rose: "#DC4C55",
          amber: "#D99A35",
          purple: "#8B5CF6",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'kali-glow': '0 0 20px -5px rgba(54, 123, 245, 0.25)',
        'kali-glow-cyan': '0 0 20px -5px rgba(34, 184, 207, 0.25)',
        'kali-card': '0 4px 20px -2px rgba(0, 0, 0, 0.45)',
      },
    },
  },
  plugins: [],
}
