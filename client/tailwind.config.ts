import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}", "./index.html"],
  theme: {
    extend: {
      colors: {
        // Intelli Sense brand
        brand: {
          blue: "#293b83",
          green: "#64b783",
          teal: "#67b4b0",
        },
        // Retain Sense accent
        retain: {
          50: "#eef2ff",
          100: "#dde5ff",
          500: "#293b83",
          600: "#1e2d66",
          700: "#16224d",
        },
        // Obtain Sense accent
        obtain: {
          50: "#ecfdf5",
          100: "#d1fae5",
          500: "#10B981",
          600: "#059669",
          700: "#047857",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
