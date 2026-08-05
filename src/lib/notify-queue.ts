import type { NotificationType, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { nextAllowedTime, isQuiet } from "@/lib/quiet-hours";

/**
 * תור ההתראות.
 *
 * כל טריגר **מכניס לתור** ולא שולח. הסיבה כפולה:
 *
 *   1. שליחה נכשלת. שירות דוא"ל או Push שנופל בשליחה ישירה פירושו
 *      התראה שאבדה בשקט.
 *   2. cron רץ פעמיים. שליחה ישירה פירושה התראה כפולה, וזה פוגע
 *      באמון יותר מהתראה שאיחרה.
 *
 * התור פותר את שניהם: `dedupeKey` ייחודי במסד חוסם כפילות גם בין שתי
 * הרצות מקבילות, ועבודה שנכשלה חוזרת עם השהיה גדלה עד `MAX_ATTEMPTS`.
 */

/** אחרי שלושה כשלונות העבודה מסומנת FAILED ולא נוסה עוד. */
export const MAX_ATTEMPTS = 3;

/** כמה עבודות לעבד בהרצה אחת. תואם ל-`maxDuration` של ה-cron. */
const BATCH = 200;

/** השהיה לפני ניסיון נוסף: 5 דקות, 25 דקות, ואז ויתור. */
export function backoffMinutes(attempts: number): number {
  return 5 * 5 ** (attempts - 1);
}

export type JobPayload = {
  title: string;
  body: string;
  url?: string;
  /** האם לשלוח גם דוא"ל. Push נשלח תמיד. */
  email?: boolean;
  /** תיאור קצר של הפריט, לשימוש בקיבוץ */
  itemLabel?: string;
};

/**
 * הכנסת עבודה לתור.
 *
 * `dedupeKey` הוא מזהה לוגי של האירוע — למשל
 * `saved-search:<id>:<listingId>`. עבודה שכבר קיימת עם אותו מפתח לא
 * נוצרת שוב, וזה נאכף באינדקס ייחודי במסד ולא בבדיקה בקוד: שתי הרצות
 * במקביל יכולות שתיהן לעבור בדיקת "האם כבר קיים" לפני שאחת כתבה.
 *
 * העבודה מתוזמנת מיד לזמן המותר הבא. חישוב שעות השקט קורה כאן ולא
 * בשליחה, כדי שאפשר יהיה לראות בתור מתי כל התראה אמורה לצאת.
 */
export async function enqueue(input: {
  userId: string;
  kind: NotificationType;
  dedupeKey: string;
  payload: JobPayload;
  /** לא לפני הזמן הזה, גם אם הוא זמן מותר */
  notBefore?: Date;
}): Promise<boolean> {
  const base = input.notBefore ?? new Date();

  try {
    await prisma.notificationJob.create({
      data: {
        userId: input.userId,
        kind: input.kind,
        dedupeKey: input.dedupeKey,
        payload: input.payload as unknown as Prisma.InputJsonValue,
        runAfter: nextAllowedTime(base),
      },
    });
    return true;
  } catch (err) {
    // P2002 — המפתח קיים, כלומר האירוע הזה כבר בתור. זו הצלחה, לא שגיאה.
    if (isUniqueViolation(err)) return false;
    throw err;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { code?: string }).code === "P2002"
  );
}

export type QueueResult = {
  claimed: number;
  sent: number;
  grouped: number;
  deferred: number;
  failed: number;
};

/**
 * מריץ את התור.
 *
 * שלושה שלבים:
 *
 *   1. **תפיסה** — העבודות הבשלות נמשכות ומספר הניסיונות שלהן עולה
 *      *לפני* השליחה. עבודה שהתהליך נפל באמצע הטיפול בה תיראה בהרצה
 *      הבאה כמי שנוסתה, ולא תיתפס בלופ אינסופי.
 *   2. **קיבוץ** — עבודות מאותו סוג לאותו משתמש הופכות להתראה אחת.
 *   3. **שליחה** — ואז סימון כ-SENT, או השהיה עם backoff.
 */
export async function runQueue(now = new Date()): Promise<QueueResult> {
  const result: QueueResult = { claimed: 0, sent: 0, grouped: 0, deferred: 0, failed: 0 };

  /*
   * שעת שקט שנכנסה אחרי התזמון — למשל שבת שנכנסה בזמן שהעבודה חיכתה.
   * ההרצה מסתיימת בלי לשלוח דבר; העבודות יישארו בתור להרצה הבאה.
   */
  if (isQuiet(now)) return result;

  const due = await prisma.notificationJob.findMany({
    where: { state: "PENDING", runAfter: { lte: now }, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: "asc" },
    take: BATCH,
  });
  if (due.length === 0) return result;

  result.claimed = due.length;

  await prisma.notificationJob.updateMany({
    where: { id: { in: due.map((j) => j.id) } },
    data: { attempts: { increment: 1 } },
  });

  // קיבוץ לפי (משתמש, סוג)
  const groups = new Map<string, typeof due>();
  for (const job of due) {
    const key = `${job.userId}::${job.kind}`;
    const list = groups.get(key);
    if (list) list.push(job);
    else groups.set(key, [job]);
  }

  for (const jobs of groups.values()) {
    const first = jobs[0]!;
    const payloads = jobs.map((j) => j.payload as unknown as JobPayload);
    const message = groupMessage(first.kind, payloads);

    if (jobs.length > 1) result.grouped += jobs.length;

    try {
      await createNotification({
        userId: first.userId,
        type: first.kind,
        title: message.title,
        body: message.body,
        url: message.url,
        email: payloads.some((p) => p.email),
      });

      await prisma.notificationJob.updateMany({
        where: { id: { in: jobs.map((j) => j.id) } },
        data: { state: "SENT", sentAt: new Date(), lastError: null },
      });
      result.sent += jobs.length;
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const attempts = first.attempts + 1;

      if (attempts >= MAX_ATTEMPTS) {
        await prisma.notificationJob.updateMany({
          where: { id: { in: jobs.map((j) => j.id) } },
          data: { state: "FAILED", lastError: reason },
        });
        result.failed += jobs.length;
      } else {
        await prisma.notificationJob.updateMany({
          where: { id: { in: jobs.map((j) => j.id) } },
          data: {
            runAfter: nextAllowedTime(
              new Date(now.getTime() + backoffMinutes(attempts) * 60_000),
            ),
            lastError: reason,
          },
        });
        result.deferred += jobs.length;
      }
    }
  }

  return result;
}

/**
 * הודעה אחת מכמה עבודות.
 *
 * התראה נפרדת לכל אירוע היא מה שגורם לאדם לכבות התראות לגמרי. שש
 * הודעות "מודעה חדשה בחיפוש השמור" הן שש סיבות לכבות; אחת שאומרת
 * "6 מודעות חדשות" היא סיבה להיכנס.
 *
 * הקישור של קבוצה מצביע לרשימה ולא לפריט הראשון — הפריט הראשון הוא
 * בחירה שרירותית, והמשתמש התכוון לראות את כולם.
 */
export function groupMessage(
  kind: NotificationType,
  payloads: JobPayload[],
): { title: string; body: string; url?: string } {
  const first = payloads[0]!;
  if (payloads.length === 1) return { title: first.title, body: first.body, url: first.url };

  const n = payloads.length;
  const labels = payloads
    .map((p) => p.itemLabel)
    .filter((l): l is string => Boolean(l))
    .slice(0, 3);

  const tail = labels.length ? `${labels.join(" · ")}${n > labels.length ? " ועוד" : ""}` : "";

  switch (kind) {
    case "NEW_MESSAGE":
      return {
        title: `${n} הודעות חדשות`,
        body: tail || `התקבלו ${n} הודעות חדשות בשיחות שלך.`,
        url: "/my/messages",
      };
    case "SAVED_SEARCH_MATCH":
      return {
        title: `${n} מודעות חדשות בחיפושים השמורים`,
        body: tail || `נמצאו ${n} מודעות חדשות שמתאימות לחיפושים ששמרת.`,
        url: "/my/searches",
      };
    case "PRICE_DROP":
      return {
        title: `ירידת מחיר ב-${n} מודעות שמורות`,
        body: tail || `${n} מודעות שסימנת ירדו במחיר.`,
        url: "/my/favorites",
      };
    case "LISTING_EXPIRING":
      return {
        title: `${n} מודעות שלך עומדות לפוג`,
        body: tail || `${n} מודעות יפוגו בימים הקרובים.`,
        url: "/my/listings",
      };
    default:
      return {
        title: `${n} עדכונים חדשים`,
        body: tail || `יש לך ${n} עדכונים חדשים.`,
        url: "/my",
      };
  }
}

/**
 * ירידת מחיר במודעה — מתריע לכל מי שסימן אותה במועדפים.
 *
 * מוגדר כאן ולא בנתיב ה-API כי הוא צריך את `enqueue`, ומפני שהכלל
 * שלו הוא כלל מוצר ולא פרט טכני: **רק ירידה מתריעה.** עלייה במחיר
 * אינה חדשה שמישהו ביקש לשמוע, והתראה עליה הופכת את המועדפים ממעקב
 * אחרי הזדמנויות לרעש שמכבים.
 *
 * המפתח כולל את המחיר החדש, ולכן ירידה נוספת מתריעה שוב אבל אותה
 * ירידה לא מתריעה פעמיים.
 */
export async function notifyPriceDrop(input: {
  listingId: string;
  listingTitle: string;
  oldPrice: number;
  newPrice: number;
  currency: string;
}): Promise<number> {
  const favorites = await prisma.favorite.findMany({
    where: { listingId: input.listingId },
    select: { userId: true },
    take: 2000,
  });
  if (favorites.length === 0) return 0;

  const dropPct = Math.round(((input.oldPrice - input.newPrice) / input.oldPrice) * 100);
  const { formatPrice } = await import("@/lib/format");

  let queued = 0;
  for (const fav of favorites) {
    const created = await enqueue({
      userId: fav.userId,
      kind: "PRICE_DROP",
      dedupeKey: `price-drop:${input.listingId}:${fav.userId}:${input.newPrice}`,
      payload: {
        title: `ירידת מחיר: ${input.listingTitle}`,
        body: `המחיר ירד ב-${dropPct}% — מ-${formatPrice(input.oldPrice, {
          currency: input.currency,
        })} ל-${formatPrice(input.newPrice, { currency: input.currency })}.`,
        url: "/my/favorites",
        itemLabel: input.listingTitle,
        email: true,
      },
    });
    if (created) queued += 1;
  }

  return queued;
}
