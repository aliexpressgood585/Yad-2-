/**
 * סריקת מחרוזות עברית בקוד — מה שהמשתמש רואה, ולא ההערות.
 *
 * הסריקה עוברת דרך ה-AST של TypeScript ולא דרך רג'קס, ולכן היא מבחינה
 * בין מחרוזת שמוצגת לבין הערה בעברית. הקוד כאן מתועד כולו בעברית, ולכן
 * ספירה טקסטואלית מנפחת את ההיקף פי כמה.
 */
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

import ts from "typescript";

const HEB = /[֐-׿]/;

export type Hit = {
  file: string;
  line: number;
  kind: "jsx" | "str" | "tmpl" | "tmplx";
  text: string;
};

export function hebrewFiles(): string[] {
  return execSync("rg -l '[\\u0590-\\u05FF]' src --glob '*.ts' --glob '*.tsx'", {
    encoding: "utf8",
  })
    .trim()
    .split("\n")
    .filter(Boolean);
}

export function scanFile(file: string): Hit[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, "utf8"),
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const hits: Hit[] = [];
  const at = (node: ts.Node) =>
    source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;

  const walk = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      if (HEB.test(node.text) && node.text.trim()) {
        hits.push({ file, line: at(node), kind: "jsx", text: node.text.trim() });
      }
    } else if (ts.isStringLiteral(node) && HEB.test(node.text)) {
      hits.push({ file, line: at(node), kind: "str", text: node.text });
    } else if (ts.isNoSubstitutionTemplateLiteral(node) && HEB.test(node.text)) {
      hits.push({ file, line: at(node), kind: "tmpl", text: node.text });
    } else if (ts.isTemplateExpression(node) && HEB.test(node.getText(source))) {
      hits.push({ file, line: at(node), kind: "tmplx", text: node.getText(source) });
      return; // לא לרדת פנימה ולספור את החלקים פעם שנייה
    }
    ts.forEachChild(node, walk);
  };
  walk(source);
  return hits;
}

export function scanAll(): Hit[] {
  return hebrewFiles().flatMap(scanFile);
}

if (process.argv[1]?.endsWith("scan.ts")) {
  const hits = scanAll();
  const byDir = new Map<string, number>();
  for (const hit of hits) {
    const dir = hit.file.split("/").slice(0, 3).join("/");
    byDir.set(dir, (byDir.get(dir) ?? 0) + 1);
  }
  console.log(`סה"כ מחרוזות עם עברית (ללא הערות): ${hits.length}`);
  console.log(`ייחודיות: ${new Set(hits.map((h) => h.text)).size}`);
  console.log(`קבצים: ${new Set(hits.map((h) => h.file)).size}`);
  console.log("\nלפי תיקייה:");
  [...byDir.entries()]
    .sort((a, b) => b[1] - a[1])
    .forEach(([dir, n]) => console.log(`  ${String(n).padStart(5)}  ${dir}`));
  const byKind = new Map<string, number>();
  hits.forEach((h) => byKind.set(h.kind, (byKind.get(h.kind) ?? 0) + 1));
  console.log("\nלפי סוג:", Object.fromEntries(byKind));
}
