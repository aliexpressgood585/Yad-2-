import bcrypt from "bcryptjs";

import { BRAND } from "@/lib/brand";
import { sendSms, smsConfigured } from "@/lib/sms";
import { prisma } from "@/lib/db";

const OTP_TTL_MS = 5 * 60_000;
const MAX_ATTEMPTS = 5;

/** מייצר קוד בן 6 ספרות. */
function generateCode(): string {
  return String(Math.floor(100_000 + Math.random() * 900_000));
}

/**
 * יוצר קוד חד-פעמי, שומר את ה-hash שלו ושולח אותו ב-SMS.
 * בסביבת פיתוח (ללא ספק SMS) הקוד מוחזר כדי לאפשר בדיקה מקומית.
 */
export async function issueOtp(
  phone: string,
  purpose: "login" | "verify" = "login",
): Promise<{ sent: boolean; devCode?: string }> {
  const code = generateCode();
  const codeHash = await bcrypt.hash(code, 10);

  await prisma.phoneOtp.create({
    data: {
      phone,
      codeHash,
      purpose,
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });

  const body = `${BRAND.name} — קוד האימות שלך: ${code}`;
  const result = await sendSms(phone, body);

  /*
   * הקוד מוחזר לקורא רק כשאין ספק אמיתי **ואנחנו לא בפרודקשן** — כדי
   * שפיתוח ובדיקות קבלה יעבדו בלי חשבון SMS. בפרודקשן הוא לעולם לא
   * חוזר בתגובה, גם אם הספק נפל: קוד אימות שנשלח ללקוח בגוף התשובה
   * מבטל את כל מה שהאימות אמור להשיג.
   */
  const devCode =
    process.env.NODE_ENV !== "production" && !smsConfigured() ? code : undefined;

  return { sent: result.sent, devCode };
}

/**
 * מאמת קוד ומסמן אותו כמנוצל. מונע ניחוש ע"י מגבלת ניסיונות.
 * מחזיר `true` רק אם הקוד תקף, לא פג ולא נוצל.
 */
export async function consumeOtp(
  phone: string,
  code: string,
  purpose: "login" | "verify" = "login",
): Promise<boolean> {
  const record = await prisma.phoneOtp.findFirst({
    where: {
      phone,
      purpose,
      usedAt: null,
      expiresAt: { gt: new Date() },
      attempts: { lt: MAX_ATTEMPTS },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!record) return false;

  const ok = await bcrypt.compare(code, record.codeHash);

  if (!ok) {
    await prisma.phoneOtp.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  await prisma.phoneOtp.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });
  return true;
}
