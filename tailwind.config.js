/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "sans-serif"] },
      colors: {
        primary: "var(--primary)",
        primarysoft: "var(--primary-soft)",
        primaryactive: "var(--primary-active)",
        secondary: "var(--secondary)",
        pinkacc: "var(--accent-pink)",
        yellowacc: "var(--accent-yellow)",
        ink: "var(--ink)",
        muted: "var(--muted)",
        onprimary: "var(--on-primary)",
        ondark: "var(--on-dark)",
        ondarksoft: "var(--on-dark-soft)",
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        card: "var(--card)",
        surfacedark: "var(--surface-dark)",
        hairline: "var(--hairline)",
        hairlinestrong: "var(--hairline-strong)"
      },
      borderRadius: { sm: "8px", md: "11px", lg: "18px", pill: "9999px" }
    }
  },
  plugins: []
};
