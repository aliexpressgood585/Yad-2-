import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: "1rem", sm: "1.25rem", lg: "2rem" },
      screens: { "2xl": "1400px" },
    },
    extend: {
      fontFamily: {
        /*
         * שלושה תפקידים, שלושה גופנים:
         *   heading — Heebo 900, גרוטסק עברי מעובה. כותרות ומחיר ראשי.
         *   sans    — Assistant. כל טקסט הממשק.
         *   data    — IBM Plex Mono עם tabular-nums. כל מספר שנקרא כמדידה.
         *             ערך עברי בתוך `.num` נופל אחורה ל-Assistant, כי
         *             ל-Plex Mono אין עברית — וזה בסדר: המונו נחוץ לספרות.
         */
        heading: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        data: ["var(--font-data)", "var(--font-body)", "ui-monospace", "monospace"],
      },

      /*
       * סקאלת טיפוגרפיה סגורה: 12 / 14 / 16 / 20 / 26 / 34 / 46.
       * אין גדלים אחרים — `text-[15px]` בקוד הוא באג, לא בחירה.
       */
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1.1rem" }],
        sm: ["0.875rem", { lineHeight: "1.25rem" }],
        base: ["1rem", { lineHeight: "1.5rem" }],
        lg: ["1.25rem", { lineHeight: "1.65rem" }],
        xl: ["1.625rem", { lineHeight: "2rem" }],
        "2xl": ["2.125rem", { lineHeight: "2.4rem" }],
        "3xl": ["2.875rem", { lineHeight: "3.1rem" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          soft: "hsl(var(--primary-soft))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      /*
       * אפס פינות מעוגלות.
       *
       * הסקאלה כולה מוגדרת מחדש ל-0 — `full` בכלל זה — במקום לעבור על
       * מאתיים שימושי `rounded-*` בקוד ולמחוק אותם אחד-אחד. הכלל נאכף
       * במקום אחד, וחריגה ממנו דורשת לשנות את הקובץ הזה במפורש.
       * `npm run check:design` נופל אם ערך כאן חדל להיות אפס.
       */
      borderRadius: {
        none: "0px",
        sm: "var(--radius)",
        DEFAULT: "var(--radius)",
        md: "var(--radius)",
        lg: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "var(--radius)",
        "3xl": "var(--radius)",
        full: "var(--radius)",
      },
      /*
       * אפס צללים.
       *
       * צל הוא סימולציה של עומק פיזי, וזה בדיוק מה שהמכשיר אינו מנסה
       * להיות. הפרדה בין משטחים נעשית בקו של פיקסל אחד ובהפרש הערך בין
       * גרפיט (#16181B) לשלדה (#1E2126) — שני אמצעים שאינם מטשטשים כלום
       * ואינם עולים בפריים.
       *
       * גם `overlay` הוא none: שכבת פורטל נבדלת מהתוכן בקו הענבר שלה,
       * שהוא סימון חד ולא ענן.
       */
      boxShadow: {
        none: "none",
        sm: "none",
        DEFAULT: "none",
        md: "none",
        lg: "none",
        xl: "none",
        "2xl": "none",
        inner: "none",
        lifted: "none",
        overlay: "none",
      },

      /* תקציב התנועה: משך אחד, easing אחד. ראה DESIGN.md. */
      transitionTimingFunction: {
        DEFAULT: "cubic-bezier(.2,0,0,1)",
        ui: "cubic-bezier(.2,0,0,1)",
      },
      transitionDuration: {
        DEFAULT: "180ms",
        ui: "180ms",
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
        shimmer: {
          "100%": { transform: "translateX(-100%)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.18s cubic-bezier(.2,0,0,1)",
        "accordion-up": "accordion-up 0.18s cubic-bezier(.2,0,0,1)",
        shimmer: "shimmer 1.6s infinite",
        "fade-up": "fade-up 0.12s cubic-bezier(.2,0,0,1) both",
      },
    },
  },
  plugins: [animate],
};

export default config;
