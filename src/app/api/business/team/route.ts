import { z } from "zod";

import { ApiError, handleError, ok, parseBody, requireSession } from "@/lib/api";
import { prisma } from "@/lib/db";
import { requireBusiness } from "@/lib/business";

const addSchema = z.object({
  /** האימייל שאיתו העובד רשום בלוח */
  email: z.string().trim().email("כתובת דוא\"ל לא תקינה"),
  role: z.enum(["MANAGER", "AGENT"]),
});

const updateSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["MANAGER", "AGENT"]),
});

const removeSchema = z.object({ userId: z.string().min(1) });

/**
 * צירוף עובד לצוות.
 *
 * **העובד חייב להיות רשום בלוח מראש.** אין כאן הזמנה במייל, וזו החלטה
 * ולא חוסר: הזמנה פתוחה היא כתובת שמי שמחזיק בה מקבל גישה למלאי של
 * העסק, והיא דורשת אסימון, תפוגה, וביטול — מערכת שלמה שאפשר לוותר
 * עליה כשהעובד ממילא צריך חשבון כדי לפרסם. הסוחר שולח לו קישור
 * הרשמה, והוא מצרף אותו בכתובת שלו.
 */
export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const business = await requireBusiness(session.user.id, "manageTeam");
    const { email, role } = await parseBody(req, addSchema);

    const user = await prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null, isBlocked: false },
      select: { id: true, name: true, email: true },
    });
    if (!user) {
      throw new ApiError(
        404,
        "לא נמצא משתמש עם הכתובת הזו. בקשו ממנו להירשם ללוח, ואז צרפו אותו.",
        "USER_NOT_FOUND",
      );
    }
    if (user.id === business.businessId) {
      throw new ApiError(400, "בעל העסק כבר בצוות");
    }

    await prisma.businessMember.upsert({
      where: { businessId_userId: { businessId: business.businessId, userId: user.id } },
      create: { businessId: business.businessId, userId: user.id, role },
      update: { role },
    });

    return ok({ member: { userId: user.id, name: user.name, email: user.email, role } });
  } catch (err) {
    return handleError(err);
  }
}

/** שינוי תפקיד. */
export async function PATCH(req: Request) {
  try {
    const session = await requireSession();
    const business = await requireBusiness(session.user.id, "manageTeam");
    const { userId, role } = await parseBody(req, updateSchema);

    const member = await prisma.businessMember.findUnique({
      where: { businessId_userId: { businessId: business.businessId, userId } },
      select: { id: true },
    });
    if (!member) throw new ApiError(404, "החבר לא נמצא בצוות");

    await prisma.businessMember.update({ where: { id: member.id }, data: { role } });
    return ok({ updated: true });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * הסרה מהצוות.
 *
 * המודעות שהעובד פרסם **נשארות אצל העסק**: `businessId` אינו משתנה,
 * ורק `userId` ממשיך להצביע עליו. עובד שעוזב לא לוקח איתו את המלאי,
 * וגם לא נמחק מההיסטוריה של מי פרסם מה.
 */
export async function DELETE(req: Request) {
  try {
    const session = await requireSession();
    const business = await requireBusiness(session.user.id, "manageTeam");
    const { userId } = await parseBody(req, removeSchema);

    await prisma.businessMember.deleteMany({
      where: { businessId: business.businessId, userId },
    });

    return ok({ removed: true });
  } catch (err) {
    return handleError(err);
  }
}
