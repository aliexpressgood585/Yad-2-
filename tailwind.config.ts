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
         *   display — Noto Sans Hebrew מעובה־צר. כותרות מסך ומחיר ראשי בלבד.
         *   sans    — Assistant. כל טקסט הממשק.
         *   data    — Rubik עם tabular-nums. מחירים, ק"מ, מ"ר, שנה, טלפון.
         */
        /* שרשרת הנפילה כבר בתוך המשתנה (`fallback` ב-next/font); כאן רק גנרי */
        heading: ["var(--font-display)", "sans-serif"],
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        data: ["var(--font-data)", "var(--font-body)", "system-ui", "sans-serif"],
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
       * אפס עיגול בכל הסקאלה.
       *
       * הערכים כתובים מפורשות ולא כ-`calc(var(--radius) - 4px)`: חיסור
       * מאפס נותן רדיוס שלילי, שהוא הצהרה לא חוקית שהדפדפן זורק בשקט.
       * התוצאה הייתה זהה במקרה הזה, אבל CSS לא חוקי שנשען על כך
       * שהדפדפן יתעלם ממנו הוא באג שממתין לשינוי הבא ב---radius.
       *
       * `rounded-full` אינו נגזר מכאן ונשאר זמין לצ'יפים ולאווטרים.
       */
      borderRadius: {
        lg: "var(--radius)",
        md: "var(--radius)",
        sm: "var(--radius)",
        xl: "var(--radius)",
        "2xl": "var(--radius)",
      },
      /*
       * אין צללים במערכת.
       *
       * `lifted` נשאר בשם הזה כי הוא בשימוש בעשרות מקומות, אבל הוא כבר
       * אינו צל אלא טבעת שיער בעובי פיקסל: במכשיר מדידה משטח אינו מרחף
       * מעל משטח אחר, הוא נחתך ממנו. ההפרדה היא קו, לא עומק מדומה.
       */
      boxShadow: {
        lifted: "0 0 0 1px hsl(var(--foreground) / 0.16)",
        /*
         * החריג היחיד, ורק לשכבות פורטל.
         * תפריט, דיאלוג וטולטיפ אינם יושבים בזרימת הדף ואין להם קו
         * שמפריד אותם ממנה; בלי הצללה הם נקראים כחלק מהתוכן שמתחתיהם.
         * אסור לכרטיס, לשורה או למשטח בתוך הזרימה.
         */
        overlay: "0 10px 30px hsl(var(--shadow-color) / 0.45)",
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
