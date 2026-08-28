import { after } from "next/server";

import { handleError, ok, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";
import { deliverNow } from "@/lib/notification-queue";

/**
 * מספר ההתראות שלא נקראו — לתג בכותרת.
 *
 * הנתיב הזה גם מרוקן את התור של המשתמש, ב-`after` אחרי שהתשובה נשלחה.
 *
 * הסיבה מעשית: ב-Vercel בתוכנית החינם יש משימת cron יומית אחת בלבד
 * (`DECISIONS.md` §15), ולכן התראה שנדחתה בגלל שעות שקט הייתה מחכה עד
 * לריצה הבאה — כלומר עד יממה. משתמש שנכנס ללוח בבוקר אחרי הלילה מקבל
 * אותה מיד, ובלי אף מתזמן נוסף. התור עצמו מונע שליחה כפולה, ולכן אין
 * סכנה בכך ששני מקורות מרוקנים אותו.
 */
export async function GET() {
  try {
    const session = await requireSession();
    const unread = await prisma.notification.count({
      where: { userId: session.user.id, readAt: null },
    });

    const userId = session.user.id;
    after(() => deliverNow(userId));

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
