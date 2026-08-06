import { getCity } from "@/lib/cities";

/**
 * הקוהורט — מול מי בדיוק מושווה המחיר.
 *
 * זה הלב של מד המחיר, וזה גם המקום שבו הוא היה שגוי מיסודו: ההשוואה
 * נעשתה מול כל תת-הקטגוריה. פנטהאוז 3 חדרים בהוד השרון הושווה לכל
 * דירות 3 החדרים בישראל, ופיג'ו 308 משנת 2006 עם 417 אלף ק"מ הושווה
 * לכל הרכבים מאותן שנים. שני המספרים שיצאו היו נכונים חשבונית וחסרי
 * ערך למשתמש.
 *
 * **קוהורט הדוק עם הרפיה מדורגת.** מנסים קודם את הקבוצה הצרה ביותר,
 * ורק אם אין בה מספיק דגימות מרפים שלב אחד. עוצרים ברגע שיש
 * `MIN_SAMPLE`. אם גם השלב הרחב ביותר לא מספיק — לא מציגים כלום.
 *
 * שני עוגנים מספריים לכל מודעה:
 * - `band` — הערך הראשי (שנת ייצור ברכב, מספר חדרים בנדל"ן)
 * - `band2` — הערך המשני שנמדד באחוזים (ק"מ ברכב, מ"ר בנדל"ן)
 *
 * ושני מפתחות זהות:
 * - `key` — הזהות ההדוקה (יצרן+דגם, עיר, מצב הפריט)
 * - `keyBroad` — ההרפיה (יצרן, אזור)
 *
 * **השכרה מול מכירה לא מושוות לעולם**, וזה נאכף בשכבה שמתחת לכול:
 * הן תת-קטגוריות נפרדות (`apartments-rent` / `apartments-sale`), וכל
 * שלבי ההשוואה מחייבים `categoryId` זהה. מאותה סיבה גם רכב פרטי לא
 * מושווה לאופנוע ולא למסחרי.
 */

/** מתחת לזה אין מספיק בסיס להשוואה, בכל שלב. */
export const MIN_SAMPLE = 8;

export type CohortTierSpec = {
  /** סטייה מותרת בערך הראשי, ביחידות שלו */
  band: number | null;
  /** סטייה מותרת בערך המשני, כשבר מהערך של המודעה */
  band2Pct: number | null;
  /** האם השלב משתמש במפתח הרחב במקום בהדוק */
  broad?: boolean;
};

/**
 * שלבי ההרפיה לפי קטגוריית שורש.
 *
 * מה שלא מופיע כאן לא מקבל מד מחיר בכלל. דרושים ועסקים למכירה הם
 * המקרה החשוב: המספר שלהם אינו מחיר מוצר אלא שכר או שווי עסק, וחציון
 * שמערבב אותם עם מחירי מוצרים הוא בדיוק סוג המספר שמלמד להתעלם מהמד.
 */
export const COHORT_TIERS: Record<string, CohortTierSpec[]> = {
  vehicles: [
    // יצרן+דגם, שנה ±2, ק"מ ±40%
    { band: 2, band2Pct: 0.4 },
    // יצרן+דגם, שנה ±4
    { band: 4, band2Pct: null },
    /*
     * יצרן, שנה ±3. "סוג הרכב" אינו נבדק כאן כשדה נפרד מפני שהוא כבר
     * נאכף חזק יותר: תת-הקטגוריה עצמה היא סוג הרכב (רכב פרטי, ג'יפ,
     * מסחרי, אופנוע), והיא חייבת להיות זהה בכל שלב.
     */
    { band: 3, band2Pct: null, broad: true },
  ],
  realestate: [
    // עיר, חדרים ±0.5, מ"ר ±25%
    { band: 0.5, band2Pct: 0.25 },
    // עיר, חדרים ±1
    { band: 1, band2Pct: null },
    // אשכול ערים, חדרים ±0.5
    { band: 0.5, band2Pct: null, broad: true },
  ],
  /* יד שנייה ובעלי חיים: תת-קטגוריה + מצב הפריט. אין הרפיה. */
  "second-hand": [{ band: null, band2Pct: null }],
  pets: [{ band: null, band2Pct: null }],
};

export type Cohort = {
  key: string | null;
  keyBroad: string | null;
  band: number | null;
  band2: number | null;
};

const EMPTY: Cohort = { key: null, keyBroad: null, band: null, band2: null };

function num(raw: unknown): number | null {
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function str(raw: unknown): string | null {
  const s = typeof raw === "string" ? raw.trim() : "";
  return s.length ? s : null;
}

/**
 * הקוהורט של מודעה — מחושב בכתיבה ונשמר על השורה.
 *
 * לא בשאילתה: כל בדיקת מד מחיר הייתה דורשת אז `join` אל טבלת השדות
 * הדינמיים עבור כל מודעה שמושווית, כלומר עשרות אלפי שורות לעמוד
 * תוצאות אחד.
 *
 * `key` ריק פירושו שאין מספיק מידע כדי להשוות בכנות — ואז אין מד.
 */
export function cohortFor(
  rootSlug: string | null | undefined,
  attributes: Record<string, unknown>,
  city: string | null | undefined,
): Cohort {
  switch (rootSlug) {
    case "vehicles": {
      const make = str(attributes.manufacturer);
      const model = str(attributes.model);
      const year = num(attributes.year);
      if (!make || !year) return EMPTY;
      return {
        // בלי דגם אין קוהורט הדוק, אבל היצרן עדיין מאפשר את השלב הרחב
        key: model ? `${make}|${model}` : null,
        keyBroad: make,
        band: year,
        band2: num(attributes.km),
      };
    }
    case "realestate": {
      const town = str(city);
      const rooms = num(attributes.rooms);
      if (!town || !rooms) return EMPTY;
      /*
       * האשכול הוא האזור מתוך `cities.ts`. זהו קירוב גאוגרפי לרמת
       * מחירים ולא חלוקה שנגזרה ממחירים בפועל — אבל הוא נתון אמיתי
       * ויציב, ועדיף על חלוקה שהומצאה. משתמש שנופל לשלב הזה רואה
       * ממילא את גודל המדגם לצד המספר.
       */
      return {
        key: town,
        keyBroad: getCity(town)?.region ?? null,
        band: rooms,
        band2: num(attributes.size),
      };
    }
    case "second-hand":
    case "pets": {
      const condition = str(attributes.condition);
      if (!condition) return EMPTY;
      return { key: condition, keyBroad: null, band: null, band2: null };
    }
    default:
      return EMPTY;
  }
}

/** האם לקטגוריית השורש הזו יש מד מחיר בכלל. */
export function hasPriceMeter(rootSlug: string | null | undefined): boolean {
  return !!rootSlug && rootSlug in COHORT_TIERS;
}
