import { handleError, requireSession, ApiError } from "@/lib/api";
import { requireBusiness } from "@/lib/business";
import { attributeSpecsFor } from "@/lib/feed-import";
import { sampleCsv } from "@/lib/feed";

/**
 * קובץ CSV לדוגמה לקטגוריה נתונה.
 *
 * נבנה מהשדות בפועל ולא מקובץ סטטי: קטגוריה שנוספה או שדה חובה שהשתנה
 * מופיעים בו מיד, ותבנית שמתיישנת היא בדיוק מה שגורם לסוחר להעלות
 * קובץ שנדחה כולו.
 *
 * ה-BOM בהתחלה הוא בשביל אקסל: בלעדיו הוא פותח עברית ב-UTF-8 כג׳יבריש.
 */
export async function GET(req: Request) {
  try {
    const session = await requireSession();
    await requireBusiness(session.user.id, "importInventory");

    const categoryId = new URL(req.url).searchParams.get("categoryId");
    if (!categoryId) throw new ApiError(422, "חסרה קטגוריה");

    const specs = await attributeSpecsFor(categoryId);
    const csv = `﻿${sampleCsv(specs)}`;

    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="luach-template.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
