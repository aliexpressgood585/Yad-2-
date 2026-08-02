import type { NotificationType } from "@prisma/client";

import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { sendPushToUser } from "@/lib/push";
import { truncate } from "@/lib/utils";
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

/** התראה על הודעה חדשה בצ'אט. */
export async function notifyNewMessage(input: {
  recipientId: string;
  senderName: string;
  conversationId: string;
  listingTitle: string;
  preview: string;
}) {
  await createNotification({
    userId: input.recipientId,
    type: "NEW_MESSAGE",
    title: `הודעה חדשה מ${input.senderName}`,
    body: `${truncate(input.preview, 120)} — בנוגע ל"${truncate(input.listingTitle, 60)}"`,
    url: `/my/messages/${input.conversationId}`,
  });
}

/** התראה על מודעות חדשות שתואמות חיפוש שמור. */
export async function notifySavedSearchMatch(input: {
  userId: string;
  searchName: string;
  count: number;
  searchId: string;
  email: boolean;
}) {
  await createNotification({
    userId: input.userId,
    type: "SAVED_SEARCH_MATCH",
    title:
      input.count === 1
        ? `מודעה חדשה תואמת ל"${input.searchName}"`
        : `${input.count} מודעות חדשות תואמות ל"${input.searchName}"`,
    body: "לחצו כדי לראות את המודעות שהתווספו מאז הביקור האחרון שלכם.",
    url: `/my/searches?highlight=${input.searchId}`,
    email: input.email,
  });
}

/** התראה למוכר שהמודעה שלו עומדת לפוג. */
export async function notifyListingExpiring(input: {
  userId: string;
  listingId: string;
  listingTitle: string;
  daysLeft: number;
}) {
  await createNotification({
    userId: input.userId,
    type: "LISTING_EXPIRING",
    title: `המודעה "${truncate(input.listingTitle, 50)}" תפוג בקרוב`,
    body: `נותרו ${input.daysLeft} ימים. אפשר לחדש אותה בלחיצה אחת מהאזור האישי.`,
    url: "/my",
    email: true,
  });
}
