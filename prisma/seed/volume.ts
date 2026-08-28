/**
 * היקף הזריעה: כמה מודעות ובכמה משתמשים.
 *
 * הקבועים יושבים בקובץ נפרד ולא ב-`seed.ts` משום ש-`seed.ts` מריץ את
 * `main()` בטעינה — ייבוא שלו כדי לקרוא מספר היה זורע את בסיס הנתונים.
 * `npm run check:docs` קורא מכאן ומשווה ל-README.
 */

export const TOTAL_USERS = 30;

/**
 * כמה מודעות לייצר בכל תת-קטגוריה.
 *
 * ארבע הקטגוריות הראשונות עמוקות בהרבה מהשאר, ובכוונה: מדד המחירים
 * מציג מספר רק כשיש לפחות `MIN_SAMPLE` מודעות להשוואה, ובפיזור אחיד על
 * 49 קטגוריות אף צירוף של דגם ושנה או של עיר ומספר חדרים לא היה מגיע
 * לסף. לוח אמיתי גם הוא אינו אחיד — רכב ונדל"ן הם רוב התנועה.
 */
export const DISTRIBUTION: Record<string, number> = {
  "private-cars": 150,
  "commercial-vehicles": 12,
  suvs: 45,
  motorcycles: 10,
  scooters: 6,
  "off-road": 2,
  "trade-in": 4,

  "apartments-sale": 220,
  "apartments-rent": 200,
  roommates: 8,
  commercial: 6,
  lots: 3,
  vacation: 3,

  furniture: 18,
  electronics: 20,
  appliances: 14,
  fashion: 12,
  sports: 10,
  "baby-kids": 10,
  tools: 6,

  "jobs-tech": 6,
  "jobs-sales": 4,
  "jobs-hospitality": 4,
  "jobs-education": 4,
  "jobs-health": 3,
  "jobs-logistics": 3,
  "jobs-construction": 3,
  "jobs-admin": 3,

  dogs: 4,
  cats: 4,
  birds: 2,
  fish: 1,
  rodents: 1,
  "pet-supplies": 3,

  businesses: 10,

  renovations: 3,
  "electrician-plumber": 2,
  cleaning: 2,
  moving: 2,
  computers: 2,
  events: 2,
  tutoring: 1,
  beauty: 1,
};

export const TOTAL_LISTINGS = Object.values(DISTRIBUTION).reduce((sum, n) => sum + n, 0);
