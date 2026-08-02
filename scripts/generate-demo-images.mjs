/**
 * מייצר תמונות דמו מקומיות עבור נתוני הזריעה.
 *
 * למה: נתוני הדמו הצביעו על picsum.photos, כך שהזריעה הייתה תלויה
 * בחיבור לאינטרנט וברשת שאינה חוסמת אותו. התמונות כאן נוצרות מקומית,
 * ולכן `npm run db:seed` נראה נכון גם ללא רשת.
 *
 * הרצה: node scripts/generate-demo-images.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { encode } from "blurhash";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "uploads", "demo");

/** נושא → תווית בעברית + זוג צבעים לגרדיאנט. */
const TOPICS = {
  car: { label: "רכב", colors: ["#0f6d55", "#1b9b7a"] },
  motorcycle: { label: "דו־גלגלי", colors: ["#243b53", "#3d5a80"] },
  apartment: { label: "דירה", colors: ["#7c4a1e", "#c07a3e"] },
  land: { label: "מגרש", colors: ["#5c6b3c", "#8aa05a"] },
  office: { label: "משרד", colors: ["#334155", "#64748b"] },
  furniture: { label: "ריהוט", colors: ["#6b4423", "#a0703f"] },
  electronics: { label: "אלקטרוניקה", colors: ["#1e3a5f", "#3b6ea5"] },
  appliance: { label: "מוצר חשמל", colors: ["#3f3f46", "#71717a"] },
  fashion: { label: "אופנה", colors: ["#7a2f4a", "#b8547a"] },
  sport: { label: "ספורט", colors: ["#155e52", "#2a9d8f"] },
  baby: { label: "לתינוק", colors: ["#8a5a72", "#c08fa4"] },
  tools: { label: "כלי עבודה", colors: ["#7a4a15", "#c98a2e"] },
  pet: { label: "בעלי חיים", colors: ["#5b4a2f", "#96794c"] },
  shop: { label: "עסק", colors: ["#4a3560", "#7b5aa0"] },
  work: { label: "שירותים", colors: ["#1f4d5c", "#3d8299"] },
};

/** מספר וריאציות לכל נושא, כדי שהרשימות לא ייראו מונוטוניות. */
const VARIANTS = 4;
const WIDTH = 1200;
const HEIGHT = 900;

function svg(label, [from, to], variant) {
  // זווית ומיקום שונים לכל וריאציה
  const angle = 20 + variant * 25;
  const cx = 30 + variant * 15;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="g" gradientTransform="rotate(${angle})">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#g)"/>
  <circle cx="${(cx / 100) * WIDTH}" cy="${HEIGHT * 0.35}" r="${HEIGHT * 0.42}"
          fill="#ffffff" opacity="0.07"/>
  <circle cx="${WIDTH * 0.82}" cy="${HEIGHT * 0.85}" r="${HEIGHT * 0.3}"
          fill="#000000" opacity="0.08"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif" font-weight="bold"
        font-size="${HEIGHT * 0.13}" fill="#ffffff" opacity="0.92">${label}</text>
  <text x="50%" y="63%" text-anchor="middle"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${HEIGHT * 0.045}" fill="#ffffff" opacity="0.6">תמונת דמו</text>
</svg>`;
}

/** blurhash אמיתי של התמונה, כדי שה-placeholder יתאים לצבעים בפועל. */
async function blurhashOf(source) {
  const { data, info } = await sharp(source)
    .resize(32, 32, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  const manifest = {};
  let count = 0;

  for (const [topic, { label, colors }] of Object.entries(TOPICS)) {
    manifest[topic] = [];

    for (let v = 0; v < VARIANTS; v++) {
      const source = Buffer.from(svg(label, colors, v));

      const full = await sharp(source).webp({ quality: 82 }).toBuffer();
      await writeFile(path.join(OUT, `${topic}-${v}.webp`), full);

      const thumb = await sharp(source)
        .resize({ width: 480 })
        .webp({ quality: 72 })
        .toBuffer();
      await writeFile(path.join(OUT, `${topic}-${v}-thumb.webp`), thumb);

      manifest[topic].push({
        url: `/uploads/demo/${topic}-${v}.webp`,
        thumbUrl: `/uploads/demo/${topic}-${v}-thumb.webp`,
        blurhash: await blurhashOf(source),
        width: WIDTH,
        height: HEIGHT,
      });
      count += 2;
    }
  }

  await writeFile(
    path.join(OUT, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );

  console.log(`נוצרו ${count} תמונות דמו ב-${path.relative(process.cwd(), OUT)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
