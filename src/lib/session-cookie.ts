/**
 * שם העוגייה של מזהה הסשן האנונימי למדידה.
 *
 * הקובץ הזה קיים כדי שלא יהיו שני עותקים של המחרוזת.
 * הוא נטול תלויות בכוונה: `src/middleware.ts` רץ ב-Edge Runtime ואינו
 * יכול לייבא את `src/lib/metrics.ts`, שגורר את לקוח Prisma.
 */
export const SESSION_COOKIE = "kedai_sid";

/** תוקף העוגייה — מספיק ארוך למחזור חיפוש של דירה או רכב. */
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180;
