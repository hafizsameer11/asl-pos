/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // ASL ORIGINALS tokens (styles.css in the website/admin prototype): ink #0f0f0f, admin canvas #f7f5ef, burnt orange #cc5000.
        canvas: "#f7f5ef",
        paper: "#faf8f3",
        line: { DEFAULT: "#e8e6e1", strong: "#d6d3cc" },
        ink: { DEFAULT: "#0f0f0f", 2: "#3d3b38" },
        muted: "#6b6760",
        faint: "#9a968f",
        gold: { DEFAULT: "#cc5000", soft: "#f8e5d6", ink: "#a03d00" },
        side: { DEFAULT: "#000000", 2: "#161616", line: "#262626" },
        good: { DEFAULT: "#12805c", soft: "#e3f4ec" },
        warn: { DEFAULT: "#a15c07", soft: "#fdf0dc" },
        bad: { DEFAULT: "#d1302f", soft: "#fce8e7" },
        info: { DEFAULT: "#2456b8", soft: "#e8eefb" },
      },
      fontFamily: {
        sans: ['"Inter Tight Variable"', '"Inter Tight"', '"Helvetica Neue"', "Helvetica", "Arial", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,23,26,0.04)",
        pop: "0 12px 32px -8px rgba(23,23,26,0.18), 0 2px 6px rgba(23,23,26,0.06)",
      },
    },
  },
  plugins: [],
};
