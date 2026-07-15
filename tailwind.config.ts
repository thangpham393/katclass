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
        // KAT brand — xanh dương hoàng gia
        brand: {
          50: "#eff4ff",
          100: "#dbe6fe",
          200: "#bfd2fe",
          300: "#94b5fd",
          400: "#608cfa",
          500: "#3b66f6",
          600: "#2549ec",
          700: "#1d4ed8",
          800: "#1e3aa8",
          900: "#1e3582",
          950: "#131f4d",
        },
        // gold = đỏ KAT (giữ tên để không vỡ class cũ)
        gold: {
          50: "#fef2f2",
          100: "#fee2e2",
          200: "#fecaca",
          300: "#fca5a5",
          400: "#f87171",
          500: "#ef4444",
          600: "#dc2626",
          700: "#b91c1c",
          800: "#991b1b",
          900: "#7f1d1d",
          950: "#450a0a",
        },
        // ink = navy đậm cho sidebar & bề mặt tối
        ink: {
          50: "#f2f5fb",
          100: "#e2e8f4",
          200: "#c5d1e8",
          300: "#9fb1d4",
          400: "#7289ba",
          500: "#53699f",
          600: "#405284",
          700: "#35436b",
          800: "#2b3555",
          900: "#1c2338",
          950: "#101527",
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
        zh: ["var(--font-zh)", "Noto Serif SC", "serif"],
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #1d4ed8 0%, #dc2626 100%)",
        "gradient-soft":
          "radial-gradient(1200px 600px at 0% 0%, #eff4ff 0%, transparent 60%), radial-gradient(1000px 500px at 100% 0%, #fef2f2 0%, transparent 60%)",
      },
      boxShadow: {
        soft: "0 6px 24px -8px rgba(29, 78, 216, 0.22)",
        glow: "0 0 0 4px rgba(29, 78, 216, 0.14)",
        seal: "0 2px 8px -2px rgba(220, 38, 38, 0.45)",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
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
        "fade-in": "fade-in 0.3s ease-out",
        "pulse-soft": "pulse-soft 1.8s ease-in-out infinite",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
