import { PrismaClient } from "@prisma/client";

/**
 * מופע יחיד של Prisma. ב-dev, Next מרענן מודולים ולכן שומרים את המופע
 * על ה-globalThis כדי לא לפתוח בריכות חיבורים חדשות בכל hot reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * הטבלאות שיש בהן שורות הדגמה, כלומר אלה שצריך לסנן.
 *
 * הרשימה מפורשת ולא נגזרת: מודל חדש עם `isDemo` שלא נרשם כאן פשוט לא
 * ייחסם, ולכן עדיף שהוספתו תהיה החלטה גלויה. השאר מסונן ממילא דרך
 * הקשר — שיחה של משתמש דמו לא מגיעה לאף מסך של משתמש אמיתי.
 */
const DEMO_MODELS = ["listing", "user"] as const;

/**
 * האם מותר להגיש נתוני הדגמה.
 *
 * **זו ההגנה החשובה ביותר בקוד הזה.** במסד יש אלפי מודעות דמו עם
 * מספרי טלפון שאינם קיימים. מודעה כזאת שמגיעה למשתמש אמיתי שולחת
 * אותו להתקשר לאיש שאינו קיים, וזה הורג את האמון בלוח ביום הראשון.
 *
 * ברירת המחדל היא חסימה, וההיתר הוא מפורש: סביבת תצוגה שרוצה דמו
 * מגדירה `ALLOW_DEMO_DATA=true` ויודעת מה היא עושה.
 */
export function demoDataAllowed(): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return process.env.ALLOW_DEMO_DATA === "true";
}

/**
 * הסינון נעשה בהרחבה אחת ולא בכל קריאה בנפרד.
 *
 * שאילתה אחת ששכחו לסנן היא כל ההבדל, ובלוח יש עשרות מסכים. השכבה
 * הזאת הופכת את הסינון לברירת מחדל שאי אפשר לשכוח.
 *
 * `where` הקיים נשמר ומתווסף אליו `isDemo: false` — לא מוחלף.
 */
function createClient(): PrismaClient {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  if (demoDataAllowed()) return base;

  /*
   * ההמרה חזרה ל-`PrismaClient` מכוונת. `$extends` מחזיר טיפוס נגזר
   * שמאבד את החתימות המדויקות של `groupBy` ושל האגרגציות, וההרחבה
   * כאן אינה משנה את הממשק אלא רק מצמצמת תוצאות — הטיפוס המקורי הוא
   * התיאור הנכון שלה.
   */
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const target = model?.toLowerCase() as (typeof DEMO_MODELS)[number] | undefined;
          if (!target || !DEMO_MODELS.includes(target)) return query(args);

          /*
           * פעולות קריאה וספירה בלבד. `create` ו-`update` אינם מקבלים
           * `where` מהסוג הזה, ומחיקה מסוננת הייתה משאירה שורות דמו
           * שאיש לא יכול להגיע אליהן — כולל `demo:purge`.
           */
          const READS = [
            "findFirst",
            "findFirstOrThrow",
            "findMany",
            "findUnique",
            "findUniqueOrThrow",
            "count",
            "aggregate",
            "groupBy",
          ];
          if (!READS.includes(operation)) return query(args);

          const a = args as { where?: Record<string, unknown> };
          return query({ ...a, where: { ...(a.where ?? {}), isDemo: false } });
        },
      },
    },
  }) as unknown as PrismaClient;
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { Prisma } from "@prisma/client";
