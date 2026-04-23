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
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6", // clear blue
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
          950: "#172554",
        },
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b", // dark slate for sidebar
          900: "#0f172a",
          950: "#020617",
        },
        neutral: {
          0: "#ffffff",
          50: "#f9fafb",
          100: "#f3f4f6",
          150: "#e5e7eb",
          200: "#d1d5db",
          300: "#9ca3af",
          400: "#6b7280",
          500: "#4b5563",
          600: "#374151",
          700: "#1f2937",
          800: "#111827",
          850: "#0f131a",
          900: "#030712",
          950: "#000000",
        },
        success: { DEFAULT: "#15803d", light: "#dcfce7" }, // darker green for better contrast
        warning: { DEFAULT: "#b45309", light: "#fef3c7" }, // darker amber/orange
        danger: { DEFAULT: "#b91c1c", light: "#fee2e2" },  // darker red
        info: { DEFAULT: "#0369a1", light: "#e0f2fe" },
      },
      borderRadius: {
        DEFAULT: "0.5rem",
        sm: "0.375rem",
        md: "0.5rem",
        lg: "0.75rem",
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem",
      },
      boxShadow: {
        card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)", // clearer border/shadow
        "card-hover": "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
        modal: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
        sidebar: "2px 0 10px 0 rgb(0 0 0 / 0.1)", // softer shadow, less dramatic
        "inner-sm": "inset 0 1px 2px 0 rgb(0 0 0 / 0.05)",
        glow: "0 0 10px 0 rgb(59 130 246 / 0.3)", // blue glow
      },
      fontSize: {
        // Boosted base text sizes for "grandma" legibility
        "2xs": ["0.75rem", { lineHeight: "1rem" }], // was 0.625
        xs: ["0.8125rem", { lineHeight: "1.125rem" }], // was 0.75
        sm: ["0.875rem", { lineHeight: "1.25rem" }], // was 0.8125
        base: ["1rem", { lineHeight: "1.5rem" }], // standard reading size
        md: ["1.0625rem", { lineHeight: "1.5rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.25rem", { lineHeight: "1.75rem" }],
        "2xl": ["1.5rem", { lineHeight: "2rem" }],
        "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
        "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
        "5xl": ["3rem", { lineHeight: "1" }],
      },
      spacing: {
        18: "4.5rem",
        22: "5.5rem",
        sidebar: "16rem", // slightly wider sidebar for larger text
        "sidebar-collapsed": "4.5rem",
        topbar: "4rem", // slightly taller topbar
      },
      backgroundImage: {
        "sidebar-gradient": "linear-gradient(180deg, #0f172a 0%, #020617 100%)", // slate
        "brand-gradient": "linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)", // blue
      },
      animation: {
        "fade-in": "fadeIn 0.22s ease-out",
        "slide-in-left": "slideInLeft 0.28s ease-out",
        "slide-up": "slideUp 0.22s ease-out",
        "pulse-soft": "pulseSoft 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideInLeft: {
          "0%": { transform: "translateX(-14px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
      },
    },
  },
  plugins: [require("tailwindcss/plugin")],
}
