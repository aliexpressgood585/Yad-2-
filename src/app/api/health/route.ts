import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { paymentsConfigured } from "@/lib/payments";
import { smsConfigured } from "@/lib/sms";

/**
 * בדיקת בריאות — `/api/health`.
 *
 * בודקת את מה שהאתר באמת תלוי בו ולא רק שהתהליך חי: מסד נתונים,
 * Redis ואחסון. שירות שנופל בשקט הוא הדבר שמגלים ממשתמש שמתלונן,
 * וזה מאוחר מדי.
 *
 * מחזירה 503 כשמשהו קריטי נפל, כדי שניטור חיצוני יוכל להתריע בלי
 * לפרסר את הגוף.
 */
export const dynamic = "force-dynamic";

type Check = { ok: boolean; ms?: number; note?: string };

async function timed(fn: () => Promise<unknown>): Promise<Check> {
  const t = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - t };
  } catch (error) {
    return {
      ok: false,
      ms: Date.now() - t,
      note: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkRedis(): Promise<Check> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    return {
      ok: false,
      note: "לא מוגדר — הגבלת הקצב פועלת בזיכרון, כלומר לא פועלת ב-serverless",
    };
  }
  return timed(async () => {
    const res = await fetch(`${url}/ping`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
}

function checkStorage(): Check {
  if (process.env.UPLOAD_PROVIDER !== "cloudinary") {
    return { ok: false, note: "אחסון מקומי — התמונות לא ישרדו את הפריסה הבאה" };
  }
  const configured =
    Boolean(process.env.CLOUDINARY_CLOUD_NAME) &&
    Boolean(process.env.CLOUDINARY_API_KEY) &&
    Boolean(process.env.CLOUDINARY_API_SECRET);
  return { ok: configured, note: configured ? undefined : "מפתחות Cloudinary חסרים" };
}

export async function GET() {
  const [database, redis] = await Promise.all([
    timed(() => prisma.$queryRaw`SELECT 1`),
    checkRedis(),
  ]);

  const sms = smsConfigured();
  const payments = paymentsConfigured();
  const demoExposed = process.env.ALLOW_DEMO_DATA === "true";

  /*
   * רק מסד הנתונים מפיל את הבדיקה. אתר שמגיש מודעות בלי Redis עדיף
   * על אתר שמכריז על עצמו כמת ומוסר מהאיזון — השאר מדווח ולא חוסם.
   */
  const healthy = database.ok;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      time: new Date().toISOString(),
      checks: {
        database,
        redis,
        storage: checkStorage(),
        sms: { ok: sms, note: sms ? undefined : "אין ספק SMS — אי אפשר לאמת טלפון" },
        payments: {
          ok: payments,
          note: payments ? undefined : "אין סליקה — קידומים מופעלים בחינם",
        },
        demoData: {
          ok: !demoExposed,
          note: demoExposed ? "נתוני הדגמה חשופים למשתמשים" : undefined,
        },
      },
    },
    { status: healthy ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
