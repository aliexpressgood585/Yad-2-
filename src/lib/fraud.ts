import { prisma } from "@/lib/db";
import { normalizeHebrew } from "@/lib/listing-text";
import { computeRiskScore, RISK_WEIGHTS, type RiskCode } from "@/lib/risk";

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
  /** טלפון ליצירת קשר — נבדק מול דיווחים קודמים */
  contactPhone?: string | null;
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
    const rows = await prisma.$queryRaw<
      { median: number | null; sd: number | null; n: bigint }[]
    >`
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "price")::int AS median,
             STDDEV_POP("price") AS sd,
             COUNT(*)::bigint AS n
      FROM "Listing"
      WHERE "categoryId" = ${input.categoryId}
        AND "status" = 'ACTIVE' AND "deletedAt" IS NULL
        AND "price" IS NOT NULL AND "price" > 0
        AND "id" <> ${input.listingId}
    `;
    const median = rows[0]?.median ?? null;
    const sd = rows[0]?.sd === null || rows[0]?.sd === undefined ? null : Number(rows[0].sd);
    const sample = Number(rows[0]?.n ?? 0);

    /*
     * חריגה של יותר משלוש סטיות תקן מתחת לחציון.
     *
     * הכלל הקודם היה "פחות מ-25% מהחציון" — סף שרירותי שלא מתחשב
     * בפיזור: בקטגוריה הומוגנית כמו מקררים 25% הוא חריג קיצוני, ובקטגוריה
     * מפוזרת כמו רכב הוא טווח לגיטימי לחלוטין. סטיות תקן מכיילות את
     * עצמן לפיזור בפועל של כל קטגוריה.
     *
     * חורגים כלפי מעלה אינם מסומנים: מחיר מופרז הוא טעות של המוכר,
     * לא סיכון לקונה.
     */
    if (median && sd && sd > 0 && sample >= 8 && input.price < median - 3 * sd) {
      const deviations = ((median - input.price) / sd).toFixed(1);
      flags.push({
        code: "PRICE_OUTLIER",
        severity: "HIGH",
        message: `המחיר (${input.price}) נמוך ב-${deviations} סטיות תקן מהחציון (${median}), מדגם ${sample}`,
        publicWarning:
          "המחיר נמוך משמעותית ממחיר השוק בקטגוריה. מחיר טוב מדי מכדי להיות אמיתי הוא סימן אזהרה מוכר.",
        score: RISK_WEIGHTS.PRICE_OUTLIER,
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
    if (ageDays < 2 && user._count.listings >= 5) {
      flags.push({
        code: "NEW_ACCOUNT_BURST",
        severity: "HIGH",
        message: `חשבון בן פחות מ-48 שעות עם ${user._count.listings} מודעות`,
        score: RISK_WEIGHTS.NEW_ACCOUNT_BURST,
      });
    }
    if (!user.verifiedAt) {
      flags.push({
        code: "UNVERIFIED_SELLER",
        severity: "LOW",
        message: "המוכר לא אימת מספר טלפון",
        score: RISK_WEIGHTS.UNVERIFIED_SELLER,
      });
    }
  }

  /*
   * 5ב. המוכר או הטלפון הופיעו בדיווחים קודמים.
   *
   * זה האות החזק ביותר במערכת, כי מקורו בבני אדם ולא ביוריסטיקה:
   * מישהו כבר נתקל בפריט הזה ודיווח. נספרים רק דיווחים שנבדקו ואושרו
   * ע"י מנהל — דיווח פתוח הוא טענה, לא ממצא, ולהעניש עליו היה הופך
   * את כפתור הדיווח לנשק נגד מתחרים.
   */
  const priorReports = await prisma.report.count({
    where: {
      // RESOLVED = מנהל בדק ומצא שהדיווח מוצדק. DISMISSED נדחה, ו-OPEN
      // הוא עדיין טענה בלבד — שניהם לא נספרים.
      status: "RESOLVED",
      listing: {
        OR: [
          { userId: input.userId },
          ...(input.contactPhone ? [{ contactPhone: input.contactPhone }] : []),
        ],
        id: { not: input.listingId },
      },
    },
  });
  if (priorReports > 0) {
    flags.push({
      code: "PRIOR_REPORTS",
      severity: "HIGH",
      message: `${priorReports} דיווחים שאושרו על מודעות קודמות של אותו מוכר או טלפון`,
      publicWarning:
        "התקבלו בעבר דיווחים על מודעות של מוכר זה. מומלץ להיפגש פנים אל פנים ולבדוק את הפריט לפני תשלום.",
      score: RISK_WEIGHTS.PRIOR_REPORTS,
    });
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
  // הציון מגיע מהנוסחה המתועדת ב-@/lib/risk ולא מסכום פשוט:
  // אות אחרי הראשון נכנס בתשומה פוחתת.
  const score = computeRiskScore(flags.map((f) => f.code as RiskCode));

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
