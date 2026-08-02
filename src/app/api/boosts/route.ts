import { revalidatePath } from "next/cache";
import { z } from "zod";

import { ApiError, handleError, ok, parseBody, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";
import { BOOST_PACKAGES } from "@/lib/site";

const schema = z.object({
  listingId: z.string().min(1),
  kind: z.enum(["BUMP", "HIGHLIGHT", "TOP_CATEGORY", "HOMEPAGE"]),
});

/**
 * הפעלת חבילת קידום. אין כאן סליקה — הזמנת הקידום נרשמת
 * והמודעה מסומנת כמקודמת עד לתאריך הסיום.
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
          meta: { kind, days: pkg.days, priceIls: pkg.priceIls },
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
