import { FunnelStep } from "@prisma/client";

import { prisma } from "@/lib/db";

/*
 * הקובץ הזה **אינו** מייבא את `next/headers` ואינו מסומן `server-only`,
 * וזה מכוון: הוא מכיל את חישוב המשפך, שהוא ההיגיון שצריך בדיקות.
 * `npm run check:metrics` מריץ אותו מחוץ ל-Next, ותלות בהקשר של בקשה
 * הייתה הופכת את החלק החשוב ביותר כאן לבלתי ניתן לבדיקה.
 *
 * קריאת העוגייה יושבת ב-`src/lib/metrics-session.ts`.
 */

/**
 * מדידת מוצר — מדד צפון ומשפכים.
 *
 * זה **לא** אותו דבר כמו `ListingDailyStat`. הטבלה ההיא עונה למוכר על
 * "איך המודעה שלי מתפקדת"; כאן נמדד המוצר עצמו — האם הלוח מצליח לחבר
 * בין קונה למוכר, ואיפה הוא מאבד אנשים בדרך.
 *
 * ---
 *
 * ## מדד הצפון: פניות ראשונות
 *
 * `northStar` סופר זוגות **ייחודיים** של (סשן, מודעה) שהגיעו למגע —
 * חשיפת טלפון או הודעה ראשונה.
 *
 * למה דווקא זה, ולא אחת מהחלופות המתבקשות:
 *
 *   כניסות וצפיות — קלט, לא ערך. אפשר להכפיל אותן בלי שאף אחד מכר דבר.
 *   מודעות שפורסמו — היצע. לוח עם 10,000 מודעות שאיש לא פונה אליהן
 *     נכשל, והמספר הזה דווקא ייראה מצוין.
 *   עסקאות שנסגרו — הדבר הנכון באמת, אבל הן נסגרות בטלפון ומחוץ
 *     למערכת. מדד שאי אפשר למדוד ביושר הוא מדד גרוע.
 *
 * פנייה ראשונה היא הרגע שבו הלוח סיפק את מה שהוא מבטיח, והוא היחיד
 * מבין הארבעה שגם נמדד במלואו וגם מייצג ערך אמיתי.
 *
 * ## למה חשיפה והודעה נספרות יחד
 *
 * הן **חלופות ולא שלבים**. קונה מתקשר או כותב, לא שניהם בזה אחר זה.
 * משפך שמציב אותן זו אחרי זו היה מציג נפילה של 90% בין שני שלבים
 * שאינם רצף — כלומר ממציא בעיה שלא קיימת.
 *
 * ## שיעור המענה כמשמר
 *
 * `REPLY` אינו חלק ממדד הצפון אלא מוצג לצידו. מדד צפון שאפשר לשפר
 * בלי שאיש ירוויח הוא מדד שישופר בדיוק כך; שיעור המענה הוא מה שמונע
 * לחגוג עלייה בפניות שאף מוכר לא ענה להן.
 */

/** סדר התצוגה של המשפך. `REPLY` נמדד אך אינו שלב במשפך הראשי. */
export const FUNNEL_ORDER: FunnelStep[] = ["SEARCH", "VIEW", "REVEAL", "MESSAGE", "REPLY"];

export const STEP_LABEL: Record<FunnelStep, string> = {
  SEARCH: "חיפוש",
  VIEW: "צפייה במודעה",
  REVEAL: "חשיפת טלפון",
  MESSAGE: "הודעה למוכר",
  REPLY: "המוכר השיב",
};

export type EventInput = {
  step: FunnelStep;
  sessionId: string;
  userId?: string | null;
  listingId?: string | null;
  categoryId?: string | null;
};

/**
 * רישום אירוע.
 *
 * **לעולם אינו זורק.** מדידה שמפילה בקשה היא מדידה ששינתה את מה שהיא
 * מודדת — ובמקרה הגרוע מונעת מקונה ליצור קשר. כישלון כאן נבלע בשקט,
 * והמחיר הוא חור בנתונים ולא חור במוצר.
 *
 * הקריאה אינה מומתנת (`void`) כדי לא להוסיף השהיה למסלול הבקשה.
 */
export function recordEvent(input: EventInput): void {
  if (!input.sessionId) return;

  void prisma.funnelEvent
    .create({
      data: {
        step: input.step,
        day: startOfUtcDay(new Date()),
        sessionId: input.sessionId,
        userId: input.userId ?? null,
        listingId: input.listingId ?? null,
        categoryId: input.categoryId ?? null,
      },
    })
    .catch(() => undefined);
}

/** חצות UTC של התאריך, כערך `@db.Date`. */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export type FunnelRow = {
  step: FunnelStep;
  label: string;
  /** סשנים ייחודיים שהגיעו לשלב */
  sessions: number;
  /** אחוז מהשלב הקודם במשפך. `null` בשלב הראשון ובשלבים שאינם רצף. */
  fromPrevPct: number | null;
};

export type Funnel = {
  from: Date;
  to: Date;
  rows: FunnelRow[];
  /** פניות ראשונות — זוגות ייחודיים של (סשן, מודעה) שהגיעו למגע */
  northStar: number;
  /** אחוז הפניות שהמוכר השיב להן */
  replyRatePct: number | null;
};

/**
 * המשפך לטווח תאריכים.
 *
 * שאילתה אחת לספירות הסשנים ואחת לזוגות (סשן, מודעה) — לא אחת לכל
 * שלב. חמש נסיעות הלוך-חזור למסד בשביל חמישה מספרים הן בדיוק סוג
 * העומס שמתחיל להכאיב כשהטבלה גדלה.
 */
export async function funnelFor(from: Date, to: Date): Promise<Funnel> {
  const [bySteps, reach] = await Promise.all([
    prisma.$queryRaw<{ step: FunnelStep; sessions: bigint }[]>`
      SELECT step, COUNT(DISTINCT "sessionId") AS sessions
      FROM "FunnelEvent"
      WHERE day BETWEEN ${from} AND ${to}
      GROUP BY step
    `,
    prisma.$queryRaw<{ reached: bigint; messaged: bigint; replied: bigint }[]>`
      WITH contacts AS (
        SELECT DISTINCT "sessionId", "listingId"
        FROM "FunnelEvent"
        WHERE day BETWEEN ${from} AND ${to}
          AND step IN ('REVEAL', 'MESSAGE')
          AND "listingId" IS NOT NULL
      ),
      messaged AS (
        SELECT DISTINCT "userId", "listingId"
        FROM "FunnelEvent"
        WHERE day BETWEEN ${from} AND ${to}
          AND step = 'MESSAGE'
          AND "userId" IS NOT NULL
          AND "listingId" IS NOT NULL
      ),
      replied AS (
        SELECT DISTINCT "userId", "listingId"
        FROM "FunnelEvent"
        WHERE day BETWEEN ${from} AND ${to}
          AND step = 'REPLY'
          AND "userId" IS NOT NULL
          AND "listingId" IS NOT NULL
      )
      SELECT
        (SELECT COUNT(*) FROM contacts) AS reached,
        (SELECT COUNT(*) FROM messaged) AS messaged,
        (SELECT COUNT(*) FROM messaged m
          WHERE EXISTS (
            SELECT 1 FROM replied r
            WHERE r."listingId" = m."listingId" AND r."userId" = m."userId"
          )) AS replied
    `,
  ]);

  const counts = new Map(bySteps.map((r) => [r.step, Number(r.sessions)]));
  const search = counts.get("SEARCH") ?? 0;
  const view = counts.get("VIEW") ?? 0;

  const rows: FunnelRow[] = FUNNEL_ORDER.map((step) => {
    const sessions = counts.get(step) ?? 0;
    return {
      step,
      label: STEP_LABEL[step],
      sessions,
      /*
       * רק המעבר חיפוש ← צפייה הוא רצף אמיתי. חשיפה והודעה הן חלופות
       * זו לזו ולא שלבים עוקבות, ולכן הן נמדדות מול הצפיות ולא זו מול
       * זו; ו-`REPLY` הוא פעולה של המוכר ולא המשך של מסע הקונה.
       */
      fromPrevPct:
        step === "SEARCH"
          ? null
          : step === "VIEW"
            ? pct(sessions, search)
            : step === "REPLY"
              ? null
              : pct(sessions, view),
    };
  });

  /*
   * שיעור המענה נמדד על פניות בהודעה בלבד, ולא על כלל המגעים.
   * לשיחת טלפון אין "מענה" שהמערכת יכולה לראות, וחלוקה בכלל המגעים
   * הייתה מייצרת מספר שיורד ככל שיותר אנשים מתקשרים — כלומר מדד
   * שנפגע דווקא כשהמוצר עובד.
   */
  const reached = Number(reach[0]?.reached ?? 0);
  const messaged = Number(reach[0]?.messaged ?? 0);
  const replied = Number(reach[0]?.replied ?? 0);

  return {
    from,
    to,
    rows,
    northStar: reached,
    replyRatePct: pct(replied, messaged),
  };
}

/** מגמת מדד הצפון ליום, לטווח הנתון. */
export async function northStarTrend(
  from: Date,
  to: Date,
): Promise<{ day: string; contacts: number }[]> {
  const rows = await prisma.$queryRaw<{ day: Date; contacts: bigint }[]>`
    SELECT day, COUNT(*) AS contacts
    FROM (
      SELECT DISTINCT day, "sessionId", "listingId"
      FROM "FunnelEvent"
      WHERE day BETWEEN ${from} AND ${to}
        AND step IN ('REVEAL', 'MESSAGE')
        AND "listingId" IS NOT NULL
    ) c
    GROUP BY day
    ORDER BY day
  `;

  return rows.map((r) => ({
    day: r.day.toISOString().slice(0, 10),
    contacts: Number(r.contacts),
  }));
}

function pct(part: number, whole: number): number | null {
  if (whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}
