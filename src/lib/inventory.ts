import { unstable_cache } from "next/cache";

import { prisma } from "@/lib/db";

/**
 * כמה מודעות באמת יש בלוח, ומה מותר להציג בהתאם.
 *
 * המוצר כולו עוצב מול אלפי מודעות. ביום הראשון יהיו שלושים. כל מסך
 * שמניח צפיפות — רצועת מקודמות, מד מחיר, "נוספו עכשיו" — נראה שבור
 * בלוח דליל, ולא בגלל באג אלא בגלל הנחה.
 *
 * במקום לפזר בדיקות `length > 0` על פני המסכים, הספים יושבים כאן.
 * המעבר בין "לוח דליל" ל"לוח מלא" הוא אוטומטי: כשהמלאי גדל, המסכים
 * מתמלאים בלי שאיש נוגע בקוד.
 */

/** מתחת לזה דף הבית לא מציג את הרצועות המשניות. */
export const MIN_LISTINGS_FOR_SECTIONS = 20;

/** מתחת לזה לא מוצג מונה מלאי בכלל. מספר קטן מזיק יותר משום מספר. */
export const MIN_LISTINGS_FOR_COUNTER = 50;

/** מתחת לזה רצועת המקודמות אינה מוצגת — היא נראית כמו כל הלוח. */
export const MIN_LISTINGS_FOR_PROMOTED = 40;

/** מתחת לזה קריאות השוק בדף הבית נסתרות; אין ממה לגזור אותן. */
export const MIN_LISTINGS_FOR_TICKS = 30;

export type Inventory = {
  total: number;
  /** האם מותר להציג רצועות משניות בדף הבית */
  sections: boolean;
  /** האם מותר להציג מונה מלאי */
  counter: boolean;
  promoted: boolean;
  ticks: boolean;
};

function shape(total: number): Inventory {
  return {
    total,
    sections: total >= MIN_LISTINGS_FOR_SECTIONS,
    counter: total >= MIN_LISTINGS_FOR_COUNTER,
    promoted: total >= MIN_LISTINGS_FOR_PROMOTED,
    ticks: total >= MIN_LISTINGS_FOR_TICKS,
  };
}

/**
 * הספירה היא של מודעות פעילות בלבד, והיא **אמיתית**.
 *
 * "567 מודעות" כשיש 30 הוא השקר הראשון שמשתמש תופס, והוא זול: הוא
 * סופר בעצמו את מה שעל המסך. מונה מנופח בלוח חדש עולה יותר ממה
 * שהוא מביא.
 */
export const inventory = unstable_cache(
  async (): Promise<Inventory> =>
    shape(await prisma.listing.count({ where: { status: "ACTIVE", deletedAt: null } })),
  ["inventory"],
  { revalidate: 300, tags: ["inventory"] },
);

export { shape as inventoryShape };
