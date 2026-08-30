/**
 * חילוץ מכני של מחרוזות ממשק לקטלוג.
 *   npx tsx scripts/i18n/extract.ts <קובץ> [...]      — כתיבה
 *   npx tsx scripts/i18n/extract.ts --dry <קובץ>      — דיווח בלבד
 *
 * ## למה כלי ולא עריכה ידנית
 *
 * `DECISIONS.md` §53 טען שחילוץ אוטומטי שובר אינטרפולציות וריבוי. זה
 * נכון לגבי תבניות עם ביטויים בפנים — ולכן הכלי הזה **אינו נוגע בהן**
 * ומדווח עליהן לטיפול ידני. מה שהוא כן עושה הוא המקרה המשעמם: טקסט
 * JSX קבוע ומחרוזת קבועה בתכונת JSX, שהם רוב המסה.
 *
 * ## המפתחות
 *
 * `<מרחב>.<גיבוב>` — המרחב נגזר מנתיב הקובץ, והגיבוב מהטקסט העברי.
 * לא נבחרו מפתחות סמנטיים משום שאי אפשר לגזור מפתח אנגלי קריא מטקסט
 * עברי בלי לתרגם אותו קודם, ומפתח סידורי (`.1`, `.2`) משתנה בכל
 * שינוי סדר בקובץ ומנתק את התרגומים הקיימים.
 *
 * לגיבוב יש תכונה שנבחרה במכוון: שינוי הנוסח העברי משנה את המפתח,
 * ולכן התרגומים הישנים נעשים יתומים והמהדר דורש חדשים. מחרוזת שנוסחה
 * מחדש בעברית ונשארה עם תרגום ישן לאנגלית היא בדיוק סוג התקלה
 * שהמנגנון הזה מונע.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";

import ts from "typescript";

import { classify } from "./classify";
import { scanFile } from "./scan";

const HEB = /[֐-׿]/;

/** `src/components/publish/step-details.tsx` → `publish.stepDetails` */
export function namespaceFor(file: string): string {
  const parts = file
    .replace(/^src\//, "")
    .replace(/\.(tsx?|jsx?)$/, "")
    .split("/")
    .filter((p) => p !== "components" && p !== "app" && p !== "lib");

  // `page`, `layout` ו-`index` אינם מוסיפים מידע — התיקייה כבר מזהה
  const trimmed = parts.filter((p, i) => !(i === parts.length - 1 && /^(page|layout|index|route)$/.test(p)));
  const useful = trimmed.length ? trimmed : parts;

  return useful
    .map((p) => p.replace(/^\[|\]$/g, "").replace(/-(\w)/g, (_, c: string) => c.toUpperCase()))
    .join(".");
}

export function keyFor(file: string, text: string): string {
  const hash = createHash("sha256").update(text).digest("hex").slice(0, 6);
  return `${namespaceFor(file)}.${hash}`;
}

type Edit = { start: number; end: number; replacement: string };

export type FileResult = {
  file: string;
  entries: Map<string, string>;
  edits: number;
  skipped: { line: number; reason: string; text: string }[];
  needsScope: "client" | "server" | "none" | "unsupported";
};

/**
 * האם `t` כבר זמין בקובץ, ואיזה מנגנון מתאים לו.
 *
 * רכיב לקוח משתמש ב-hook, רכיב שרת אסינכרוני ב-`await getT()`. מודול
 * `.ts` רגיל אינו יכול לקבל `t` בלי לשנות את החתימה שלו, ולכן הוא
 * מסומן `unsupported` ומטופל ידנית.
 */
function scopeKind(file: string, source: string): FileResult["needsScope"] {
  if (source.includes("useT()") || source.includes("await getT()")) return "none";
  if (!file.endsWith(".tsx")) return "unsupported";
  return source.startsWith('"use client"') ? "client" : "server";
}

export function extractFile(file: string, write: boolean): FileResult {
  const source = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  const entries = new Map<string, string>();
  const edits: Edit[] = [];
  const skipped: FileResult["skipped"][number][] = [];

  const hits = scanFile(file).filter((h) => classify(h) !== "data");

  const walk = (node: ts.Node) => {
    /* טקסט JSX קבוע */
    if (ts.isJsxText(node) && HEB.test(node.text) && node.text.trim()) {
      const raw = node.text;
      const text = raw.trim();
      const lead = raw.slice(0, raw.indexOf(text[0]!));
      const tail = raw.slice(raw.indexOf(text[0]!) + text.length);
      const key = keyFor(file, text);
      entries.set(key, text);
      /*
       * `pos` ולא `getStart`. עבור טקסט JSX `getStart` מדלג על הרווח
       * המוביל, ולכן החלפה שמתחילה שם ומכניסה מחדש את `lead` הייתה
       * מכפילה את ההזחה ומשאירה שורה ריקה לפני כל טקסט רב-שורתי.
       */
      edits.push({
        start: node.pos,
        end: node.end,
        replacement: `${lead}{t(${JSON.stringify(key)})}${tail}`,
      });
      return;
    }

    /* מחרוזת קבועה בתכונת JSX: aria-label="…" */
    if (
      ts.isJsxAttribute(node) &&
      node.initializer &&
      ts.isStringLiteral(node.initializer) &&
      HEB.test(node.initializer.text)
    ) {
      const text = node.initializer.text;
      const key = keyFor(file, text);
      entries.set(key, text);
      edits.push({
        start: node.initializer.getStart(sf),
        end: node.initializer.getEnd(),
        replacement: `{t(${JSON.stringify(key)})}`,
      });
      return;
    }

    ts.forEachChild(node, walk);
  };
  walk(sf);

  /* מה שנשאר אחרי המעבר — הכלי לא נגע בו */
  const handled = new Set([...entries.values()]);
  for (const hit of hits) {
    if (handled.has(hit.text)) continue;
    skipped.push({
      line: hit.line,
      reason: hit.kind === "tmplx" ? "תבנית עם ביטויים" : `מחרוזת מחוץ ל-JSX (${hit.kind})`,
      text: hit.text.replace(/\s+/g, " ").slice(0, 70),
    });
  }

  const needsScope = edits.length ? scopeKind(file, source) : "none";

  if (write && edits.length) {
    let out = source;
    for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
      out = out.slice(0, edit.start) + edit.replacement + out.slice(edit.end);
    }
    writeFileSync(file, out);
  }

  return { file, entries, edits: edits.length, skipped, needsScope };
}

if (process.argv[1]?.endsWith("extract.ts")) {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const files = args.filter((a) => !a.startsWith("--"));

  const all = new Map<string, string>();
  for (const file of files) {
    const result = extractFile(file, !dry);
    result.entries.forEach((v, k) => all.set(k, v));
    console.log(
      `${result.edits ? "✎" : "·"} ${file}  ${result.edits} הוחלפו, ${result.skipped.length} ידניות  [${result.needsScope}]`,
    );
    for (const s of result.skipped.slice(0, 6)) {
      console.log(`    ${s.line}: ${s.reason} — ${s.text}`);
    }
  }

  console.log(`\nמפתחות חדשים: ${all.size}`);
  for (const [key, value] of all) console.log(`  ${JSON.stringify(key)}: ${JSON.stringify(value)},`);
}
