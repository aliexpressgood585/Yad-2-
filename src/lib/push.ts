import webpush from "web-push";

import { prisma } from "@/lib/db";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const configured = Boolean(publicKey && privateKey);

if (configured) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:admin@example.com",
    publicKey!,
    privateKey!,
  );
}

export type PushPayload = {
  title: string;
  body: string;
  url: string;
};

/**
 * שולח Web Push לכל המכשירים הרשומים של המשתמש.
 * מנוי שהשרת מדווח עליו כלא תקין (410/404) נמחק אוטומטית.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<{ sent: number }> {
  if (!configured) return { sent: 0 };

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });
  if (!subscriptions.length) return { sent: 0 };

  const message = JSON.stringify(payload);
  let sent = 0;
  const stale: string[] = [];

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          message,
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) stale.push(sub.id);
        else console.error("[push] send failed", status);
      }
    }),
  );

  if (stale.length) {
    await prisma.pushSubscription.deleteMany({ where: { id: { in: stale } } });
  }

  return { sent };
}

export const pushConfigured = configured;
