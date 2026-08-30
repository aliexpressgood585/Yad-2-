import { cookies, headers } from "next/headers";
import { cache } from "react";

import { LOCALE_COOKIE, resolveLocale, type Locale } from "./config";
import { MESSAGES, type MessageKey } from "./messages";
import { makeTranslator, type Translator } from "./translate";

/**
 * השפה של הבקשה הנוכחית, ברכיבי שרת.
 *
 * `cache` של React ולא משתנה מודול: ערך ברמת המודול היה נשמר בין בקשות
 * של משתמשים שונים באותו תהליך, ומגיש לאחד את השפה של השני. `cache`
 * חי לאורך רינדור אחד בלבד.
 *
 * ## אסור לקרוא לזה בתוך `after()`
 *
 * `cookies()` ו-`headers()` אסורים שם, ו-Next בולע את השגיאה ל-stderr.
 * מי שצריך את השפה בעבודת רקע — יקרא אותה לפני, ויעביר אותה פנימה.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  return resolveLocale(
    cookieStore.get(LOCALE_COOKIE)?.value,
    headerList.get("accept-language"),
  );
});

/** המתרגם של הבקשה הנוכחית. */
export const getT = cache(async (): Promise<Translator<MessageKey>> => {
  const locale = await getLocale();
  return makeTranslator<MessageKey>(locale, MESSAGES[locale]);
});
