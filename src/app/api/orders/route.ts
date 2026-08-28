import { z } from "zod";

import { ApiError, handleError, ok, parseBody, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";
import { activeMembership } from "@/lib/business";
import { createOrder } from "@/lib/orders";
import { paymentProvider } from "@/lib/payments";
import { SITE } from "@/lib/site";

const schema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("BOOST"),
    listingId: z.string().min(1),
    boostKind: z.enum(["BUMP", "HIGHLIGHT", "TOP_CATEGORY", "HOMEPAGE"]),
  }),
  z.object({ kind: z.literal("SUBSCRIPTION"), planId: z.string().min(1) }),
]);

/**
 * פתיחת תשלום.
 *
 * ההזמנה נכתבת קודם והספק נקרא אחריה, ולא להפך: תשובה שהולכת לאיבוד
 * בדרך חזרה משאירה הזמנה `PENDING` שאפשר לברר עליה, ולא תשלום שקרה
 * ואיש אינו יודע עליו.
 *
 * מה שהמסך מקבל הוא או כתובת להפניה או הוראות תשלום, לפי הספק. שום
 * מסלול כאן אינו מחזיר "שולם" — ההזמנה הופכת ל-`PAID` רק דרך
 * `fulfillOrder`, שנקרא מאישור של הספק או מאישור של מנהל.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const input = await parseBody(req, schema);

    let order;
    if (input.kind === "BOOST") {
      order = await createOrder({
        kind: "BOOST",
        userId: session.user.id,
        listingId: input.listingId,
        boostKind: input.boostKind,
      });
    } else {
      const membership = await activeMembership(session.user.id);
      if (!membership) {
        throw new ApiError(403, "מנוי סוחר זמין לחשבונות עסקיים בלבד", "NOT_A_BUSINESS");
      }
      if (membership.role !== "OWNER") {
        throw new ApiError(403, "רק בעל העסק יכול לרכוש מנוי", "FORBIDDEN");
      }
      order = await createOrder({
        kind: "SUBSCRIPTION",
        userId: session.user.id,
        businessId: membership.businessId,
        planId: input.planId,
      });
    }

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: order.userId },
      select: { name: true, email: true, phone: true },
    });

    const provider = paymentProvider();
    const checkout = await provider.createCheckout({
      order,
      customer: user,
      returnUrl: `${SITE.url}/my/orders/${order.id}`,
      cancelUrl: `${SITE.url}/my/orders/${order.id}?cancelled=1`,
      callbackUrl: `${SITE.url}/api/payments/callback/${provider.id}`,
    });

    if (checkout.providerRef) {
      await prisma.order.update({
        where: { id: order.id },
        data: { providerRef: checkout.providerRef },
      });
    }

    return ok({ orderId: order.id, number: order.number, checkout }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}
