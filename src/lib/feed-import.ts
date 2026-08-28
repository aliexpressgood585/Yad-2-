import { getAttributesForCategory } from "@/lib/categories";
import { prisma } from "@/lib/db";
import {
  buildAttributeRows,
  deriveListingFields,
  expiryDate,
  uniqueSlug,
} from "@/lib/listing-write";
import type { AttributeSpec, ParsedRow } from "@/lib/feed";
import { sanitizeText } from "@/lib/utils";

/**
 * הכתיבה של המלאי המיובא.
 *
 * זהה לחלוטין בהעלאה מרוכזת ובפיד — ההבדל היחיד הוא מאיפה הגיע הטקסט.
 *
 * ## המפתח הוא `externalId`, וזה כל הסיפור
 *
 * `@@unique([businessId, externalId])` הופך ייבוא חוזר לעדכון. בלעדיו
 * סוחר שמייבא את הפיד שלו כל בוקר היה מייצר בשבוע 5,600 מודעות במקום
 * לעדכן 800 — וזו התקלה שהופכת פיד מכלי למטרד.
 *
 * ## מה מתעדכן ומה לא
 *
 * מתעדכנים: כותרת, תיאור, מחיר, עיר, שכונה והשדות הדינמיים. כלומר כל
 * מה שהסוחר שולט בו במערכת שלו.
 *
 * **תמונות אינן מוחלפות בעדכון** אלא רק נכתבות בפעם הראשונה. הסיבה
 * מעשית: הורדה ועיבוד מחדש של עשר תמונות לכל מודעה בכל ריצה יומית היא
 * העבודה היקרה ביותר במערכת, והיא מיותרת ב-99% מהמקרים כי התמונות לא
 * השתנו. סוחר שהחליף תמונות מוחק את המודעה ומייבא מחדש.
 *
 * **סטטוס אינו נדרס.** מודעה שהמנהל הסיר או שהסוחר סימן כנמכרה אינה
 * חוזרת לאוויר בייבוא הבא. ייבוא שמחזיר מודעה שהוסרה במודרציה הוא
 * דרך לעקוף מודרציה.
 */

export type ImportResult = {
  created: number;
  updated: number;
  /** מודעות שסומנו כנמכרו כי נעלמו מהפיד */
  removed: number;
  /** שגיאות כתיבה — נפרד משגיאות אימות שנתפסו לפני */
  failures: { externalId: string; message: string }[];
};

/** מפרט השדות הדינמיים של קטגוריה, בצורה שהמיפוי צורך. */
export async function attributeSpecsFor(categoryId: string): Promise<AttributeSpec[]> {
  const attributes = await getAttributesForCategory(categoryId);
  return attributes.map((a) => ({
    key: a.key,
    label: a.label,
    type: a.type,
    isRequired: a.isRequired,
    values: a.values.map((v) => ({ value: v.value, label: v.label })),
  }));
}

/**
 * כותב שורות מיובאות. יוצר מה שחדש ומעדכן מה שקיים.
 *
 * `publish` קובע אם המודעות עולות לאוויר או נכנסות כטיוטות. העלאה
 * מרוכזת ראשונה של סוחר נכנסת כטיוטה כברירת מחדל, כדי שהוא יראה מה
 * נוצר לפני שמאתיים מודעות מופיעות בלוח.
 */
export async function importRows(
  rows: ParsedRow[],
  options: {
    businessId: string;
    userId: string;
    categoryId: string;
    publish: boolean;
    /** הפיד שמייבא. `null` בהעלאה מרוכזת. */
    feedId?: string | null;
  },
): Promise<ImportResult> {
  const result: ImportResult = { created: 0, updated: 0, removed: 0, failures: [] };
  if (!rows.length) return result;

  const existing = await prisma.listing.findMany({
    where: {
      businessId: options.businessId,
      externalId: { in: rows.map((r) => r.externalId) },
    },
    select: { id: true, externalId: true, slug: true, price: true, status: true },
  });
  const byExternal = new Map(existing.map((l) => [l.externalId!, l]));

  for (const row of rows) {
    try {
      const title = sanitizeText(row.title);
      const description = sanitizeText(row.description);
      const { rows: attributeRows, labels } = await buildAttributeRows(
        options.categoryId,
        row.attributes,
      );

      const found = byExternal.get(row.externalId);

      if (found) {
        const derived = await deriveListingFields(
          {
            categoryId: options.categoryId,
            title,
            description,
            price: row.price,
            city: row.city,
            neighborhood: row.neighborhood,
          } as Parameters<typeof deriveListingFields>[0],
          labels,
          found.slug,
          row.attributes,
        );

        await prisma.$transaction([
          prisma.listing.update({
            where: { id: found.id },
            data: {
              title,
              description,
              price: row.price,
              city: row.city,
              neighborhood: row.neighborhood,
              ...derived,
            },
          }),
          prisma.listingAttribute.deleteMany({ where: { listingId: found.id } }),
          ...(attributeRows.length
            ? [
                prisma.listingAttribute.createMany({
                  data: attributeRows.map((r) => ({ ...r, listingId: found.id })),
                }),
              ]
            : []),
          // היסטוריית מחיר נרשמת רק כשהמחיר באמת השתנה
          ...(row.price !== null && row.price !== found.price
            ? [prisma.priceHistory.create({ data: { listingId: found.id, price: row.price } })]
            : []),
        ]);

        result.updated++;
        continue;
      }

      const slug = await uniqueSlug(title);
      const derived = await deriveListingFields(
        {
          categoryId: options.categoryId,
          title,
          description,
          price: row.price,
          city: row.city,
          neighborhood: row.neighborhood,
        } as Parameters<typeof deriveListingFields>[0],
        labels,
        slug,
        row.attributes,
      );

      const now = new Date();
      await prisma.listing.create({
        data: {
          slug,
          userId: options.userId,
          businessId: options.businessId,
          feedId: options.feedId ?? null,
          externalId: row.externalId,
          categoryId: options.categoryId,
          title,
          description,
          price: row.price,
          city: row.city,
          neighborhood: row.neighborhood,
          status: options.publish ? "ACTIVE" : "DRAFT",
          publishedAt: options.publish ? now : null,
          expiresAt: options.publish ? expiryDate(now) : null,
          ...derived,
          ...(row.images.length
            ? {
                images: {
                  create: row.images.map((url, i) => ({ url, order: i })),
                },
              }
            : {}),
          ...(attributeRows.length ? { attributes: { create: attributeRows } } : {}),
          ...(options.publish && row.price !== null
            ? { priceHistory: { create: { price: row.price } } }
            : {}),
        },
      });

      result.created++;
    } catch (err) {
      result.failures.push({
        externalId: row.externalId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

/**
 * מסמן כנמכרו מודעות **של הפיד** שנעלמו ממנו.
 *
 * מופעל רק כשהסוחר ביקש זאת, וכבוי כברירת מחדל: פיד שנקטע באמצע
 * ההורדה נראה בדיוק כמו פיד שבו נמכר כל המלאי, והתוצאה הייתה מחיקת
 * החנות כולה בגלל תקלת רשת. הסף למטה הוא ההגנה השנייה.
 */
export async function removeMissing(
  feedId: string,
  seenExternalIds: string[],
): Promise<number> {
  /*
   * מוגבל למודעות של **הפיד הזה** ולא של העסק.
   *
   * בלי ההגבלה, פיד של רכבים היה מסמן כנמכר את כל מלאי הדירות של אותו
   * סוחר, ואת כל מה שהועלה בהעלאה מרוכזת — כי לכולם יש `externalId`.
   * זה בדיוק מה שקרה בבדיקה הראשונה: הרצת פיד אחת מחקה שתי מודעות
   * שהגיעו מקובץ.
   */
  const total = await prisma.listing.count({
    where: { feedId, status: "ACTIVE", deletedAt: null },
  });
  if (!total) return 0;

  /*
   * אם הפיד מכיל פחות מחצי מהמלאי הפעיל, זו כמעט תמיד תקלה ולא מכירה
   * המונית. הריצה מדלגת על ההסרה ומדווחת — עדיף מלאי מיושן ליום אחד
   * מאשר חנות שנמחקה.
   */
  if (seenExternalIds.length * 2 < total) return 0;

  const { count } = await prisma.listing.updateMany({
    where: {
      feedId,
      status: "ACTIVE",
      deletedAt: null,
      externalId: { notIn: seenExternalIds },
    },
    data: { status: "SOLD" },
  });

  return count;
}
