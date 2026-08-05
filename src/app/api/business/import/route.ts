import { ApiError, enforceRateLimit, handleError, ok, requireSession } from "@/lib/api";
import { getCategoryBySlug } from "@/lib/categories";
import { prisma } from "@/lib/db";
import { findDuplicates, parseImport, type RowError } from "@/lib/dealer-import";
import { expiryDate, uniqueSlug } from "@/lib/listing-write";
import { sanitizeText } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * כמה שורות מותר בקובץ אחד.
 *
 * הגבול קיים כדי שבקשה אחת לא תרוץ דקות ולא תיפול באמצע ותשאיר חצי
 * מלאי באוויר. סוחר עם יותר מזה מייבא בשני קבצים, וזה מחיר סביר מול
 * ייבוא שנקטע ואי אפשר לדעת מה נוצר ומה לא.
 */
const MAX_ROWS = 200;

/**
 * ייבוא מרוכז לסוחרים.
 *
 * **`commit: false` הוא ברירת המחדל, ובכוונה.** ייבוא הוא פעולה שקשה
 * לבטל, ו-80 מודעות שגויות באוויר הן נזק אמיתי למוניטין של הסוחר.
 * הלקוח חייב לבקש יצירה במפורש, אחרי שראה בדיוק מה ייווצר.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    await enforceRateLimit("publish", session.user.id);

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { businessName: true, phone: true, verifiedAt: true },
    });

    if (!user?.businessName) {
      throw new ApiError(403, "ייבוא מרוכז זמין לחשבונות עסקיים בלבד");
    }
    if (!user.verifiedAt) {
      throw new ApiError(403, "יש לאמת מספר טלפון לפני ייבוא מודעות");
    }

    const body = (await req.json()) as { csv?: string; commit?: boolean };
    const csv = typeof body.csv === "string" ? body.csv : "";
    if (!csv.trim()) throw new ApiError(422, "לא התקבל תוכן לייבוא");

    const parsed = parseImport(csv);
    const duplicates = findDuplicates(parsed.rows);
    const errors: RowError[] = [...parsed.errors, ...duplicates];

    // שורה שסומנה ככפילות אינה נוצרת, אבל שאר הקובץ כן
    const duplicateLines = new Set(duplicates.map((d) => d.line));
    const usable = parsed.rows.filter((r) => !duplicateLines.has(r.line));

    if (usable.length > MAX_ROWS) {
      throw new ApiError(422, `הקובץ מכיל ${usable.length} שורות. המקסימום הוא ${MAX_ROWS}.`);
    }

    if (!body.commit) {
      return ok({
        preview: true,
        willCreate: usable.length,
        rejected: parsed.rows.length - usable.length + countRejectedLines(parsed.errors),
        rows: usable.slice(0, 50),
        errors,
        columns: parsed.columns,
      });
    }

    if (usable.length === 0) {
      throw new ApiError(422, "אין שורות תקינות לייבוא");
    }

    /*
     * הקטגוריה נפתרת פעם אחת לכל slug ולא לכל שורה. קובץ של 200 רכבים
     * מכיל את אותה קטגוריה 200 פעם, וזה ההבדל בין שאילתה אחת ל-200.
     */
    const slugs = [...new Set(usable.map((r) => r.categorySlug).filter(Boolean))] as string[];
    const categories = new Map<string, string>();
    for (const slug of slugs) {
      const cat = await getCategoryBySlug(slug);
      if (cat) categories.set(slug, cat.id);
    }

    const created: { line: number; slug: string }[] = [];
    const failures: RowError[] = [];

    for (const row of usable) {
      const categoryId = row.categorySlug ? categories.get(row.categorySlug) : undefined;
      if (!categoryId) {
        failures.push({
          line: row.line,
          column: "קטגוריה",
          message: `הקטגוריה "${row.categorySlug ?? ""}" לא נמצאה`,
        });
        continue;
      }

      /*
       * כל שורה נוצרת בנפרד ולא בטרנזקציה אחת גדולה.
       *
       * שורה שנכשלת בגלל התנגשות slug או מאפיין לא חוקי לא צריכה לבטל
       * 199 מודעות תקינות שכבר נוצרו — הסוחר יעדיף 199 באוויר ורשימה
       * של אחת לתיקון על פני כלום ואותה רשימה.
       */
      try {
        const listing = await prisma.listing.create({
          data: {
            userId: session.user.id,
            categoryId,
            title: sanitizeText(row.title),
            description: sanitizeText(row.description),
            slug: await uniqueSlug(row.title),
            price: row.price,
            city: row.city,
            neighborhood: row.neighborhood ?? null,
            contactPhone: row.phone ?? user.phone,
            status: "ACTIVE",
            publishedAt: new Date(),
            expiresAt: expiryDate(),
          },
          select: { slug: true },
        });
        created.push({ line: row.line, slug: listing.slug });
      } catch (err) {
        failures.push({
          line: row.line,
          column: "",
          message: err instanceof Error ? err.message : "יצירת המודעה נכשלה",
        });
      }
    }

    return ok({
      preview: false,
      created: created.length,
      failed: failures.length,
      errors: [...errors, ...failures],
      slugs: created.map((c) => c.slug),
    });
  } catch (err) {
    return handleError(err);
  }
}

/** כמה שורות ייחודיות נדחו, ולא כמה שגיאות היו — לשורה אחת יכולות להיות שלוש. */
function countRejectedLines(errors: RowError[]): number {
  return new Set(errors.map((e) => e.line)).size;
}
