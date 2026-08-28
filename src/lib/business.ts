import type { BusinessRole } from "@prisma/client";

import { ApiError } from "@/lib/api";
import { permissionsFor, type Permissions } from "@/lib/business-roles";
import { prisma } from "@/lib/db";

/**
 * חברות בעסק והרשאות.
 *
 * ## המודל
 *
 * חשבון עסק הוא משתמש רגיל שיש לו `businessSlug`. חברי הצוות הם שורות
 * ב-`BusinessMember` שמצביעות אליו. **הבעלים אינו שורה בטבלה** — הוא
 * העסק עצמו, וזה מה שמונע את המצב שבו מישהו מסיר את הבעלים מהצוות של
 * העסק שלו.
 *
 * ## למה `Listing.businessId` נפרד מ-`Listing.userId`
 *
 * `userId` הוא מי שפרסם בפועל — סוכן, מנהל או הבעלים. `businessId` הוא
 * העסק שהמודעה שייכת לו. ההפרדה היא מה שמאפשר לסוכן לראות רק את המלאי
 * שלו ולמנהל לראות את הכול, בלי שמודעות יעברו בעלות בין אנשים כשעובד
 * מתחלף — וגם מה שמאפשר לאותו אדם למכור ספה פרטית בלי שהיא תיכנס
 * למלאי הסוכנות.
 *
 * ## שלושה תפקידים ולא חמישה
 *
 * כל תפקיד נוסף הוא שאלה שמישהו צריך לענות עליה בכל פעם שהוא מוסיף
 * עובד. ההבחנה המעשית בסוכנות היא בין מי שמנהל את המלאי כולו לבין מי
 * שאחראי על מה שהוא פרסם, ובין שניהם לבין מי שרשאי לשנות את הצוות.
 */

export type Membership = {
  businessId: string;
  businessName: string;
  businessSlug: string;
  role: BusinessRole;
};

/**
 * החברויות של משתמש — העסק שבבעלותו, ואלה שצורף אליהם.
 *
 * מוחזר מערך ולא ערך יחיד כי אותו אדם יכול להיות בעלים של עסק אחד
 * וסוכן אצל אחר. המסך בוחר את הראשון כברירת מחדל ומאפשר להחליף.
 */
export async function membershipsFor(userId: string): Promise<Membership[]> {
  const [self, memberships] = await Promise.all([
    prisma.user.findFirst({
      where: { id: userId, businessSlug: { not: null }, deletedAt: null },
      select: { id: true, name: true, businessName: true, businessSlug: true },
    }),
    prisma.businessMember.findMany({
      where: { userId },
      select: {
        role: true,
        business: {
          select: {
            id: true,
            name: true,
            businessName: true,
            businessSlug: true,
            deletedAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const result: Membership[] = [];

  if (self?.businessSlug) {
    result.push({
      businessId: self.id,
      businessName: self.businessName ?? self.name,
      businessSlug: self.businessSlug,
      role: "OWNER",
    });
  }

  for (const m of memberships) {
    if (!m.business.businessSlug || m.business.deletedAt) continue;
    result.push({
      businessId: m.business.id,
      businessName: m.business.businessName ?? m.business.name,
      businessSlug: m.business.businessSlug,
      role: m.role,
    });
  }

  return result;
}

/**
 * החברות הפעילה, או `null` כשהמשתמש אינו חלק מאף עסק.
 *
 * `businessId` נמסר כשהמשתמש בחר עסק מסוים; בלעדיו נבחר הראשון. עסק
 * שנמסר ואינו שייך למשתמש מחזיר `null` ולא זורק — לקורא יש כבר תשובה
 * ל"אין הרשאה", ושתי דרכים לאותה שגיאה מסבכות את הקריאה.
 */
export async function activeMembership(
  userId: string,
  businessId?: string | null,
): Promise<Membership | null> {
  const all = await membershipsFor(userId);
  if (!all.length) return null;
  if (!businessId) return all[0]!;
  return all.find((m) => m.businessId === businessId) ?? null;
}

/** מחזיר חברות עם ההרשאה המבוקשת, או זורק. */
export async function requireBusiness(
  userId: string,
  permission?: keyof Permissions,
  businessId?: string | null,
): Promise<Membership & { permissions: Permissions }> {
  const membership = await activeMembership(userId, businessId);
  if (!membership) {
    throw new ApiError(403, "הפעולה זמינה לחשבונות עסקיים בלבד", "NOT_A_BUSINESS");
  }

  const permissions = permissionsFor(membership.role);
  if (permission && !permissions[permission]) {
    throw new ApiError(403, "אין לך הרשאה לפעולה הזו בעסק", "FORBIDDEN");
  }

  return { ...membership, permissions };
}

/**
 * תנאי Prisma למלאי שהחבר רשאי לראות.
 *
 * מנהל ובעלים רואים את כל מודעות העסק; סוכן רואה רק את מה שהוא פרסם.
 * התנאי מוחזר כאובייקט ולא כבוליאני כדי שכל מסך ישתמש באותו כלל בדיוק
 * — הרשאה שנאכפת בשלושה מקומות שונים היא הרשאה שתישבר באחד מהם.
 */
export function inventoryScope(membership: Membership, userId: string) {
  const base = { businessId: membership.businessId, deletedAt: null };
  return permissionsFor(membership.role).manageAllListings ? base : { ...base, userId };
}

export { permissionsFor, ROLE_LABELS, ROLE_DESCRIPTIONS } from "@/lib/business-roles";
export type { Permissions } from "@/lib/business-roles";
