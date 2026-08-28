import { z } from "zod";

import { ApiError, enforceRateLimit, handleError, ok, parseBody, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/business";
import { entitlementFor } from "@/lib/entitlements";
import { guessMapping, mapRows, parseFeed, type FeedMapping } from "@/lib/feed";
import { attributeSpecsFor, importRows } from "@/lib/feed-import";

/** תקרת גודל לקובץ שמועלה. מעבר לזה זו כבר עבודה לפיד. */
const MAX_CHARS = 5 * 1024 * 1024;

const previewSchema = z.object({
  mode: z.literal("preview"),
  categoryId: z.string().min(1),
  format: z.enum(["CSV", "XML"]).default("CSV"),
  content: z.string().min(1).max(MAX_CHARS),
  /** מיפוי ידני. כשחסר — מנוחש מהכותרות. */
  mapping: z.record(z.string()).optional(),
});

const commitSchema = z.object({
  mode: z.literal("commit"),
  categoryId: z.string().min(1),
  format: z.enum(["CSV", "XML"]).default("CSV"),
  content: z.string().min(1).max(MAX_CHARS),
  mapping: z.record(z.string()),
  /** לפרסם מיד או להשאיר כטיוטות */
  publish: z.boolean().default(false),
});

const bodySchema = z.discriminatedUnion("mode", [previewSchema, commitSchema]);

/**
 * העלאה מרוכזת.
 *
 * שני שלבים ולא אחד, וזה העיקר: **`preview` אינו כותב דבר.** הסוחר
 * רואה את המיפוי שנוחש, את השורות שיתקבלו ואת השורות שנפלו — עם מספר
 * השורה בקובץ ועם הסיבה — ורק אז מאשר. מסך שכותב מאתיים מודעות ואז
 * מספר על שלוש שגיאות הוא מסך שאי אפשר לתקן בו כלום.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const business = await requireBusiness(session.user.id, "importInventory");
    const body = await parseBody(req, bodySchema);

    const category = await prisma.category.findUnique({
      where: { id: body.categoryId },
      select: { id: true, isActive: true, children: { select: { id: true }, take: 1 } },
    });
    if (!category?.isActive) throw new ApiError(422, "הקטגוריה שנבחרה אינה זמינה");
    if (category.children.length) {
      throw new ApiError(422, "יש לבחור תת-קטגוריה, לא קטגוריית אב");
    }

    const table = parseFeed(body.content, body.format);
    if (table.length < 2) {
      throw new ApiError(422, "לא זוהו שורות בקובץ. ודאו שהוא CSV עם שורת כותרות.");
    }

    const specs = await attributeSpecsFor(body.categoryId);
    const headers = table[0] ?? [];

    const mapping: FeedMapping =
      body.mode === "commit"
        ? body.mapping
        : (body.mapping ?? guessMapping(headers, specs.map((s) => ({ key: s.key, label: s.label }))));

    const { rows, errors } = mapRows(table, mapping, specs);

    if (body.mode === "preview") {
      return ok({
        headers,
        mapping,
        total: table.length - 1,
        accepted: rows.length,
        // עשר שורות ראשונות בלבד — התצוגה המקדימה נועדה לאמת מיפוי,
        // לא להעביר את הקובץ פעמיים ברשת
        sample: rows.slice(0, 10),
        errors: errors.slice(0, 50),
        errorCount: errors.length,
      });
    }

    if (!rows.length) {
      throw new ApiError(422, "אף שורה בקובץ לא עברה אימות");
    }

    await enforceRateLimit("publish", session.user.id);

    /*
     * ייבוא שמפרסם מייד נבדק מול המכסה **לפני** הכתיבה, ובכמות: קובץ
     * של 300 מודעות אינו אמור לעבור 299 פעמים ולהיכשל באחרונה.
     */
    if (body.publish) {
      const entitlement = await entitlementFor(business.businessId);
      if (entitlement.quota !== null && entitlement.used + rows.length > entitlement.quota) {
        throw new ApiError(
          402,
          `הייבוא יעבור את מכסת החנות (${entitlement.quota} מודעות פעילות; כרגע ${entitlement.used}). אפשר לייבא כטיוטות או לשדרג את החבילה.`,
          "QUOTA_EXCEEDED",
        );
      }
    }

    const result = await importRows(rows, {
      businessId: business.businessId,
      userId: session.user.id,
      categoryId: body.categoryId,
      publish: body.publish,
    });

    return ok({ ...result, rejected: errors.length });
  } catch (err) {
    return handleError(err);
  }
}
