/**
 * מנוע התרגום — פונקציה טהורה, משותפת לשרת וללקוח.
 *
 * ## שיבוץ ערכים
 *
 * `t("results.count", { n: 12 })` מחליף `{n}` בטקסט. הפורמט נבחר על פני
 * שרשור מחרוזות משום שבעברית ובערבית סדר המילים שונה מאנגלית, ומשפט
 * שנבנה בשרשור מקבע את הסדר של שפת המקור בקוד.
 *
 * ## ריבוי
 *
 * מפתח שמסתיים ב-`_one` / `_two` / `_many` / `_other` הוא משפחת ריבוי.
 * `Intl.PluralRules` בוחר את הצורה לפי השפה, ולא לפי `n === 1`: לעברית
 * יש צורת זוגי ("שבועיים"), ולערבית שש צורות. בדיקה של `n === 1` הייתה
 * נכונה באנגלית ושגויה בשתי השפות האחרות.
 *
 * אם הצורה שנבחרה חסרה בקטלוג — נופלים ל-`_other`, שקיים תמיד. זו נפילה
 * לצורה נכונה דקדוקית ברוב המקרים, ולא לטקסט חסר.
 */
import { LOCALE_TAG, type Locale } from "./config";

export type Vars = Record<string, string | number>;

const PLACEHOLDER = /\{(\w+)\}/g;

export function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(PLACEHOLDER, (match, name: string) =>
    name in vars ? String(vars[name]) : match,
  );
}

/*
 * `Intl.PluralRules` יקר לבנייה ונקרא הרבה. הוא נבנה פעם אחת לשפה.
 */
const pluralRules = new Map<Locale, Intl.PluralRules>();

function rulesFor(locale: Locale): Intl.PluralRules {
  let rules = pluralRules.get(locale);
  if (!rules) {
    rules = new Intl.PluralRules(LOCALE_TAG[locale]);
    pluralRules.set(locale, rules);
  }
  return rules;
}

export function pluralSuffix(locale: Locale, count: number): string {
  return rulesFor(locale).select(count);
}

/**
 * בונה את `t` מעל קטלוג נתון.
 *
 * מפתח שאינו בקטלוג מוחזר כמות שהוא. זה לא אמור לקרות — הטיפוסים אוסרים
 * את זה בקוד — אבל מפתח שהגיע ממקור דינמי עדיף שיוצג כמפתח מאשר שיפיל
 * את הדף.
 */
export function makeTranslator<K extends string>(
  locale: Locale,
  messages: Readonly<Record<K, string>>,
) {
  const lookup = messages as Readonly<Record<string, string>>;

  function t(key: K, vars?: Vars): string {
    return interpolate(lookup[key] ?? key, vars);
  }

  /**
   * ריבוי. `count` משובץ גם כ-`{count}` כדי שלא צריך להעביר אותו פעמיים.
   */
  function plural(key: K, count: number, vars?: Vars): string {
    const form = pluralSuffix(locale, count);
    const exact = lookup[`${key}_${form}`];
    const fallback = lookup[`${key}_other`];
    return interpolate(exact ?? fallback ?? key, { count, ...vars });
  }

  return { t, plural, locale };
}

export type Translator<K extends string = string> = ReturnType<typeof makeTranslator<K>>;
