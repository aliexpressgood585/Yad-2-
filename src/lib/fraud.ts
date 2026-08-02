import { prisma } from "@/lib/db";
import { normalizeHebrew } from "@/lib/listing-text";

export type FraudFlagResult = {
  code: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  /** הסבר למנהל */
  message: string;
  /** אזהרה שמוצגת לגולש, אם יש */
  publicWarning?: string;
  score: number;
};

/** ביטויים שמאפיינים הונאות תשלום־מראש נפוצות בלוחות מודעות. */
const SUSPICIOUS_PHRASES: { pattern: RegExp; label: string }[] = [
  { pattern: /העברה\s*(בנקאית\s*)?מראש/, label: "בקשה להעברה בנקאית מראש" },
  { pattern: /תשלום\s*מקדמה/, label: "דרישת מקדמה" },
  { pattern: /אני\s*(נמצא\s*)?בחו"?ל/, label: 'המוכר מצהיר שהוא בחו"ל' },
  { pattern: /שליח\s*מטעמי/, label: "שליח מטעם המוכר" },
  { pattern: /חברת\s*שילוח\s*תשלח/, label: "מסירה דרך חברת שילוח לא מוכרת" },
  { pattern: /ווסטרן\s*יוניון|western\s*union/i, label: "תשלום בוסטרן יוניון" },
  { pattern: /ביטקוין|קריפטו|crypto/i, label: "תשלום במטבע קריפטוגרפי" },
  { pattern: /לא\s*ניתן\s*לראות\s*את\s*הפריט/, label: "סירוב להצגת הפריט" },
  { pattern: /דחוף\s*מאוד.*היום\s*בלבד/, label: "לחץ זמן חריג" },
  { pattern: /גיפט\s*קארד|gift\s*card/i, label: "תשלום בכרטיס מתנה" },
];

export type FraudInput = {
  listingId: string;
  title: string;
  description: string;
  price: number | null;
  categoryId: string;
  userId: string;
  contentHash: string | null;
  imagePhashes: string[];
};

/**
 * מריץ יוריסטיקות זיהוי הונאה על מודעה.
 * המערכת אינה חוסמת אוטומטית — היא מסמנת לתור המודרציה
 * ומציגה באנר אזהרה לגולש כשהסימן חזק מספיק.
 */
export async function detectFraud(input: FraudInput): Promise<FraudFlagResult[]> {
  const flags: FraudFlagResult[] = [];
  const text = normalizeHebrew(`${input.title} ${input.description}`);

  // 1. ביטויים חשודים בטקסט
  const matched = SUSPICIOUS_PHRASES.filter((p) =>
    p.pattern.test(`${input.title} ${input.description}`),
  );
  if (matched.length) {
    flags.push({
      code: "SUSPICIOUS_TEXT",
      severity: matched.length >= 2 ? "HIGH" : "MEDIUM",
      message: `נמצאו ביטויים חשודים: ${matched.map((m) => m.label).join(", ")}`,
      publicWarning:
        "המודעה מכילה ניסוחים שמאפיינים ניסיונות הונאה. אל תעבירו כסף לפני שראיתם את הפריט.",
      score: matched.length >= 2 ? 40 : 20,
    });
  }

  // 2. מחיר חריג ביחס לחציון הקטגוריה
  if (input.price && input.price > 0) {
    const rows = await prisma.$queryRaw<{ median: number | null; n: bigint }[]>`
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "price")::int AS median,
             COUNT(*)::bigint AS n
      FROM "Listing"
      WHERE "categoryId" = ${input.categoryId}
        AND "status" = 'ACTIVE' AND "deletedAt" IS NULL
        AND "price" IS NOT NULL AND "price" > 0
        AND "id" <> ${input.listingId}
    `;
    const median = rows[0]?.median ?? null;
    const sample = Number(rows[0]?.n ?? 0);

    // נדרשות מספיק מודעות להשוואה כדי שהחציון יהיה משמעותי
    if (median && sample >= 8 && input.price < median * 0.25) {
      flags.push({
        code: "PRICE_TOO_LOW",
        severity: "HIGH",
        message: `המחיר (${input.price}) נמוך מ-25% מהחציון בקטגוריה (${median})`,
        publicWarning:
          "המחיר נמוך משמעותית ממחיר השוק בקטגוריה. מחיר טוב מדי מכדי להיות אמיתי הוא סימן אזהרה מוכר.",
        score: 35,
      });
    }
  }

  // 3. תמונות שכבר מופיעות במודעה אחרת (perceptual hash)
  if (input.imagePhashes.length) {
    const duplicates = await prisma.listingImage.findMany({
      where: {
        phash: { in: input.imagePhashes },
        listing: { id: { not: input.listingId }, deletedAt: null },
      },
      select: { listingId: true },
      take: 5,
    });
    if (duplicates.length) {
      flags.push({
        code: "DUPLICATE_IMAGES",
        severity: "MEDIUM",
        message: `תמונות זהות נמצאו ב-${duplicates.length} מודעות אחרות`,
        publicWarning:
          "תמונות המודעה מופיעות גם במודעות אחרות באתר. ודאו שהפריט אכן ברשות המוכר.",
        score: 25,
      });
    }
  }

  // 4. מודעה כפולה של אותו משתמש
  if (input.contentHash) {
    const dup = await prisma.listing.count({
      where: {
        contentHash: input.contentHash,
        id: { not: input.listingId },
        deletedAt: null,
      },
    });
    if (dup > 0) {
      flags.push({
        code: "DUPLICATE_CONTENT",
        severity: "LOW",
        message: `תוכן זהה קיים ב-${dup} מודעות נוספות`,
        score: 10,
      });
    }
  }

  // 5. חשבון חדש שמפרסם בקצב חריג
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { createdAt: true, verifiedAt: true, _count: { select: { listings: true } } },
  });
  if (user) {
    const ageDays = (Date.now() - user.createdAt.getTime()) / 86_400_000;
    if (ageDays < 3 && user._count.listings > 8) {
      flags.push({
        code: "NEW_ACCOUNT_BURST",
        severity: "HIGH",
        message: `חשבון בן פחות מ-3 ימים עם ${user._count.listings} מודעות`,
        score: 30,
      });
    }
    if (!user.verifiedAt) {
      flags.push({
        code: "UNVERIFIED_SELLER",
        severity: "LOW",
        message: "המוכר לא אימת מספר טלפון",
        score: 8,
      });
    }
  }

  // 6. פרטי קשר חיצוניים בגוף המודעה — עוקף את מנגנוני ההגנה של האתר
  if (/\b(?:whatsapp|טלגרם|telegram)\b/i.test(text) && /\d{9,}/.test(text)) {
    flags.push({
      code: "OFFSITE_CONTACT",
      severity: "LOW",
      message: "המודעה מפנה לערוץ תקשורת חיצוני",
      score: 8,
    });
  }

  return flags;
}

/** שומר את הדגלים ומעדכן את ציון ההונאה של המודעה. */
export async function persistFraudFlags(
  listingId: string,
  flags: FraudFlagResult[],
): Promise<number> {
  const score = Math.min(100, flags.reduce((sum, f) => sum + f.score, 0));

  await prisma.$transaction([
    prisma.fraudFlag.deleteMany({ where: { listingId } }),
    ...(flags.length
      ? [
          prisma.fraudFlag.createMany({
            data: flags.map((f) => ({
              listingId,
              code: f.code,
              severity: f.severity,
              message: f.message,
              score: f.score,
            })),
            skipDuplicates: true,
          }),
        ]
      : []),
    prisma.listing.update({ where: { id: listingId }, data: { fraudScore: score } }),
  ]);

  return score;
}

/** האזהרה שתוצג לגולש בדף המודעה, אם קיימת. */
export function publicWarningFor(flags: FraudFlagResult[]): string | null {
  const strong = flags.filter((f) => f.publicWarning && f.severity !== "LOW");
  if (!strong.length) return null;
  return strong.map((f) => f.publicWarning).join(" ");
}
