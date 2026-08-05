/**
 * בדיקות צבע ההדגשה שנגזר מהמודעה.
 *   npm run check:accent
 *
 * מקבע את מה שמגן על העיצוב: הצבע נגזר מהתמונה, אבל לעולם אינו יוצא
 * מהטווח שהוגדר לו. blurhash שבור או תמונה חסרה מחזירים `null`, והדף
 * חוזר לפלטה במקום להציג צבע שרירותי.
 */
import { accentFromBlurhash } from "../../src/lib/listing-accent";
import { blurDataUrl } from "../../src/lib/blur";

let failed = 0;

function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

function parse(accent: string | null) {
  if (!accent) return null;
  const parts = accent.split(" ");
  if (parts.length !== 2) return null;
  return { h: Number(parts[0]), s: Number(parts[1]!.replace("%", "")) };
}

/**
 * הבהירות שכל ערכה מספקת ל-`--accent-l`. חייב להישאר תואם ל-`globals.css`.
 * הבדיקה למטה מקבעת שהיא באמת שונה בין הערכות: ערך אחד לשתיהן היה
 * מחזיר בדיוק את הבאג שהמנגנון הזה נועד למנוע.
 */
const ACCENT_L = { light: 44, dark: 64 };

/**
 * בהירות יחסית מתוך בהירות HSL — **קירוב, לא מדידת WCAG.**
 *
 * הבהירות ב-HSL אינה ערך ערוץ sRGB, ולכן המספר כאן אינו יחס הניגודיות
 * האמיתי של הצבע הסופי; הוא מספיק כדי לתפוס את מה שהבדיקה הזו מחפשת,
 * שזו הדגשה שנבלעת ברקע. ניגודיות טקסט נבדקת במקום אחר.
 *
 * העקומה היא הליניאריזציה של sRGB. הכיוון ההפוך — `1.055 * v^(1/2.4)`
 * — הוא קידוד ולא פענוח, והוא מחזיר יחסים שטוחים מדי שנראים אמינים.
 */
function relativeLuminance(l: number): number {
  const v = l / 100;
  return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function contrast(a: number, b: number): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/* --- קלט לא תקין ---------------------------------------------------------- */

console.log("קלט לא תקין\n");

check(accentFromBlurhash(null) === null, "null → אין צבע");
check(accentFromBlurhash("") === null, "מחרוזת ריקה → אין צבע");
check(accentFromBlurhash("abc") === null, "hash קצר מדי → אין צבע");
check(accentFromBlurhash("LEHV6n!!!!!!") === null, "תווים שאינם base83 → אין צבע");

/* --- טווח הריסון ---------------------------------------------------------- */

console.log("\nטווח הריסון\n");

// blurhash-ים אמיתיים מתמונות הדמו שבמאגר
const SAMPLES = [
  "LUN^xfxv~W%M?bayt6ofjXayD*WV",
  "LNP$]|%M?b-;~qjut7ofM{j[D%V@",
  "LLQSe?%M_N-;~qoftRofMxfQDiRj",
  "LsNc$ltSt7aJ?wWXbHoes8RPRjxu",
  "L~LE+oofj[of?woMfQj[R*j[fQay",
  "LTMtH[xu~q%M^+j[ozkC.8kCDjay",
  // אפור מלא — אין ממה לגזור צבע
  "L00000fQfQfQfQfQfQfQfQfQfQfQ",
];

for (const hash of SAMPLES) {
  const accent = accentFromBlurhash(hash);
  const hsl = parse(accent);
  if (!hsl) {
    console.log(`✓ ${hash.slice(0, 12)}… → אין צבע (אפור או לא תקין)`);
    continue;
  }
  const inRange = hsl.h >= 0 && hsl.h <= 360 && hsl.s >= 14 && hsl.s <= 42;
  check(inRange, `${hash.slice(0, 12)}… בתוך הטווח`, accent!);
}

/* --- הבהירות מגיעה מהערכה ולא מהתמונה ------------------------------------- */

console.log("\nבהירות לפי ערכה\n");

check(
  parse(accentFromBlurhash(SAMPLES[0]!))?.s !== undefined,
  "הצבע מוחזר כגוון ורוויה בלבד, בלי בהירות",
  accentFromBlurhash(SAMPLES[0]!)!,
);

/*
 * זו הבדיקה שמגנה על המנגנון עצמו.
 *
 * אותה הדגשה צריכה להיראות גם על חוגה בהירה (87%) וגם על גרפיט (10%).
 * ערך בהירות אחד לשתיהן נכשל תמיד באחת מהן — וזה בדיוק מה שקרה כשהצבע
 * כלל בהירות שנגזרה מהתמונה: 34% על גרפיט הוא כתם שלא נראה.
 */
check(
  contrast(ACCENT_L.light, 87) >= 2,
  "ההדגשה נבדלת מהחוגה הבהירה",
  `יחס ${contrast(ACCENT_L.light, 87).toFixed(2)}`,
);
check(
  contrast(ACCENT_L.dark, 10) >= 2,
  "ההדגשה נבדלת מהחוגה הכהה",
  `יחס ${contrast(ACCENT_L.dark, 10).toFixed(2)}`,
);
check(
  ACCENT_L.light !== ACCENT_L.dark,
  "כל ערכה מספקת בהירות משלה",
  `בהיר ${ACCENT_L.light}% · כהה ${ACCENT_L.dark}%`,
);

/* --- עקביות --------------------------------------------------------------- */

console.log("\nעקביות\n");

const twice = [accentFromBlurhash(SAMPLES[0]!), accentFromBlurhash(SAMPLES[0]!)];
check(twice[0] === twice[1], "אותו hash מחזיר תמיד אותו צבע");

const distinct = new Set(SAMPLES.map((h) => accentFromBlurhash(h)).filter(Boolean));
check(distinct.size >= 5, "hash-ים שונים נותנים צבעים שונים", `${distinct.size} ערכים`);

// הצבע נגזר מאותו מקור שממנו נבנה ה-placeholder, ולכן חייב להתקיים יחד איתו
check(
  blurDataUrl(SAMPLES[0]!).startsWith("data:image/bmp"),
  "אותו blurhash עדיין מייצר placeholder תקין",
);

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות צבע ההדגשה עברו");
