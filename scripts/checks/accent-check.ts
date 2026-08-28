/**
 * בדיקות צבע ההדגשה שנגזר מהמודעה.
 *   npm run check:accent
 *
 * מקבע את מה שמגן על העיצוב: הצבע נגזר מהתמונה, אבל לעולם אינו יוצא
 * מהטווח שהוגדר לו, ולעולם אינו יורד מתחת לסף הניגודיות מול הקרקע
 * שעליה הוא מצויר. blurhash שבור או תמונה חסרה מחזירים `null`, והשורה
 * חוזרת לצבע המסגרת של הפלטה במקום להציג צבע שרירותי.
 *
 * הבדיקה החשובה כאן היא הניגודיות. בלעדיה תמונה כחולה-כהה נותנת מסגרת
 * שנעלמת על גרפיט, ותמונה צהובה נותנת מסגרת שנעלמת על עצם — ובשני
 * המקרים המשתמש רואה שורות שחלקן ממוסגרות וחלקן לא, בלי שום סיבה
 * שהוא יכול לראות.
 */
import {
  accentFromBlurhash,
  contrastRatio,
  GROUND_LUMINANCE,
  MIN_CONTRAST,
  relativeLuminance,
} from "../../src/lib/listing-accent";
import { blurDataUrl } from "../../src/lib/blur";

let failed = 0;

function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

function parse(value: string) {
  const [h, s, l] = value.split(" ");
  return { h: Number(h), s: Number(s!.replace("%", "")), l: Number(l!.replace("%", "")) };
}

/** HSL באחוזים → בהירות יחסית. */
function luminanceOf(value: string): number {
  const { h, s, l } = parse(value);
  const hn = h / 360;
  const sn = s / 100;
  const ln = l / 100;
  if (sn === 0) return relativeLuminance(ln, ln, ln);
  const q = ln < 0.5 ? ln * (1 + sn) : ln + sn - ln * sn;
  const p = 2 * ln - q;
  const channel = (t: number) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };
  return relativeLuminance(channel(hn + 1 / 3), channel(hn), channel(hn - 1 / 3));
}

/* --- קלט לא תקין ---------------------------------------------------------- */

console.log("קלט לא תקין\n");

check(accentFromBlurhash(null) === null, "null → אין צבע");
check(accentFromBlurhash("") === null, "מחרוזת ריקה → אין צבע");
check(accentFromBlurhash("abc") === null, "hash קצר מדי → אין צבע");
check(accentFromBlurhash("LEHV6n!!!!!!") === null, "תווים שאינם base83 → אין צבע");

/* --- טווח הריסון והניגודיות ------------------------------------------------ */

console.log("\nטווח הריסון וניגודיות מול שתי הקרקעות\n");

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
  if (!accent) {
    console.log(`✓ ${hash.slice(0, 12)}… → אין צבע (אפור או לא תקין)`);
    continue;
  }

  for (const [face, ground] of [
    ["מכשיר", GROUND_LUMINANCE.instrument],
    ["יום", GROUND_LUMINANCE.day],
  ] as const) {
    const value = face === "מכשיר" ? accent.instrument : accent.day;
    const { h, s, l } = parse(value);

    check(
      h >= 0 && h <= 360 && s >= 22 && s <= 55 && l > 0 && l < 100,
      `${hash.slice(0, 10)}… · ${face} · בתוך הטווח`,
      value,
    );

    const ratio = contrastRatio(luminanceOf(value), ground);
    check(
      ratio >= MIN_CONTRAST,
      `${hash.slice(0, 10)}… · ${face} · ניגודיות מול הקרקע`,
      `${ratio.toFixed(2)}:1`,
    );
  }
}

/* --- עקביות --------------------------------------------------------------- */

console.log("\nעקביות\n");

const twice = [accentFromBlurhash(SAMPLES[0]!), accentFromBlurhash(SAMPLES[0]!)];
check(
  twice[0]?.instrument === twice[1]?.instrument && twice[0]?.day === twice[1]?.day,
  "אותו hash מחזיר תמיד אותו צבע",
);

const distinct = new Set(
  SAMPLES.map((h) => accentFromBlurhash(h)?.instrument).filter(Boolean),
);
check(distinct.size >= 5, "hash-ים שונים נותנים צבעים שונים", `${distinct.size} ערכים`);

// שתי הפנים אינן זהות — אחרת אחת מהן לא עברה התאמה והבדיקה למעלה חיפתה על זה
const drift = SAMPLES.map(accentFromBlurhash).filter(Boolean).filter(
  (a) => a!.instrument !== a!.day,
);
check(drift.length >= 5, "הבהירות מותאמת בנפרד לכל קרקע", `${drift.length} מודעות`);

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
