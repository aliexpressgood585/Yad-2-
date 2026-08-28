import type { BoostKind, Order, Prisma } from "@prisma/client";

import { ApiError } from "@/lib/api";
import { prisma } from "@/lib/db";
import {
  SUBSCRIPTION_PERIOD_DAYS,
  VAT_RATE,
  planById,
  shekelsToAgorot,
  vatFromGross,
} from "@/lib/plans";
import { BOOST_PACKAGES } from "@/lib/site";
import { paymentProvider } from "@/lib/payments";

/**
 * הזמנות — כל תשלום באתר עובר דרכן.
 *
 * ## סדר הפעולות, ולמה הוא כזה
 *
 * ההזמנה נכתבת **לפני** הפנייה לספק הסליקה. תשובה שהולכת לאיבוד בדרך
 * חזרה משאירה הזמנה `PENDING` שאפשר לברר עליה מול הספק, ולא תשלום
 * שקרה ואיש במערכת אינו יודע עליו.
 *
 * ## מה נותן את מה שנקנה
 *
 * `fulfillOrder` הוא המקום היחיד שמפעיל קידום או פותח מנוי, והוא
 * **אידמפוטנטי**: הזמנה שכבר `PAID` יוצאת ממנו בלי לעשות דבר. ספקי
 * סליקה שולחים את אותו callback פעמיים בשגרה, ובלי ההגנה הזו קידום
 * של שבוע היה הופך לשבועיים על תשלום אחד.
 */

/** סכומי הזמנה מתוך מחיר לצרכן בשקלים. */
function amounts(priceIls: number) {
  const amountAgorot = shekelsToAgorot(priceIls);
  return {
    amountAgorot,
    vatAgorot: vatFromGross(amountAgorot, VAT_RATE),
    vatRate: VAT_RATE,
  };
}

export type CreateOrderInput =
  | { kind: "BOOST"; userId: string; listingId: string; boostKind: BoostKind }
  | { kind: "SUBSCRIPTION"; userId: string; businessId: string; planId: string };

/**
 * יוצר הזמנה במצב `PENDING`.
 *
 * זורק כשאין ספק סליקה מוגדר — **לפני** שנכתבת שורה. הזמנה שאי אפשר
 * לשלם עליה היא רק שורה שתקועה בתור לנצח, והיא נראית למשתמש כמו
 * חוב פתוח.
 */
export async function createOrder(input: CreateOrderInput): Promise<Order> {
  const provider = paymentProvider();
  if (!provider.isConfigured) {
    throw new ApiError(
      503,
      "התשלום אינו זמין כרגע. נסו שוב מאוחר יותר או פנו אלינו.",
      "PAYMENTS_UNAVAILABLE",
    );
  }

  if (input.kind === "BOOST") {
    const pkg = BOOST_PACKAGES.find((p) => p.kind === input.boostKind);
    if (!pkg) throw new ApiError(422, "חבילת הקידום אינה קיימת");

    const listing = await prisma.listing.findFirst({
      where: { id: input.listingId, userId: input.userId, deletedAt: null },
      select: { id: true, title: true, status: true },
    });
    if (!listing) throw new ApiError(404, "המודעה לא נמצאה");
    if (listing.status !== "ACTIVE") {
      throw new ApiError(409, "ניתן לקדם מודעות פעילות בלבד");
    }

    return prisma.order.create({
      data: {
        userId: input.userId,
        kind: "BOOST",
        listingId: input.listingId,
        boostKind: input.boostKind,
        description: `${pkg.name} — ${listing.title}`,
        provider: provider.id,
        ...amounts(pkg.priceIls),
      },
    });
  }

  const plan = planById(input.planId);
  if (!plan) throw new ApiError(422, "החבילה אינה קיימת");

  return prisma.order.create({
    data: {
      userId: input.businessId,
      kind: "SUBSCRIPTION",
      planId: plan.id,
      description: `מנוי ${plan.name} — ${SUBSCRIPTION_PERIOD_DAYS} ימים`,
      provider: provider.id,
      ...amounts(plan.priceIls),
    },
  });
}

/** מספר חשבונית: שנת ההנפקה ומספר ההזמנה. ייחודי לכל החיים. */
export function invoiceNumber(order: Pick<Order, "number">, issuedAt: Date): string {
  return `${issuedAt.getFullYear()}-${String(order.number).padStart(6, "0")}`;
}

/**
 * מסמן הזמנה כשולמה, מנפיק חשבונית, ומעניק את מה שנקנה.
 *
 * הכול בטרנזקציה אחת: מצב שבו ההזמנה `PAID` אבל הקידום לא הופעל הוא
 * בדיוק המצב שהמשתמש מתלונן עליו ואי אפשר לשחזר.
 *
 * מחזיר `false` כשההזמנה כבר הייתה משולמת — זו אינה שגיאה אלא המקרה
 * הרגיל של callback כפול.
 */
export async function fulfillOrder(
  orderId: string,
  options: { providerRef?: string | null; paidAt?: Date } = {},
): Promise<boolean> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { name: true, email: true } } },
  });
  if (!order) throw new ApiError(404, "ההזמנה לא נמצאה");
  if (order.status === "PAID") return false;

  const paidAt = options.paidAt ?? new Date();
  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.order.update({
      where: { id: order.id },
      data: {
        status: "PAID",
        paidAt,
        providerRef: options.providerRef ?? order.providerRef,
        failureReason: null,
      },
    }),
    prisma.invoice.create({
      data: {
        orderId: order.id,
        number: invoiceNumber(order, paidAt),
        issuedAt: paidAt,
        // מועתק ולא נקרא בזמן הצגה: חשבונית היא מסמך של רגע מסוים
        customerName: order.user.name,
        customerEmail: order.user.email,
        amountAgorot: order.amountAgorot,
        vatAgorot: order.vatAgorot,
        vatRate: order.vatRate,
      },
    }),
  ];

  if (order.kind === "BOOST" && order.listingId && order.boostKind) {
    const pkg = BOOST_PACKAGES.find((p) => p.kind === order.boostKind);
    if (!pkg) throw new ApiError(500, "חבילת הקידום של ההזמנה אינה קיימת יותר");

    const listing = await prisma.listing.findUnique({
      where: { id: order.listingId },
      select: { promotedUntil: true, slug: true },
    });

    // קידום שעדיין בתוקף מוארך במקום להתחיל מחדש
    const start =
      listing?.promotedUntil && listing.promotedUntil > paidAt ? listing.promotedUntil : paidAt;
    const endsAt = new Date(start.getTime() + pkg.days * 86_400_000);

    writes.push(
      prisma.boost.create({
        data: {
          listingId: order.listingId,
          userId: order.userId,
          kind: order.boostKind,
          days: pkg.days,
          priceIls: Math.round(order.amountAgorot / 100),
          startsAt: paidAt,
          endsAt,
        },
      }),
      prisma.listing.update({
        where: { id: order.listingId },
        data: {
          isPromoted: true,
          promotedUntil: endsAt,
          ...(order.boostKind === "BUMP" ? { bumpedAt: paidAt } : {}),
        },
      }),
    );
  }

  if (order.kind === "SUBSCRIPTION" && order.planId) {
    const existing = await prisma.subscription.findUnique({
      where: { businessId: order.userId },
      select: { currentPeriodEnd: true },
    });

    /*
     * חידוש ממשיך מסוף התקופה הקיימת ולא מהיום. סוחר שמשלם שלושה ימים
     * לפני שהמנוי נגמר אינו אמור לאבד אותם.
     */
    const start =
      existing?.currentPeriodEnd && existing.currentPeriodEnd > paidAt
        ? existing.currentPeriodEnd
        : paidAt;
    const end = new Date(start.getTime() + SUBSCRIPTION_PERIOD_DAYS * 86_400_000);

    writes.push(
      prisma.subscription.upsert({
        where: { businessId: order.userId },
        create: {
          businessId: order.userId,
          planId: order.planId,
          status: "ACTIVE",
          currentPeriodStart: paidAt,
          currentPeriodEnd: end,
        },
        update: {
          planId: order.planId,
          status: "ACTIVE",
          currentPeriodEnd: end,
          cancelAtPeriodEnd: false,
        },
      }),
    );
  }

  writes.push(
    prisma.auditLog.create({
      data: {
        actorId: order.userId,
        action: "order.paid",
        entityType: "Order",
        entityId: order.id,
        meta: {
          provider: order.provider,
          amountAgorot: order.amountAgorot,
          kind: order.kind,
        },
      },
    }),
  );

  await prisma.$transaction(writes);
  return true;
}

/** מסמן הזמנה ככושלת. אינו נוגע במה שנקנה, כי דבר לא הוענק. */
export async function failOrder(orderId: string, reason: string): Promise<void> {
  await prisma.order.updateMany({
    where: { id: orderId, status: "PENDING" },
    data: { status: "FAILED", failureReason: reason.slice(0, 300) },
  });
}

/**
 * החזר.
 *
 * מסמן את ההזמנה ומבטל את מה שהוענק — קידום נסגר, מנוי עובר
 * ל-`CANCELLED`. **החשבונית אינה נמחקת**: מסמך שהונפק אינו נעלם,
 * וביטול שלו הוא חשבונית זיכוי — שאינה נכנסת למערכת הזו כל עוד אין
 * סליקה אמיתית מאחוריה. מתועד ב-GROWTH.md.
 *
 * הזרימה מול הספק (החזר כספי בפועל) נעשית בממשק הספק, וכאן נרשם
 * המצב. במסלול ההעברה הבנקאית זו ממילא פעולה ידנית.
 */
export async function refundOrder(orderId: string, actorId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new ApiError(404, "ההזמנה לא נמצאה");
  if (order.status !== "PAID") throw new ApiError(409, "ניתן לזכות הזמנה משולמת בלבד");

  const writes: Prisma.PrismaPromise<unknown>[] = [
    prisma.order.update({ where: { id: order.id }, data: { status: "REFUNDED" } }),
    prisma.auditLog.create({
      data: {
        actorId,
        action: "order.refund",
        entityType: "Order",
        entityId: order.id,
        meta: { amountAgorot: order.amountAgorot },
      },
    }),
  ];

  if (order.kind === "BOOST" && order.listingId) {
    writes.push(
      prisma.listing.update({
        where: { id: order.listingId },
        data: { isPromoted: false, promotedUntil: null },
      }),
    );
  }

  if (order.kind === "SUBSCRIPTION") {
    writes.push(
      prisma.subscription.updateMany({
        where: { businessId: order.userId },
        data: { status: "CANCELLED", cancelAtPeriodEnd: true },
      }),
    );
  }

  await prisma.$transaction(writes);
}
