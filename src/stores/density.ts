"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * צפיפות התצוגה ברשימות מודעות.
 *
 *   grid — תמונה גדולה, שתי עמודות בנייד. טוב לעיון ולפריטים ויזואליים.
 *   list — תמונה קטנה מימין, שורה אחת לכל מודעה. סריקה מהירה בהרבה,
 *          וזה מה שסוחרי רכב ומחפשי דירות עושים בפועל.
 *
 * הבחירה נשמרת ב-localStorage כי היא העדפת עבודה, לא מצב של מסך אחד.
 */
export type Density = "grid" | "list";

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
      density: "grid",
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
      name: "metzia-density",
      version: 2,
      /**
       * גרסה 1 שמרה `density` בלבד. שדרוג בלי migrate היה מחזיר
       * `learned` ו-`streaks` כ-undefined לכל מי שכבר ביקר באתר,
       * והקריאה הראשונה אליהם הייתה נופלת.
       */
      migrate: (persisted) =>
        ({
          learned: {},
          streaks: {},
          density: "grid",
          ...(persisted as object),
        }) as DensityState,
    },
  ),
);

/**
 * הצפיפות הנוכחית, בטוחה ל-SSR.
 *
 * בשרת ובהרצה הראשונה בלקוח מוחזר תמיד `grid` — הערך שאיתו נבנה ה-HTML.
 * רק אחרי ההידרציה מוחזרת הבחירה השמורה, אחרת React היה מדווח על אי-התאמה
 * בין השרת ללקוח.
 *
 * **ההעדפה הנלמדת גוברת על הגלובלית בקטגוריה שלה.** מי שעבר לרשימה
 * שלוש פעמים ברציפות ברכב מקבל רשימה ברכב, וממשיך לקבל גריד בריהוט —
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
    density: hydrated ? (learned ?? density) : "grid",
    setDensity: (d: Density) => setDensity(d, categorySlug),
    isLearned: hydrated && learned !== undefined,
  };
}
