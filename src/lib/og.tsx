import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { CSSProperties, ReactNode } from "react";

import { MARK_COLORS, MARK_VIEWBOX, markGeometry } from "@/lib/brand-mark";
import { PALETTE } from "@/lib/palette";
import { SITE } from "@/lib/site";

/**
 * חלקים משותפים לתמונות השיתוף (`opengraph-image.tsx`).
 * הצבעים מגיעים מ-@/lib/palette כי Satori לא מכיר טוקני CSS.
 */
export const OG_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png";

export const OG = PALETTE;

/**
 * גופן עברי לתמונות השיתוף.
 *
 * **בלי זה העברית יוצאת הפוכה.** Satori אינו מגיע עם גופן עברי — ברירת
 * המחדל שלו היא `noto-sans-latin`, ובלי הגליפים הוא פורש את המחרוזת
 * תו-אחר-תו משמאל לימין. בפועל תמונת השיתוף הציגה "יאדכ" במקום "כדאי"
 * ו-"םיעונטק" במקום "קטנועים", והסימן ₪ יצא ריבוע ריק.
 *
 * זה קרה בדיוק בנכס שאמור לשווק את הלוח בחינם: מודעה שנשלחת בוואטסאפ
 * מגיעה למישהו שלא ביקר באתר, וזה מה שהוא רואה ראשון.
 *
 * הגופן נטען מהדיסק ולא מהרשת — בנייה שתלויה ב-fonts.googleapis.com
 * נופלת בכל סביבה חסומה. הוא מצומצם לעברית, לטינית ול-₪ בלבד: 23KB
 * במקום 744KB. `outputFileTracingIncludes` ב-next.config דואג שהקבצים
 * ייארזו לפונקציה.
 */
let fontCache: { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" }[] | null = null;

export async function ogFonts() {
  if (fontCache) return fontCache;
  const dir = join(process.cwd(), "src/assets/fonts");
  const [regular, bold] = await Promise.all([
    readFile(join(dir, "og-sans.ttf")),
    readFile(join(dir, "og-sans-bold.ttf")),
  ]);
  fontCache = [
    { name: "OgSans", data: regular.buffer as ArrayBuffer, weight: 400 as const, style: "normal" as const },
    { name: "OgSans", data: bold.buffer as ArrayBuffer, weight: 700 as const, style: "normal" as const },
  ];
  return fontCache;
}

/**
 * סידור טקסט לסדר חזותי — Satori אינו מיישם דו-כיווניות.
 *
 * מנוע הציור פורש את התווים בסדר הלוגי משמאל לימין, ולכן "הונדה"
 * יוצא "הדנוה" ו"כדאי" יוצא "יאדכ". גופן עברי פותר את הגליפים ואת
 * הסימן ₪, אבל לא את הסדר — זו שכבה אחרת לגמרי.
 *
 * מה שנעשה כאן הוא המינימום שנדרש לתוכן של הלוח: פיצול לרצפים של
 * עברית מול לטינית/ספרות, היפוך סדר הרצפים (בסיס ימני-לשמאלי),
 * והיפוך התווים בתוך רצף עברי בלבד. מספרים ומודלים לועזיים —
 * "50cc 2025", "RAV4", "i20" — נשארים כפי שהם, וזה בדיוק המקרה
 * שהיה נשבר בפתרון של היפוך המחרוזת כולה.
 *
 * זה אינו אלגוריתם UAX#9 מלא, והוא לא מתיימר: אין כאן סוגריים
 * מקוננים ואין רמות הטמעה. יש כותרת מודעה, מחיר, עיר וקטגוריה.
 */
const RTL_CHAR = /[\u0590-\u05FF\uFB1D-\uFB4F]/;
const NEUTRAL = /[\s\u00B7·,.\-–—:;!?'"״׳()]/;

export function bidi(text: string): string {
  if (!text || !RTL_CHAR.test(text)) return text;

  type Run = { text: string; rtl: boolean | null };
  const runs: Run[] = [];

  for (const ch of text) {
    const rtl = RTL_CHAR.test(ch) ? true : NEUTRAL.test(ch) ? null : false;
    const last = runs[runs.length - 1];
    if (last && last.rtl === rtl) last.text += ch;
    else runs.push({ text: ch, rtl });
  }

  /*
   * רצף ניטרלי בין שני רצפים זהים שייך להם — "מגדל העמק" הוא רצף
   * עברי אחד ולא שניים עם רווח באמצע. בלי האיחוד הזה כל רווח היה
   * הופך לגבול, והמילים היו מתהפכות זו מול זו.
   */
  const merged: Run[] = [];
  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    if (run.rtl === null) {
      const prev = merged[merged.length - 1];
      const next = runs[i + 1];
      if (prev && next && prev.rtl === next.rtl) {
        prev.text += run.text;
        continue;
      }
      if (!prev || !next) {
        // ניטרלי בקצה — נצמד לכיוון הבסיס
        (prev ?? { text: "", rtl: true }).rtl;
      }
      merged.push({ text: run.text, rtl: prev ? prev.rtl : true });
      continue;
    }
    const prev = merged[merged.length - 1];
    if (prev && prev.rtl === run.rtl) prev.text += run.text;
    else merged.push({ ...run });
  }

  return merged
    .reverse()
    .map((run) => (run.rtl === false ? run.text : [...run.text].reverse().join("")))
    .join("");
}

/**
 * פיצול לשורות **לפני** הסידור החזותי.
 *
 * `bidi` הופך את סדר הרצפים במחרוזת, ולכן אם המנוע שובר אותה לשתי
 * שורות בעצמו — השורות יוצאות בסדר הפוך: הסוף למעלה וההתחלה למטה.
 * כותרת "קיה פיקנטו 2023 יד ראשונה" הוצגה כ"2023 יד ראשונה" ומתחתיה
 * "קיה פיקנטו".
 *
 * הפתרון הוא לא לתת למנוע לשבור: אנחנו שוברים למילים, אורזים לשורות
 * לפי אומדן רוחב, ומסדרים כל שורה בנפרד. הסדר האנכי נשמר כי הוא
 * שלנו.
 *
 * האומדן גס במכוון — רוחב ממוצע של תו בגופן הזה הוא כ-0.55 מגודל
 * הגופן. עדיף להעריך ביתר ולשבור מוקדם מאשר לגלוש מהתמונה.
 */
export function bidiLines(text: string, maxChars: number): string[] {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars || !current) current = candidate;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);

  return lines.map(bidi);
}

/**
 * תמונת המודעה כ-data URI שהמנוע יודע לצייר.
 *
 * **Satori אינו תומך ב-WebP.** כל התמונות בלוח נשמרות ב-WebP, ולכן
 * `<img>` בתמונת השיתוף נשמט בשקט — בלי שגיאה, בלי לוג, פשוט חצי
 * תמונה ריקה. כרטיס שיתוף בלי תמונת המוצר הוא בדיוק הכרטיס שלא
 * נלחצים עליו בוואטסאפ.
 *
 * PNG ו-JPEG עוברים כמו שהם; כל השאר מומר ב-sharp. ההמרה נכשלת
 * בשקט ומחזירה `undefined`, כי כרטיס בלי תמונה עדיף על כרטיס שלא
 * נוצר בכלל.
 */
export async function ogImage(url: string | undefined): Promise<string | undefined> {
  if (!url) return undefined;

  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const raw = Buffer.from(await res.arrayBuffer());

    const isPng = raw[0] === 0x89 && raw[1] === 0x50;
    const isJpeg = raw[0] === 0xff && raw[1] === 0xd8;
    if (isPng) return `data:image/png;base64,${raw.toString("base64")}`;
    if (isJpeg) return `data:image/jpeg;base64,${raw.toString("base64")}`;

    const sharp = (await import("sharp")).default;
    const jpeg = await sharp(raw).resize(560, 630, { fit: "cover" }).jpeg({ quality: 78 }).toBuffer();
    return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
  } catch {
    return undefined;
  }
}

/** אפשרויות אחידות ל-`ImageResponse` — גודל וגופנים. */
export async function ogOptions() {
  return { ...OG_SIZE, fonts: await ogFonts() };
}

const shellStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  background: OG.bone,
  direction: "rtl",
  padding: 64,
  fontFamily: "OgSans",
};

/**
 * הסימן — אותה גאומטריה בדיוק שבכותרת האתר ובפאביקון.
 *
 * הגרסה הקודמת ציירה את האות "ל" על ריבוע ענבר. זה היה שריד מהשם
 * הישן ("לוח"), והוא שרד שלוש החלפות שם — כלומר תמונת השיתוף נשאה
 * מותג שכבר לא קיים.
 *
 * הצורה נבנית מ-`markGeometry()` ולא מ-SVG: Satori תומך ב-SVG חלקית,
 * ו-divs ממוקמים מתנהגים אצלו צפוי. היחסים נגזרים מאותו מקור אמת,
 * ולכן הסימן כאן לא יכול להיפרד מהסימן באתר.
 */
export function OgWordmark({ scale = 1 }: { scale?: number }) {
  const geo = markGeometry("full");
  const plateW = 78 * scale;
  const plateH = (plateW * MARK_VIEWBOX.height) / MARK_VIEWBOX.width;
  const unit = plateW / MARK_VIEWBOX.width;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16 * scale }}>
      <div
        style={{
          display: "flex",
          position: "relative",
          width: plateW,
          height: plateH,
          borderRadius: 10 * scale,
          background: MARK_COLORS.plate,
        }}
      >
        {geo.ticks.map((t) => (
          <div
            key={`t-${t.x}`}
            style={{
              position: "absolute",
              left: t.x * unit,
              top: t.y1 * unit,
              width: Math.max(1, 1.1 * unit),
              height: (t.y2 - t.y1) * unit,
              background: MARK_COLORS.hair,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: geo.needle.x * unit,
            top: geo.needle.y1 * unit,
            width: Math.max(2, 1.6 * unit),
            height: (geo.needle.y2 - geo.needle.y1) * unit,
            background: MARK_COLORS.needle,
          }}
        />
      </div>
      <div style={{ fontSize: 34 * scale, fontWeight: 700, color: OG.ink }}>
        {bidi(SITE.name)}
      </div>
    </div>
  );
}

/** מסגרת אחידה: לוגו למעלה, תוכן באמצע, שורת רגל למטה. */
export function OgShell({
  children,
  footer,
}: {
  children: ReactNode;
  footer?: string;
}) {
  return (
    <div style={shellStyle}>
      <OgWordmark />
      {children}
      <div style={{ display: "flex", fontSize: 26, color: OG.muted }}>
        {bidi(footer ?? SITE.tagline)}
      </div>
    </div>
  );
}
