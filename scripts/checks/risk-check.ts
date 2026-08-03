/**
 * בדיקות ציון הסיכון.
 *   npm run check:risk
 *
 * מקבע את שתי התכונות שחשובות: אות חזק אחד מספיק כדי להיכנס לתור
 * המודרציה, וכמה אותות חלשים לא מצטברים לאזהרה פומבית.
 */
import {
  computeRiskScore,
  riskLevel,
  RISK_REVIEW_AT,
  RISK_WARN_AT,
  explainRisk,
  type RiskCode,
} from "../../src/lib/risk";

type Case = { codes: RiskCode[]; expect: ReturnType<typeof riskLevel>; why: string };

const CASES: Case[] = [
  { codes: [], expect: "clear", why: "מודעה נקייה" },
  { codes: ["UNVERIFIED_SELLER"], expect: "clear", why: "מוכר לא מאומת לבדו אינו סיכון" },
  {
    codes: ["UNVERIFIED_SELLER", "DUPLICATE_CONTENT"],
    expect: "clear",
    why: "שני אותות חלשים לא מצטברים לתור מודרציה",
  },
  { codes: ["DUPLICATE_IMAGES"], expect: "clear", why: "תמונה משוכפלת לבדה — מתחת לסף" },
  { codes: ["SUSPICIOUS_TEXT"], expect: "review", why: "ניסוחי הונאה נבדקים" },
  { codes: ["PRICE_OUTLIER"], expect: "review", why: "מחיר חריג נבדק" },
  { codes: ["PRIOR_REPORTS"], expect: "warn", why: "דיווח אנושי מאושר — האות החזק ביותר" },
  {
    codes: ["SUSPICIOUS_TEXT", "PRICE_OUTLIER"],
    expect: "warn",
    why: "שני אותות חזקים יחד מצדיקים אזהרה",
  },
  {
    codes: ["DUPLICATE_IMAGES", "UNVERIFIED_SELLER", "DUPLICATE_CONTENT"],
    expect: "review",
    why: "שלושה אותות בינוניים־חלשים נבדקים אך לא מזהירים",
  },
];

let failed = 0;
console.log(`ספים: מודרציה ${RISK_REVIEW_AT} · אזהרה ${RISK_WARN_AT}\n`);

for (const c of CASES) {
  const score = computeRiskScore(c.codes);
  const level = riskLevel(score);
  const ok = level === c.expect;
  if (!ok) failed++;
  console.log(
    `${ok ? "✓" : "✗"} ${String(score).padStart(3)} ${level.padEnd(7)} ${c.why}` +
      (ok ? "" : `  ← ציפינו ${c.expect}`),
  );
  if (c.codes.length) console.log(`      ${explainRisk(c.codes)}`);
}

// תשומה פוחתת: סכום פשוט היה נותן 100, הנוסחה נותנת פחות
const naive = 30 + 35 + 25;
const actual = computeRiskScore(["SUSPICIOUS_TEXT", "PRICE_OUTLIER", "DUPLICATE_IMAGES"]);
console.log(`\nתשומה פוחתת: סכום פשוט ${naive} → נוסחה ${actual}`);
if (actual >= naive) {
  console.error("✗ הנוסחה אינה מפחיתה תשומה");
  failed++;
}

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות הסיכון עברו");
