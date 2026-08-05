import bcrypt from "bcryptjs";

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
): Promise<{ sent: true; devCode?: string }> {
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

  const body = `קוד האימות שלך לשנתות: ${code}`;
  const provider = process.env.SMS_PROVIDER;

  if (!provider || !process.env.SMS_API_KEY) {
    // מוק פיתוח — אין ספק SMS מוגדר.
    console.info(`[SMS→${phone}] ${body}`);
    return process.env.NODE_ENV === "production"
      ? { sent: true }
      : { sent: true, devCode: code };
  }

  await sendSms(phone, body);
  return { sent: true };
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

/** שליחת SMS דרך ספק חיצוני. מופרד כדי שיהיה קל להחליף ספק. */
async function sendSms(phone: string, body: string): Promise<void> {
  const url = process.env.SMS_PROVIDER;
  if (!url) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.SMS_API_KEY ?? ""}`,
      },
      body: JSON.stringify({
        to: phone,
        from: process.env.SMS_SENDER ?? "Luach",
        text: body,
      }),
    });
    if (!res.ok) {
      console.error("SMS provider error", res.status, await res.text());
    }
  } catch (err) {
    console.error("SMS provider unreachable", err);
  }
}
