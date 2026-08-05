/**
 * שקיפות על התנהגות המוכר.
 *
 * שני דפוסים שלוחות מודעות בישראל מאפשרים והקונה לא רואה:
 *
 *   **ריפרוט** — סוחר מוחק מודעה ומפרסם אותה מחדש כל שבוע, כדי לחזור
 *   לראש הרשימה. המודעה נראית "פורסמה היום" ובפועל היא באוויר חודשיים,
 *   וזה גם מסתיר מהקונה שהפריט לא נמכר — כלומר בדיוק את המידע שהיה
 *   גורם לו להתמקח.
 *
 *   **העלאה לפני הורדה** — המחיר מועלה ואז "מורד", כך שהמודעה מקבלת
 *   תג ירידת מחיר בלי שהמחיר באמת ירד מתחת לנקודת הפתיחה.
 *
 * שניהם ניתנים לחישוב מנתונים שכבר נשמרים: `contentHash` ו-
 * `PriceHistory`. מה שהיה חסר זו ההצגה.
 *
 * ## הטון
 *
 * הרכיבים האלה מציגים **עובדה, לא האשמה.** "פורסם מחדש 6 פעמים" הוא
 * נתון; "המוכר מנסה להטעות אותך" הוא מסקנה שאולי שגויה — יש סיבות
 * לגיטימיות לפרסם מחדש. הקונה יסיק בעצמו, וזה גם מה שהופך את הנתון
 * לאמין.
 *
 * הקובץ טהור ואינו נוגע במסד — כדי שיהיו לו בדיקות.
 */

/**
 * מכמה פרסומים מתחילים להציג.
 *
 * שניים אינם דפוס — מודעה שפגה וחודשה פעם אחת היא התנהגות רגילה
 * לחלוטין. שלושה כבר מעידים על שיטה.
 */
export const REPOST_MIN = 3;

/** מתחת לזה שינוי המחיר הוא עיגול ולא מהלך. */
const PRICE_NOISE = 0.02;

export type RepostInfo = {
  /** כמה פעמים אותו תוכן פורסם, כולל הפרסום הנוכחי */
  times: number;
  /** מתי פורסם לראשונה */
  firstSeen: Date;
};

/**
 * תיאור הריפרוט, או `null` כשאין מה לומר.
 *
 * `null` ולא מחרוזת ריקה: הרכיב שמציג לא צריך להחליט אם להסתיר.
 */
export function repostLabel(info: RepostInfo | null, now = new Date()): string | null {
  if (!info || info.times < REPOST_MIN) return null;

  const days = Math.max(1, Math.floor((now.getTime() - info.firstSeen.getTime()) / 86_400_000));

  /*
   * "באוויר X ימים" ולא רק "פורסם N פעמים".
   *
   * מספר הפרסומים לבדו לא אומר לקונה דבר; מה שמעניין אותו הוא שהפריט
   * לא נמכר כבר חודשיים — וזה בדיוק מה שהריפרוט נועד להסתיר.
   */
  return `פורסם מחדש ${info.times} פעמים · באוויר ${days} ימים`;
}

export type PricePoint = { price: number; at: Date };

export type PriceInsight =
  | { kind: "raised-then-cut"; peak: number; start: number; current: number }
  | { kind: "net-drop"; start: number; current: number; pct: number }
  | null;

/**
 * מה באמת קרה למחיר לאורך זמן.
 *
 * `raised-then-cut` הוא הממצא שחשוב: המחיר הועלה ואז הורד, כך שהמודעה
 * מציגה "ירידת מחיר" בעוד המחיר הנוכחי אינו נמוך מנקודת הפתיחה. תג
 * ירידה במצב הזה הוא נכון טכנית ומטעה למעשה.
 *
 * `net-drop` הוא ירידה אמיתית מנקודת הפתיחה, וראוי שתוצג ככזו.
 */
export function priceInsight(points: PricePoint[]): PriceInsight {
  if (points.length < 2) return null;

  const sorted = [...points].sort((a, b) => a.at.getTime() - b.at.getTime());
  const start = sorted[0]!.price;
  const current = sorted[sorted.length - 1]!.price;
  const peak = Math.max(...sorted.map((p) => p.price));

  if (start <= 0) return null;

  /*
   * הועלה מעל נקודת הפתיחה, ואז ירד — אבל לא מתחתיה.
   * זה הדפוס שמייצר תג "ירידת מחיר" בלי הנחה אמיתית.
   */
  const raised = (peak - start) / start > PRICE_NOISE;
  const cameDown = (peak - current) / peak > PRICE_NOISE;
  const belowStart = (start - current) / start > PRICE_NOISE;

  if (raised && cameDown && !belowStart) {
    return { kind: "raised-then-cut", peak, start, current };
  }

  if (belowStart) {
    return {
      kind: "net-drop",
      start,
      current,
      pct: Math.round(((start - current) / start) * 100),
    };
  }

  return null;
}

/** ניסוח עברי לממצא. עובדה, לא האשמה. */
export function priceInsightLabel(insight: PriceInsight): string | null {
  if (!insight) return null;

  if (insight.kind === "raised-then-cut") {
    return "המחיר הועלה ואז הורד — המחיר הנוכחי אינו נמוך ממחיר הפרסום";
  }

  return `ירידה של ${insight.pct}% ממחיר הפרסום המקורי`;
}
