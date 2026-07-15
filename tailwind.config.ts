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
        // Ink & Jade — brand = ngọc bích (jade)
        brand: {
          50: "#f0faf5",
          100: "#dbf2e7",
          200: "#b8e5d1",
          300: "#89d0b3",
          400: "#55b491",
          500: "#309875",
          600: "#217a5f",
          700: "#1d624e",
          800: "#1a4e40",
          900: "#164036",
          950: "#0a241e",
        },
        // gold = đỏ chu sa (cinnabar seal red) — giữ tên cũ để không vỡ class cũ
        gold: {
          50: "#fdf4ef",
          100: "#fbe6da",
          200: "#f6c9b4",
          300: "#f0a483",
          400: "#e97751",
          500: "#e2542c",
          600: "#d03e1d",
          700: "#ac2f1a",
          800: "#8a281b",
          900: "#70241a",
          950: "#3c0f0a",
        },
        // ink = mực đen ánh lục, cho sidebar & bề mặt tối
        ink: {
          50: "#f4f6f5",
          100: "#e3e8e6",
          200: "#c7d1cd",
          300: "#a2b2ac",
          400: "#7c908a",
          500: "#61756f",
          600: "#4c5d58",
          700: "#3f4c48",
          800: "#353f3c",
          900: "#232b28",
          950: "#131917",
        },
        jade: {
          500: "#309875",
          600: "#217a5f",
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
        "gradient-brand": "linear-gradient(160deg, #1d624e 0%, #309875 100%)",
        "gradient-soft": "none",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(19, 25, 23, 0.05), 0 8px 24px -12px rgba(19, 25, 23, 0.12)",
        glow: "0 0 0 3px rgba(48, 152, 117, 0.18)",
        seal: "0 2px 8px -2px rgba(208, 62, 29, 0.45)",
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
