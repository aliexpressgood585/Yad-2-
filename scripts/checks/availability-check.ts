/**
 * בדיקות טריות מודעה.
 *   npm run check:availability
 *
 * מקבע את שלוש ההחלטות שהפיצ'ר עומד עליהן: מודעה חדשה לא מתויגת
 * כלא-מאושרת, אישור מנצח את תאריך הפרסום, וצינון הבקשות באמת מונע
 * הצפה של המוכר.
 */
import {
  ASK_COOLDOWN_HOURS,
  STALE_DAYS,
  canAsk,
  freshnessLabel,
  freshnessOf,
  needsNudge,
} from "../../src/lib/availability";

let failed = 0;
function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

const NOW = new Date("2026-06-15T10:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000);

/* --- מצב הטריות ----------------------------------------------------------- */

console.log("מצב הטריות\n");

/*
 * מודעה שפורסמה אתמול לא צריכה אישור. לתייג אותה כ"לא אושרה" היה
 * מייצר אזהרה על כל מודעה חדשה בלוח — כלומר להפוך את התג לרעש ביום
 * הראשון.
 */
check(
  freshnessOf({ publishedAt: daysAgo(1), now: NOW }).kind === "new",
  "מודעה מאתמול היא חדשה, לא לא-מאושרת",
);
check(
  freshnessOf({ publishedAt: daysAgo(10), now: NOW }).kind === "confirmed",
  "מודעה בת 10 ימים בלי אישור עדיין בטווח",
);
check(
  freshnessOf({ publishedAt: daysAgo(STALE_DAYS + 5), now: NOW }).kind === "stale",
  `מעל ${STALE_DAYS} ימים בלי אישור → לא אושרה`,
);

/*
 * אישור גובר על תאריך הפרסום. מודעה בת חצי שנה שאושרה היום היא מודעה
 * טרייה, וזו כל הנקודה של הפיצ'ר.
 */
const old = freshnessOf({ publishedAt: daysAgo(180), availabilityAt: daysAgo(0), now: NOW });
check(old.kind === "confirmed", "אישור גובר על תאריך פרסום ישן", freshnessLabel(old));
check(freshnessLabel(old) === "אושר היום", "ניסוח של אישור מהיום", freshnessLabel(old));

check(
  freshnessLabel(freshnessOf({ availabilityAt: daysAgo(1), now: NOW })) === "אושר אתמול",
  "ניסוח של אתמול",
);

/*
 * אישור ישן חוזר להיות לא-מאושר. אחרת "אושר" הופך לתג קבוע שמוכר
 * מקבל פעם אחת ואיש כבר לא יכול לסמוך עליו.
 */
check(
  freshnessOf({ availabilityAt: daysAgo(STALE_DAYS + 1), now: NOW }).kind === "stale",
  "אישור שפג תוקפו חוזר ללא-מאושר",
);

check(
  freshnessOf({ publishedAt: null, availabilityAt: null, now: NOW }).kind === "new",
  "בלי תאריכים בכלל → חדשה, ולא נופל",
);

/*
 * שעון לא מסונכרן נותן תאריך עתידי. מספר ימים שלילי היה מייצר
 * "אושר לפני -3 ימים", וזה נראה כמו באג בדיוק כמו שהוא באג.
 */
check(
  freshnessOf({ availabilityAt: new Date(NOW.getTime() + 86_400_000), now: NOW }).kind === "new",
  "תאריך עתידי אינו מייצר מספר שלילי",
);

/* --- תזכורת יזומה --------------------------------------------------------- */

console.log("\nתזכורת יזומה\n");

check(needsNudge({ publishedAt: daysAgo(60), now: NOW }), "מודעה בת חודשיים דורשת תזכורת");
check(!needsNudge({ publishedAt: daysAgo(5), now: NOW }), "מודעה טרייה לא דורשת");
check(
  !needsNudge({ publishedAt: daysAgo(200), availabilityAt: daysAgo(2), now: NOW }),
  "מודעה ישנה שאושרה לאחרונה לא דורשת",
);

/* --- צינון הבקשות --------------------------------------------------------- */

console.log("\nצינון בקשות\n");

check(canAsk(null, NOW).allowed, "מודעה שאיש לא שאל עליה — מותר");
check(canAsk(hoursAgo(ASK_COOLDOWN_HOURS + 1), NOW).allowed, "אחרי הצינון — מותר שוב");

const blocked = canAsk(hoursAgo(2), NOW);
check(!blocked.allowed, "שאלו לפני שעתיים — חסום", "מגן על המוכר מהצפה");
check(
  !blocked.allowed && blocked.hoursLeft > 0 && blocked.hoursLeft <= ASK_COOLDOWN_HOURS,
  "מוחזר כמה זמן נשאר",
  !blocked.allowed ? `${blocked.hoursLeft} שעות` : "",
);

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות הטריות עברו");
