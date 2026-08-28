/**
 * שעות שקט — מתי הלוח אינו שולח התראות.
 *
 * שני חלונות:
 *
 *   **לילה** — 22:00 עד 07:00 שעון ישראל.
 *   **שבת** — מ-40 דקות לפני שקיעה ביום שישי עד 50 דקות אחרי שקיעה
 *   במוצאי שבת.
 *
 * למה זה חלק מהמערכת ולא הגדרה: התראה שמעירה אדם בשלוש לפנות בוקר
 * אינה גורמת לו לחזור ללוח, אלא לכבות את ההתראות — ואז כל הערוץ אבד.
 * החישוב כאן קובע מתי **מותר** לשלוח, וההתראה נדחית לשם במקום להימחק:
 * אף התראה אינה מבוטלת בגלל שעות שקט, היא רק מחכה.
 *
 * ## למה שקיעה מחושבת ולא מקובעת
 *
 * "שישי 18:00 עד שבת 20:00" נראה סביר בינואר וגורם ללוח לשלוח התראות
 * בשעה שבע בערב ביולי, כשהשמש עוד גבוהה בשמיים אבל השבת כבר נכנסה
 * לפי כל לוח. הפרש השקיעה בין דצמבר ליולי בישראל הוא כשעתיים —
 * גדול מכל טווח סביר של קירוב.
 *
 * החישוב הוא אלגוריתם NOAA לזווית שמש של 90.833° (כולל שבירה
 * אטמוספרית ורדיוס השמש), עבור נקודת ייחוס אחת בישראל. אין כאן קריאת
 * רשת ואין תלות בשירות חיצוני.
 *
 * ## מה במפורש לא כלול
 *
 * חגי ישראל. ראש השנה, יום כיפור וסוכות דורשים לוח שנה עברי מלא, וזה
 * פרויקט בפני עצמו; המערכת אינה מתיימרת לכסות אותם, וזה מתועד ב-GROWTH.md
 * ולא מוסתר מאחורי חצי מימוש שנופל פעמיים בשנה.
 */

/** נקודת הייחוס לחישוב השקיעה — ירושלים. */
const REFERENCE = { lat: 31.7683, lon: 35.2137 } as const;

/** זווית השמש שמגדירה שקיעה, כולל שבירה אטמוספרית ורדיוס השמש. */
const ZENITH = 90.833;

/** 22:00 עד 07:00 שעון ישראל. */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 7;

/**
 * הכניסה מוקדמת ביחס לשקיעה והיציאה מאוחרת ביחס לה, בשתי הקצוות
 * לכיוון הזהירות: עדיף שהתראה תגיע רבע שעה מאוחר מדי מאשר דקה מוקדם
 * מדי.
 */
export const SHABBAT_ENTRY_MINUTES_BEFORE_SUNSET = 40;
export const SHABBAT_EXIT_MINUTES_AFTER_SUNSET = 50;

const MINUTE = 60_000;
const DEG = Math.PI / 180;

/** מספר היום בשנה עבור תאריך UTC. */
function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

/**
 * שקיעה ב-UTC עבור תאריך נתון בנקודת הייחוס.
 *
 * אלגוריתם NOAA/USNO הסטנדרטי. מוחזר `Date` באותו יום קלנדרי (UTC)
 * שבו נמצא `date`.
 */
export function sunsetUtc(date: Date): Date {
  const n = dayOfYear(date);
  const lngHour = REFERENCE.lon / 15;

  // 1. זמן משוער — 18:00 מקומי לשקיעה
  const t = n + (18 - lngHour) / 24;

  // 2. אנומליה ממוצעת של השמש
  const M = 0.9856 * t - 3.289;

  // 3. אורך אמיתי
  let L = M + 1.916 * Math.sin(M * DEG) + 0.02 * Math.sin(2 * M * DEG) + 282.634;
  L = ((L % 360) + 360) % 360;

  // 4. עלייה ישרה, מותאמת לאותו רביע כמו L
  let RA = Math.atan(0.91764 * Math.tan(L * DEG)) / DEG;
  RA = ((RA % 360) + 360) % 360;
  RA += Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90;
  RA /= 15;

  // 5. נטייה
  const sinDec = 0.39782 * Math.sin(L * DEG);
  const cosDec = Math.cos(Math.asin(sinDec));

  // 6. זווית השעה המקומית
  const cosH =
    (Math.cos(ZENITH * DEG) - sinDec * Math.sin(REFERENCE.lat * DEG)) /
    (cosDec * Math.cos(REFERENCE.lat * DEG));

  // בקווי הרוחב של ישראל השמש שוקעת בכל יום בשנה; הענף הזה קיים
  // רק כדי שהפונקציה תהיה מוגדרת גם אם נקודת הייחוס תשתנה אי פעם.
  if (cosH > 1 || cosH < -1) {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 16, 0, 0),
    );
  }

  /*
   * ענף השקיעה: `acos` ישירות. הענף `360 - acos` הוא הזריחה, ושתי
   * הנוסחאות נראות זהות למי שקורא במהירות — הן נבדלות בתו אחד ונותנות
   * תוצאה שנופלת בערך עשר שעות מהאמת, כלומר "שקיעה" ב-06:40 בבוקר.
   */
  const H = Math.acos(cosH) / DEG / 15;
  const T = H + RA - 0.06571 * t - 6.622;
  const ut = ((((T - lngHour) % 24) + 24) % 24) * 3600_000;

  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) + ut,
  );
}

/**
 * חלקי הזמן בשעון ישראל.
 *
 * `Intl` ולא היסט קבוע: ישראל עוברת לשעון קיץ, ומספר קבוע היה מזיז את
 * חלון הלילה בשעה במשך חצי שנה.
 */
const JERUSALEM = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  hour12: false,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function jerusalemParts(at: Date): { weekday: number; hour: number; minute: number } {
  const parts = Object.fromEntries(
    JERUSALEM.formatToParts(at).map((p) => [p.type, p.value]),
  );
  return {
    weekday: WEEKDAYS.indexOf(parts.weekday ?? "Sun"),
    hour: Number(parts.hour ?? 0),
    minute: Number(parts.minute ?? 0),
  };
}

/** חלון השבת שחל על התאריך הנתון, או `null` אם אין חפיפה אפשרית. */
function shabbatWindow(at: Date): { start: Date; end: Date } | null {
  // נבדקות שבתות של השבוע הנוכחי והקודם, כי `at` יכול ליפול בשבת
  // בבוקר — ואז הכניסה הייתה ביום שישי הקודם.
  for (const offset of [0, -1, -2]) {
    const probe = new Date(at.getTime() + offset * 86_400_000);
    const { weekday } = jerusalemParts(probe);
    if (weekday !== 5) continue; // שישי

    const friday = new Date(probe);
    const saturday = new Date(probe.getTime() + 86_400_000);

    const start = new Date(
      sunsetUtc(friday).getTime() - SHABBAT_ENTRY_MINUTES_BEFORE_SUNSET * MINUTE,
    );
    const end = new Date(
      sunsetUtc(saturday).getTime() + SHABBAT_EXIT_MINUTES_AFTER_SUNSET * MINUTE,
    );
    if (at >= start && at < end) return { start, end };
  }
  return null;
}

/** חלון הלילה שחל על הרגע הנתון, או `null`. */
function nightWindow(at: Date): { end: Date } | null {
  const { hour } = jerusalemParts(at);
  const inNight = hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
  if (!inNight) return null;

  /*
   * סוף החלון נמצא בחיפוש קדימה בצעדי דקה ולא בחישוב היסט.
   *
   * זה נראה עצל והוא ההפך: מעבר שעון קיץ מזיז את 07:00 המקומי ביחס
   * ל-UTC, וחישוב "היום הבא ב-07:00" דרך היסט קבוע נותן 06:00 או 08:00
   * פעמיים בשנה. חיפוש שנשען על `Intl` נכון תמיד, ועולה לכל היותר
   * 660 בדיקות זולות פעם בהתראה.
   *
   * הצעד הוא דקה ולא רבע שעה כדי שהתוצאה תהיה 07:00 בדיוק ולא 07:12:
   * הזמן הזה נכתב ל-`scheduledFor` ומוצג בתור, ומספר שנראה אקראי גורם
   * למי שקורא אותו לחפש באג שאינו קיים.
   */
  let cursor = new Date(at.getTime() - (at.getTime() % MINUTE));
  for (let i = 0; i < 660; i++) {
    cursor = new Date(cursor.getTime() + MINUTE);
    const { hour: h } = jerusalemParts(cursor);
    if (h >= NIGHT_END_HOUR && h < NIGHT_START_HOUR) return { end: cursor };
  }
  return { end: new Date(at.getTime() + 9 * 3600_000) };
}

/** האם הרגע הנתון נמצא בשעת שקט. */
export function isQuiet(at: Date): boolean {
  return nightWindow(at) !== null || shabbatWindow(at) !== null;
}

/**
 * הרגע הקרוב ביותר שבו מותר לשלוח, החל מ-`at`.
 *
 * מוחזר `at` עצמו כשמותר עכשיו. בלולאה כי החלונות יכולים להשיק זה
 * לזה: מוצאי שבת ב-20:30 בחורף נופל אל תוך... לא, אבל כניסת שבת
 * בחורף (16:20) נופלת אחרי סוף חלון הלילה, וסוף השבת (17:50) נופל
 * לפני תחילת חלון הלילה הבא — ובקיץ סוף השבת ב-21:00 נופל שעה לפני
 * תחילת הלילה. הלולאה מטפלת בכל צירוף בלי לנחש איזה מהם אפשרי.
 */
export function nextAllowedTime(at: Date): Date {
  let cursor = at;
  for (let i = 0; i < 8; i++) {
    const night = nightWindow(cursor);
    if (night) {
      cursor = night.end;
      continue;
    }
    const shabbat = shabbatWindow(cursor);
    if (shabbat) {
      cursor = shabbat.end;
      continue;
    }
    return cursor;
  }
  return cursor;
}
