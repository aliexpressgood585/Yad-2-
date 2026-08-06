/**
 * יצירת קובצי האייקונים מתוך אותה גאומטריה של הלוגו.
 *
 * `npm run icons`
 *
 * הקבצים האלה נשמרים ב-git ולא נבנים בזמן build — הם צריכים להיות שם
 * גם כשהבנייה נכשלת, ו-`src/app/icon.png` נקרא על ידי Next כקובץ סטטי
 * בזמן ניתוח המסלולים. הסקריפט הוא הדרך לרענן אותם, לא תלות שלהם.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { markSvg, type MarkDensity } from "../src/lib/brand-mark";

const ROOT = path.resolve(import.meta.dirname, "..");

type IconSpec = {
  file: string;
  size: number;
  density?: MarkDensity;
  padding?: number;
  note: string;
};

const ICONS: IconSpec[] = [
  {
    file: "public/icons/icon-512.png",
    size: 512,
    padding: 0.1,
    note: "PWA — הגודל שממנו נגזרות התצוגות הגדולות",
  },
  {
    file: "public/icons/icon-192.png",
    size: 192,
    padding: 0.1,
    note: "PWA — מסך הבית באנדרואיד",
  },
  {
    /*
     * אנדרואיד חותך אייקון maskable לצורה משתנה (עיגול, ריבוע מעוגל,
     * טיפה). אזור הבטוח הוא 80% מהצלע, ולכן הסימן מוקטן לתוכו — בלי
     * זה ראש המחוג נחתך בדיוק בעיגול, וזה החלק היחיד שאסור לאבד.
     */
    file: "public/icons/icon-maskable-512.png",
    size: 512,
    padding: 0.2,
    note: "PWA maskable — אזור בטוח 80%",
  },
  {
    file: "public/icons/apple-icon.png",
    size: 180,
    padding: 0.1,
    note: "iOS — מסך הבית",
  },
  {
    /*
     * בגודל הזה רווח של 3 יחידות בין שנתות הוא פחות משלושה פיקסלים,
     * והאנטי-אליאסינג ממרח אותן לכתם. הצפיפות המצומצמת משאירה את מה
     * שנושא את הזיהוי: קו הבסיס והמחוג במקומו הלא-מרכזי.
     */
    file: "public/icons/favicon.png",
    size: 48,
    density: "compact",
    padding: 0.08,
    note: "פאביקון — צפיפות מצומצמת",
  },
  {
    file: "src/app/icon.png",
    size: 48,
    density: "compact",
    padding: 0.08,
    note: "אייקון ברירת המחדל של Next",
  },
];

async function main() {
  for (const icon of ICONS) {
    const svg = markSvg({ size: icon.size, density: icon.density, padding: icon.padding });
    const out = path.join(ROOT, icon.file);
    await mkdir(path.dirname(out), { recursive: true });
    const png = await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
    await writeFile(out, png);
    console.log(`✓ ${icon.file.padEnd(38)} ${String(icon.size).padStart(3)}px  ${icon.note}`);
  }
  console.log(`\n${ICONS.length} אייקונים נוצרו מ-src/lib/brand-mark.ts`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
