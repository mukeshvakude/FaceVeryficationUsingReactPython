/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0f172a",
        haze: "#f8fafc",
        glow: "#38bdf8",
        ember: "#f97316",
        moss: "#22c55e"
      },
      boxShadow: {
        glass: "0 10px 40px rgba(15, 23, 42, 0.15)",
        lift: "0 12px 24px rgba(15, 23, 42, 0.18)"
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: 0, transform: "translateY(12px)" },
          "100%": { opacity: 1, transform: "translateY(0)" }
        }
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease both"
      }
    }
  },
  plugins: []
};
