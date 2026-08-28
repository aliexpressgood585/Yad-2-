/**
 * בדיקות ייבוא המלאי.
 *   npm run check:feed
 *
 * המנתח והמיפוי הם המקום שבו קובץ אמיתי של סוחר נשבר: פסיק בתוך
 * תיאור, מרכאות כפולות, BOM שאקסל מוסיף לכל קובץ עברי, שורה חדשה בתוך
 * שדה, וכותרות שכתובות עברית באחד ואנגלית בשני. כל אחד מאלה נראה כמו
 * "הקובץ שלך לא תקין" לסוחר, והוא באג אצלנו.
 *
 * הבדיקות טהורות ואינן דורשות בסיס נתונים.
 */
import { guessMapping, mapRows, parseCsv, parseXml, sampleCsv } from "../../src/lib/feed";
import type { AttributeSpec } from "../../src/lib/feed";

let failed = 0;

function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

/* --- ניתוח CSV ------------------------------------------------------------ */

console.log("ניתוח CSV\n");

const withComma = parseCsv('a,b\n1,"שלום, עולם"');
check(withComma.length === 2, "שתי שורות");
check(withComma[1]?.[1] === "שלום, עולם", "פסיק בתוך שדה מצוטט", withComma[1]?.[1]);

const withQuotes = parseCsv('a\n"הוא אמר ""שלום"""');
check(withQuotes[1]?.[0] === 'הוא אמר "שלום"', "מרכאות כפולות", withQuotes[1]?.[0]);

const withNewline = parseCsv('a,b\n1,"שורה\nשנייה"');
check(withNewline[1]?.[1] === "שורה\nשנייה", "שורה חדשה בתוך שדה מצוטט");

// אקסל בעברית שומר UTF-8 עם BOM. בלי טיפול, הכותרת הראשונה מקבלת
// תו בלתי נראה בהתחלה ואף מיפוי לא מתאים לה.
const withBom = parseCsv("﻿id,title\n1,שלום");
check(withBom[0]?.[0] === "id", "BOM של אקסל מוסר מהכותרת הראשונה", JSON.stringify(withBom[0]?.[0]));

check(parseCsv("a,b\r\n1,2")[1]?.[1] === "2", "שורות CRLF של חלונות");
check(parseCsv("a,b\n1,2\n\n\n").length === 2, "שורות ריקות בסוף מסוננות");

/* --- ניתוח XML ------------------------------------------------------------ */

console.log("\nניתוח XML\n");

const xml = `<?xml version="1.0"?>
<feed>
  <car><id>1</id><title><![CDATA[טויוטה & קורולה]]></title><price>84000</price></car>
  <car><id>2</id><title>מאזדה 3</title><price>92000</price></car>
</feed>`;
const table = parseXml(xml);
check(table.length === 3, "שורת כותרות ושתי שורות", `${table.length}`);
check(table[0]?.includes("title") === true, "שמות האלמנטים הם הכותרות");
const titleIndex = table[0]!.indexOf("title");
check(table[1]?.[titleIndex] === "טויוטה & קורולה", "CDATA וישויות מפוענחים", table[1]?.[titleIndex]);

/* --- ניחוש המיפוי --------------------------------------------------------- */

console.log("\nניחוש המיפוי\n");

const specs: AttributeSpec[] = [
  {
    key: "manufacturer",
    label: "יצרן",
    type: "SELECT",
    isRequired: true,
    values: [
      { value: "toyota", label: "טויוטה" },
      { value: "mazda", label: "מאזדה" },
    ],
  },
  { key: "year", label: "שנת ייצור", type: "NUMBER", isRequired: true, values: [] },
  { key: "sunroof", label: "חלון גג", type: "BOOLEAN", isRequired: false, values: [] },
];

const english = guessMapping(
  ["SKU", "Title", "Description", "Price", "City", "manufacturer", "year"],
  specs,
);
check(english.externalId === "SKU", "SKU → מזהה", english.externalId);
check(english.price === "Price", "Price → מחיר");
check(english.manufacturer === "manufacturer", "שדה דינמי לפי המפתח");

const hebrew = guessMapping(["מק״ט", "כותרת", "תיאור", "מחיר", "עיר", "יצרן", "שנת ייצור"], specs);
check(hebrew.externalId === "מק״ט", "מק״ט → מזהה", hebrew.externalId);
check(hebrew.city === "עיר", "עיר → עיר");
check(hebrew.manufacturer === "יצרן", "שדה דינמי לפי התווית", hebrew.manufacturer);
check(hebrew.year === "שנת ייצור", "תווית עם רווח");

/* --- אימות שורות ---------------------------------------------------------- */

console.log("\nאימות שורות\n");

const mapping = {
  externalId: "id",
  title: "title",
  description: "description",
  price: "price",
  city: "city",
  manufacturer: "manufacturer",
  year: "year",
  sunroof: "sunroof",
};

const rows = parseCsv(
  [
    "id,title,description,price,city,manufacturer,year,sunroof",
    "A1,טויוטה קורולה 2019,רכב במצב מצוין עם תיעוד מלא,84000,תל אביב,טויוטה,2019,כן",
    "A2,מאזדה 3,רכב שמור מאוד בלי תאונות כלל,\"₪ 92,000\",חיפה,mazda,2020,no",
    "A3,קצר,קצר,לא-מספר,,פורד,לא-שנה,אולי",
  ].join("\n"),
);

const { rows: parsed, errors } = mapRows(rows, mapping, specs);

check(parsed.length === 2, "שתי שורות תקינות עוברות", `${parsed.length}`);
check(parsed[0]?.attributes.sunroof === true, '"כן" → true');
check(parsed[1]?.attributes.sunroof === false, '"no" → false');
check(parsed[1]?.price === 92000, "מחיר עם ₪ ופסיקים מנורמל", String(parsed[1]?.price));
check(parsed[0]?.attributes.manufacturer === "toyota", "ערך לפי התווית העברית");
check(parsed[1]?.attributes.manufacturer === "mazda", "ערך לפי הערך האנגלי");

/*
 * שורה שנפלה אינה עוצרת את הייבוא, וכל שגיאה נושאת מספר שורה. סוחר
 * שמקבל "שגיאה בקובץ" בלי מספר שורה פותח את הקובץ באקסל ומחפש ידנית.
 */
const badLines = new Set(errors.map((e) => e.line));
check(badLines.size === 1 && badLines.has(4), "כל השגיאות מיוחסות לשורה 4", [...badLines].join(","));
check(errors.length >= 4, "כל שדה שגוי מדווח בנפרד", `${errors.length} שגיאות`);
check(
  errors.every((e) => e.message.length > 0),
  "לכל שגיאה יש הודעה בעברית",
);

const shortRow = mapRows(
  parseCsv("id,title,description,city\nB1,כותרת תקינה,תיאור ארוך מספיק כדי לעבור,רמת גן"),
  { externalId: "id", title: "title", description: "description", city: "city" },
  [],
);
check(shortRow.rows[0]?.price === null, "בלי עמודת מחיר — המחיר null ולא 0");

/* --- קובץ הדוגמה ---------------------------------------------------------- */

console.log("\nקובץ הדוגמה\n");

const sample = parseCsv(sampleCsv(specs));
check(sample.length === 2, "כותרות ושורת דוגמה אחת");
check(sample[0]?.includes("manufacturer") === true, "שדות חובה של הקטגוריה נכללים");
check(sample[0]?.includes("sunroof") === false, "שדה שאינו חובה אינו מעמיס על התבנית");

// התבנית חייבת לעבור את האימות של עצמה — אחרת הסוחר ממלא אותה ונדחה
const selfMapping = Object.fromEntries(sample[0]!.map((h) => [h, h]));
const selfCheck = mapRows(sample, selfMapping, specs);
check(
  selfCheck.rows.length === 1 && selfCheck.errors.length === 0,
  "קובץ הדוגמה עובר את האימות של עצמו",
  selfCheck.errors.map((e) => e.message).join(" · "),
);

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות ייבוא המלאי עברו");
