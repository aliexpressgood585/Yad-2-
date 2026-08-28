import { z } from "zod";

import { handleError, ok, parseBody, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";

/**
 * העדפות ההתראה.
 *
 * כל השדות אופציונליים כדי שהמסך יוכל לשלוח מתג בודד. `.strict()` כדי
 * ששדה שאינו העדפה — למשל `role` — לא ייכנס לעדכון דרך הנתיב הזה.
 */
const schema = z
  .object({
    notifyEmail: z.boolean().optional(),
    notifyPush: z.boolean().optional(),
    quietHours: z.boolean().optional(),
    monthlyReport: z.boolean().optional(),
  })
  .strict();

export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const data = await parseBody(req, schema);

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data,
      select: {
        notifyEmail: true,
        notifyPush: true,
        quietHours: true,
        monthlyReport: true,
      },
    });

    return ok({ preferences: user });
  } catch (err) {
    return handleError(err);
  }
}
