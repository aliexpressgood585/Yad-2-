import { randomUUID } from "crypto";

import type { NotificationType, Prisma } from "@prisma/client";

import { createNotification } from "@/lib/notifications";
import { prisma } from "@/lib/db";
import { nextAllowedTime } from "@/lib/quiet-hours";
import { formatCount, formatPrice } from "@/lib/format";
import { truncate } from "@/lib/utils";

/**
 * תור ההתראות.
 *
 * הבעיה שהוא פותר אינה טכנית אלא התנהגותית: **אדם שמקבל שש התראות
 * ביום מכבה אותן**, ואז כל הערוץ אבד — כולל ההתראה השביעית שבאמת
 * הייתה חשובה לו. לכן אירועים נאספים לתור, והתור מחליט מה נשלח, מתי,
 * וכמה הודעות זה יהיה בסך הכול.
 *
 * ארבע ההבטחות:
 *
 *   **לא נשלח פעמיים** — `dedupeKey` הוא `@unique` וההכנסה היא
 *   `createMany({ skipDuplicates: true })`. cron שרץ פעמיים, ניסיון
 *   חוזר, או שתי בקשות מקבילות — כולם מייצרים שורה אחת.
 *
 *   **לא הולך לאיבוד** — עבודה נשארת `PENDING` עד שנשלחה בפועל.
 *   תהליך שנפל באמצע משאיר נעילה ישנה, והריצה הבאה תופסת אותה מחדש.
 *
 *   **מקובץ** — כל העבודות של אותו משתמש שהגיע זמנן נאספות יחד, ומהן
 *   נשלחות לכל היותר שתי התראות: אחת מיידית (הודעה בצ׳אט) ואחת מרוכזת
 *   לכל השאר.
 *
 *   **שקט בלילה ובשבת** — עבודה שזמנה הגיע בשעת שקט אינה נמחקת אלא
 *   נדחית לרגע המותר הבא.
 */

/** אחרי כמה כישלונות עבודה מסומנת כאבודה. */
export const MAX_ATTEMPTS = 5;

/** נעילה ישנה מזו נחשבת נטושה, והעבודה נתפסת מחדש. */
export const CLAIM_TTL_MS = 5 * 60_000;

/** כמה עבודות נתפסות בריצה אחת. */
export const DRAIN_BATCH = 500;

/**
 * הודעה בצ׳אט נשלחת מיד; כל השאר מתקבצות.
 *
 * ההפרדה אינה שרירותית: הודעה בצ׳אט היא בן אדם שמחכה לתשובה בצד השני,
 * וקיבוץ שלה לדוח יומי הורג את המשא ומתן. ירידת מחיר, מודעה חדשה
 * בחיפוש שמור ומודעה שעומדת לפוג — כולן יכולות לחכות לרכבת הבאה, ואף
 * אחת מהן אינה שווה התראה נפרדת.
 */
export const IMMEDIATE_TYPES: NotificationType[] = ["NEW_MESSAGE"];

export type EnqueueInput = {
  userId: string;
  type: NotificationType;
  /** מזהה האירוע. חייב להיות יציב — הוא ההגנה מפני שליחה כפולה. */
  dedupeKey: string;
  payload: Prisma.InputJsonValue;
  /** מתי מוקדם ביותר לשלוח. ברירת מחדל: עכשיו. */
  scheduledFor?: Date;
};

/**
 * הכנסת אירועים לתור. אידמפוטנטית.
 *
 * מחזירה כמה שורות נוצרו בפועל — הפער בינה לבין מספר הקלטים הוא מספר
 * הכפילויות שנחסמו, וזה נתון שימושי בלוג של ה-cron.
 */
export async function enqueueNotifications(inputs: EnqueueInput[]): Promise<number> {
  if (!inputs.length) return 0;
  const now = new Date();

  const result = await prisma.notificationJob.createMany({
    data: inputs.map((i) => ({
      userId: i.userId,
      type: i.type,
      dedupeKey: i.dedupeKey,
      payload: i.payload,
      scheduledFor: i.scheduledFor ?? now,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

type ClaimedJob = {
  id: string;
  userId: string;
  type: NotificationType;
  attempts: number;
  payload: Prisma.JsonValue;
};

/**
 * תופס עד `limit` עבודות שהגיע זמנן.
 *
 * שני שלבים ולא אחד, כי ל-`updateMany` של Prisma אין `LIMIT`: קודם
 * נבחרים מזהים, ואז מסומנים באסימון ריצה בתנאי שהם עדיין פנויים.
 * שני עובדים שבחרו את אותם מזהים — הראשון מסמן, ותנאי ה-`WHERE` של
 * השני כבר לא מתקיים והוא תופס אפס. זה מונע שליחה כפולה בלי לנעול
 * טבלה.
 */
async function claimDueJobs(
  now: Date,
  limit: number,
  userId?: string,
): Promise<ClaimedJob[]> {
  const stale = new Date(now.getTime() - CLAIM_TTL_MS);

  const candidates = await prisma.notificationJob.findMany({
    where: {
      status: "PENDING",
      scheduledFor: { lte: now },
      ...(userId ? { userId } : {}),
      OR: [{ claimedAt: null }, { claimedAt: { lt: stale } }],
    },
    select: { id: true },
    orderBy: { scheduledFor: "asc" },
    take: limit,
  });
  if (!candidates.length) return [];

  const token = randomUUID();
  await prisma.notificationJob.updateMany({
    where: {
      id: { in: candidates.map((c) => c.id) },
      status: "PENDING",
      OR: [{ claimedAt: null }, { claimedAt: { lt: stale } }],
    },
    data: { claimToken: token, claimedAt: now },
  });

  return prisma.notificationJob.findMany({
    where: { claimToken: token, status: "PENDING" },
    select: { id: true, userId: true, type: true, attempts: true, payload: true },
  });
}

type Composed = { title: string; body: string; url: string };

/** ההתראה המיידית — הודעה בצ׳אט. */
function composeMessages(jobs: ClaimedJob[]): Composed {
  const payloads = jobs.map((j) => j.payload as Record<string, string>);
  const first = payloads[0]!;

  if (jobs.length === 1) {
    return {
      title: `הודעה חדשה מ${first.senderName ?? "משתמש"}`,
      body: `${truncate(first.preview ?? "", 120)} — בנוגע ל"${truncate(first.listingTitle ?? "", 60)}"`,
      url: `/my/messages/${first.conversationId}`,
    };
  }

  const senders = [...new Set(payloads.map((p) => p.senderName).filter(Boolean))];
  return {
    title: `${formatCount(jobs.length)} הודעות חדשות`,
    body:
      senders.length === 1
        ? `כולן מ${senders[0]}.`
        : `מ-${formatCount(senders.length)} אנשים שונים.`,
    url: "/my/messages",
  };
}

/**
 * ההתראה המרוכזת — כל השאר, בהודעה אחת.
 *
 * הגוף מונה את הסוגים במקום להסתיר אותם מאחורי "יש לך עדכונים": מי
 * שמקבל "ירידת מחיר ב-2 מודעות · 5 מודעות חדשות בחיפוש שמור" יודע אם
 * זה מעניין אותו בלי להיכנס, ומי שמקבל "3 עדכונים" חייב להיכנס כדי
 * לגלות שלא. השני הוא זה שגורם לאנשים להפסיק ללחוץ.
 */
function composeDigest(jobs: ClaimedJob[]): Composed {
  /*
   * הדוח החודשי הוא הטקסט היחיד שנכתב מראש כטקסט שלם, ולכן כשהוא לבדו
   * הוא נשלח כמו שהוא. פירוק שלו לשורת "עדכונים" היה מוחק בדיוק את
   * התוכן שבגללו הוא נשלח.
   */
  if (jobs.length === 1 && jobs[0]!.type === "SYSTEM") {
    const p = jobs[0]!.payload as Record<string, string>;
    if (p.title && p.body) {
      return { title: p.title, body: p.body, url: p.url ?? "/my/notifications" };
    }
  }

  const byType = new Map<NotificationType, ClaimedJob[]>();
  for (const job of jobs) {
    const list = byType.get(job.type) ?? [];
    list.push(job);
    byType.set(job.type, list);
  }

  const parts: string[] = [];

  const drops = byType.get("PRICE_DROP");
  if (drops?.length) {
    const p = drops[0]!.payload as Record<string, string | number>;
    parts.push(
      drops.length === 1
        ? `ירידת מחיר ל-${formatPrice(Number(p.newPrice))} ב"${truncate(String(p.listingTitle ?? ""), 40)}"`
        : `ירידת מחיר ב-${formatCount(drops.length)} מודעות שסימנתם`,
    );
  }

  const matches = byType.get("SAVED_SEARCH_MATCH");
  if (matches?.length) {
    const total = matches.reduce(
      (sum, j) => sum + Number((j.payload as Record<string, unknown>).count ?? 1),
      0,
    );
    const p = matches[0]!.payload as Record<string, string>;
    parts.push(
      matches.length === 1
        ? `${formatCount(total)} מודעות חדשות ב"${truncate(p.searchName ?? "", 40)}"`
        : `${formatCount(total)} מודעות חדשות ב-${formatCount(matches.length)} חיפושים שמורים`,
    );
  }

  const expiring = byType.get("LISTING_EXPIRING");
  if (expiring?.length) {
    const p = expiring[0]!.payload as Record<string, string | number>;
    parts.push(
      expiring.length === 1
        ? `המודעה "${truncate(String(p.listingTitle ?? ""), 40)}" תפוג בעוד ${p.daysLeft} ימים`
        : `${formatCount(expiring.length)} מודעות שלכם עומדות לפוג`,
    );
  }

  const system = byType.get("SYSTEM");
  if (system?.length) {
    for (const job of system) {
      const p = job.payload as Record<string, string>;
      if (p.title) parts.push(p.title);
    }
  }

  // כל סוג אחר שיתווסף בעתיד נספר ולא נעלם בשקט
  for (const [type, list] of byType) {
    if (["PRICE_DROP", "SAVED_SEARCH_MATCH", "LISTING_EXPIRING", "SYSTEM"].includes(type)) {
      continue;
    }
    parts.push(`${formatCount(list.length)} עדכונים נוספים`);
  }

  const single = jobs.length === 1;
  const url = single
    ? ((jobs[0]!.payload as Record<string, string>).url ?? "/my/notifications")
    : "/my/notifications";

  return {
    title: single ? (parts[0] ?? "עדכון בלוח") : `${formatCount(jobs.length)} עדכונים בלוח`,
    body: parts.join(" · "),
    url,
  };
}

/** מסמן קבוצת עבודות כנשלחה. */
async function markSent(ids: string[]) {
  await prisma.notificationJob.updateMany({
    where: { id: { in: ids } },
    data: { status: "SENT", sentAt: new Date(), claimToken: null, claimedAt: null },
  });
}

/**
 * מחזיר קבוצת עבודות לתור אחרי כישלון, עם השהיה מצטברת.
 * אחרי `MAX_ATTEMPTS` היא מסומנת `FAILED` ולא מנוסה שוב — ניסיון
 * אינסופי על שגיאה קבועה הוא לולאה שממלאת את הלוג ולא מוסיפה התראה.
 */
async function reschedule(jobs: ClaimedJob[], error: string) {
  const now = Date.now();
  await Promise.all(
    jobs.map((job) => {
      const attempts = job.attempts + 1;
      const exhausted = attempts >= MAX_ATTEMPTS;
      return prisma.notificationJob.update({
        where: { id: job.id },
        data: {
          attempts,
          status: exhausted ? "FAILED" : "PENDING",
          lastError: error.slice(0, 500),
          claimToken: null,
          claimedAt: null,
          // 5 דקות, 10, 20, 40 — מספיק כדי לעבור תקלה זמנית של ספק
          scheduledFor: new Date(now + 5 * 60_000 * 2 ** (attempts - 1)),
        },
      });
    }),
  );
}

/** דוחה קבוצת עבודות לרגע המותר הבא, בלי לספור ניסיון. */
async function defer(ids: string[], until: Date) {
  await prisma.notificationJob.updateMany({
    where: { id: { in: ids } },
    data: { scheduledFor: until, claimToken: null, claimedAt: null },
  });
}

export type DrainResult = {
  claimed: number;
  sent: number;
  deferred: number;
  failed: number;
};

/**
 * מרוקן את התור: תופס את מה שהגיע זמנו, מקבץ לפי משתמש, ושולח.
 *
 * `now` הוא פרמטר ולא `new Date()` פנימי כדי שאפשר יהיה לבדוק את
 * ההתנהגות בשעות שקט בלי לחכות ללילה.
 */
export async function drainQueue(
  now: Date = new Date(),
  limit: number = DRAIN_BATCH,
  userId?: string,
): Promise<DrainResult> {
  const jobs = await claimDueJobs(now, limit, userId);
  const result: DrainResult = { claimed: jobs.length, sent: 0, deferred: 0, failed: 0 };
  if (!jobs.length) return result;

  const byUser = new Map<string, ClaimedJob[]>();
  for (const job of jobs) {
    const list = byUser.get(job.userId) ?? [];
    list.push(job);
    byUser.set(job.userId, list);
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...byUser.keys()] } },
    select: {
      id: true,
      notifyEmail: true,
      notifyPush: true,
      quietHours: true,
      deletedAt: true,
      isBlocked: true,
    },
  });
  const prefs = new Map(users.map((u) => [u.id, u]));

  for (const [userId, userJobs] of byUser) {
    const user = prefs.get(userId);

    // משתמש שנמחק או נחסם — העבודות נסגרות ולא נשלחות ולא נשארות
    // בתור לנצח כשהן מנסות שוב ושוב.
    if (!user || user.deletedAt || user.isBlocked) {
      await prisma.notificationJob.updateMany({
        where: { id: { in: userJobs.map((j) => j.id) } },
        data: {
          status: "FAILED",
          lastError: "המשתמש אינו פעיל",
          claimToken: null,
          claimedAt: null,
        },
      });
      result.failed += userJobs.length;
      continue;
    }

    if (user.quietHours) {
      const allowed = nextAllowedTime(now);
      if (allowed.getTime() > now.getTime()) {
        await defer(
          userJobs.map((j) => j.id),
          allowed,
        );
        result.deferred += userJobs.length;
        continue;
      }
    }

    const immediate = userJobs.filter((j) => IMMEDIATE_TYPES.includes(j.type));
    const digest = userJobs.filter((j) => !IMMEDIATE_TYPES.includes(j.type));

    /*
     * סוג ההתראה המרוכזת: הסוג עצמו כשכל האירועים מאותו סוג, ו-SYSTEM
     * כשהם מעורבים. הסוג קובע את האייקון ברשימת ההתראות, ותקציר של
     * ירידת מחיר ומודעה שפגה שמסומן `PRICE_DROP` פשוט משקר בתמונה.
     */
    const digestTypes = new Set(digest.map((j) => j.type));
    const digestType: NotificationType =
      digestTypes.size === 1 ? digest[0]!.type : "SYSTEM";

    for (const [group, compose, type] of [
      [immediate, composeMessages, "NEW_MESSAGE" as NotificationType],
      [digest, composeDigest, digestType],
    ] as const) {
      if (!group.length) continue;
      try {
        const { title, body, url } = compose(group as ClaimedJob[]);
        await createNotification({
          userId,
          type,
          title,
          body,
          url,
          push: user.notifyPush,
          // דוא"ל רק לתקציר; הודעת צ׳אט מגיעה ב-Push ובאתר, ומייל על
          // כל הודעה הוא בדיוק מה שגורם לאנשים לסנן את הכתובת שלנו.
          email: user.notifyEmail && group === digest,
        });
        await markSent((group as ClaimedJob[]).map((j) => j.id));
        result.sent += group.length;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[queue] delivery failed for ${userId}`, err);
        await reschedule(group as ClaimedJob[], message);
        result.failed += group.length;
      }
    }
  }

  return result;
}

/**
 * מרוקן את התור של משתמש אחד, מיד.
 *
 * זה מה שהופך הודעת צ׳אט למיידית בלי לוותר על התור: האירוע נרשם קודם
 * (ולכן אינו הולך לאיבוד ואינו נשלח פעמיים), ורק אחר כך נעשה ניסיון
 * לשלוח אותו כאן ועכשיו. אם השליחה נופלת או שעכשיו שעת שקט — ה-cron
 * יטפל בזה בריצה הבאה, בלי שאיש כתב שורת טיפול נוספת.
 */
export async function deliverNow(userId: string): Promise<DrainResult> {
  return drainQueue(new Date(), 50, userId);
}
