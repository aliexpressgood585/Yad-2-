/**
 * כמה מהממשק עדיין אינו מחולץ.
 *   npm run check:i18n
 *
 * ## מה הבדיקה הזו מגינה עליו
 *
 * הכלל השלישי אוסר פיצ'ר חצי-בנוי, ובחילוץ מחרוזות הצורה המדויקת של
 * ההפרה היא מסך שחציו אנגלית וחציו עברית. הבדיקה סופרת כמה מחרוזות
 * ממשק עדיין לא עברו ל-`t()`, ו-`AVAILABLE_LOCALES` נפתח רק כשהמספר
 * הזה אפס.
 *
 * לכן הבדיקה **אינה נכשלת** כשנשארו מחרוזות — היא מדווחת. מה שהיא כן
 * מוודאת הוא שהשער עצמו עקבי: אם נרשמו שפות לבחירה בזמן שנשארו
 * מחרוזות לא מחולצות, זו הפרה של הכלל והבדיקה נופלת.
 *
 * הקטלוגים עצמם אינם נבדקים כאן. מפתח חסר באנגלית או בערבית אינו
 * מתקמפל מלכתחילה — `Messages` הוא `Record` ולא `Partial`, ו-`tsc`
 * תופס אותו לפני שהבדיקה בכלל רצה.
 */
import { AVAILABLE_LOCALES, LOCALES } from "../../src/i18n/config";
import { classify } from "../i18n/classify";
import { scanAll } from "../i18n/scan";

const hits = scanAll();
const remaining = hits.filter((h) => classify(h) !== "data");

const byFile = new Map<string, number>();
for (const hit of remaining) byFile.set(hit.file, (byFile.get(hit.file) ?? 0) + 1);

const uniqueTexts = new Set(remaining.map((h) => h.text)).size;

console.log("חילוץ מחרוזות\n");
console.log(`  נותרו ${remaining.length} מופעים (${uniqueTexts} ייחודיות) ב-${byFile.size} קבצים`);
console.log(`  שפות קיימות: ${LOCALES.join(", ")}`);
console.log(`  שפות פתוחות לבחירה: ${AVAILABLE_LOCALES.join(", ")}`);

if (byFile.size) {
  console.log("\n  הקבצים הגדולים שנותרו:");
  [...byFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .forEach(([file, n]) => console.log(`    ${String(n).padStart(4)}  ${file}`));
}

/*
 * השער. שפה נוספת נפתחת לבחירה רק כשאין מחרוזת ממשק אחת שנשארה בעברית
 * קשיחה. כל עוד נשאר ולו מופע אחד, בחירת אנגלית הייתה נותנת מסך מעורב.
 */
const gateOpen = AVAILABLE_LOCALES.length > 1;
if (gateOpen && remaining.length > 0) {
  console.error(
    `\n✗ ${AVAILABLE_LOCALES.length} שפות פתוחות לבחירה בזמן ש-${remaining.length} מחרוזות עדיין לא חולצו.\n` +
      "  זהו בדיוק המסך החצי-מתורגם שהכלל השלישי אוסר.\n" +
      "  או להשלים את החילוץ, או לסגור את השער ב-src/i18n/config.ts.",
  );
  process.exit(1);
}

if (!gateOpen && remaining.length === 0) {
  console.error(
    "\n✗ החילוץ הושלם אך השער עדיין סגור.\n" +
      "  יש לפתוח את AVAILABLE_LOCALES ב-src/i18n/config.ts.",
  );
  process.exit(1);
}

console.log(
  gateOpen
    ? "\n✓ החילוץ הושלם וכל השפות פתוחות"
    : "\n✓ השער סגור בעקביות — האתר מוגש בעברית בלבד עד להשלמת החילוץ",
);
