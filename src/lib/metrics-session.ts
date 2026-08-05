import "server-only";

import { cookies } from "next/headers";

import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * מזהה הסשן האנונימי מהעוגייה, או `null` כשאין.
 *
 * מופרד מ-`src/lib/metrics.ts` כדי שחישוב המשפך יישאר בר-בדיקה מחוץ
 * ל-Next: הקובץ הזה קשור להקשר של בקשה, וחישוב המשפך אינו.
 *
 * `null` הוא מצב תקין ולא שגיאה. הבקשה הראשונה של דפדפן חדש מגיעה
 * לפני שה-middleware הספיק לכתוב את העוגייה, ובוטים לא שומרים עוגיות
 * כלל. אירוע בלי סשן פשוט לא נרשם — עדיף חור קטן בנתונים על פני
 * ספירת כל בוט כמבקר ייחודי.
 */
export async function sessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}
