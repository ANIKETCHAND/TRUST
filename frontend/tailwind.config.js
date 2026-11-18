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
          bg: "#000000",
          secondary: "#080C14",
          sidebar: "#03060C",
          card: "#090D18",
          elevated: "#0F1523",
          border: "rgba(255, 255, 255, 0.08)",
          borderLight: "rgba(255, 255, 255, 0.15)",
          borderFocus: "#367BF5",
          primary: "#367BF5",
          secondaryBlue: "#2563EB",
          cyan: "#22B8CF",
          secure: "#16A36A",
          warning: "#F59E0B",
          critical: "#EF4444",
          info: "#367BF5",
        },
        cyber: {
          bg: "#000000",
          surface: "#080C14",
          card: "#090D18",
          elevated: "#0F1523",
          border: "rgba(255, 255, 255, 0.08)",
          borderLight: "rgba(255, 255, 255, 0.15)",
          accent: "#367BF5",
          cyan: "#22B8CF",
          emerald: "#16A36A",
          rose: "#EF4444",
          amber: "#F59E0B",
          purple: "#8B5CF6",
        },
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      boxShadow: {
        'kali-glow': '0 0 25px -5px rgba(54, 123, 245, 0.3)',
        'kali-glow-cyan': '0 0 25px -5px rgba(34, 184, 207, 0.3)',
        'kali-card': '0 4px 24px -2px rgba(0, 0, 0, 0.6)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.4)',
      },
    },
  },
  plugins: [],
}
