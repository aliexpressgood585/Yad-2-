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
  const [h, s, l] = accent.split(" ");
  return { h: Number(h), s: Number(s!.replace("%", "")), l: Number(l!.replace("%", "")) };
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
  const inRange =
    hsl.h >= 0 && hsl.h <= 360 && hsl.s >= 14 && hsl.s <= 42 && hsl.l >= 34 && hsl.l <= 56;
  check(inRange, `${hash.slice(0, 12)}… בתוך הטווח`, accent!);
}

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
