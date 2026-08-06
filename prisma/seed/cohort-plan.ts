/**
 * תוכנית הקוהורטים — עומק מתוכנן ולא עומק מקווה.
 *
 * מד המחיר מציג מספר רק כשיש לפחות 8 מודעות בקוהורט הדוק (יצרן+דגם+
 * שנה, עיר+חדרים). כשהזריעה בחרה יצרן, דגם ושנה באקראי, ההסתברות
 * שצירוף מסוים יגיע ל-8 הייתה נמוכה — ו-78% מהמודעות נפלו לשלב
 * ההרפיה הרחב ביותר, כלומר המספר שהוצג היה ברובו השוואה רופפת.
 *
 * הפתרון אינו עוד מודעות אלא **פחות צירופים**: רשימה סגורה של
 * צירופים נפוצים, שהזריעה עוברת עליה במחזור. כל צירוף מקבל בדיוק
 * `count / combos` מודעות, וזה מספר שאפשר לתכנן מולו במקום לקוות לו.
 *
 * זה גם נכון יותר ללוח אמיתי: שוק הרכב בישראל מרוכז בעשרה דגמים,
 * ושוק הדירות בעשר ערים. פיזור אחיד על 26 יצרנים ו-40 ערים הוא בדיוק
 * מה שלוח אמיתי אינו.
 */

export type VehiclePin = { make: string; model: string; year: number };
export type RealEstatePin = { city: string; rooms: number };

/** יעד הצפיפות שהתוכנית נבנתה כדי לעמוד בו. */
export const MIN_PER_VEHICLE_COHORT = 25;
export const MIN_PER_REALESTATE_COHORT = 30;

/** חמש השנים שמרכזות את שוק היד השנייה. */
const CAR_YEARS = [2017, 2019, 2021, 2022, 2023];

/** שמונת צירופי יצרן־דגם הנפוצים בכביש הישראלי. */
const CAR_PAIRS: [string, string][] = [
  ["טויוטה", "קורולה"],
  ["מאזדה", "3"],
  ["יונדאי", "i20"],
  ["קיה", "פיקנטו"],
  ["סקודה", "אוקטביה"],
  ["פולקסווגן", "גולף"],
  ["ניסאן", "מיקרה"],
  ["סוזוקי", "סוויפט"],
];

const SUV_PAIRS: [string, string][] = [
  ["קיה", "ספורטג'"],
  ["יונדאי", "טוסון"],
  ["מיצובישי", "אאוטלנדר"],
  ["סקודה", "קודיאק"],
];

const SUV_YEARS = [2019, 2021, 2023];

function grid(pairs: [string, string][], years: number[]): VehiclePin[] {
  return pairs.flatMap(([make, model]) => years.map((year) => ({ make, model, year })));
}

export const VEHICLE_PLAN: Record<string, VehiclePin[]> = {
  "private-cars": grid(CAR_PAIRS, CAR_YEARS),
  suvs: grid(SUV_PAIRS, SUV_YEARS),
};

/** שלושת גדלי הדירה שמרכיבים את רוב השוק. */
const ROOM_SIZES = [3, 3.5, 4];

const SALE_CITIES = [
  "תל אביב-יפו",
  "ירושלים",
  "חיפה",
  "ראשון לציון",
  "פתח תקווה",
  "נתניה",
  "באר שבע",
  "אשדוד",
];

const RENT_CITIES = [
  "תל אביב-יפו",
  "ירושלים",
  "חיפה",
  "רמת גן",
  "באר שבע",
  "פתח תקווה",
  "נתניה",
];

function reGrid(cities: string[]): RealEstatePin[] {
  return cities.flatMap((city) => ROOM_SIZES.map((rooms) => ({ city, rooms })));
}

export const REALESTATE_PLAN: Record<string, RealEstatePin[]> = {
  "apartments-sale": reGrid(SALE_CITIES),
  "apartments-rent": reGrid(RENT_CITIES),
};
