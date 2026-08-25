"use client";

import * as React from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { CONSENT_COOKIE } from "@/lib/consent";

/**
 * הודעת עוגיות שאפשר באמת לסרב לה.
 *
 * באנר שכל כפתוריו מסכימים הוא קישוט, והוא גם חסר ערך משפטי: הסכמה
 * שאי אפשר לסרב לה אינה הסכמה. כאן "לא, תודה" מוחק בפועל את עוגיית
 * המדידה ומונע את כתיבתה מחדש.
 *
 * הבאנר אינו מוצג על עוגיות הכרחיות — התחברות, מצב תצוגה ורשימת
 * השוואה אינן דורשות הסכמה, כי בלעדיהן השירות שהמשתמש ביקש אינו
 * עובד. ההסכמה נדרשת רק על המדידה.
 *
 * **הטקסט קצר בכוונה, וזו החלטת ביצועים שנמדדה.** בגרסה הקודמת
 * הפסקה הייתה בת ארבע שורות, ובמסך נייד ברוחב 412 היא כיסתה שטח
 * גדול יותר מהכותרת הראשית (21,866 מול 15,360 פיקסלים רבועים).
 * המשמעות: הדבר שגוגל מודד כ"התוכן הגדול ביותר" בכל דף באתר היה
 * הודעת העוגיות, והיא מופיעה רק אחרי ההידרציה — כלומר LCP של 2.5
 * שניות במקום 0.98, בכל דף.
 *
 * ההסבר המלא חי ב-`/cookies`, שם יש מקום לקרוא אותו. כאן נשארת
 * השורה שאומרת מה נמדד ושאפשר לסרב — וזה גם מה שהיידוע מחייב.
 */
export function CookieConsent() {
  const [decided, setDecided] = React.useState(true);

  React.useEffect(() => {
    // ההחלטה נקראת בלקוח כדי שהבאנר לא יישבר בעמוד שנשמר במטמון
    setDecided(document.cookie.includes(`${CONSENT_COOKIE}=`));
  }, []);

  function decide(accepted: boolean) {
    const year = 60 * 60 * 24 * 365;
    document.cookie = `${CONSENT_COOKIE}=${accepted ? "all" : "essential"}; path=/; max-age=${year}; samesite=lax`;

    /*
     * המחיקה של עוגיית המדידה נעשית ב-middleware ולא כאן: היא
     * `httpOnly`, ו-`document.cookie` אינו יכול לגעת בה. הרענון הבא
     * מוחק אותה, וכל בקשה אחריו כבר לא נמדדת.
     */
    setDecided(true);
    if (!accepted) location.reload();
  }

  if (decided) return null;

  return (
    <div
      role="region"
      aria-label="הודעת עוגיות"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card px-4 py-3 shadow-lifted sm:inset-x-4 sm:bottom-4 sm:mx-auto sm:max-w-2xl sm:rounded-lg sm:border"
    >
      <div className="flex items-center gap-3">
        <p className="flex-1 text-sm text-muted-foreground">
          עוגייה אחת למדידה אנונימית, ואפשר לסרב.{" "}
          <Link href="/cookies" className="text-info underline underline-offset-2">
            פרטים
          </Link>
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => decide(false)}>
            לא, תודה
          </Button>
          <Button size="sm" onClick={() => decide(true)}>
            מאשר/ת
          </Button>
        </div>
      </div>
    </div>
  );
}
