import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    container: {
      center: true,
      padding: "1rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        // KAT brand palette — royal blue + bright red
        brand: {
          50: "#eff4ff",
          100: "#dbe6fe",
          200: "#bfd2fe",
          300: "#94b5fd",
          400: "#608cfa",
          500: "#3b66f6",
          600: "#2549ec",
          700: "#1d4ed8", // primary blue
          800: "#1e3aa8",
          900: "#1e3582",
        },
        // accent red (was "gold" — keep alias name to avoid breaking refs)
        gold: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626", // accent red
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
        },
        jade: {
          500: "#0f9d70",
          600: "#0a7d59",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        xl: "calc(var(--radius) + 4px)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
        zh: ["var(--font-zh)", "Noto Sans SC", "serif"],
      },
      backgroundImage: {
        "gradient-brand":
          "linear-gradient(135deg, #1d4ed8 0%, #dc2626 100%)",
        "gradient-soft":
          "radial-gradient(1200px 600px at 0% 0%, #eff4ff 0%, transparent 60%), radial-gradient(1000px 500px at 100% 0%, #fef2f2 0%, transparent 60%)",
      },
      boxShadow: {
        soft: "0 6px 24px -8px rgba(29, 78, 216, 0.22)",
        glow: "0 0 0 4px rgba(29, 78, 216, 0.14)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.04)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out",
        "pulse-soft": "pulse-soft 1.8s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
