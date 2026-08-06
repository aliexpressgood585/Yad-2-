import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError, handleError, ok, parseBody, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";
import { checkoutUrl, newReference, paymentsConfigured } from "@/lib/payments";
import { BOOST_PACKAGES } from "@/lib/site";
import { SITE } from "@/lib/site";

const schema = z.object({
  listingId: z.string().min(1),
  kind: z.enum(["BUMP", "HIGHLIGHT", "TOP_CATEGORY", "HOMEPAGE"]),
});

/**
 * רכישת חבילת קידום.
 *
 * **המחיר נקבע כאן ולא מגיע מהלקוח.** מה שמגיע בבקשה הוא בחירת
 * חבילה בלבד; הסכום נשלף מהקטלוג בשרת, אחרת אפשר לקנות חשיפה בשקל.
 *
 * כשיש ספק סליקה מוגדר נוצרת רשומת תשלום ומוחזרת כתובת דף הסליקה,
 * והקידום **אינו** מופעל — הוא מופעל רק אחרי אימות שרת-אל-שרת
 * ב-`/api/boosts/callback`. בלי ספק מוגדר (פיתוח) הקידום מופעל מיד,
 * וזה מסומן ביומן הביקורת כדי שלא ייראה כמו מכירה.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const { listingId, kind } = await parseBody(req, schema);

    const pkg = BOOST_PACKAGES.find((p) => p.kind === kind);
    if (!pkg) throw new ApiError(422, "חבילת הקידום אינה קיימת");

    const listing = await prisma.listing.findFirst({
      where: { id: listingId, userId: session.user.id, deletedAt: null },
      select: { id: true, slug: true, status: true, promotedUntil: true },
    });
    if (!listing) throw new ApiError(404, "המודעה לא נמצאה");
    if (listing.status !== "ACTIVE") {
      throw new ApiError(409, "ניתן לקדם מודעות פעילות בלבד");
    }

    /*
     * יש סליקה → יוצרים הזמנה ושולחים לתשלום. שום דבר לא מופעל כאן:
     * לקוח יכול לזייף כל מה שהוא שולח, כולל "שילמתי".
     */
    if (paymentsConfigured()) {
      const reference = newReference();
      await prisma.payment.create({
        data: {
          userId: session.user.id,
          reference,
          provider: process.env.PAYMENT_PROVIDER ?? "unknown",
          amountIls: pkg.priceIls,
          kind,
          listingId,
        },
      });

      const url = checkoutUrl({
        reference,
        amountIls: pkg.priceIls,
        description: `${pkg.name} — ${listing.slug}`,
        successUrl: `${SITE.url}/api/boosts/callback?ref=${reference}`,
        failureUrl: `${SITE.url}/my?boost=failed`,
        email: session.user.email ?? undefined,
      });

      return ok({ checkoutUrl: url, reference }, { status: 201 });
    }

    const now = new Date();
    // קידום קיים שעדיין בתוקף מוארך במקום להתחיל מחדש
    const start =
      listing.promotedUntil && listing.promotedUntil > now ? listing.promotedUntil : now;
    const endsAt = new Date(start.getTime() + pkg.days * 86_400_000);

    await prisma.$transaction([
      prisma.boost.create({
        data: {
          listingId,
          userId: session.user.id,
          kind,
          days: pkg.days,
          priceIls: pkg.priceIls,
          startsAt: now,
          endsAt,
        },
      }),
      prisma.listing.update({
        where: { id: listingId },
        data: {
          isPromoted: true,
          promotedUntil: endsAt,
          // רענון מודעה מקפיץ אותה גם לראש הרשימות
          ...(kind === "BUMP" ? { bumpedAt: now } : {}),
        },
      }),
      prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "listing.boost",
          entityType: "Listing",
          entityId: listingId,
          meta: { kind, days: pkg.days, priceIls: pkg.priceIls, unpaid: true },
        },
      }),
    ]);

    revalidatePath(`/item/${listing.slug}`);
    revalidatePath("/my");

    return ok({ boosted: true, until: endsAt.toISOString() }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
