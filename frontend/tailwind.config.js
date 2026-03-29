/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './app/**/*.{js,jsx}',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "#2a3448",
        input: "#2a3448",
        ring: "#6c63ff",
        background: "#0f1117",
        foreground: "#e2e8f0",
        primary: {
          DEFAULT: "#6c63ff",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#1c2333",
          foreground: "#8892a4",
        },
        destructive: {
          DEFAULT: "#ef4444",
          foreground: "#ffffff",
        },
        muted: {
          DEFAULT: "#161b27",
          foreground: "#8892a4",
        },
        accent: {
          DEFAULT: "rgba(108,99,255,0.18)",
          foreground: "#e2e8f0",
        },
        popover: {
          DEFAULT: "#1c2333",
          foreground: "#e2e8f0",
        },
        card: {
          DEFAULT: "#1c2333",
          foreground: "#e2e8f0",
        },
        sidebar: {
          DEFAULT: "#161b27",
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "pulse-glow": {
          "0%, 100%": { boxShadow: "0 0 6px #22c55e" },
          "50%": { boxShadow: "0 0 14px #22c55e" },
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-glow": "pulse-glow 2s infinite"
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
