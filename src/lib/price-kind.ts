/**
 * מה המספר הזה בעצם.
 *
 * ₪16,854 על משרת עוזר טבח ו-₪16,854 על אופנוע הוצגו עד כה באותו מקום
 * ובאותה טיפוגרפיה. שניהם "מחיר" בסכימה, ורק אחד מהם מחיר: השני הוא
 * שכר חודשי, והשלישי — ₪2,130,000 על קיוסק — הוא שווי עסק.
 *
 * ההפרדה הזאת אינה קוסמטית. **שכר לעולם לא נכנס למד המחיר** של מחירי
 * מוצרים, ובלי `priceKind` אין שום דבר בקוד שאומר את זה.
 */

export type PriceKind = "sale" | "rent" | "salary" | "business";

/** תווית שמופיעה מעל המספר. `null` = המספר מובן בלי תווית. */
const LABEL: Record<PriceKind, string | null> = {
  sale: null,
  rent: null,
  salary: "שכר",
  business: "מחיר עסק",
};

/** סיומת שנצמדת למספר. */
const SUFFIX: Record<PriceKind, string | null> = {
  sale: null,
  rent: "לחודש",
  salary: "לחודש",
  business: null,
};

/**
 * סוג המספר לפי תת-הקטגוריה ואחריה השורש.
 *
 * תת-הקטגוריה נבדקת ראשונה מפני שהיא מה שמבדיל בין השכרה למכירה בתוך
 * אותו שורש — וזו ההבחנה שהכי יקר לטעות בה.
 */
export function priceKindFor(
  rootSlug: string | null | undefined,
  leafSlug: string | null | undefined,
): PriceKind {
  const leaf = leafSlug ?? "";
  if (leaf.endsWith("-rent") || leaf === "roommates" || leaf === "vacation") return "rent";

  switch (rootSlug ?? leaf) {
    case "jobs":
      return "salary";
    case "businesses":
      return "business";
    default:
      return "sale";
  }
}

/** האם המספר הזה משתתף בהשוואת מחירים מול השוק. */
export function comparableKind(kind: PriceKind): boolean {
  return kind === "sale" || kind === "rent";
}

export function priceLabel(kind: PriceKind): string | null {
  return LABEL[kind];
}

export function priceSuffix(kind: PriceKind): string | null {
  return SUFFIX[kind];
}
