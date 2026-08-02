import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** מעצב מחיר בשקלים. `null` → "לא צוין מחיר". */
// פורמט מספרים חי כולו ב-@/lib/format — ראה את ההסבר בראש הקובץ.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** זמן יחסי בעברית: "לפני 3 ימים". */
export function timeAgo(date: Date | string | number): string {
  const d = new Date(date).getTime();
  const diff = Date.now() - d;
  if (Number.isNaN(d)) return "";
  if (diff < MINUTE) return "עכשיו";
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return m === 1 ? "לפני דקה" : `לפני ${m} דקות`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return h === 1 ? "לפני שעה" : `לפני ${h} שעות`;
  }
  const days = Math.floor(diff / DAY);
  if (days === 1) return "אתמול";
  if (days < 7) return `לפני ${days} ימים`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return w === 1 ? "לפני שבוע" : `לפני ${w} שבועות`;
  }
  if (days < 365) {
    const mo = Math.floor(days / 30);
    return mo === 1 ? "לפני חודש" : `לפני ${mo} חודשים`;
  }
  const y = Math.floor(days / 365);
  return y === 1 ? "לפני שנה" : `לפני ${y} שנים`;
}

/** תאריך מלא בעברית. */
export function formatDate(date: Date | string, withTime = false): string {
  const d = new Date(date);
  return d.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** יוצר slug ידידותי מטקסט עברי או אנגלי. */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/["'׳״]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
}

/** מנרמל מספר טלפון ישראלי לפורמט 0XXXXXXXXX. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("972")) return `0${digits.slice(3)}`;
  if (digits.startsWith("00972")) return `0${digits.slice(5)}`;
  return digits;
}

/** פורמט תצוגה: 052-123-4567 */
export function formatPhone(raw: string): string {
  const p = normalizePhone(raw);
  if (p.length === 10) return `${p.slice(0, 3)}-${p.slice(3, 6)}-${p.slice(6)}`;
  if (p.length === 9) return `${p.slice(0, 2)}-${p.slice(2, 5)}-${p.slice(5)}`;
  return p;
}

/** ממיר מספר ישראלי לפורמט בינלאומי עבור קישורי WhatsApp. */
export function toWhatsAppNumber(raw: string): string {
  const p = normalizePhone(raw);
  return p.startsWith("0") ? `972${p.slice(1)}` : p;
}

const EARTH_RADIUS_KM = 6371;

/** מרחק בקילומטרים בין שתי נקודות (Haversine). */
export function distanceKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/**
 * מסיט קואורדינטות באופן דטרמיניסטי בתוך רדיוס נתון.
 * משמש להצגת מיקום מקורב של מודעה במקום הכתובת המדויקת.
 */
export function fuzzLocation(
  lat: number,
  lng: number,
  seed: string,
  radiusMeters = 400,
): { lat: number; lng: number } {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const angle = ((h >>> 0) % 3600) / 3600 * 2 * Math.PI;
  const dist = (((h >>> 8) % 1000) / 1000) * radiusMeters;
  const dLat = (dist * Math.cos(angle)) / 111_320;
  const dLng =
    (dist * Math.sin(angle)) / (111_320 * Math.cos((lat * Math.PI) / 180));
  return { lat: +(lat + dLat).toFixed(6), lng: +(lng + dLng).toFixed(6) };
}

/** קיצור טקסט עם שלוש נקודות. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

/** ניקוי טקסט חופשי מתגי HTML ותווי בקרה. */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}

/** משהה ביצוע (משמש להשהיות מלאכותיות ולניסיונות חוזרים). */
export const sleep = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, ms));

/** בוחר מפתחות מאובייקט. */
export function pick<T extends object, K extends keyof T>(
  obj: T,
  keys: readonly K[],
): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) if (k in obj) out[k] = obj[k];
  return out;
}
