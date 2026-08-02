import { decode } from "blurhash";

/**
 * ממיר blurhash ל-data URL זעיר עבור `placeholder="blur"` של next/image.
 * מפוענח ל-BMP 32×32 — קטן מספיק כדי להיכנס ל-HTML בלי לפגוע ב-LCP,
 * ולא דורש קנבס (עובד גם בשרת).
 */
const CACHE = new Map<string, string>();

export function blurDataUrl(hash: string, size = 24): string {
  const cached = CACHE.get(hash);
  if (cached) return cached;

  let pixels: Uint8ClampedArray;
  try {
    pixels = decode(hash, size, size);
  } catch {
    // hash לא תקין — נופלים בחזרה לתמונה שקופה
    return TRANSPARENT_PIXEL;
  }

  const url = bmpDataUrl(pixels, size, size);
  if (CACHE.size > 500) CACHE.clear();
  CACHE.set(hash, url);
  return url;
}

const TRANSPARENT_PIXEL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** בונה BMP 24-bit מתוך פיקסלים בפורמט RGBA. */
function bmpDataUrl(rgba: Uint8ClampedArray, width: number, height: number): string {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;
  const buf = Buffer.alloc(fileSize);

  buf.write("BM", 0, "ascii");
  buf.writeUInt32LE(fileSize, 2);
  buf.writeUInt32LE(54, 10); // offset לתחילת נתוני הפיקסלים
  buf.writeUInt32LE(40, 14); // גודל כותרת DIB
  buf.writeInt32LE(width, 18);
  buf.writeInt32LE(-height, 22); // גובה שלילי = שורות מלמעלה למטה
  buf.writeUInt16LE(1, 26); // מישורי צבע
  buf.writeUInt16LE(24, 28); // ביטים לפיקסל
  buf.writeUInt32LE(pixelArraySize, 34);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      const dst = 54 + y * rowSize + x * 3;
      // BMP שומר את הערוצים בסדר BGR
      buf[dst] = rgba[src + 2] ?? 0;
      buf[dst + 1] = rgba[src + 1] ?? 0;
      buf[dst + 2] = rgba[src] ?? 0;
    }
  }

  return `data:image/bmp;base64,${buf.toString("base64")}`;
}
