/**
 * שעות שקט — מתי מותר לשלוח התראה.
 *
 * שני כללים, ושניהם על שעון ישראל:
 *
 *   לילה — אין שליחה בין 22:00 ל-08:00.
 *   שבת  — אין שליחה משקיעה בערב שבת עד צאת השבת במוצאי שבת.
 *
 * **השבת מחושבת מהשקיעה ולא מ"שישי אחרי 18:00".** ההפרש בין הקיץ
 * לחורף בישראל הוא כשעה ורבע: שקיעה ב-16:40 בדצמבר ו-19:50 ביולי.
 * סף קבוע היה שולח התראות בשבת בדצמבר, או חוסם שעתיים מיותרות ביולי —
 * ובמוצר ישראלי זו לא אי-דיוק אלא טעות שנראית כמו זלזול.
 *
 * הפונקציות כאן טהורות ומקבלות `now` כפרמטר, כדי שיהיו בדיקות.
 */

/** ירושלים. השקיעה בתל אביב מאוחרת ב-4 דקות בערך, וזה בתוך המרווח. */
const LAT = 31.7683;
const LON = 35.2137;

/** אין שליחה מ-22:00 עד 08:00 שעון ישראל. */
export const NIGHT_START_HOUR = 22;
export const NIGHT_END_HOUR = 8;

/**
 * מרווח לפני השקיעה שבו כבר לא שולחים.
 * 18 דקות הוא הנוהג המקובל להדלקת נרות, וזה גם הרגע שממנו והלאה
 * התראה בטלפון היא הפרעה ולא שירות.
 */
const CANDLE_LIGHTING_MINUTES = 18;

/**
 * צאת השבת — כ-42 דקות אחרי השקיעה (שלושה כוכבים).
 * לא נכנסים כאן לשיטות; המספר שמרני ומאחר, וזה הכיוון הנכון לטעות בו.
 */
const HAVDALAH_MINUTES = 42;

/**
 * ההיסט של שעון ישראל מ-UTC בדקות, לתאריך נתון.
 *
 * נגזר מ-`Intl` ולא מטבלת תאריכים: מועדי שעון הקיץ בישראל נקבעים
 * בחוק ומשתנים, וטבלה שנכתבת היום תהיה שגויה בעוד שנתיים.
 */
export function israelOffsetMinutes(when: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    timeZoneName: "longOffset",
  }).formatToParts(when);

  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+02:00";
  const m = /GMT([+-])(\d{2}):(\d{2})/.exec(raw);
  if (!m) return 120;

  const sign = m[1] === "-" ? -1 : 1;
  return sign * (Number(m[2]) * 60 + Number(m[3]));
}

/** השעה והיום בשבוע לפי שעון ישראל. יום 0 = ראשון, 6 = שבת. */
export function israelParts(when: Date): { hour: number; minute: number; weekday: number } {
  const shifted = new Date(when.getTime() + israelOffsetMinutes(when) * 60_000);
  return {
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

/**
 * שקיעה בירושלים ביום נתון, כ-`Date` ב-UTC.
 *
 * קירוב NOAA. הדיוק סביב דקה, ומול מרווח של 18 ו-42 דקות זה מספיק
 * בהרבה — אין כאן שימוש הלכתי, אלא החלטה מתי לא לצפצף בטלפון.
 */
export function sunsetUtc(when: Date): Date {
  const dayMs = 86_400_000;
  const daysSinceEpoch = Math.floor(when.getTime() / dayMs);

  /*
   * מספר היום מאז J2000, **כמספר שלם**.
   *
   * היום היוליאני מתחיל בצהריים ולא בחצות, ולכן `jDay - 2451545.0`
   * מסתיים תמיד ב-0.5. השארת השבר הזו הזיזה את כל החישוב בחצי יום
   * בדיוק, והשקיעה יצאה ב-04:36 במקום ב-16:39 — שעה שנראית לגמרי
   * סבירה למי שלא בדק מול לוח אמיתי.
   */
  const jDay = daysSinceEpoch + 2440587.5;
  const n = Math.round(jDay - 2451545.0 + 0.0008);

  const meanSolarNoon = n - LON / 360;
  const M = (357.5291 + 0.98560028 * meanSolarNoon) % 360;
  const rad = Math.PI / 180;

  const C =
    1.9148 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 0.0003 * Math.sin(3 * M * rad);
  const lambda = (M + C + 180 + 102.9372) % 360;

  const jTransit =
    2451545.0 + meanSolarNoon + 0.0053 * Math.sin(M * rad) - 0.0069 * Math.sin(2 * lambda * rad);

  const delta = Math.asin(Math.sin(lambda * rad) * Math.sin(23.44 * rad));

  // -0.833° מביא בחשבון את רדיוס השמש ואת השבירה האטמוספרית
  const cosOmega =
    (Math.sin(-0.833 * rad) - Math.sin(LAT * rad) * Math.sin(delta)) /
    (Math.cos(LAT * rad) * Math.cos(delta));

  // בקווי הרוחב של ישראל השמש שוקעת בכל יום; ההגנה כאן היא מפני NaN
  const omega = Math.acos(Math.max(-1, Math.min(1, cosOmega))) / rad;

  const jSet = jTransit + omega / 360;
  return new Date((jSet - 2440587.5) * dayMs);
}

/** האם הרגע נופל בתוך השבת (מהדלקת נרות עד צאת השבת). */
export function isShabbat(when: Date): boolean {
  const { weekday } = israelParts(when);

  if (weekday === 5) {
    const start = sunsetUtc(when).getTime() - CANDLE_LIGHTING_MINUTES * 60_000;
    return when.getTime() >= start;
  }

  if (weekday === 6) {
    const end = sunsetUtc(when).getTime() + HAVDALAH_MINUTES * 60_000;
    return when.getTime() < end;
  }

  return false;
}

/** האם הרגע נופל בשעות הלילה שבהן לא שולחים. */
export function isNight(when: Date): boolean {
  const { hour } = israelParts(when);
  return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
}

export function isQuiet(when: Date): boolean {
  return isNight(when) || isShabbat(when);
}

/**
 * הרגע הבא שבו מותר לשלוח.
 *
 * **דוחה, לא מוחק.** התראה שנופלת בשעת שקט נשלחת בבוקר, ולא נעלמת:
 * הודעה מקונה שהגיעה ב-23:00 היא עדיין רלוונטית ב-08:00, והמוכר שלא
 * קיבל אותה בכלל מפסיד עסקה.
 *
 * המימוש מקדם בצעדים של רבע שעה ולא פותר את התנאים אנליטית. הצעדים
 * זולים, הלוגיקה נשארת קריאה, והפתרון האנליטי היה צריך לטפל בחיתוך
 * בין הלילה לשבת — למשל מוצאי שבת בדצמבר, שיוצאת ב-17:20 אבל הלילה
 * מתחיל רק ב-22:00.
 */
export function nextAllowedTime(from: Date, maxHours = 72): Date {
  const stepMs = 15 * 60_000;
  const limit = from.getTime() + maxHours * 3_600_000;

  let t = from.getTime();
  while (t <= limit) {
    const at = new Date(t);
    if (!isQuiet(at)) return at;
    t += stepMs;
  }

  /*
   * לא אמור לקרות: אין בישראל חלון של 72 שעות שקט רצופות. אם הגענו
   * לכאן משהו בחישוב שבור, ומוטב לשלוח מאוחר מלהחזיק עבודה לנצח.
   */
  return new Date(limit);
}
