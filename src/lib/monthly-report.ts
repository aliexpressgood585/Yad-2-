import { prisma } from "@/lib/db";
import { enqueueNotifications } from "@/lib/notification-queue";
import { formatPrice } from "@/lib/format";
import {
  MIN_TREND_POINTS,
  realEstateTrend,
  vehicleTrend,
  type DealKind,
  type TrendPoint,
} from "@/lib/valuation";

/**
 * הדוח החודשי של מדד המחירים.
 *
 * זו החתיכה שהייתה תלויה בלולאת ההתראות: בלי תור, בלי קיבוץ ובלי שעות
 * שקט, דוח חודשי הוא רק עוד מייל שנשלח לכולם בשלוש לפנות בוקר.
 *
 * ## מה נשלח למי
 *
 * הדוח אינו עלון כללי. לכל משתמש נשלח מה ש**הוא** עוקב אחריו: היצרנים
 * והדגמים שסימן במועדפים או שפרסם, והערים שבהן המודעות שסימן. משתמש
 * שאין לו שום עוגן כזה אינו מקבל דוח — עדיף בלי מייל מאשר עם מייל על
 * מחירי דירות בקריית שמונה למי שמחפש ספה בתל אביב.
 *
 * ## הכלל של סעיף C חל גם כאן
 *
 * שורה נכנסת לדוח רק אם יש לה מגמה אמיתית: שלוש נקודות חודשיות לפחות,
 * וכל נקודה עם מדגם של שמונה מודעות לפחות (`toTrendPoints` כבר מסנן).
 * דוח שכתוב בו "אין מספיק נתונים" בכל שורה פשוט לא נשלח.
 */

/** כמה נושאים לכל היותר בדוח אחד. מעבר לזה אף אחד לא קורא. */
const MAX_TOPICS = 3;

export type ReportLine = {
  subject: string;
  median: number;
  /** שינוי באחוזים בין הנקודה הראשונה לאחרונה */
  changePct: number;
  months: number;
};

/** שורת דוח מתוך סדרת מגמה, או `null` כשאין מספיק נקודות. */
export function lineFromTrend(subject: string, points: TrendPoint[]): ReportLine | null {
  if (points.length < MIN_TREND_POINTS) return null;

  const first = points[0]!;
  const last = points[points.length - 1]!;
  if (!first.median) return null;

  return {
    subject,
    median: last.median,
    changePct: Math.round(((last.median - first.median) / first.median) * 100),
    months: points.length,
  };
}

/** הנושאים שמשתמש עוקב אחריהם, לפי המועדפים והמודעות שלו. */
async function topicsFor(userId: string): Promise<{
  vehicles: { manufacturer: string; model: string | null }[];
  realEstate: { deal: DealKind; city: string }[];
}> {
  /*
   * מודעה נחשבת "נושא" של המשתמש אם הוא סימן אותה או פרסם אותה.
   * שני המקורות יחד, כי קונה מסמן וסוחר מפרסם — ושניהם רוצים לדעת
   * לאן הלך המחיר.
   */
  const listings = await prisma.listing.findMany({
    where: {
      deletedAt: null,
      OR: [{ favorites: { some: { userId } } }, { userId }],
    },
    select: {
      city: true,
      category: { select: { slug: true, parent: { select: { slug: true } } } },
      attributes: {
        select: {
          attribute: { select: { key: true } },
          value: { select: { label: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  });

  const vehicleCounts = new Map<string, { manufacturer: string; model: string | null; n: number }>();
  const realEstateCounts = new Map<string, { deal: DealKind; city: string; n: number }>();

  for (const listing of listings) {
    const root = listing.category?.parent?.slug ?? listing.category?.slug;

    if (root === "vehicles") {
      const byKey = new Map(
        listing.attributes.map((a) => [a.attribute.key, a.value?.label ?? null]),
      );
      const manufacturer = byKey.get("manufacturer");
      if (!manufacturer) continue;
      const model = byKey.get("model") ?? null;
      const k = `${manufacturer}|${model ?? ""}`;
      const prev = vehicleCounts.get(k);
      vehicleCounts.set(k, { manufacturer, model, n: (prev?.n ?? 0) + 1 });
    }

    if (root === "realestate" && listing.city) {
      const deal: DealKind = listing.category?.slug === "apartments-rent" ? "rent" : "sale";
      const k = `${deal}|${listing.city}`;
      const prev = realEstateCounts.get(k);
      realEstateCounts.set(k, { deal, city: listing.city, n: (prev?.n ?? 0) + 1 });
    }
  }

  const byFrequency = <T extends { n: number }>(a: T, b: T) => b.n - a.n;

  return {
    vehicles: [...vehicleCounts.values()].sort(byFrequency).slice(0, MAX_TOPICS),
    realEstate: [...realEstateCounts.values()].sort(byFrequency).slice(0, MAX_TOPICS),
  };
}

/** גוף הדוח מתוך השורות, או `null` כשלא נותרה אף שורה. */
export function composeReport(lines: ReportLine[]): { title: string; body: string } | null {
  if (!lines.length) return null;

  const sentences = lines.map((l) => {
    const direction =
      l.changePct > 0 ? "עלה" : l.changePct < 0 ? "ירד" : "נשאר ללא שינוי";
    const magnitude =
      l.changePct === 0 ? "" : ` ב-${Math.abs(l.changePct)}%`;
    return `${l.subject}: חציון ${formatPrice(l.median)}, ${direction}${magnitude} ב-${l.months} החודשים האחרונים.`;
  });

  return {
    title: "מדד המחירים — הדוח החודשי שלכם",
    body: sentences.join(" "),
  };
}

export type MonthlyReportResult = {
  /** `false` כשלא ה-1 בחודש והמשימה לא רצה בכלל */
  ran: boolean;
  candidates: number;
  queued: number;
};

/**
 * שולח את הדוח לכל מי שביקש אותו. נועד להיקרא מה-cron היומי.
 *
 * הבדיקה "האם היום ה-1 בחודש" נעשית כאן ולא במתזמן, כי Vercel בתוכנית
 * החינם מרשה משימת cron יומית אחת בלבד (`DECISIONS.md` §15) — כלומר
 * אין מתזמן חודשי שאפשר להגדיר. השאלה נשאלת בקוד, וזה מקום שאפשר
 * לבדוק אותו.
 */
export async function sendMonthlyPriceReports(now: Date): Promise<MonthlyReportResult> {
  if (now.getUTCDate() !== 1) {
    return { ran: false, candidates: 0, queued: 0 };
  }

  const month = now.toISOString().slice(0, 7);

  const users = await prisma.user.findMany({
    where: {
      monthlyReport: true,
      notifyEmail: true,
      deletedAt: null,
      isBlocked: false,
      email: { not: null },
    },
    select: { id: true },
    take: 5000,
  });

  let queued = 0;

  for (const user of users) {
    try {
      const topics = await topicsFor(user.id);
      const lines: ReportLine[] = [];

      for (const v of topics.vehicles) {
        const line = lineFromTrend(
          v.model ? `${v.manufacturer} ${v.model}` : v.manufacturer,
          await vehicleTrend(v.manufacturer, v.model),
        );
        if (line) lines.push(line);
      }

      for (const r of topics.realEstate) {
        const line = lineFromTrend(
          `${r.deal === "rent" ? "שכירות" : "דירות למכירה"} ב${r.city}`,
          await realEstateTrend(r.deal, r.city),
        );
        if (line) lines.push(line);
      }

      const report = composeReport(lines.slice(0, MAX_TOPICS));
      if (!report) continue;

      /*
       * דרך התור ולא ישירות: כך הדוח מכבד שעות שקט, אינו נשלח פעמיים
       * אם ה-cron ירוץ שוב באותו יום, ומתמזג עם שאר העדכונים של אותו
       * משתמש להתראה אחת במקום שתיים.
       */
      queued += await enqueueNotifications([
        {
          userId: user.id,
          type: "SYSTEM",
          dedupeKey: `monthly-report:${month}:${user.id}`,
          payload: { title: report.title, body: report.body, url: "/valuation" },
        },
      ]);
    } catch (err) {
      console.error(`[monthly-report] user ${user.id} failed`, err);
    }
  }

  return { ran: true, candidates: users.length, queued };
}
