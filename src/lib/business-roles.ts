import type { BusinessRole } from "@prisma/client";

/**
 * תפקידים והרשאות — הצד הטהור.
 *
 * מופרד מ-`business.ts` כי רכיבי לקוח צריכים את התוויות ואת טבלת
 * ההרשאות, ו-`business.ts` מייבא את `ApiError` שגורר את `next/headers`.
 * ייבוא של קובץ אחד לתוך רכיב `"use client"` היה מפיל את הבנייה כולה
 * עם שגיאה שמצביעה על `src/lib/api.ts` ולא על הסיבה האמיתית.
 */

/** ההרשאות הנגזרות מתפקיד. */
export type Permissions = {
  /** לראות ולערוך את כל מלאי העסק, ולא רק את המודעות שהוא פרסם */
  manageAllListings: boolean;
  /** העלאה מרוכזת וייבוא פידים */
  importInventory: boolean;
  /** דשבורד ביצועי המלאי */
  viewDashboard: boolean;
  /** הוספה, שינוי תפקיד והסרה של חברי צוות */
  manageTeam: boolean;
};

export function permissionsFor(role: BusinessRole): Permissions {
  switch (role) {
    case "OWNER":
      return {
        manageAllListings: true,
        importInventory: true,
        viewDashboard: true,
        manageTeam: true,
      };
    case "MANAGER":
      return {
        manageAllListings: true,
        importInventory: true,
        viewDashboard: true,
        // ניהול צוות נשאר אצל הבעלים בלבד: מנהל שיכול להוסיף מנהלים
        // יכול גם להוסיף את עצמו כבעלים, וזו לא הרשאה אלא פרצה.
        manageTeam: false,
      };
    case "AGENT":
      return {
        manageAllListings: false,
        importInventory: false,
        viewDashboard: true,
        manageTeam: false,
      };
  }
}

export const ROLE_LABELS: Record<BusinessRole, string> = {
  OWNER: "בעלים",
  MANAGER: "מנהל",
  AGENT: "סוכן",
};

export const ROLE_DESCRIPTIONS: Record<BusinessRole, string> = {
  OWNER: "כל ההרשאות, כולל ניהול הצוות.",
  MANAGER: "כל המלאי, העלאה מרוכזת ופידים. ללא ניהול צוות.",
  AGENT: "רק המודעות שהוא עצמו פרסם.",
};

