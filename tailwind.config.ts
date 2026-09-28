import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

// Visual style in line with howest.be/iot (shared with the other Graduaat IoT
// apps): dark bars, Howest light blue as accent, light blue background, rounded
// Nunito headings and Open Sans body text. Colours are HSL tokens in index.css.
export default {
  // Follows the system setting, like the other Graduaat IoT apps.
  darkMode: "media",
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "1.25rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        // Howest light blue: for fills (buttons, active states) with dark text on top.
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          hover: "hsl(var(--primary-hover))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Text and links in the accent colour: light blue is too pale for text
        // on a light background, so text uses the darker Howest link blue.
        link: "hsl(var(--link))",
        heading: "hsl(var(--heading))",
        success: {
          DEFAULT: "hsl(var(--success))",
          soft: "hsl(var(--success-soft))",
        },
        // The dark header and footer bars.
        bar: {
          DEFAULT: "hsl(var(--bar))",
          foreground: "hsl(var(--bar-foreground))",
          muted: "hsl(var(--bar-muted))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 4px)",
        sm: "calc(var(--radius) - 8px)",
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
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
      fontFamily: {
        sans: ["Open Sans Variable", "Open Sans", "Arial", "Verdana", "sans-serif"],
        // Nunito as a free stand-in for Howest's VAG Rounded.
        heading: ["Nunito Variable", "Nunito", "Arial Rounded MT Bold", "Open Sans Variable", "Arial", "sans-serif"],
        mono: ["ui-monospace", "Cascadia Mono", "Consolas", "monospace"],
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
      },
    },
  },
  plugins: [tailwindcssAnimate],
} satisfies Config;
