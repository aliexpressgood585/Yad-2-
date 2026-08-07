"use client";

import * as React from "react";

/**
 * משחרר את המחוגים להתייצב, כשהם מגיעים למסך.
 *
 * **צופה אחד לכל הדף ולא רכיב לכל כרטיס.** בעמוד עם 24 מודעות
 * הגישה השנייה הייתה 24 רכיבי לקוח, 24 מופעי `useEffect` ו-24
 * צופים — כלומר להפוך אלמנט קריאה סטטי לעלות הידרציה אמיתית.
 * כאן זה קובץ אחד, צופה אחד, ואפס JavaScript בכרטיס עצמו.
 *
 * הכרטיסים נשארים רכיבי שרת. הרכיב הזה רק מוסיף תכונה ל-DOM שכבר
 * נוצר, ו-CSS עושה את השאר.
 */
export function NeedleSettle() {
  React.useEffect(() => {
    if (typeof IntersectionObserver === "undefined") {
      // בדפדפן בלי צופה — משחררים מיד. עדיף מחוג שקפץ ממחוג שנתקע.
      document.querySelectorAll(".price-scale").forEach((el) => el.setAttribute("data-settled", ""));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-settled", "");
          // מתייצב פעם אחת. מחוג שרץ מחדש בכל גלילה הוא קישוט.
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px" },
    );

    const observe = () =>
      document
        .querySelectorAll(".price-scale:not([data-settled])")
        .forEach((el) => io.observe(el));

    observe();

    /*
     * גלילה אינסופית מוסיפה כרטיסים אחרי הטעינה, והם צריכים להיקלט
     * גם הם. `MutationObserver` על ה-body זול יותר מלחווט את הצופה
     * דרך כל רכיב שמוסיף תוצאות.
     *
     * **מקובץ ב-rAF.** בלי זה ההידרציה של Next מייצרת מאות מוטציות
     * בטעינה הראשונה, וכל אחת מהן מריצה סריקת DOM מלאה — כלומר רכיב
     * שנועד לחסוך עבודה הופך לעבודה. במדידה זה עלה נקודת ביצועים
     * בדף הבית, וזה מחיר מגוחך לאנימציה של מחוג.
     */
    let queued = false;
    const mo = new MutationObserver(() => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        observe();
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, []);

  return null;
}
