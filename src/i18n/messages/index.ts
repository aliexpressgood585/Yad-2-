import type { Locale } from "../config";

import { ar } from "./ar";
import { en } from "./en";
import { he, type Messages } from "./he";

/**
 * הקטלוגים לפי שפה.
 *
 * `Record<Locale, Messages>` הוא הגדר השני: שפה שנוספה ל-`LOCALES` בלי
 * קטלוג מפילה את הבנייה כאן, ומפתח חסר בקטלוג קיים מפיל אותה בקובץ
 * הקטלוג עצמו.
 */
export const MESSAGES: Record<Locale, Messages> = { he, en, ar };

export type { Messages, MessageKey } from "./he";
