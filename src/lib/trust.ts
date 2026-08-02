import { timeAgo } from "@/lib/utils";

export type TrustInput = {
  createdAt: Date;
  verifiedAt: Date | null;
  ratingAvg: number;
  ratingCount: number;
  dealsCount: number;
  responseMins: number | null;
  role: "USER" | "BUSINESS" | "ADMIN";
  activeListings: number;
};

export type TrustSignal = {
  label: string;
  value: string;
  positive: boolean;
};

export type TrustScore = {
  /** 0–100 */
  score: number;
  level: "new" | "fair" | "good" | "excellent";
  levelLabel: string;
  signals: TrustSignal[];
};

const LEVEL_LABELS: Record<TrustScore["level"], string> = {
  new: "מוכר חדש",
  fair: "מוכר מתחיל",
  good: "מוכר אמין",
  excellent: "מוכר מצטיין",
};

/**
 * ציון אמינות מוכר, מחושב מאותות גלויים בלבד:
 * ותק, אימות טלפון, מספר עסקאות, דירוגים וזמן תגובה.
 * הציון מוצג למשתמש יחד עם האותות עצמם — בלי "קופסה שחורה".
 */
export function computeTrust(input: TrustInput): TrustScore {
  const ageDays = Math.floor(
    (Date.now() - input.createdAt.getTime()) / 86_400_000,
  );

  let score = 0;
  const signals: TrustSignal[] = [];

  // ותק — עד 25 נקודות
  const agePoints = Math.min(25, Math.round((ageDays / 365) * 25));
  score += agePoints;
  signals.push({
    label: "ותק באתר",
    value:
      ageDays < 30
        ? "פחות מחודש"
        : ageDays < 365
          ? `${Math.floor(ageDays / 30)} חודשים`
          : `${Math.floor(ageDays / 365)} שנים`,
    positive: ageDays >= 90,
  });

  // אימות טלפון — 20 נקודות
  if (input.verifiedAt) score += 20;
  signals.push({
    label: "אימות טלפון",
    value: input.verifiedAt ? "מאומת" : "לא מאומת",
    positive: Boolean(input.verifiedAt),
  });

  // דירוגים — עד 30 נקודות, משוקללים לפי כמות הדירוגים
  if (input.ratingCount > 0) {
    const confidence = Math.min(1, input.ratingCount / 10);
    score += Math.round(((input.ratingAvg - 1) / 4) * 30 * confidence);
    signals.push({
      label: "דירוג ממוצע",
      value: `${input.ratingAvg.toFixed(1)} מתוך 5 (${input.ratingCount} דירוגים)`,
      positive: input.ratingAvg >= 4,
    });
  } else {
    signals.push({ label: "דירוגים", value: "אין עדיין", positive: false });
  }

  // עסקאות שהושלמו — עד 15 נקודות
  score += Math.min(15, Math.round(Math.log10(input.dealsCount + 1) * 12));
  if (input.dealsCount > 0) {
    signals.push({
      label: "עסקאות שהושלמו",
      value: String(input.dealsCount),
      positive: input.dealsCount >= 3,
    });
  }

  // זמן תגובה — עד 10 נקודות
  if (input.responseMins !== null) {
    const fast = input.responseMins <= 60;
    score += fast ? 10 : input.responseMins <= 360 ? 6 : 2;
    signals.push({
      label: "זמן תגובה ממוצע",
      value:
        input.responseMins < 60
          ? `${input.responseMins} דקות`
          : `${Math.round(input.responseMins / 60)} שעות`,
      positive: fast,
    });
  }

  if (input.role === "BUSINESS") {
    signals.push({ label: "סוג חשבון", value: "עסקי מאומת", positive: true });
  }

  // חשבון חדש עם הרבה מודעות — סימן אזהרה שמוריד ציון
  if (ageDays < 7 && input.activeListings > 10) {
    score -= 20;
    signals.push({
      label: "פעילות חריגה",
      value: `${input.activeListings} מודעות בשבוע הראשון`,
      positive: false,
    });
  }

  score = Math.max(0, Math.min(100, score));

  const level: TrustScore["level"] =
    score >= 75 ? "excellent" : score >= 50 ? "good" : score >= 25 ? "fair" : "new";

  return { score, level, levelLabel: LEVEL_LABELS[level], signals };
}

/** טקסט "חבר מאז" לתצוגה בפרופיל. */
export function memberSince(date: Date): string {
  return timeAgo(date).replace("לפני", "חבר כבר");
}
