import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { verifyPayment } from "@/lib/payments";
import { BOOST_PACKAGES, SITE } from "@/lib/site";

/**
 * חזרה מדף הסליקה.
 *
 * **הפרמטרים בכתובת אינם ראיה לתשלום.** כל אחד יכול לפתוח את הכתובת
 * הזאת עם `ref` של מישהו אחר. מה שקובע הוא `verifyPayment`, שמדבר
 * עם הספק ישירות ומשווה גם את הסכום.
 *
 * הפעולה אידמפוטנטית: לחיצה על "רענון" בדף החזרה לא תקנה קידום
 * פעמיים, כי תשלום שכבר סומן `PAID` מדלג על ההפעלה.
 */
export async function GET(req: Request) {
  const reference = new URL(req.url).searchParams.get("ref");
  const back = (status: string) => NextResponse.redirect(`${SITE.url}/my?boost=${status}`);

  if (!reference) return back("failed");

  const payment = await prisma.payment.findUnique({ where: { reference } });
  if (!payment) return back("failed");
  if (payment.status === "PAID") return back("ok");

  const result = await verifyPayment(reference, payment.amountIls);

  if (!result.paid) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: { status: "FAILED", raw: { reason: result.reason } },
    });
    return back("failed");
  }

  const pkg = BOOST_PACKAGES.find((p) => p.kind === payment.kind);
  if (!pkg) return back("failed");

  const listing = await prisma.listing.findUnique({
    where: { id: payment.listingId },
    select: { id: true, slug: true, promotedUntil: true },
  });
  if (!listing) return back("failed");

  const now = new Date();
  // קידום שעדיין בתוקף מוארך במקום להתחיל מחדש
  const start = listing.promotedUntil && listing.promotedUntil > now ? listing.promotedUntil : now;
  const endsAt = new Date(start.getTime() + pkg.days * 86_400_000);

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: "PAID",
        paidAt: now,
        externalId: result.externalId,
        raw: result.raw as never,
      },
    }),
    prisma.boost.create({
      data: {
        listingId: listing.id,
        userId: payment.userId,
        kind: payment.kind,
        days: pkg.days,
        priceIls: pkg.priceIls,
        startsAt: now,
        endsAt,
        paymentId: payment.id,
      },
    }),
    prisma.listing.update({
      where: { id: listing.id },
      data: {
        isPromoted: true,
        promotedUntil: endsAt,
        ...(payment.kind === "BUMP" ? { bumpedAt: now } : {}),
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId: payment.userId,
        action: "listing.boost.paid",
        entityType: "Listing",
        entityId: listing.id,
        meta: { kind: payment.kind, priceIls: pkg.priceIls, reference },
      },
    }),
  ]);

  revalidatePath(`/item/${listing.slug}`);
  revalidatePath("/my");
  return back("ok");
}
