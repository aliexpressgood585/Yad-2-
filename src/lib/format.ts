/**
 * המקור היחיד לפורמט מספרים באפליקציה.
 *
 * שום קומפוננטה לא קוראת ל-`toLocaleString` בעצמה. הסיבה היא לא
 * אחידות סגנונית אלא נכונות: מספרים בלוח מודעות נחלקים לשתי משפחות
 * שנראות זהות בקוד ומתנהגות הפוך על המסך.
 *
 *   מדידה (measure)     — כמה. "84,000 ק\"מ", "₪27,000". מפריד אלפים עוזר.
 *   מזהה (identifier)   — איזה. "2016", "קומה 3", "יד 2". מפריד אלפים שובר.
 *
 * הבאג שהוליד את הקובץ: "BYD סיל 2,016" — שנת ייצור שעברה דרך
 * `toLocaleString` וקיבלה פסיק.
 */

export type NumericStyle = "measure" | "identifier";

/**
 * שדות שערכם מזהה ולא כמות.
 *
 * רובם ממילא לא חוצים 999 (קומה, חדרים, יד), כך שהמפריד לא היה מופיע
 * בהם גם בלי הרשימה — הם כאן כדי שהכוונה תהיה מפורשת ולא תלויה בגבול
 * שמישהו ישנה בעתיד. `year` הוא המקרה שבו זה באמת קרה.
 */
const IDENTIFIER_KEYS = new Set([
  "year",
  "hand",
  "floor",
  "totalFloors",
  "rooms",
  "currentRoommates",
  "sleeps",
  "employees",
  "yearsActive",
  "yearsExperience",
  "petAge",
  "minLease",
  "screenSize",
  "ageRange",
]);

/** האם ערכו המספרי של שדה דינמי הוא מזהה או מדידה. */
export function attributeNumericStyle(key: string): NumericStyle {
  return IDENTIFIER_KEYS.has(key) ? "identifier" : "measure";
}

/**
 * מספר כטקסט. `identifier` לעולם בלי מפריד אלפים.
 * שברים נשמרים עד שתי ספרות (2.5 חדרים), אבל בלי אפסים מיותרים.
 */
export function formatNumber(
  value: number,
  { style = "measure" }: { style?: NumericStyle } = {},
): string {
  if (!Number.isFinite(value)) return "";
  return value.toLocaleString("he-IL", {
    useGrouping: style === "measure",
    maximumFractionDigits: 2,
  });
}

/** מחיר עם סימן מטבע. תמיד מדידה. */
export function formatPrice(
  price: number | null | undefined,
  opts: { currency?: string; free?: string; empty?: string } = {},
): string {
  const { currency = "ILS", free = "חינם", empty = "לא צוין מחיר" } = opts;
  if (price === null || price === undefined) return empty;
  if (price === 0) return free;
  const symbol = currency === "ILS" ? "₪" : currency === "USD" ? "$" : "€";
  return `${symbol}${formatNumber(price)}`;
}

/** ספירות בממשק: תוצאות, צפיות, מודעות. */
export function formatCount(n: number): string {
  return formatNumber(n);
}

/** מקצר מספרים גדולים: 1200 → "1.2K". */
export function formatCompact(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** מרחק בין שתי נקודות כטקסט: "800 מ'" / "4.2 ק\"מ". */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} מ'` : `${km.toFixed(1)} ק"מ`;
}

/** צורת ערך של שדה דינמי, בלי התווית. */
type AttributeShape = {
  valueText: string | null;
  valueNumber: number | null;
  valueBool: boolean | null;
  attribute: { key: string; label: string; unit: string | null };
  value: { label: string } | null;
};

/**
 * ערך של שדה דינמי כטקסט קריא — בלי התווית.
 * להצגה בכרטיס יש להשתמש ב-`formatAttributeEntry`, שמחזיר גם תווית:
 * שדה בלי תווית אסור להופיע בכרטיס (ראה DESIGN.md).
 */
export function formatAttributeValue(attr: AttributeShape): string {
  if (attr.valueBool !== null) return attr.valueBool ? "יש" : "אין";

  if (attr.valueNumber !== null) {
    const n = formatNumber(attr.valueNumber, {
      style: attributeNumericStyle(attr.attribute.key),
    });
    return attr.attribute.unit ? `${n} ${attr.attribute.unit}` : n;
  }

  return attr.value?.label ?? attr.valueText ?? "";
}

export type AttributeEntry = {
  key: string;
  label: string;
  value: string;
  /** האם הערך עומד בפני עצמו — "יד שנייה" מובן בלי התווית "יד". */
  selfEvident: boolean;
};

/**
 * שדות שערכם נושא את משמעותו: המילה כבר מכילה את מה שהתווית הייתה מוסיפה.
 * "יד שנייה" לא צריך "יד: ", אבל "₪120,000" חייב "מחזור חודשי: ".
 */
const SELF_EVIDENT_KEYS = new Set([
  // מספר בן ארבע ספרות בטווח שנות ייצור נקרא כשנה בלי שיסבירו אותו
  "year",
  "hand",
  "manufacturer",
  "model",
  "brand",
  "breed",
  "dealType",
  "propertyType",
  "condition",
  "gender",
  "petGender",
  "material",
  "powerSource",
  "zoning",
  "salaryPeriod",
  "priceBasis",
  "roommateGender",
  "energyRating",
]);

/** שדה דינמי כתווית + ערך, מוכן לתצוגה. */
export function formatAttributeEntry(attr: AttributeShape): AttributeEntry | null {
  const value = formatAttributeValue(attr);
  if (!value) return null;

  const key = attr.attribute.key;
  // ערך מספרי עם יחידה קוראת ("84,000 ק"מ") מסביר את עצמו; בלי יחידה
  // הוא מספר עירום וחייב תווית.
  const selfEvident =
    SELF_EVIDENT_KEYS.has(key) ||
    attr.valueBool !== null ||
    (attr.valueNumber !== null && Boolean(attr.attribute.unit) && attr.attribute.unit !== "₪");

  return { key, label: attr.attribute.label, value, selfEvident };
}
