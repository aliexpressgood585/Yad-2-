/**
 * בדיקות מנוע החיפוש.
 *
 *   npm run check:search
 *
 * שתי משפחות:
 *   parse — מה ה-parser חילץ מהשאילתה (לא דורש בסיס נתונים)
 *   match — האם המודעה הצפויה מופיעה בשלושת הראשונים (דורש נתונים)
 *
 * הפיקסצ'רים נכתבו כפי שישראלי באמת מקליד, כולל גרשיים, קיצורים
 * ושגיאות כתיב.
 */
import { parseQuery } from "../../src/lib/search/parse-query";
import { normalize, tokenize } from "../../src/lib/search/normalize";
import { synonymsOf, SYNONYM_TERM_COUNT } from "../../src/lib/search/synonyms";

type ParseCase = {
  q: string;
  expect: Partial<ReturnType<typeof parseQuery>>;
};

/** חילוץ פילטרים מטקסט חופשי. */
const PARSE_CASES: ParseCase[] = [
  { q: "דירת 3 חד' בת״א עד 6000", expect: { rooms: 3, city: "תל אביב-יפו", priceMax: 6000 } },
  { q: "דירה 4 חדרים בחיפה", expect: { rooms: 4, city: "חיפה" } },
  { q: "דירת שלושה חדרים בירושלים", expect: { rooms: 3, city: "ירושלים" } },
  { q: "דירה למכירה בפ״ת עד 2 מיליון", expect: { city: "פתח תקווה", priceMax: 2_000_000 } },
  { q: "דירה בבאר שבע מ 3000", expect: { city: "באר שבע", priceMin: 3000 } },
  { q: "ספה פינתית ר״ג", expect: { city: "רמת גן" } },
  { q: "טויוטה קורולה 2019 יד ראשונה", expect: { make: "טויוטה", yearMin: 2019, hand: 1 } },
  { q: "מאזדה 3 יד שנייה", expect: { make: "מאזדה", hand: 2 } },
  { q: "דירה 90 מ״ר בנתניה", expect: { sqm: 90, city: "נתניה" } },
  { q: "רכב 2015 עד 2018", expect: { yearMin: 2015, yearMax: 2018 } },
  { q: "מקרר עד 1500", expect: { priceMax: 1500 } },
  { q: "אופנוע מעל 20000", expect: { priceMin: 20000 } },
];

/** נרמול: שתי צורות שחייבות להיות זהות אחרי נרמול. */
const NORMALIZE_PAIRS: [string, string][] = [
  ["ת״א", 'ת"א'],
  ["ת״א", "ת'א"],
  ["מ״ר", "מר"],
  ["ירושלים", "ירושלימ"],
  ["בית-ספר", "בית ספר"],
  ["מִזְגָן", "מזגן"],
  ["רמת­גן", "רמת גן"],
];

/**
 * זוגות שמתאחדים ברמת הטוקניזציה ולא ברמת הנרמול.
 * המרת מספרים מילוליים והכתיב חיים ב-`tokenize` במכוון: הם פועלים על
 * מילה שלמה, ו-`normalize` עובד על תווים.
 */
const TOKENIZE_PAIRS: [string, string][] = [
  ["שלושה חדרים", "3 חדרים"],
  ["שלוש חדרים", "3 חדרים"],
  ["דירת 3 חדרים", "דירה 3 חדר"],
  ["למכירה", "מכירה"],
];

/** מילים נרדפות שחייבות להתחבר. */
const SYNONYM_PAIRS: [string, string][] = [
  ["פריג'ידר", "מקרר"],
  ["toyota", "טויוטה"],
  ["corolla", "קורולה"],
  ["chery", "צ'רי"],
  ["bugaboo", "בוגבו"],
  ["אוטו", "רכב"],
  ["ג'יפ", "suv"],
  ["אוטומט", "אוטומטית"],
  ["סולר", "דיזל"],
  ["פלאפון", "סלולרי"],
  ["טלוויזיה", "מסך"],
  ["ממ״ד", "מרחב מוגן"],
  ["יח״ד", "יחידת דיור"],
  ["ת״א", "תל אביב"],
  ["ב״ש", "באר שבע"],
  ["י-ם", "ירושלים"],
  ["vw", "פולקסווגן"],
  ["פולסווגן", "פולקסווגן"],
  ["bmw", "במוו"],
  ["עגלת תינוק", "טיולון"],
];

let failed = 0;
const fail = (msg: string) => {
  console.error(`  ✗ ${msg}`);
  failed++;
};

console.log(`מילון: ${SYNONYM_TERM_COUNT} מונחים\n`);
if (SYNONYM_TERM_COUNT < 300) fail(`המילון הצטמצם ל-${SYNONYM_TERM_COUNT} מונחים`);

console.log("נרמול:");
for (const [a, b] of NORMALIZE_PAIRS) {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) console.log(`  ✓ "${a}" = "${b}"  →  ${na}`);
  else fail(`"${a}" (${na}) ≠ "${b}" (${nb})`);
}

console.log("\nטוקניזציה — צורות שקולות:");
for (const [a, b] of TOKENIZE_PAIRS) {
  const ta = tokenize(a).join(" ");
  const tb = tokenize(b).join(" ");
  if (ta === tb) console.log(`  ✓ "${a}" = "${b}"  →  ${ta}`);
  else fail(`"${a}" (${ta}) ≠ "${b}" (${tb})`);
}

console.log("\nמילים נרדפות:");
for (const [a, b] of SYNONYM_PAIRS) {
  if (synonymsOf(a).includes(normalize(b))) console.log(`  ✓ ${a} → ${b}`);
  else fail(`"${a}" לא מתחבר ל-"${b}"`);
}

console.log("\nחילוץ פילטרים:");
for (const { q, expect } of PARSE_CASES) {
  const got = parseQuery(q);
  const bad: string[] = [];
  for (const [key, want] of Object.entries(expect)) {
    const actual = got[key as keyof typeof got];
    if (actual !== want) bad.push(`${key}: ציפינו ${String(want)}, קיבלנו ${String(actual)}`);
  }
  if (bad.length) fail(`"${q}" — ${bad.join(" | ")}`);
  else {
    const summary = got.chips.map((c) => c.label).join(" · ");
    console.log(`  ✓ "${q}"\n      → ${summary}${got.text ? `  + טקסט: "${got.text}"` : ""}`);
  }
}

console.log("\nטוקניזציה:");
for (const q of ["דירת 3 חד' בת״א", "toyota corolla", "מקרר סמסונג"]) {
  console.log(`  ${q}  →  [${tokenize(q).join(", ")}]`);
}

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות החיפוש עברו");
