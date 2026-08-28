import { z } from "zod";

import { handleError, ok, parseBody, requireAdmin } from "@/lib/api";
import { fulfillOrder, refundOrder } from "@/lib/orders";
import { prisma } from "@/lib/db";

const schema = z.object({
  orderId: z.string().min(1),
  action: z.enum(["mark-paid", "refund", "cancel"]),
  /** אסמכתת ההעברה הבנקאית, כשמאשרים ידנית */
  reference: z.string().trim().max(120).optional(),
});

/**
 * אישור וזיכוי של הזמנות במסך הניהול.
 *
 * זה המסלול שהופך העברה בנקאית לתשלום: מנהל שראה את הכסף בבנק מסמן
 * את ההזמנה. **הפעולה נרשמת ב-`AuditLog` עם מי אישר ומתי** — אישור
 * ידני שאין לו עקבות הוא בדיוק המקום שבו כסף נעלם.
 */
export async function PATCH(req: Request) {
  try {
    const session = await requireAdmin();
    const { orderId, action, reference } = await parseBody(req, schema);

    if (action === "mark-paid") {
      const applied = await fulfillOrder(orderId, { providerRef: reference ?? null });
      await prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "order.mark_paid",
          entityType: "Order",
          entityId: orderId,
          meta: { reference: reference ?? null, applied },
        },
      });
      return ok({ applied });
    }

    if (action === "refund") {
      await refundOrder(orderId, session.user.id);
      return ok({ refunded: true });
    }

    await prisma.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "CANCELLED" },
    });
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "order.cancel",
        entityType: "Order",
        entityId: orderId,
      },
    });
    return ok({ cancelled: true });
  } catch (err) {
    return handleError(err);
  }
}
