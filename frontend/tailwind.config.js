/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        // Brand palette — deep emerald-slate
        brand: {
          50:  "#eefaf4",
          100: "#d5f3e4",
          200: "#aee7cc",
          300: "#77d4ae",
          400: "#40ba8c",
          500: "#1e9d72",
          600: "#12815d",
          700: "#0e674b",
          800: "#0d523c",
          900: "#0c4432",
          950: "#05261d",
        },
        // Neutral — cool gray
        neutral: {
          0:   "#ffffff",
          50:  "#f7f8fa",
          100: "#f0f2f5",
          150: "#e8eaed",
          200: "#dde0e5",
          300: "#c8ccd3",
          400: "#a3a9b4",
          500: "#7a8190",
          600: "#5c636f",
          700: "#434952",
          800: "#2e333b",
          850: "#23272f",
          900: "#181b21",
          950: "#0f1115",
        },
        // Semantic
        success: { DEFAULT: "#16a34a", light: "#dcfce7" },
        warning: { DEFAULT: "#d97706", light: "#fef3c7" },
        danger:  { DEFAULT: "#dc2626", light: "#fee2e2" },
        info:    { DEFAULT: "#2563eb", light: "#dbeafe" },
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.06)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.12), 0 2px 6px -2px rgb(0 0 0 / 0.08)",
        modal: "0 20px 60px 0 rgb(0 0 0 / 0.18), 0 8px 24px -6px rgb(0 0 0 / 0.14)",
        sidebar: "1px 0 0 0 rgb(0 0 0 / 0.06)",
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
        xs:    ["0.75rem",  { lineHeight: "1rem" }],
        sm:    ["0.8125rem",{ lineHeight: "1.25rem" }],
        base:  ["0.875rem", { lineHeight: "1.375rem" }],
        md:    ["0.9375rem",{ lineHeight: "1.5rem" }],
        lg:    ["1rem",     { lineHeight: "1.5rem" }],
        xl:    ["1.125rem", { lineHeight: "1.625rem" }],
        "2xl": ["1.25rem",  { lineHeight: "1.75rem" }],
        "3xl": ["1.5rem",   { lineHeight: "2rem" }],
        "4xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "5xl": ["2.25rem",  { lineHeight: "2.75rem" }],
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        sidebar: "15rem",
        "sidebar-collapsed": "4rem",
        topbar: "3.5rem",
      },
      animation: {
        "fade-in":      "fadeIn 0.2s ease-out",
        "slide-in-left":"slideInLeft 0.25s ease-out",
        "slide-up":     "slideUp 0.2s ease-out",
        "pulse-soft":   "pulseSoft 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInLeft: {
          "0%":   { transform: "translateX(-12px)", opacity: "0" },
          "100%": { transform: "translateX(0)",     opacity: "1" },
        },
        slideUp: {
          "0%":   { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)",   opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.6" },
        },
      },
    },
  },
  plugins: [require("tailwindcss/plugin")],
}
