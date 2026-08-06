/**
 * בדיקת שפיות לכללי פורמט המספרים.
 * מריצים עם `npx tsx scripts/checks/format-check.ts` — נכשל אם כלל נשבר.
 */
import { formatAttributeEntry } from "../../src/lib/format";

type Case = { key: string; label: string; n: number; unit?: string; expect: string };

const CASES: Case[] = [
  // מזהים — בלי מפריד אלפים
  { key: "year", label: "שנת ייצור", n: 2016, expect: "2016" },
  { key: "year", label: "שנת ייצור", n: 1999, expect: "1999" },
  { key: "floor", label: "קומה", n: 3, expect: "קומה 3" },
  { key: "totalFloors", label: "מתוך קומות", n: 12, expect: "מתוך קומות 12" },
  { key: "yearsExperience", label: "שנות ניסיון", n: 15, expect: "שנות ניסיון 15" },
  // מדידות — עם מפריד
  { key: "km", label: "קילומטראז'", n: 84000, unit: 'ק"מ', expect: '84,000 ק"מ' },
  { key: "size", label: "גודל", n: 1200, unit: 'מ"ר', expect: '1,200 מ"ר' },
  { key: "rooms", label: "חדרים", n: 2.5, unit: "חד'", expect: "2.5 חד'" },
  // מטבע — מדידה, אבל חייב תווית כי המספר לבד חסר משמעות
  { key: "monthlyRevenue", label: "מחזור חודשי", n: 120000, unit: "₪", expect: "מחזור חודשי 120,000 ₪" },
  { key: "monthlyProfit", label: "רווח תפעולי", n: 35000, unit: "₪", expect: "רווח תפעולי 35,000 ₪" },
];

let failed = 0;
for (const c of CASES) {
  const entry = formatAttributeEntry({
    valueText: null,
    valueNumber: c.n,
    valueBool: null,
    value: null,
    attribute: { key: c.key, label: c.label, unit: c.unit ?? null },
  });
  const shown = entry === null ? "" : (entry.standalone ?? `${entry.label} ${entry.value}`);
  const ok = shown === c.expect;
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${c.key.padEnd(16)} ${shown}${ok ? "" : `   (ציפינו: ${c.expect})`}`);
}

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל כללי הפורמט מתקיימים");
