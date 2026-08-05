import { auth } from "@/lib/auth";
import { ApiError, enforceRateLimit, getClientIp, handleError, ok } from "@/lib/api";
import { canAsk } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { enqueue } from "@/lib/notify-queue";

export const dynamic = "force-dynamic";

/**
 * זמינות מודעה — "עדיין רלוונטי?"
 *
 * `ask`     — קונה מבקש מהמוכר לאשר. פתוח גם למי שאינו מחובר.
 * `confirm` — המוכר מאשר. בעל המודעה בלבד.
 *
 * **הבקשה פתוחה לאנונימיים בכוונה.** מי ששואל "עדיין רלוונטי?" עדיין
 * לא החליט אם הוא רוצה את הפריט, ולדרוש ממנו הרשמה בשביל השאלה הזו
 * פירושו שהוא פשוט יכתוב הודעה — כלומר בדיוק מה שהפיצ'ר בא למנוע.
 * ההגנה היא צינון ברמת המודעה והגבלת קצב לפי IP, לא חשבון.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await auth();
    const body = (await req.json().catch(() => ({}))) as { action?: string };
    const action = body.action === "confirm" ? "confirm" : "ask";

    const listing = await prisma.listing.findFirst({
      where: { id, deletedAt: null, status: "ACTIVE" },
      select: {
        id: true,
        userId: true,
        title: true,
        availabilityAt: true,
        availabilityAskedAt: true,
      },
    });
    if (!listing) throw new ApiError(404, "המודעה לא נמצאה");

    if (action === "confirm") {
      if (!session?.user?.id || session.user.id !== listing.userId) {
        throw new ApiError(403, "רק בעל המודעה יכול לאשר זמינות");
      }

      const now = new Date();
      await prisma.listing.update({
        where: { id },
        data: { availabilityAt: now },
      });

      return ok({ confirmed: true, availabilityAt: now.toISOString() });
    }

    // --- ask ---

    if (session?.user?.id === listing.userId) {
      throw new ApiError(400, "זו המודעה שלך");
    }

    await enforceRateLimit("message", session?.user?.id ?? (await getClientIp()));

    const gate = canAsk(listing.availabilityAskedAt);
    if (!gate.allowed) {
      /*
       * לא שגיאה. מישהו כבר שאל היום, והמוכר כבר קיבל את הבקשה —
       * מבחינת הקונה השואל, המצב זהה לחלוטין לבקשה שנשלחה עכשיו.
       * להחזיר כאן 429 היה מעניש אותו על מזלו הרע בתזמון.
       */
      return ok({ asked: true, alreadyAsked: true, hoursLeft: gate.hoursLeft });
    }

    await prisma.listing.update({
      where: { id },
      data: { availabilityAskedAt: new Date() },
    });

    /*
     * מפתח הכפילות כולל את היום, ולכן בקשות מאותו יום מתקבצות
     * להתראה אחת — גם אם הצינון היה מתאפס.
     */
    const day = new Date().toISOString().slice(0, 10);
    await enqueue({
      userId: listing.userId,
      kind: "SYSTEM",
      dedupeKey: `availability:${listing.id}:${day}`,
      payload: {
        title: "שאלו אם המודעה עדיין רלוונטית",
        body: `מישהו מתעניין ב"${listing.title}". אישור בלחיצה אחת מראה לכל הקונים שהמודעה מעודכנת.`,
        url: "/my",
        itemLabel: listing.title,
      },
    });

    return ok({ asked: true, alreadyAsked: false });
  } catch (err) {
    return handleError(err);
  }
}
