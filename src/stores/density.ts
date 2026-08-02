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

type DensityState = {
  density: Density;
  setDensity: (density: Density) => void;
};

export const useDensityStore = create<DensityState>()(
  persist(
    (set) => ({
      density: "grid",
      setDensity: (density) => set({ density }),
    }),
    { name: "luach-density" },
  ),
);

/**
 * הצפיפות הנוכחית, בטוחה ל-SSR.
 *
 * בשרת ובהרצה הראשונה בלקוח מוחזר תמיד `grid` — הערך שאיתו נבנה ה-HTML.
 * רק אחרי ההידרציה מוחזרת הבחירה השמורה, אחרת React היה מדווח על אי-התאמה
 * בין השרת ללקוח.
 */
export function useDensity(): { density: Density; setDensity: (d: Density) => void } {
  const density = useDensityStore((s) => s.density);
  const setDensity = useDensityStore((s) => s.setDensity);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => setHydrated(true), []);

  return { density: hydrated ? density : "grid", setDensity };
}
