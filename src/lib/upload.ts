import { createHash, randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { encode } from "blurhash";
import sharp from "sharp";

export type ProcessedImage = {
  url: string;
  thumbUrl: string;
  blurhash: string;
  width: number;
  height: number;
  /** perceptual hash לזיהוי תמונות משוכפלות */
  phash: string;
};

const MAX_WIDTH = 1600;
const THUMB_WIDTH = 480;
const MAX_BYTES = 10 * 1024 * 1024;

export const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
];

/**
 * מעבד תמונה שהועלתה:
 * 1. מסובב לפי EXIF ואז **מסיר את כל המטא-דאטה** (כולל מיקום GPS)
 * 2. מקטין ודוחס ל-WebP
 * 3. מייצר תמונה ממוזערת, blurhash ו-perceptual hash
 */
export async function processImage(file: File): Promise<ProcessedImage> {
  if (file.size > MAX_BYTES) {
    throw new Error("הקובץ גדול מדי — עד 10MB לתמונה");
  }
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("סוג קובץ לא נתמך. אפשר להעלות JPG, PNG, WebP או AVIF");
  }

  const input = Buffer.from(await file.arrayBuffer());

  // `rotate()` ללא ארגומנט מיישר לפי EXIF; sharp משמיט מטא-דאטה כברירת מחדל,
  // ולכן נתוני המצלמה והמיקום לא נשמרים בקובץ היוצא.
  const base = sharp(input, { failOn: "none" }).rotate();
  const meta = await base.metadata();

  const main = await base
    .clone()
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer({ resolveWithObject: true });

  const thumb = await base
    .clone()
    .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();

  const [blurhash, phash] = await Promise.all([
    computeBlurhash(base.clone()),
    computePhash(base.clone()),
  ]);

  const id = randomUUID();
  const [url, thumbUrl] = await Promise.all([
    store(`${id}.webp`, main.data, "image/webp"),
    store(`${id}-thumb.webp`, thumb, "image/webp"),
  ]);

  return {
    url,
    thumbUrl,
    blurhash,
    width: main.info.width,
    height: main.info.height ?? meta.height ?? 0,
    phash,
  };
}

async function computeBlurhash(image: sharp.Sharp): Promise<string> {
  const { data, info } = await image
    .resize(32, 32, { fit: "inside" })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}

/**
 * dHash 8×8: משווה כל פיקסל לשכנו מימין ומקודד את התוצאה כ-hex.
 * עמיד לשינויי גודל ודחיסה, ולכן מזהה העתקות תמונה בין מודעות.
 */
async function computePhash(image: sharp.Sharp): Promise<string> {
  const { data } = await image
    .resize(9, 8, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const left = data[y * 9 + x] ?? 0;
      const right = data[y * 9 + x + 1] ?? 0;
      bits += left > right ? "1" : "0";
    }
  }

  let hex = "";
  for (let i = 0; i < 64; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** שומר את הקובץ אצל הספק המוגדר ומחזיר URL ציבורי. */
async function store(name: string, buffer: Buffer, contentType: string): Promise<string> {
  const provider = process.env.UPLOAD_PROVIDER ?? "local";

  if (provider === "cloudinary" && process.env.CLOUDINARY_CLOUD_NAME) {
    return uploadToCloudinary(buffer, name);
  }

  // ברירת מחדל: אחסון מקומי תחת public/uploads (מתאים לפיתוח).
  // ב-Vercel מערכת הקבצים אינה קבועה — יש להגדיר ספק ענן.
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buffer);
  void contentType;
  return `/uploads/${name}`;
}

/** העלאה ל-Cloudinary עם חתימה, ללא SDK נוסף. */
async function uploadToCloudinary(buffer: Buffer, name: string): Promise<string> {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME!;
  const apiKey = process.env.CLOUDINARY_API_KEY!;
  const apiSecret = process.env.CLOUDINARY_API_SECRET!;

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `metzia/${name.replace(/\.[^.]+$/, "")}`;
  const signature = createHash("sha1")
    .update(`public_id=${publicId}&timestamp=${timestamp}${apiSecret}`)
    .digest("hex");

  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: "image/webp" }), name);
  form.append("api_key", apiKey);
  form.append("timestamp", String(timestamp));
  form.append("public_id", publicId);
  form.append("signature", signature);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${cloud}/image/upload`, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(`העלאת התמונה נכשלה (${res.status})`);
  }
  const data = (await res.json()) as { secure_url: string };
  return data.secure_url;
}
