import type { Config } from "tailwindcss";

const rgb = (v: string) => `rgb(var(${v}) / <alpha-value>)`;

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Semantic tokens backed by CSS variables (see globals.css) so light/dark share class names.
        bg: rgb("--bg"),
        surface: rgb("--surface"),
        "surface-2": rgb("--surface-2"),
        "surface-3": rgb("--surface-3"),
        border: rgb("--border"),
        fg: rgb("--fg"),
        muted: rgb("--muted"),
        brand: { DEFAULT: rgb("--brand"), fg: rgb("--brand-fg"), a: rgb("--brand-a"), b: rgb("--brand-b") },
        good: rgb("--good"),
        warn: rgb("--warn"),
        bad: rgb("--bad"),
        // Validated chart/ring colours, fixed meaning (docs/DESIGN.md §3).
        cal: rgb("--c-cal"),
        protein: rgb("--c-protein"),
        steps: rgb("--c-steps"),
        sleep: rgb("--c-sleep"),
        fiber: rgb("--c-fiber"),
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-inter)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: { xl2: "1.25rem", "3xl": "1.5rem", "4xl": "2rem" },
      boxShadow: { tile: "var(--shadow-tile)", float: "var(--shadow-float)", glow: "var(--glow)" },
      transitionTimingFunction: { out: "cubic-bezier(0.22, 1, 0.36, 1)" },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(1)", opacity: "0.5" },
          "100%": { transform: "scale(1.9)", opacity: "0" },
        },
        breathe: {
          "0%, 100%": { transform: "scale(1)", opacity: "0.9" },
          "50%": { transform: "scale(1.06)", opacity: "1" },
        },
        spinSlow: { to: { transform: "rotate(360deg)" } },
        ripple: {
          "0%": { transform: "scale(0.9)", opacity: "0.5" },
          "100%": { transform: "scale(1.7)", opacity: "0" },
        },
        drawRing: { from: { strokeDashoffset: "var(--ring-len)" }, to: { strokeDashoffset: "var(--ring-off)" } },
        checkDraw: { from: { strokeDashoffset: "24" }, to: { strokeDashoffset: "0" } },
        floatUp: { from: { opacity: "0", transform: "translateY(12px) scale(.98)" }, to: { opacity: "1", transform: "none" } },
      },
      animation: {
        "pulse-ring": "pulseRing 1.6s ease-out infinite",
        breathe: "breathe 4.5s ease-in-out infinite",
        "spin-slow": "spinSlow 2.4s linear infinite",
        ripple: "ripple 2s ease-out infinite",
        "draw-ring": "drawRing 900ms cubic-bezier(0.22, 1, 0.36, 1) backwards",
        "check-draw": "checkDraw 380ms cubic-bezier(0.22, 1, 0.36, 1) 80ms both",
        "float-up": "floatUp 320ms cubic-bezier(0.22, 1, 0.36, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
