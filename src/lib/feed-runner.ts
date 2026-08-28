import { prisma } from "@/lib/db";
import { mapRows, parseFeed, type FeedMapping } from "@/lib/feed";
import { attributeSpecsFor, importRows, removeMissing } from "@/lib/feed-import";

/**
 * הרצת פידים — מושך את הכתובת, ממפה, וכותב.
 *
 * ## למה ההורדה מוגבלת כל כך
 *
 * הכתובת מגיעה מהסוחר, כלומר היא קלט של משתמש שהשרת שלנו הולך לפנות
 * אליו. שלוש מגבלות סוגרות את זה:
 *
 *   **פרוטוקול** — http/https בלבד. `file://` היה מאפשר לקרוא קבצים
 *   מהשרת, ו-`gopher://` הוא וקטור SSRF קלאסי.
 *
 *   **גודל** — 10MB. פיד גדול מזה אינו פיד אלא הורדה, והוא מפיל את
 *   הפונקציה על מגבלת הזיכרון.
 *
 *   **זמן** — 20 שניות. שרת שלא עונה לא צריך להחזיק את משימת ה-cron
 *   שכל שאר הפידים מחכים בה.
 *
 * חסימת כתובות פנימיות אינה נעשית כאן אלא בשכבת הרשת של סביבת ההרצה;
 * זה מתועד ב-BLOCKED.md, כי בדיקת DNS בקוד אינה עמידה בפני
 * DNS rebinding והיא הייתה נותנת ביטחון שאינו קיים.
 */

const MAX_BYTES = 10 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

export type FeedRunOutcome = {
  feedId: string;
  status: "OK" | "PARTIAL" | "FAILED";
  message: string;
  created: number;
  updated: number;
  removed: number;
};

/** מוריד את גוף הפיד, עם כל המגבלות. */
async function fetchFeed(url: string): Promise<string> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("כתובת הפיד אינה תקינה");
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("כתובת הפיד חייבת להיות http או https");
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(parsed.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: { accept: "text/csv, application/xml, text/xml, text/plain, */*" },
    });
    if (!res.ok) throw new Error(`השרת החזיר ${res.status}`);

    const declared = Number(res.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) {
      throw new Error(`הפיד גדול מ-${Math.round(MAX_BYTES / 1024 / 1024)}MB`);
    }

    const text = await res.text();
    if (text.length > MAX_BYTES) {
      throw new Error(`הפיד גדול מ-${Math.round(MAX_BYTES / 1024 / 1024)}MB`);
    }
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** מריץ פיד אחד ומעדכן את מצבו. לעולם אינו זורק. */
export async function runFeed(feedId: string): Promise<FeedRunOutcome> {
  const feed = await prisma.listingFeed.findUnique({ where: { id: feedId } });
  if (!feed) {
    return { feedId, status: "FAILED", message: "הפיד לא נמצא", created: 0, updated: 0, removed: 0 };
  }

  const finish = async (outcome: Omit<FeedRunOutcome, "feedId">) => {
    await prisma.listingFeed.update({
      where: { id: feed.id },
      data: {
        lastRunAt: new Date(),
        lastStatus: outcome.status,
        lastMessage: outcome.message.slice(0, 500),
        lastCreated: outcome.created,
        lastUpdated: outcome.updated,
      },
    });
    return { feedId: feed.id, ...outcome };
  };

  try {
    const text = await fetchFeed(feed.url);
    const table = parseFeed(text, feed.format);
    if (table.length < 2) {
      return finish({
        status: "FAILED",
        message: "הפיד ריק או שלא זוהו בו שורות",
        created: 0,
        updated: 0,
        removed: 0,
      });
    }

    const specs = await attributeSpecsFor(feed.categoryId);
    const { rows, errors } = mapRows(table, feed.mapping as FeedMapping, specs);

    /*
     * ריצת פיד מפרסמת ישירות ולא כטיוטה. ההבדל מהעלאה מרוכזת מכוון:
     * העלאה היא פעולה חד-פעמית שהסוחר עומד מולה ויכול לבדוק, ופיד הוא
     * תהליך אוטומטי שרץ בלילה — טיוטות שמצטברות בלי שאיש מאשר אותן הן
     * מלאי שלא קיים.
     */
    const written = await importRows(rows, {
      businessId: feed.businessId,
      userId: feed.businessId,
      categoryId: feed.categoryId,
      publish: true,
      feedId: feed.id,
    });

    const removed = feed.removeMissing
      ? await removeMissing(
          feed.id,
          rows.map((r) => r.externalId),
        )
      : 0;

    const failed = errors.length + written.failures.length;
    const parts = [
      `${written.created} נוצרו`,
      `${written.updated} עודכנו`,
      ...(removed ? [`${removed} סומנו כנמכרו`] : []),
      ...(failed ? [`${failed} שורות נדחו`] : []),
    ];

    return finish({
      status: failed ? "PARTIAL" : "OK",
      message: parts.join(" · "),
      created: written.created,
      updated: written.updated,
      removed,
    });
  } catch (err) {
    return finish({
      status: "FAILED",
      message: err instanceof Error ? err.message : String(err),
      created: 0,
      updated: 0,
      removed: 0,
    });
  }
}

/** מריץ את כל הפידים הפעילים. נקרא מה-cron היומי. */
export async function runActiveFeeds(): Promise<{
  feeds: number;
  ok: number;
  partial: number;
  failed: number;
}> {
  const feeds = await prisma.listingFeed.findMany({
    where: { isActive: true },
    select: { id: true },
    orderBy: { lastRunAt: "asc" },
    take: 50,
  });

  const summary = { feeds: feeds.length, ok: 0, partial: 0, failed: 0 };

  // בזה אחר זה ולא במקביל: כל ריצה כותבת מאות שורות, ועשרים פידים
  // במקביל מרוקנים את מאגר החיבורים של Postgres.
  for (const feed of feeds) {
    const outcome = await runFeed(feed.id);
    if (outcome.status === "OK") summary.ok++;
    else if (outcome.status === "PARTIAL") summary.partial++;
    else summary.failed++;
  }

  return summary;
}
