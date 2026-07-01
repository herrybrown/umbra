import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        arc: {
          blue: "#1652F0",
          dark: "#070810",
          card: "#0D0F1A",
          border: "#1A1D2E",
          muted: "#6B7280",
        },
        umbra: {
          purple: "#7C3AED",
          violet: "#6D28D9",
          indigo: "#4F46E5",
          glow: "#8B5CF6",
        },
        usdc: "#2775CA",
        eurc: "#3D9A60",
        settled: "#10B981",
        matched: "#F59E0B",
        danger: "#EF4444",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "glow": "glow 2s ease-in-out infinite alternate",
        "fade-in": "fadeIn 0.3s ease-out",
      },
      keyframes: {
        glow: {
          "0%": { boxShadow: "0 0 5px rgba(124, 58, 237, 0.3)" },
          "100%": { boxShadow: "0 0 20px rgba(124, 58, 237, 0.7)" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
