/**
 * בדיקות לולאת ההתראות.
 *   npm run check:notify
 *
 * מכסה את ארבעת הדברים שהתור קיים בשבילם: לא לשלוח פעמיים, לא לאבד
 * התראה שנכשלה, לא לצפצף בלילה ובשבת, ולא לשלוח שש הודעות כשאפשר אחת.
 *
 * החישובים של שעות השקט טהורים ונבדקים ישירות. הקיבוץ נבדק דרך
 * `groupMessage`, גם הוא טהור. אין כאן גישה למסד.
 */
import {
  isNight,
  isShabbat,
  isQuiet,
  nextAllowedTime,
  israelParts,
  sunsetUtc,
} from "../../src/lib/quiet-hours";
import { groupMessage, backoffMinutes, MAX_ATTEMPTS } from "../../src/lib/notify-queue";

let failed = 0;

function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

/** בונה `Date` משעה מקומית בישראל, דרך היסט שמחושב מהאזור עצמו. */
function israelTime(iso: string): Date {
  // `Date` מפרש ISO בלי אזור כ-UTC; מתקנים לפי ההיסט בפועל באותו יום
  const naive = new Date(`${iso}Z`);
  const guess = new Date(naive.getTime() - 120 * 60_000);
  const { hour, minute } = israelParts(guess);
  const wantedH = naive.getUTCHours();
  const wantedM = naive.getUTCMinutes();
  const driftMin = (hour - wantedH) * 60 + (minute - wantedM);
  return new Date(guess.getTime() - driftMin * 60_000);
}

/* --- לילה ---------------------------------------------------------------- */

console.log("שעות לילה\n");

check(isNight(israelTime("2026-03-10T23:30:00")), "23:30 הוא לילה");
check(isNight(israelTime("2026-03-10T02:00:00")), "02:00 הוא לילה");
check(isNight(israelTime("2026-03-10T07:59:00")), "07:59 עדיין לילה");
check(!isNight(israelTime("2026-03-10T08:01:00")), "08:01 כבר לא");
check(!isNight(israelTime("2026-03-10T21:59:00")), "21:59 עדיין מותר");

/* --- שבת ----------------------------------------------------------------- */

console.log("\nשבת\n");

/*
 * הבדיקה המרכזית של הקובץ.
 *
 * שישי ב-17:30 הוא שבת בדצמבר (השקיעה 16:47) ואינו שבת ביולי
 * (השקיעה 19:48). סף קבוע של "שישי אחרי 18:00" נכשל בשני הכיוונים:
 * שולח בשבת בדצמבר, וחוסם שעתיים מיותרות ביולי.
 */
const decFriEvening = israelTime("2026-12-11T17:30:00");
const julFriEvening = israelTime("2026-07-10T17:30:00");

check(israelParts(decFriEvening).weekday === 5, "11.12.2026 הוא יום שישי");
check(israelParts(julFriEvening).weekday === 5, "10.7.2026 הוא יום שישי");

check(isShabbat(decFriEvening), "שישי 17:30 בדצמבר הוא שבת", "שקיעה מוקדמת");
check(!isShabbat(julFriEvening), "שישי 17:30 ביולי אינו שבת", "שקיעה מאוחרת");

/*
 * השקיעה מקובעת מול לוח אמיתי, ולא רק "גדולה מ".
 *
 * הגרסה הראשונה החזירה 04:36 במקום 16:39 — היום היוליאני מתחיל
 * בצהריים, והשבר של חצי יום נשאר בחישוב. שעה כזו נראית סבירה לגמרי
 * למי שלא בדק מול לוח, וכל הבדיקות ה"רכות" שסביבה עברו.
 */
function israelHourOf(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

for (const [label, iso, expected] of [
  ["11.12.2026", "2026-12-11T12:00:00Z", 16 * 60 + 39],
  ["10.7.2026", "2026-07-10T12:00:00Z", 19 * 60 + 47],
  ["21.3.2026", "2026-03-21T12:00:00Z", 17 * 60 + 52],
] as const) {
  const at = sunsetUtc(new Date(iso));
  const shown = israelHourOf(at);
  const [h, m] = shown.split(":").map(Number);
  const drift = Math.abs(h! * 60 + m! - expected);
  check(drift <= 10, `שקיעה ב-${label} תואמת ללוח`, `${shown} · סטייה ${drift} דק'`);
}

const decSunset = sunsetUtc(decFriEvening);
const julSunset = sunsetUtc(julFriEvening);
const gapMinutes = Math.round((julSunset.getTime() - decSunset.getTime()) / 60_000) % 1440;
check(
  Math.abs(gapMinutes) > 120,
  "השקיעה זזה יותר משעתיים בין דצמבר ליולי",
  `${Math.abs(gapMinutes)} דקות — בדיוק מה שסף קבוע היה מפספס`,
);

check(isShabbat(israelTime("2026-12-12T12:00:00")), "שבת בצהריים היא שבת");
check(!isShabbat(israelTime("2026-12-13T12:00:00")), "ראשון אינו שבת");
check(!isShabbat(israelTime("2026-12-11T10:00:00")), "שישי בבוקר אינו שבת");

/* --- דחייה ולא מחיקה ------------------------------------------------------ */

console.log("\nדחייה לזמן מותר\n");

for (const [label, iso] of [
  ["לילה בחול", "2026-03-10T23:30:00"],
  ["שבת בצהריים", "2026-12-12T12:00:00"],
  ["ערב שבת אחרי השקיעה", "2026-12-11T17:30:00"],
] as const) {
  const at = israelTime(iso);
  const next = nextAllowedTime(at);
  check(!isQuiet(next), `${label} → נדחה לזמן מותר`, next.toISOString());
  check(next.getTime() > at.getTime(), `${label} → הזמן קדימה ולא אחורה`);
}

const allowed = israelTime("2026-03-10T10:00:00");
check(
  nextAllowedTime(allowed).getTime() === allowed.getTime(),
  "זמן מותר נשאר כמו שהוא",
  "אין דחייה מיותרת",
);

/*
 * מוצאי שבת בדצמבר: השבת יוצאת ב-17:30 בערך, אבל 22:00 עוד רחוק —
 * ולכן הזמן המותר הוא באותו ערב ולא למחרת בבוקר. זה החיתוך בין שני
 * הכללים, והוא הסיבה שהמימוש מקדם בצעדים במקום לפתור אנליטית.
 */
const motzash = israelTime("2026-12-12T16:00:00");
const afterMotzash = nextAllowedTime(motzash);
check(
  israelParts(afterMotzash).weekday === 6 && israelParts(afterMotzash).hour < 22,
  "מוצאי שבת בדצמבר → נשלח באותו ערב",
  `${israelParts(afterMotzash).hour}:00 במוצ"ש`,
);

/* --- backoff ------------------------------------------------------------- */

console.log("\nניסיונות חוזרים\n");

check(backoffMinutes(1) === 5, "ניסיון ראשון — 5 דקות");
check(backoffMinutes(2) === 25, "ניסיון שני — 25 דקות");
check(backoffMinutes(2) > backoffMinutes(1), "ההשהיה גדלה ולא קבועה");
check(MAX_ATTEMPTS === 3, "שלושה ניסיונות ואז ויתור", "לא לופ אינסופי");

/* --- קיבוץ --------------------------------------------------------------- */

console.log("\nקיבוץ\n");

const one = groupMessage("NEW_MESSAGE", [
  { title: "הודעה חדשה מדנה", body: "שלום, המודעה עדיין רלוונטית?" },
]);
check(one.title === "הודעה חדשה מדנה", "עבודה בודדת נשלחת כמו שהיא", "בלי ניסוח מקובץ");

const many = groupMessage("NEW_MESSAGE", [
  { title: "א", body: "1", itemLabel: "טויוטה קורולה" },
  { title: "ב", body: "2", itemLabel: "דירה בפלורנטין" },
  { title: "ג", body: "3", itemLabel: "ספה" },
]);
check(many.title === "3 הודעות חדשות", "שלוש עבודות → הודעה אחת", many.title);
check(many.url === "/my/messages", "הקישור מצביע לרשימה ולא לפריט הראשון", many.url ?? "");
check(
  many.body.includes("טויוטה קורולה") && many.body.includes("ספה"),
  "הגוף מונה את הפריטים",
  many.body,
);

const overflow = groupMessage(
  "SAVED_SEARCH_MATCH",
  Array.from({ length: 6 }, (_, i) => ({ title: "x", body: "y", itemLabel: `חיפוש ${i + 1}` })),
);
check(overflow.title.startsWith("6 "), "שש עבודות → כותרת אחת", overflow.title);
check(overflow.body.includes("ועוד"), "רשימה ארוכה נגמרת ב'ועוד'", overflow.body);

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות ההתראות עברו");
