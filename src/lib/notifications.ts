import type { NotificationType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { SITE } from "@/lib/site";

type CreateNotification = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  url?: string;
  /** שליחת מייל בנוסף להתראה באתר */
  email?: boolean;
  /** שליחת Web Push */
  push?: boolean;
};

/**
 * יוצר התראה באתר ובמקביל שולח מייל / Push לפי הצורך.
 * כשלים בערוצים חיצוניים אינם מפילים את הפעולה שקראה לפונקציה.
 *
 * זו פונקציית **המסירה** בלבד. מי מחליט שצריך להתריע, על מה, ומתי —
 * זה `notification-queue.ts`, והטריגרים עצמם ב-`notification-triggers.ts`.
 * הפרדה זו היא מה שמאפשר קיבוץ ושעות שקט: אילו הטריגרים היו קוראים
 * לכאן ישירות, כל אירוע היה הופך להתראה נפרדת ברגע שהוא קרה.
 */
export async function createNotification(input: CreateNotification) {
  const notification = await prisma.notification.create({
    data: {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      url: input.url ?? null,
    },
  });

  const url = input.url ? `${SITE.url}${input.url}` : SITE.url;

  const tasks: Promise<unknown>[] = [];

  if (input.push !== false) {
    tasks.push(
      sendPushToUser(input.userId, {
        title: input.title,
        body: input.body,
        url: input.url ?? "/",
      }).catch((err) => console.error("[push] failed", err)),
    );
  }

  if (input.email) {
    tasks.push(
      (async () => {
        const user = await prisma.user.findUnique({
          where: { id: input.userId },
          select: { email: true, name: true },
        });
        if (!user?.email) return;
        await sendEmail({
          to: user.email,
          subject: input.title,
          heading: input.title,
          body: input.body,
          ctaLabel: "צפייה באתר",
          ctaUrl: url,
        });
      })().catch((err) => console.error("[email] failed", err)),
    );
  }

  await Promise.allSettled(tasks);
  return notification;
}
