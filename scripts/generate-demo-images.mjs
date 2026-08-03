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

import { sceneFor } from "./demo-scenes.mjs";
import sharp from "sharp";

const OUT = path.join(process.cwd(), "public", "uploads", "demo");

/**
 * נושא → פלטת הסצנה.
 *
 * sky/skyLow — רקע, body — הגוף הראשי, rim — פרטים, glass — זכוכית/בד.
 * הצבעים נוטים לגוונים טבעיים ולא לצבעי המותג: תמונת מוצר לא אמורה
 * להיראות כמו חלק מהממשק.
 */
const TOPICS = {
  car:         { sky: "#cfd8dd", skyLow: "#eef1f2", floor: "#b9c2c7", body: "#2f6f8f", glass: "#96b6c6", rim: "#d8dee1" },
  motorcycle:  { sky: "#d3d7de", skyLow: "#f0f1f4", floor: "#bfc4cc", body: "#3d4d63", glass: "#9aa8bd", rim: "#c9ced8" },
  apartment:   { sky: "#e8e2d6", skyLow: "#f6f3ec", floor: "#b98d5c", body: "#8a6a49", glass: "#bcd4de", rim: "#d9c9b2" },
  land:        { sky: "#cfe0e8", skyLow: "#eef4f7", floor: "#a08a5e", body: "#7d8f52", glass: "#c9d9b8", rim: "#5f7a3c" },
  office:      { sky: "#dfe3e8", skyLow: "#f3f5f7", floor: "#c3c8cf", body: "#4a5568", glass: "#a8bcd0", rim: "#93a0b3" },
  furniture:   { sky: "#eae3d8", skyLow: "#f8f5ef", floor: "#c2a680", body: "#8a6350", glass: "#c9a892", rim: "#a97b63" },
  electronics: { sky: "#dde2e7", skyLow: "#f2f4f6", floor: "#c4c9cf", body: "#2b3440", glass: "#7fa3c4", rim: "#8f9aa8" },
  appliance:   { sky: "#e2e5e8", skyLow: "#f5f6f8", floor: "#c8ccd1", body: "#c3c8ce", glass: "#e8eaec", rim: "#8b939c" },
  fashion:     { sky: "#eee0e5", skyLow: "#faf4f6", floor: "#cbb2bb", body: "#9c5670", glass: "#d8a9bc", rim: "#7d4257" },
  sport:       { sky: "#d7e4e0", skyLow: "#f0f6f4", floor: "#b6c6c1", body: "#e0e4e7", glass: "#9fb3ad", rim: "#3a4a55" },
  baby:        { sky: "#e9e0e8", skyLow: "#f8f4f7", floor: "#c6b4c1", body: "#a4738c", glass: "#d8bccb", rim: "#7f5468" },
  tools:       { sky: "#e4e0d8", skyLow: "#f6f4ef", floor: "#c0b69f", body: "#c9822e", glass: "#e0c9a0", rim: "#4a4a4e" },
  pet:         { sky: "#dfe6dd", skyLow: "#f2f6f1", floor: "#b8c2b2", body: "#a6825a", glass: "#d3c4a8", rim: "#6d5436" },
  shop:        { sky: "#dfdce8", skyLow: "#f3f2f8", floor: "#bfb9cc", body: "#6b5a86", glass: "#b8c9dd", rim: "#a04a55" },
  work:        { sky: "#dbe3e6", skyLow: "#f1f5f6", floor: "#bcc5c9", body: "#3d7285", glass: "#a9c2cc", rim: "#c9903a" },
};

/** מספר וריאציות לכל נושא, כדי שהרשימות לא ייראו מונוטוניות. */
const VARIANTS = 4;
const WIDTH = 1200;
const HEIGHT = 900;

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

  for (const [topic, palette] of Object.entries(TOPICS)) {
    manifest[topic] = [];

    for (let v = 0; v < VARIANTS; v++) {
      const source = Buffer.from(sceneFor(topic, palette, v));

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
