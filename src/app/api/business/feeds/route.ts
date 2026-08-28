import { z } from "zod";

import { ApiError, handleError, ok, parseBody, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/business";
import { runFeed } from "@/lib/feed-runner";

/*
 * `.url()` של zod מקבל גם `file://` ו-`gopher://`. הכתובת הזו מגיעה
 * מהסוחר והשרת שלנו הולך לפנות אליה, ולכן היא מוגבלת ל-http/https
 * כבר כאן ולא רק בזמן ההרצה: שגיאה בשמירה מסבירה מה לא בסדר, וכישלון
 * בהרצת הלילה מופיע כשורת "נכשל" יום אחרי.
 */
const feedUrl = z
  .string()
  .trim()
  .url("כתובת הפיד אינה תקינה")
  .refine((u) => /^https?:\/\//i.test(u), "כתובת הפיד חייבת להתחיל ב-http או ב-https");

const createSchema = z.object({
  name: z.string().trim().min(2).max(60),
  url: feedUrl,
  format: z.enum(["CSV", "XML"]).default("CSV"),
  categoryId: z.string().min(1),
  mapping: z.record(z.string()),
  removeMissing: z.boolean().default(false),
});

const updateSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(2).max(60).optional(),
  url: feedUrl.optional(),
  isActive: z.boolean().optional(),
  removeMissing: z.boolean().optional(),
  mapping: z.record(z.string()).optional(),
  /** הרצה מיידית, כדי שהסוחר לא יחכה למחר כדי לדעת שהמיפוי נכון */
  run: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const business = await requireBusiness(session.user.id, "importInventory");
    const input = await parseBody(req, createSchema);

    const category = await prisma.category.findUnique({
      where: { id: input.categoryId },
      select: { isActive: true, children: { select: { id: true }, take: 1 } },
    });
    if (!category?.isActive) throw new ApiError(422, "הקטגוריה שנבחרה אינה זמינה");
    if (category.children.length) {
      throw new ApiError(422, "יש לבחור תת-קטגוריה, לא קטגוריית אב");
    }

    const feed = await prisma.listingFeed.create({
      data: { ...input, businessId: business.businessId },
      select: { id: true, name: true },
    });

    return ok({ feed }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const business = await requireBusiness(session.user.id, "importInventory");
    const { id, run, ...data } = await parseBody(req, updateSchema);

    const feed = await prisma.listingFeed.findFirst({
      where: { id, businessId: business.businessId },
      select: { id: true },
    });
    if (!feed) throw new ApiError(404, "הפיד לא נמצא");

    if (Object.keys(data).length) {
      await prisma.listingFeed.update({ where: { id: feed.id }, data });
    }

    const outcome = run ? await runFeed(feed.id) : null;
    return ok({ updated: true, run: outcome });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    const business = await requireBusiness(session.user.id, "importInventory");
    const { id } = await parseBody(req, z.object({ id: z.string().min(1) }));

    /*
     * מחיקת פיד אינה מוחקת את המודעות שהוא יצר. הן מלאי אמיתי שמוצג
     * בלוח, והסוחר שמפסיק להשתמש בפיד אינו מבקש למחוק את החנות שלו.
     */
    const { count } = await prisma.listingFeed.deleteMany({
      where: { id, businessId: business.businessId },
    });
    if (!count) throw new ApiError(404, "הפיד לא נמצא");

    return ok({ deleted: true });
  } catch (err) {
    return handleError(err);
  }
}
