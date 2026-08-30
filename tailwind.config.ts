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
          dark: "rgb(var(--arc-dark) / <alpha-value>)",
          card: "rgb(var(--arc-card) / <alpha-value>)",
          border: "rgb(var(--arc-border) / <alpha-value>)",
          muted: "rgb(var(--arc-muted) / <alpha-value>)",
          text: "rgb(var(--arc-text) / <alpha-value>)",
        },
        umbra: {
          purple: "rgb(var(--umbra-purple) / <alpha-value>)",
          violet: "rgb(var(--umbra-violet) / <alpha-value>)",
          indigo: "rgb(var(--umbra-indigo) / <alpha-value>)",
          glow: "rgb(var(--umbra-glow) / <alpha-value>)",
        },
        white: "rgb(var(--arc-text) / <alpha-value>)",
        action: "rgb(var(--action-text) / <alpha-value>)",
        usdc: "rgb(var(--usdc) / <alpha-value>)",
        eurc: "rgb(var(--eurc) / <alpha-value>)",
        settled: "rgb(var(--settled) / <alpha-value>)",
        matched: "rgb(var(--matched) / <alpha-value>)",
        danger: "rgb(var(--danger) / <alpha-value>)",
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
