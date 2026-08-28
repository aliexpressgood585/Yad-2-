"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * צפיפות התצוגה ברשימות מודעות.
 *
 * שני המצבים הם שתי שורות קריאה ברוחב מלא ולא גריד מול רשימה: גריד
 * כרטיסים אינו קיים באתר הזה (ראה DECISIONS.md §38), ומה שנותר לבחור
 * הוא כמה מקום התמונה מקבלת בתוך השורה.
 *
 *   full    — לוחית תמונה מלאה. עיון בפריטים שהמראה שלהם הוא הנתון.
 *   compact — חתימת תמונה צרה, שורה נמוכה. סריקה מהירה של טור מחירים,
 *             וזה מה שסוחרי רכב ומחפשי דירות עושים בפועל.
 *
 * הבחירה נשמרת ב-localStorage כי היא העדפת עבודה, לא מצב של מסך אחד.
 */
export type Density = "full" | "compact";

/**
 * כמה בחירות רצופות באותה קטגוריה הופכות לברירת מחדל שם.
 *
 * שלוש ולא אחת: בחירה בודדת היא לעיתים קרובות סקרנות או טעות, ושלוש
 * ברצף כבר אומרות משהו. ולא חמש — עד אז המשתמש כבר בחר ידנית חמש
 * פעמים ולמד שהמערכת לא מקשיבה.
 */
export const LEARN_AFTER = 3;

type Streak = { density: Density; count: number };

type DensityState = {
  /** הבחירה הגלובלית — ברירת המחדל בכל מקום שאין בו העדפה נלמדת */
  density: Density;
  /** ברירת מחדל שנלמדה לקטגוריה, לפי slug */
  learned: Record<string, Density>;
  /** רצף הבחירות הנוכחי בכל קטגוריה */
  streaks: Record<string, Streak>;
  setDensity: (density: Density, categorySlug?: string) => void;
};

export const useDensityStore = create<DensityState>()(
  persist(
    (set) => ({
      density: "full",
      learned: {},
      streaks: {},
      setDensity: (density, categorySlug) =>
        set((state) => {
          if (!categorySlug) return { ...state, density };

          const previous = state.streaks[categorySlug];
          const count = previous?.density === density ? previous.count + 1 : 1;

          return {
            ...state,
            density,
            streaks: { ...state.streaks, [categorySlug]: { density, count } },
            learned:
              count >= LEARN_AFTER
                ? { ...state.learned, [categorySlug]: density }
                : state.learned,
          };
        }),
    }),
    {
      name: "luach-density",
      version: 3,
      /**
       * גרסה 1 שמרה `density` בלבד. שדרוג בלי migrate היה מחזיר
       * `learned` ו-`streaks` כ-undefined לכל מי שכבר ביקר באתר,
       * והקריאה הראשונה אליהם הייתה נופלת.
       *
       * גרסה 3 החליפה את שמות המצבים כשהגריד ירד מהאתר. בלי המרה של
       * הערכים השמורים כל מי שביקר קודם היה נושא `"grid"` שאינו קיים
       * יותר, ומקבל שורה שאינה מסומנת באף כפתור במחליף.
       */
      migrate: (persisted) => {
        const previous = (persisted ?? {}) as Partial<DensityState> & {
          density?: string;
          learned?: Record<string, string>;
        };
        const rename = (value: string | undefined): Density =>
          value === "list" || value === "compact" ? "compact" : "full";

        return {
          streaks: {},
          ...previous,
          density: rename(previous.density),
          learned: Object.fromEntries(
            Object.entries(previous.learned ?? {}).map(([slug, d]) => [slug, rename(d)]),
          ),
        } as DensityState;
      },
    },
  ),
);

/**
 * הצפיפות הנוכחית, בטוחה ל-SSR.
 *
 * בשרת ובהרצה הראשונה בלקוח מוחזר תמיד `full` — הערך שאיתו נבנה ה-HTML.
 * רק אחרי ההידרציה מוחזרת הבחירה השמורה, אחרת React היה מדווח על אי-התאמה
 * בין השרת ללקוח.
 *
 * **ההעדפה הנלמדת גוברת על הגלובלית בקטגוריה שלה.** מי שעבר לרשימה
 * שלוש פעמים ברציפות ברכב מקבל שורה צרה ברכב, וממשיך לקבל לוחית בריהוט —
 * כי אלה שני סוגי עיון שונים ולא העדפה אחת של אדם אחד.
 */
export function useDensity(categorySlug?: string): {
  density: Density;
  setDensity: (d: Density) => void;
  /** האם הצפיפות שמוצגת הגיעה מלמידה ולא מבחירה גלובלית */
  isLearned: boolean;
} {
  const density = useDensityStore((s) => s.density);
  const learned = useDensityStore((s) => (categorySlug ? s.learned[categorySlug] : undefined));
  const setDensity = useDensityStore((s) => s.setDensity);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return {
    density: hydrated ? (learned ?? density) : "full",
    setDensity: (d: Density) => setDensity(d, categorySlug),
    isLearned: hydrated && learned !== undefined,
  };
}
