/**
 * בדיקות מערכת העיצוב.
 *   npm run check:design
 *
 * העיצוב של הלוח נשען על כמה כללים שמתפוררים בשקט: מישהו מוסיף
 * `rounded-lg` לרכיב חדש, מישהו מחזיר צל ל-hover, ומישהו מעדכן צבע
 * ב-globals.css ושוכח את `palette.ts` שממנו נבנות תמונות השיתוף
 * והמיילים. אף אחת מהתקלות האלה לא שוברת את הבנייה, וכולן נראות
 * כאילו "ככה זה תמיד היה".
 *
 * הבדיקות כאן קוראות את הקבצים עצמם ולא מסתמכות על תיעוד.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PALETTE, PALETTE_DAY } from "../../src/lib/palette";

let failed = 0;

function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

const root = resolve(import.meta.dirname, "../..");
const css = readFileSync(resolve(root, "src/app/globals.css"), "utf8");
const tailwind = readFileSync(resolve(root, "tailwind.config.ts"), "utf8");

/* --- אפס פינות מעוגלות ---------------------------------------------------- */

console.log("אפס פינות מעוגלות\n");

check(/--radius:\s*0px\s*;/.test(css), "`--radius` הוא אפס");

/*
 * הסקאלה כולה מצביעה על `--radius` או על אפס מפורש. כך `rounded-full`
 * שכתוב באחד ממאתיים המקומות בקוד אינו מייצר פינה, ואי אפשר "לשכוח"
 * לנקות אותו.
 */
const radiusBlock = tailwind.match(/borderRadius:\s*\{([^}]*)\}/s)?.[1] ?? "";
const radiusValues = [...radiusBlock.matchAll(/["']?([\w]+)["']?:\s*"([^"]+)"/g)].map(
  (m) => [m[1]!, m[2]!] as const,
);
check(radiusValues.length >= 8, "סקאלת הרדיוס מוגדרת במלואה", `${radiusValues.length} טוקנים`);
for (const [token, value] of radiusValues) {
  check(
    value === "var(--radius)" || value === "0px",
    `borderRadius.${token} אינו מייצר פינה`,
    value,
  );
}

/* --- אפס צללים ------------------------------------------------------------ */

console.log("\nאפס צללים\n");

const shadowBlock = tailwind.match(/boxShadow:\s*\{([^}]*)\}/s)?.[1] ?? "";
const shadowValues = [...shadowBlock.matchAll(/["']?([\w]+)["']?:\s*"([^"]+)"/g)].map(
  (m) => [m[1]!, m[2]!] as const,
);
check(shadowValues.length >= 8, "סקאלת הצללים מוגדרת במלואה", `${shadowValues.length} טוקנים`);
for (const [token, value] of shadowValues) {
  check(value === "none", `boxShadow.${token} הוא none`, value);
}

/*
 * גם CSS גולמי. `box-shadow` שנכתב ידנית עוקף את Tailwind לגמרי,
 * וזו בדיוק הדרך שבה צל חוזר לאתר שהחליט לוותר עליו.
 */
const rawShadows = [...css.matchAll(/box-shadow:\s*([^;]+);/g)]
  .map((m) => m[1]!.trim())
  .filter((v) => v !== "none");
check(rawShadows.length === 0, "אין box-shadow גולמי ב-globals.css", rawShadows.join(" · "));

/* --- הפלטה תואמת בין CSS לבין palette.ts ---------------------------------- */

console.log("\nהפלטה תואמת בין globals.css לבין palette.ts\n");

/** HEX → "H S% L%" מעוגל, באותו פורמט שבו נכתבים הטוקנים ב-CSS. */
function hexToHslToken(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/** ערכי הטוקנים בתוך בלוק סלקטור מסוים ב-globals.css. */
function tokensIn(selector: string): Record<string, string> {
  const block = css.match(new RegExp(`\\n\\s*${selector}\\s*\\{([\\s\\S]*?)\\n\\s*\\}`))?.[1];
  if (!block) return {};
  return Object.fromEntries(
    [...block.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()]),
  );
}

const instrumentTokens = tokensIn("\\.dark");
const dayTokens = tokensIn(":root");

check(Object.keys(instrumentTokens).length > 0, "בלוק `.dark` נמצא ב-globals.css");
check(Object.keys(dayTokens).length > 0, "בלוק `:root` נמצא ב-globals.css");

/*
 * `muted` ו-`rule` אינם טוקני פלטה גולמיים בשתי הפנים — `rule` כן,
 * ו-`muted` יושב ב-`--muted-foreground`. שניהם נבדקים בשמם ב-CSS.
 */
const PAIRS: [keyof typeof PALETTE, string][] = [
  ["graphite", "--graphite"],
  ["chassis", "--chassis"],
  ["bone", "--bone"],
  ["amber", "--amber"],
  ["cyan", "--cyan"],
  ["rule", "--rule"],
  ["muted", "--muted-foreground"],
];

for (const [key, token] of PAIRS) {
  check(
    instrumentTokens[token] === hexToHslToken(PALETTE[key]),
    `מכשיר · ${token} תואם ל-PALETTE.${key}`,
    `${instrumentTokens[token]} ↔ ${hexToHslToken(PALETTE[key])}`,
  );
  check(
    dayTokens[token] === hexToHslToken(PALETTE_DAY[key]),
    `יום · ${token} תואם ל-PALETTE_DAY.${key}`,
    `${dayTokens[token]} ↔ ${hexToHslToken(PALETTE_DAY[key])}`,
  );
}

/* --- צבע פעולה אחד -------------------------------------------------------- */

console.log("\nצבע פעולה אחד\n");

/*
 * `--primary` חייב להצביע על הענבר ולא על ערך משלו: ברגע שמישהו כותב
 * שם צבע ישירות, יש באתר שני צבעי פעולה ואף אחד לא שם לב.
 */
check(
  instrumentTokens["--primary"] === "var(--amber)",
  "מכשיר · `--primary` הוא הענבר",
  instrumentTokens["--primary"],
);
check(
  dayTokens["--primary"] === "var(--amber)",
  "יום · `--primary` הוא הענבר",
  dayTokens["--primary"],
);
check(
  instrumentTokens["--info"] === "var(--cyan)" && dayTokens["--info"] === "var(--cyan)",
  "הציאן הוא `--info` — פסק דין, לא פעולה",
);

/* --- הסקאלה --------------------------------------------------------------- */

console.log("\nהסקאלה\n");

const gauge = readFileSync(resolve(root, "src/components/listing/price-gauge.tsx"), "utf8");
check(
  /if \(!meter\) return null;/.test(gauge),
  "אין מדגם → אין סקאלה בכלל, ולא סקאלה חלשה",
);

const meterLib = readFileSync(resolve(root, "src/lib/price-meter.ts"), "utf8");
check(/export const MIN_SAMPLE = 8;/.test(meterLib), "סף המדגם הוא 8");
check(
  /HAVING count\(\*\) >= \$\{MIN_SAMPLE\}/.test(meterLib),
  "הסף נאכף גם בשאילתה ולא רק ברכיב",
);

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות מערכת העיצוב עברו");
