/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./**/*.{ts,tsx,js,jsx}", "!./node_modules/**", "!./build/**"],
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: "var(--accent, #e8cca4)",
          dark: "var(--accent-dark, #dfc093)"
        }
      }
    }
  },
  plugins: []
}
