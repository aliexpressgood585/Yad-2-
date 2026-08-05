/**
 * בדיקות מדידה.
 *   npm run check:metrics
 *
 * מקבע את מה שמגן על המספרים עצמם: המשפך סופר סשנים ייחודיים ולא
 * אירועים, מגע נספר פעם אחת לכל זוג (סשן, מודעה) גם כשהקונה חשף טלפון
 * *וגם* שלח הודעה, ושיעור המענה נמדד לכל זוג (קונה, מודעה) ולא לכל
 * מודעה.
 *
 * הבדיקה כותבת אירועים אמיתיים למסד תחת מזהי סשן ייעודיים, ומוחקת
 * אותם בסוף. היא לא נוגעת בשום נתון אחר.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

let failed = 0;

function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

/** קידומת ייחודית להרצה, כדי ששתי הרצות במקביל לא ידרסו זו את זו. */
const TAG = `check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const sid = (n: string) => `${TAG}-${n}`;

/**
 * תאריך היסטורי קבוע, ולא היום.
 *
 * `funnelFor` מקבל טווח תאריכים וסופר את **כל** מה שנמצא בו — הוא לא
 * יודע דבר על הקידומת של הבדיקה, וגם לא צריך לדעת. כשהבדיקה כתבה
 * להיום, כל אירוע אמיתי שנרשם באותו יום נספר יחד איתה: הרצה אחת של
 * בדיקת הקבלה הפכה 2 מגעים ל-5 והפילה את הבדיקה.
 *
 * יום בשנת 1990 לא ייתפס לעולם בנתוני אמת, ולכן הבדיקה מבודדת בלי
 * להוסיף פרמטר בדיקות ל-API של הייצור.
 */
const DAY = new Date(Date.UTC(1990, 0, 5));

const LISTING_A = `${TAG}-listing-a`;
const LISTING_B = `${TAG}-listing-b`;
const BUYER = `${TAG}-buyer`;

async function main() {
  /*
   * התרחיש:
   *   sess-1  חיפש, צפה, חשף טלפון *וגם* שלח הודעה על מודעה A
   *   sess-2  חיפש, צפה, שלח הודעה על מודעה A — והמוכר השיב
   *   sess-3  חיפש, צפה, ולא יצר קשר
   *   sess-1  צפה גם במודעה B בלי ליצור קשר
   *
   * ולכן: 3 חיפושים, 3 צופים, 2 מגעים ייחודיים, 1 מענה מתוך 2 פניות.
   */
  await prisma.funnelEvent.createMany({
    data: [
      { step: "SEARCH", day: DAY, sessionId: sid("1") },
      { step: "SEARCH", day: DAY, sessionId: sid("1") }, // חיפוש שני של אותו אדם
      { step: "SEARCH", day: DAY, sessionId: sid("2") },
      { step: "SEARCH", day: DAY, sessionId: sid("3") },

      { step: "VIEW", day: DAY, sessionId: sid("1"), listingId: LISTING_A },
      { step: "VIEW", day: DAY, sessionId: sid("1"), listingId: LISTING_B },
      { step: "VIEW", day: DAY, sessionId: sid("2"), listingId: LISTING_A },
      { step: "VIEW", day: DAY, sessionId: sid("3"), listingId: LISTING_A },

      // אותו אדם, אותה מודעה, שתי דרכי יצירת קשר — מגע אחד
      { step: "REVEAL", day: DAY, sessionId: sid("1"), listingId: LISTING_A },
      {
        step: "MESSAGE",
        day: DAY,
        sessionId: sid("1"),
        userId: `${BUYER}-1`,
        listingId: LISTING_A,
      },

      {
        step: "MESSAGE",
        day: DAY,
        sessionId: sid("2"),
        userId: `${BUYER}-2`,
        listingId: LISTING_A,
      },
      // המוכר השיב לקונה 2 בלבד
      {
        step: "REPLY",
        day: DAY,
        sessionId: sid("seller"),
        userId: `${BUYER}-2`,
        listingId: LISTING_A,
      },
    ],
  });

  const { funnelFor, northStarTrend } = await import("../../src/lib/metrics");
  const funnel = await funnelFor(DAY, DAY);

  const row = (step: string) => funnel.rows.find((r) => r.step === step);

  console.log("ספירת סשנים\n");
  check(
    (row("SEARCH")?.sessions ?? 0) >= 3,
    "חיפוש סופר סשנים ולא אירועים",
    `${row("SEARCH")?.sessions} סשנים משני אירועים של אותו אדם ועוד שניים`,
  );
  check((row("VIEW")?.sessions ?? 0) >= 3, "צפייה סופרת סשנים", `${row("VIEW")?.sessions}`);

  console.log("\nמגעים\n");
  /*
   * זו הבדיקה המרכזית. סשן 1 גם חשף טלפון וגם שלח הודעה על אותה מודעה;
   * ספירה נאיבית של אירועי REVEAL+MESSAGE הייתה מחזירה 3 מגעים במקום 2
   * ומנפחת את מדד הצפון בכל מי שעשה את שתי הפעולות.
   */
  check(
    funnel.northStar === 2,
    "חשיפה והודעה על אותה מודעה נספרות כמגע אחד",
    `${funnel.northStar} מגעים`,
  );

  console.log("\nשיעור מענה\n");
  /*
   * המוכר השיב לקונה אחד מתוך שניים על אותה מודעה. התאמה לפי מודעה
   * בלבד הייתה מחזירה 100%, כי לאותה מודעה *יש* מענה כלשהו.
   */
  check(
    funnel.replyRatePct === 50,
    "מענה נמדד לכל זוג (קונה, מודעה) ולא לכל מודעה",
    `${funnel.replyRatePct}%`,
  );

  console.log("\nמגמה\n");
  const trend = await northStarTrend(DAY, DAY);
  check(trend.length === 1, "יום אחד בטווח של יום", `${trend.length} ימים`);
  check(trend[0]?.contacts === 2, "המגמה תואמת את מדד הצפון", `${trend[0]?.contacts} פניות`);

  console.log("\nעמידות\n");
  const empty = await funnelFor(new Date("1990-01-01"), new Date("1990-01-02"));
  check(empty.northStar === 0, "טווח ריק מחזיר אפס ולא נופל");
  check(empty.replyRatePct === null, "שיעור מענה בלי פניות הוא null ולא 0%", "אין חלוקה באפס");
}

main()
  .catch((err) => {
    console.error(err);
    failed++;
  })
  .finally(async () => {
    await prisma.funnelEvent.deleteMany({ where: { sessionId: { startsWith: TAG } } });
    await prisma.$disconnect();

    if (failed) {
      console.error(`\n${failed} בדיקות נכשלו`);
      process.exit(1);
    }
    console.log("\nכל בדיקות המדידה עברו");
  });
