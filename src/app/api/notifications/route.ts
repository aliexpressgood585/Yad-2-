import { handleError, ok, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";

/** מספר ההתראות שלא נקראו — לתג בכותרת. */
export async function GET() {
  try {
    const session = await requireSession();
    const unread = await prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    });
    return ok({ unread });
  } catch (err) {
    return handleError(err);
  }
}

/** סימון כל ההתראות כנקראו. */
export async function PATCH() {
  try {
    const session = await requireSession();
    const result = await prisma.notification.updateMany({
      where: { userId: session.user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return ok({ updated: result.count });
  } catch (err) {
    return handleError(err);
  }
}
