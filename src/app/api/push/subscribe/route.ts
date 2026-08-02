import { z } from "zod";

import { handleError, ok, parseBody, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

const unsubscribeSchema = z.object({ endpoint: z.string().url() });

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const sub = await parseBody(req, subscribeSchema);

    await prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      create: {
        userId: session.user.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
      // אותו מכשיר עשוי להתחבר עם משתמש אחר — מעדכנים בעלות
      update: {
        userId: session.user.id,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      },
    });

    return ok({ subscribed: true }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    const { endpoint } = await parseBody(req, unsubscribeSchema);

    await prisma.pushSubscription.deleteMany({
      where: { endpoint, userId: session.user.id },
    });

    return ok({ subscribed: false });
  } catch (err) {
    return handleError(err);
  }
}
