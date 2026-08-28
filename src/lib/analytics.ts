import { cookies } from "next/headers";

import { prisma } from "@/lib/db";
import type { AnalyticsEventType } from "@prisma/client";

/**
 * המדידה של הלוח — יומן אירועים משלנו, בלי SDK חיצוני.
 *
 * למה בלי SDK: שלושה מהארבעה אירועים במשפך הם פעולות שרת (צפייה, חשיפת
 * טלפון, פנייה), וסקריפט צד-שלישי היה מודד אותן פחות טוב ולא יותר —
 * חוסמי פרסומות מפילים בין 15% ל-30% מהאירועים, ודווקא אצל המשתמשים
 * המנוסים. יומן משלנו נכתב באותה טרנזקציה שבה הפעולה קורית, ולכן הוא
 * מודד את מה שקרה ולא את מה שהצליח להישלח.
 *
 * מדד הצפון והמשפכים מתועדים ב-GROWTH.md.
 */

/** שם ה-cookie של מזהה הסשן האנונימי. */
export const SESSION_COOKIE = "luach_sid";

/**
 * חלון הסשן — 30 דקות של חוסר פעילות.
 *
 * זו אינה בחירה שרירותית: המשפך נמדד **בתוך ביקור אחד**, כי הרצף
 * "חיפוש ← צפייה ← חשיפת טלפון ← פנייה" הוא רצף של ישיבה אחת מול המסך.
 * חלון ארוך יותר היה מאחד שני ביקורים נפרדים לסשן אחד ומנפח את שיעורי
 * ההמרה; חלון קצר יותר היה חותך ביקור אמיתי באמצע.
 *
 * ה-cookie הוא first-party, httpOnly, ואינו מקושר לזהות. אין בו מידע
 * מלבד מזהה אקראי, והוא אינו נשלח לאף גורם חיצוני.
 */
export const SESSION_TTL_SECONDS = 30 * 60;

/**
 * מזהה הסשן הנוכחי, או `null` כשאין.
 *
 * לא נוצר כאן. ה-cookie נכתב ב-middleware, שהוא המקום היחיד שבו מותר
 * לכתוב cookie בזרימת Next: `cookies().set()` מתוך רכיב שרת נזרק
 * בזמן רינדור, ומתוך route handler הוא היה מייצר מזהה חדש לכל בקשת
 * API שהגיעה לפני שהדף נטען.
 */
export async function currentSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

type EventInput = {
  type: AnalyticsEventType;
  sessionId?: string | null;
  userId?: string | null;
  listingId?: string | null;
  categoryId?: string | null;
  query?: string | null;
  resultCount?: number | null;
};

/**
 * רישום אירוע.
 *
 * **לעולם אינו זורק.** מדידה שמפילה פעולה היא מדידה שגורמת נזק: אם
 * כתיבת האירוע נכשלת, המשתמש עדיין צריך לקבל את מספר הטלפון שביקש.
 * כישלון נרשם ללוג ונבלע.
 *
 * אירוע בלי מזהה סשן אינו נרשם כלל, ולא נרשם עם מזהה ריק: שורה כזו
 * הייתה נספרת כסשן שלם בכל חישוב משפך, וכל האירועים חסרי המזהה היו
 * מתאחדים לסשן ענק אחד עם שיעור המרה מופרך.
 */
export async function recordEvent(input: EventInput): Promise<void> {
  const sessionId = input.sessionId ?? (await currentSessionId());
  if (!sessionId) return;

  try {
    await prisma.analyticsEvent.create({
      data: {
        type: input.type,
        sessionId,
        userId: input.userId ?? null,
        listingId: input.listingId ?? null,
        categoryId: input.categoryId ?? null,
        query: input.query?.slice(0, 200) ?? null,
        resultCount: input.resultCount ?? null,
      },
    });
  } catch (err) {
    console.error("[analytics] failed to record event", input.type, err);
  }
}
