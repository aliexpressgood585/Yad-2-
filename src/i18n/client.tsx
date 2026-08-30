"use client";

import * as React from "react";

import { DEFAULT_LOCALE, type Locale } from "./config";
import { MESSAGES, type MessageKey } from "./messages";
import { makeTranslator, type Translator } from "./translate";

/**
 * השפה לרכיבי לקוח.
 *
 * ## מה נשלח ללקוח, ומה לא
 *
 * ה-provider מקבל את קוד השפה בלבד ולא את הקטלוג. הקטלוגים מיובאים
 * סטטית ונכנסים למנה, ולכן שלוש השפות יושבות ב-JavaScript של הדף.
 * הבחירה מודעת: הקטלוג כולו הוא כמה עשרות קילובייט של טקסט קצר שנדחס
 * היטב, ולעומת זאת טעינה דינמית לפי שפה הייתה מחייבת גבול `Suspense`
 * סביב כל טקסט בממשק, כולל תוויות `aria` שנקראות לפני שהמשתמש רואה
 * משהו. אם המשקל יימדד כבעיה, הפיצול נעשה כאן ולא בכל קריאה ל-`t()`.
 */
const LocaleContext = React.createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>;
}

export function useLocale(): Locale {
  return React.useContext(LocaleContext);
}

/** המתרגם לרכיב לקוח. נבנה מחדש רק כשהשפה משתנה. */
export function useT(): Translator<MessageKey> {
  const locale = useLocale();
  return React.useMemo(
    () => makeTranslator<MessageKey>(locale, MESSAGES[locale]),
    [locale],
  );
}
