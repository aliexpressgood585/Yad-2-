/**
 * שליחת SMS — שכבת הפשטה מעל ספק אמיתי.
 *
 * זה השירות שחוסם הכול: בלי SMS אף אחד לא מאמת טלפון, ובלי טלפון
 * מאומת אף אחד לא מפרסם מודעה. לוח בלי מודעות אינו לוח.
 *
 * שלושה ספקים ממומשים כאן, ובחירת אחד מהם היא משתנה סביבה אחד.
 * שניים ישראליים (019 ו-Inforu) ואחד בינלאומי (Twilio) — מספר שולח
 * ישראלי מגיע טוב יותר, וזה מה שקובע אם הודעת האימות מתקבלת בכלל.
 *
 * להוספת ספק רביעי: פונקציה אחת ורשומה אחת ב-`ADAPTERS`. שום קובץ
 * אחר בקוד אינו יודע איזה ספק פעיל.
 */

export type SmsResult = { sent: boolean; provider: string; error?: string };

type Adapter = (phone: string, body: string) => Promise<SmsResult>;

/** מנרמל למספר בינלאומי — כל הספקים מצפים לו, גם הישראליים. */
export function toE164(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("972")) return `+${digits}`;
  if (digits.startsWith("0")) return `+972${digits.slice(1)}`;
  return `+${digits}`;
}

function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`${name} חסר`);
  return v;
}

/**
 * 019 — ספק ישראלי, ממשק XML.
 *
 * ה-API שלהם מקבל מעטפת XML ולא JSON, וזה לא טעות בקוד: זו הצורה
 * שהם מגישים. שם המשתמש והסיסמה הם של חשבון ה-API ולא של הפורטל.
 */
async function via019(phone: string, body: string): Promise<SmsResult> {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sms>
  <user><username>${env("SMS_019_USERNAME")}</username></user>
  <source>${process.env.SMS_SENDER ?? "Kedai"}</source>
  <destinations><phone>${toE164(phone).replace("+", "")}</phone></destinations>
  <message>${body.replace(/[<>&]/g, "")}</message>
</sms>`;

  const res = await fetch("https://019sms.co.il/api", {
    method: "POST",
    headers: {
      "content-type": "text/xml",
      Authorization: `Bearer ${env("SMS_019_TOKEN")}`,
    },
    body: xml,
  });

  const text = await res.text();
  // 019 מחזיר `<status>0</status>` בהצלחה, וכל ערך אחר הוא שגיאה
  const ok = res.ok && /<status>\s*0\s*<\/status>/.test(text);
  return { sent: ok, provider: "019", error: ok ? undefined : text.slice(0, 200) };
}

/** Inforu — ספק ישראלי, ממשק JSON. */
async function viaInforu(phone: string, body: string): Promise<SmsResult> {
  const auth = Buffer.from(
    `${env("SMS_INFORU_USERNAME")}:${env("SMS_INFORU_TOKEN")}`,
  ).toString("base64");

  const res = await fetch("https://capi.inforu.co.il/api/v2/SMS/SendSms", {
    method: "POST",
    headers: { "content-type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify({
      Data: {
        Message: body,
        Recipients: [{ Phone: toE164(phone) }],
        Settings: { Sender: process.env.SMS_SENDER ?? "Kedai" },
      },
    }),
  });

  const json = (await res.json().catch(() => null)) as { StatusId?: number; StatusDescription?: string } | null;
  const ok = res.ok && json?.StatusId === 1;
  return {
    sent: ok,
    provider: "inforu",
    error: ok ? undefined : (json?.StatusDescription ?? `HTTP ${res.status}`),
  };
}

/** Twilio — נפילה בינלאומית, כשאין עדיין חשבון ישראלי. */
async function viaTwilio(phone: string, body: string): Promise<SmsResult> {
  const sid = env("TWILIO_ACCOUNT_SID");
  const auth = Buffer.from(`${sid}:${env("TWILIO_AUTH_TOKEN")}`).toString("base64");

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${auth}`,
    },
    body: new URLSearchParams({
      To: toE164(phone),
      From: env("TWILIO_FROM"),
      Body: body,
    }),
  });

  const ok = res.ok;
  return { sent: ok, provider: "twilio", error: ok ? undefined : (await res.text()).slice(0, 200) };
}

const ADAPTERS: Record<string, Adapter> = {
  "019": via019,
  inforu: viaInforu,
  twilio: viaTwilio,
};

/** האם יש ספק SMS פעיל. */
export function smsConfigured(): boolean {
  return Boolean(process.env.SMS_PROVIDER && ADAPTERS[process.env.SMS_PROVIDER]);
}

/**
 * שולח הודעה. בלי ספק מוגדר ההודעה נכתבת ללוג.
 *
 * **בפרודקשן היעדר ספק אינו שקט.** הוא נרשם כשגיאה ומחזיר
 * `sent: false`, כדי שהקורא ידע שהאימות לא יגיע. מוק שמחזיר "נשלח"
 * בפרודקשן הוא מוק שגורם למשתמש להמתין לקוד שלא קיים.
 */
export async function sendSms(phone: string, body: string): Promise<SmsResult> {
  const name = process.env.SMS_PROVIDER;
  const adapter = name ? ADAPTERS[name] : undefined;

  if (!adapter) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[sms] אין ספק SMS מוגדר (SMS_PROVIDER). ההודעה אל ${phone} לא נשלחה.`,
      );
      return { sent: false, provider: "none", error: "SMS_PROVIDER חסר" };
    }
    console.info(`[SMS→${phone}] ${body}`);
    return { sent: true, provider: "console" };
  }

  try {
    const result = await adapter(phone, body);
    if (!result.sent) console.error(`[sms:${result.provider}] ${result.error}`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[sms:${name}] ${message}`);
    return { sent: false, provider: name ?? "unknown", error: message };
  }
}
