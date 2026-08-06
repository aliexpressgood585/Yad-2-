/**
 * מחוללי תוכן למודעות דמו.
 * כל מחולל מקבל RNG דטרמיניסטי ומחזיר מודעה עם שדות דינמיים תואמים
 * לקטגוריה שלה — כדי שהפילטרים באתר יעבדו על נתונים אמיתיים.
 */
import {
  CAR_MODELS,
  COMMERCIAL_MODELS,
  MOTORCYCLE_MODELS,
  RESIDENTIAL_SALE_TYPES,
  RESIDENTIAL_RENT_TYPES,
  ROOMMATE_TYPES,
  VACATION_TYPES,
} from "./categories";
import { getCity } from "../../src/lib/cities";

export type Rng = {
  int: (min: number, max: number) => number;
  float: (min: number, max: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  picks: <T>(arr: readonly T[], n: number) => T[];
  /** בחירה משוקללת — ערך עם משקל 10 ייבחר פי עשרה מערך עם משקל 1. */
  weighted: <T>(entries: readonly (readonly [T, number])[]) => T;
  bool: (p?: number) => boolean;
  maybe: <T>(value: T, p?: number) => T | undefined;
};

export type AttrValues = Record<string, string | number | boolean | string[]>;

export type GeneratedListing = {
  title: string;
  description: string;
  price: number | null;
  attrs: AttrValues;
  /** נושא לתמונות — משמש כ-seed קבוע ל-picsum */
  imageTopic: string;
  imageCount: number;
};

export function makeRng(seed: number): Rng {
  let s = seed >>> 0 || 1;
  const next = () => {
    // xorshift32 — מספיק טוב ל-seed ומאפשר תוצאות משוחזרות
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
  const int = (min: number, max: number) =>
    Math.floor(next() * (max - min + 1)) + min;
  return {
    int,
    float: (min, max) => +(next() * (max - min) + min).toFixed(2),
    pick: <T,>(arr: readonly T[]) => arr[int(0, arr.length - 1)] as T,
    picks: <T,>(arr: readonly T[], n: number) => {
      const copy = [...arr];
      const out: T[] = [];
      for (let i = 0; i < n && copy.length; i++) {
        out.push(copy.splice(int(0, copy.length - 1), 1)[0] as T);
      }
      return out;
    },
    weighted: <T,>(entries: readonly (readonly [T, number])[]) => {
      const total = entries.reduce((sum, e) => sum + e[1], 0);
      let roll = int(1, Math.max(1, Math.round(total)));
      for (const [value, weight] of entries) {
        if ((roll -= weight) <= 0) return value;
      }
      return entries[entries.length - 1]![0];
    },
    bool: (p = 0.5) => next() < p,
    maybe: <T,>(value: T, p = 0.5) => (next() < p ? value : undefined),
  };
}

/** מסיר מפתחות עם ערך undefined. */
function clean(obj: Record<string, unknown>): AttrValues {
  const out: AttrValues = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && v !== "") {
      out[k] = v as AttrValues[string];
    }
  }
  return out;
}

const CURRENT_YEAR = new Date().getFullYear();

/* -------------------------------------------------------------------------- */
/* רכב                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * תיאור מצב הרכב, נגזר מהקילומטראז' והגיל בפועל.
 *
 * הגרסה הקודמת בחרה משפט מרשימה אקראית, ולכן רכב עם 5,433 ק"מ קיבל
 * "עבר טיפול 100 אלף כולל רצועת טיימינג" — תיאור שסותר את המפרט שלידו.
 * כאן כל משפט שייך לטווח שבו הוא נכון.
 */
function carConditionText(rng: Rng, km: number, age: number): string[] {
  const out: string[] = [];

  if (km < 20_000) {
    out.push(
      rng.pick([
        "הרכב כמעט חדש, נסועה נמוכה מאוד ועדיין באחריות היבואן.",
        "נסע מעט מאוד, שמור בחניון מקורה ומטופל לפי הוראות היצרן.",
      ]),
    );
  } else if (km < 90_000) {
    out.push(
      rng.pick([
        "שמור מאוד, לא עבר תאונות, וכל הטיפולים נעשו בזמן במוסך מורשה.",
        "רכב שני במשפחה, נסע מעט יחסית לשנתון. מחיר גמיש למי שבא לראות.",
      ]),
    );
  } else if (km < 180_000) {
    out.push(
      rng.pick([
        "מטופל בזמן, אין רעשים ואין נזילות. מוכן למבחן שמאי מטעם הקונה.",
        "הרכב עבר טיפול 100 אלף כולל רצועת טיימינג ובלמים חדשים.",
      ]),
    );
  } else {
    out.push(
      rng.pick([
        "נסועה גבוהה אבל מטופל היטב — כל הטיפולים מתועדים, כולל מערכת היגוי ומתלים.",
        "רכב עבודה אמין. עבר לאחרונה טיפול גדול והחלפת דיסקיות.",
      ]),
    );
  }

  if (age >= 12) {
    out.push("הרכב ותיק, מתאים למי שמחפש רכב זול ואמין לנסיעות יומיומיות.");
  }

  return out;
}

/** MM/YYYY במרחק חודשים קדימה מהיום — לעולם לא תאריך שעבר. */
function futureMonth(monthsAhead: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsAhead);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

const CAR_EXTRAS_TEXT = [
  "כולל מערכת מולטימדיה עם Apple CarPlay.",
  "יש חיישני חנייה מלפנים ומאחור.",
  "בקרת שיוט אדפטיבית ומערכת שמירת נתיב.",
  "ריפודי עור מקוריים ושמורים.",
  "גג נפתח חשמלי.",
];

/**
 * נתח היצרנים בלוח.
 *
 * בחירה אחידה מתוך 26 יצרנים פיזרה את המודעות דק מדי: כל צירוף
 * יצרן־דגם קיבל מודעה אחת או שתיים, וזה מספר שאי אפשר לגזור ממנו מחיר.
 * המשקלים מקרבים את הפיזור למה שנראה בשוק הישראלי, שבו חמישה יצרנים
 * מחזיקים נתח גדול — וכך יש דגמים עם מספיק מודעות כדי שמדד המחירים
 * יוכל בכלל לענות.
 */
const MAKE_WEIGHT: Record<string, number> = {
  "טויוטה": 14,
  "יונדאי": 12,
  "קיה": 12,
  "מאזדה": 9,
  "סקודה": 8,
  "פולקסווגן": 7,
  "ניסאן": 5,
  "מיצובישי": 5,
  "שברולט": 4,
  "הונדה": 4,
  "רנו": 4,
  "פיג'ו": 4,
  "סוזוקי": 3,
  "פורד": 3,
  "MG": 3,
  "BYD": 3,
  "BMW": 3,
  "מרצדס-בנץ": 3,
  "אאודי": 2,
  "סיאט": 2,
  "אופל": 2,
};

function generateCar(rng: Rng, sub: string): GeneratedListing {
  // רשימת הדגמים חייבת להתאים לתת-הקטגוריה, אחרת נוצר "MG 4" עם
  // משקל מטען וסוג מרכב מקרר.
  const models =
    sub === "commercial-vehicles"
      ? COMMERCIAL_MODELS
      : sub === "motorcycles" || sub === "scooters"
        ? MOTORCYCLE_MODELS
        : CAR_MODELS;

  const make = rng.weighted(
    Object.keys(models).map((m) => [m, MAKE_WEIGHT[m] ?? 1] as const),
  );
  // הדגמים הראשונים ברשימה הם הנפוצים ביצרן, ולכן הם מקבלים משקל גבוה.
  // בלי זה כל דגם מקבל מודעה־שתיים, ואף דגם לא מגיע לגודל מדגם שמאפשר
  // להציג עליו מחיר — ולוח אמיתי אינו מפוזר כך.
  const modelList = models[make]!;
  const model = rng.weighted(
    modelList.map((m, i) => [m, i < 2 ? 5 : 1] as const),
  );
  const year = rng.int(2006, CURRENT_YEAR);
  const age = CURRENT_YEAR - year;

  // ק"מ ויד נגזרים מהגיל, ולא נבחרים בנפרד: רכב בן שנה לא יכול להיות
  // "יד חמישית", ורכב בן 15 לא יכול להיות עם 5,000 ק"מ.
  const km = Math.max(
    500,
    age === 0
      ? rng.int(500, 12_000)
      : age * rng.int(9000, 22_000) + rng.int(0, 15_000),
  );

  // יד ראשונה עד גיל 3, ואז יד נוספת לכל ~4 שנים
  const hand = Math.min(5, Math.max(1, Math.ceil((age - 2) / 4) + rng.int(0, 1)));

  // תמחור גס לפי גיל וקילומטראז'
  const base = rng.int(85_000, 190_000);
  const depreciation = Math.pow(0.86, age);
  const kmPenalty = Math.max(0.55, 1 - km / 700_000);
  const price = Math.round((base * depreciation * kmPenalty) / 500) * 500;

  const gearbox = rng.bool(0.78) ? "אוטומטית" : "ידנית";
  const fuel = rng.pick(["בנזין", "בנזין", "בנזין", "דיזל", "היברידי", "חשמלי"]);

  const attrs = clean({
    manufacturer: make,
    model: `${make}-${model}`,
    year,
    hand: String(hand),
    km,
    gearbox,
    fuel,
    engine: fuel === "חשמלי" ? undefined : rng.pick([1000, 1200, 1400, 1600, 1800, 2000, 2500]),
    color: rng.pick(["לבן", "שחור", "כסף", "אפור", "כחול", "אדום"]),
    ownership: rng.pick(["פרטית", "פרטית", "פרטית", "חברה", "ליסינג"]),
    // טסט תמיד עתידי ביחס לרגע הזריעה — תאריך שכבר עבר על מודעה
    // פעילה קרא כמו נתון שגוי
    testUntil: futureMonth(rng.int(1, 11)),
    extras: rng.picks(
      ["חיישני רוורס", "מצלמת רוורס", "בקרת שיוט", "חלונות חשמל", "מולטימדיה", "ריפוד עור", "גלגלי סגסוגת", "חימום מושבים"],
      rng.int(2, 5),
    ),
    ...(sub === "suvs" ? { drive: rng.pick(["4x4", "AWD", "4x2 קדמית"]) } : {}),
    ...(sub === "commercial-vehicles"
      ? {
          payload: rng.pick([500, 800, 1000, 1200, 1500]),
          bodyType: rng.pick(["סגור", "פתוח", "טנדר", "מקרר"]),
        }
      : {}),
    ...(sub === "trade-in"
      ? { wantedInReturn: rng.pick(["רכב משפחתי אוטומטי 2018 ומעלה", "ג'יפ קטן, מוכן להשלים הפרש", "רכב קטן וחסכוני לעיר"]) }
      : {}),
  });

  const title = `${make} ${model} ${year}${hand <= 1 ? " יד ראשונה" : ""}`;
  const description = [
    `${make} ${model} משנת ${year}, ${gearbox}, ${km.toLocaleString("he-IL")} ק"מ.`,
    ...carConditionText(rng, km, age),
    rng.bool(0.6) ? rng.pick(CAR_EXTRAS_TEXT) : "",
    rng.bool(0.5) ? "ניתן לבדוק במכון בדיקה על חשבון הקונה." : "",
    "לפרטים נוספים ותיאום צפייה — מוזמנים ליצור קשר.",
  ]
    .filter(Boolean)
    .join(" ");

  return { title, description, price, attrs, imageTopic: "car", imageCount: rng.int(4, 8) };
}

function generateMotorcycle(rng: Rng, sub: string): GeneratedListing {
  const brands = ["ימאהה", "הונדה", "סוזוקי", "KTM", "BMW", "קוואסאקי", "פיאג'ו", "SYM", "קימקו", "דוקאטי"];
  const brand = rng.pick(brands);
  const cc = sub === "scooters" ? rng.pick([50, 125, 150, 300, 400]) : rng.pick([125, 250, 400, 650, 750, 1000]);
  const year = rng.int(2010, CURRENT_YEAR);
  const km = (CURRENT_YEAR - year) * rng.int(2500, 9000) + rng.int(0, 4000);
  const price = Math.round((rng.int(6000, 55_000) * Math.pow(0.9, CURRENT_YEAR - year)) / 100) * 100;

  const attrs = clean({
    manufacturer: undefined,
    year,
    hand: String(rng.int(1, 3)),
    km,
    engine: cc,
    gearbox: sub === "scooters" ? "אוטומטית" : "ידנית",
    fuel: rng.bool(0.15) ? "חשמלי" : "בנזין",
    color: rng.pick(["שחור", "לבן", "אדום", "כחול", "כסף"]),
    // טסט תמיד עתידי ביחס לרגע הזריעה — תאריך שכבר עבר על מודעה
    // פעילה קרא כמו נתון שגוי
    testUntil: futureMonth(rng.int(1, 11)),
    ...(sub === "motorcycles"
      ? {
          licenseType: cc <= 125 ? "A1 (עד 125)" : cc <= 400 ? 'A2 (עד 35 כ"ס)' : "A (ללא הגבלה)",
          bikeType: rng.pick(["ספורט", "נייקד", "טוארינג", "אנדורו", "סופרמוטו"]),
        }
      : {}),
    ...(sub === "scooters" ? { scooterType: rng.pick(["קטנוע עירוני", "מקסי סקוטר", "חשמלי"]) } : {}),
    ...(sub === "off-road" ? { offroadType: rng.pick(["טרקטורון", "רייזר", "באגי"]) } : {}),
  });

  return {
    title: `${brand} ${cc}cc ${year}`,
    description: `${brand} בנפח ${cc} סמ"ק משנת ${year}. ${rng.pick([
      "מטופל בזמן, שמור בחניון מקורה.",
      "צמיגים חדשים, בלמים תקינים, מוכן לרכיבה.",
      "כלי אמין ליומיום, חסכוני בדלק ובחניה.",
    ])} ${km.toLocaleString("he-IL")} ק"מ בלבד. מחיר גמיש לרציניים.`,
    price,
    attrs,
    imageTopic: "motorcycle",
    imageCount: rng.int(3, 6),
  };
}

/* -------------------------------------------------------------------------- */
/* נדל"ן                                                                       */
/* -------------------------------------------------------------------------- */

const RE_HIGHLIGHTS = [
  "הדירה מוארת ומאווררת לכל הכיוונים, עם נוף פתוח.",
  "קרוב לבתי ספר, גנים, סופר ותחבורה ציבורית.",
  "הבניין שמור עם לובי מטופח וועד בית פעיל.",
  "אזור שקט ומשפחתי, חניה זמינה ברחוב.",
  "מיקום מרכזי ממש — הכול במרחק הליכה.",
];

/**
 * רמת המחירים היחסית של כל עיר, ביחס לבסיס ארצי של 1.
 *
 * בלי זה דירה בעפולה ודירה בתל אביב נדגמו מאותו טווח מחירים, ודף
 * "מחירי הדירות ב<עיר>" היה מציג נתון אמיתי לחלוטין — שנגזר מנתוני דמו
 * חסרי משמעות. מכיוון שהמדד מציג את החציון בעיר, פיזור המחירים בין
 * ערים הוא בדיוק מה שהוא מודד, והוא חייב להיות סביר.
 */
const CITY_PRICE_LEVEL: Record<string, number> = {
  "תל אביב-יפו": 2.4,
  "רמת גן": 1.75,
  "גבעתיים": 1.85,
  "הרצליה": 1.95,
  "רמת השרון": 1.95,
  "רעננה": 1.6,
  "כפר סבא": 1.4,
  "הוד השרון": 1.4,
  "ירושלים": 1.7,
  "מודיעין-מכבים-רעות": 1.25,
  "ראשון לציון": 1.2,
  "פתח תקווה": 1.15,
  "חולון": 1.2,
  "בת ים": 1.15,
  "רחובות": 1.1,
  "נס ציונה": 1.2,
  "בני ברק": 1.15,
  "נתניה": 1.05,
  "כפר יונה": 0.95,
  "אשדוד": 0.9,
  "חיפה": 0.9,
  "בית שמש": 0.85,
  "חדרה": 0.8,
  "אשקלון": 0.75,
  "לוד": 0.7,
  "רמלה": 0.7,
  "באר שבע": 0.62,
  "קריית גת": 0.6,
  "נהריה": 0.6,
  "עפולה": 0.55,
  "נצרת": 0.55,
  "רהט": 0.45,
};

/** ברירת מחדל לפי אזור, לערים שאינן בטבלה. */
const REGION_PRICE_LEVEL: Record<string, number> = {
  "תל אביב": 1.6,
  "מרכז": 1.1,
  "שרון": 1.2,
  "ירושלים": 1.1,
  "שפלה": 0.8,
  "חיפה": 0.8,
  "צפון": 0.6,
  "דרום": 0.6,
};

function priceLevelOf(city: string): number {
  if (CITY_PRICE_LEVEL[city]) return CITY_PRICE_LEVEL[city]!;
  const region = getCity(city)?.region;
  return (region && REGION_PRICE_LEVEL[region]) ?? 0.85;
}

/**
 * מה כל סוג נכס אומר על השטח ועל הקומה.
 *
 * `perRoom` — טווח מ"ר לחדר, `minSize` — רצפה מוחלטת, `floor` — קרקע
 * לבתים ולדירות גן, קומה עליונה לפנטהאוז, וכל השאר חופשי.
 */
const PROPERTY_SHAPE: Record<
  string,
  { perRoom: [number, number]; minSize: number; floor?: "ground" | "top" }
> = {
  "דירה": { perRoom: [22, 30], minSize: 38 },
  "דירת גן": { perRoom: [26, 34], minSize: 60, floor: "ground" },
  "פנטהאוז": { perRoom: [33, 46], minSize: 95, floor: "top" },
  "דופלקס": { perRoom: [30, 42], minSize: 85 },
  "בית פרטי": { perRoom: [35, 52], minSize: 110, floor: "ground" },
  "דו משפחתי": { perRoom: [30, 44], minSize: 100, floor: "ground" },
  "קוטג'": { perRoom: [30, 44], minSize: 100, floor: "ground" },
  "יחידת דיור": { perRoom: [18, 26], minSize: 24 },
  "משק חקלאי": { perRoom: [40, 70], minSize: 140, floor: "ground" },
  "וילה": { perRoom: [40, 62], minSize: 130, floor: "ground" },
  "בקתה": { perRoom: [18, 28], minSize: 26, floor: "ground" },
  "צימר": { perRoom: [20, 32], minSize: 28, floor: "ground" },
  "לופט": { perRoom: [30, 45], minSize: 55 },
  "מגרש": { perRoom: [1, 1], minSize: 250, floor: "ground" },
};

function generateRealEstate(rng: Rng, sub: string, city: string): GeneratedListing {
  const level = priceLevelOf(city);
  // פערי השכירות בין ערים צרים מפערי המכירה — אותה עיר יקרה פי שניים
  // למכירה אינה יקרה פי שניים להשכרה.
  const rentLevel = 1 + (level - 1) * 0.6;
  // שלושה עד ארבעה חדרים הם רוב שוק הדירות בפועל; פיזור אחיד על תשעה
  // ערכים היה מותיר כל גודל דירה עם קומץ מודעות בעיר.
  const rooms = rng.weighted([
    [2, 5], [2.5, 6], [3, 20], [3.5, 16], [4, 20], [4.5, 10], [5, 8], [5.5, 3], [6, 2],
  ]);
  const isRent = sub === "apartments-rent";
  const isRoommate = sub === "roommates";
  const isVacation = sub === "vacation";
  const isCommercial = sub === "commercial";
  const isLot = sub === "lots";

  // סוג הנכס נבחר מרשימת האפשרויות של אותה תת-קטגוריה בדיוק, ולא מרשימה
  // כללית — אחרת נוצרות מודעות שהערך שלהן לא קיים בפילטר של הקטגוריה.
  const propertyTypePool = isLot
    ? null
    : isRoommate
      ? ROOMMATE_TYPES
      : isVacation
        ? VACATION_TYPES
        : isRent
          ? RESIDENTIAL_RENT_TYPES
          : RESIDENTIAL_SALE_TYPES;

  // "דירה" מוטה כלפי מעלה כי זה הנכס הנפוץ בפועל
  const propertyType = propertyTypePool
    ? rng.pick([propertyTypePool[0]!, propertyTypePool[0]!, ...propertyTypePool])
    : "מגרש";

  /*
   * השטח והקומה נגזרים מ**סוג הנכס** ולא מנוסחה אחת לכולם.
   *
   * `rooms * 20..30` ייצר "פנטהאוז 3 חדרים 63 מ\"ר" — מספר תקין
   * לדירה קטנה ובלתי אפשרי לפנטהאוז. פנטהאוז גם לא יושב בקומה 2
   * ובית פרטי לא יושב בקומה 7. סוג הנכס הוא שקובע את שניהם.
   */
  const shape = PROPERTY_SHAPE[isLot ? "מגרש" : propertyType] ?? PROPERTY_SHAPE["דירה"]!;
  const size = isLot
    ? rng.int(250, 1400)
    : Math.max(shape.minSize, Math.round(rooms * rng.int(shape.perRoom[0], shape.perRoom[1])));

  const totalFloors = rng.int(2, 14);
  const floor =
    shape.floor === "ground"
      ? 0
      : shape.floor === "top"
        ? totalFloors
        : rng.int(0, totalFloors);

  let price: number;
  if (isRent) price = Math.round(((2000 + size * rng.int(20, 38)) * rentLevel) / 50) * 50;
  else if (isRoommate) price = Math.round((rng.int(1400, 3200) * rentLevel) / 50) * 50;
  else if (isVacation) price = Math.round(rng.int(450, 2400) / 50) * 50;
  else if (isLot) price = Math.round((rng.int(400_000, 3_500_000) * level) / 10_000) * 10_000;
  else if (isCommercial) price = Math.round((rng.int(4000, 45_000) * rentLevel) / 100) * 100;
  else price = Math.round((size * rng.int(14_000, 30_000) * level) / 10_000) * 10_000;

  const attrs = clean({
    // commercial ו-lots מתארים את סוג הנכס דרך commercialType / zoning
    propertyType: isCommercial || isLot ? undefined : propertyType,
    rooms: isLot ? undefined : rooms,
    size,
    floor: isLot ? undefined : floor,
    totalFloors: isLot ? undefined : totalFloors,
    elevator: floor > 2 ? rng.bool(0.75) : rng.bool(0.3),
    parking: rng.bool(0.6),
    balcony: rng.bool(0.7),
    balconySize: rng.maybe(rng.int(6, 25), 0.6),
    safeRoom: rng.bool(0.45),
    storage: rng.bool(0.4),
    airConditioning: rng.bool(0.85),
    bars: rng.bool(0.35),
    accessible: rng.bool(0.25),
    renovated: rng.bool(0.4),
    furnished: isRent || isRoommate ? rng.bool(0.6) : rng.bool(0.15),
    condition: rng.pick(["חדש מקבלן", "משופץ", "במצב טוב", "במצב טוב", "דרוש שיפוץ"]),
    entryDate: rng.pick(["מיידי", "גמיש", "01.09", "01.10", "תוך חודשיים"]),
    ...(isRent
      ? {
          houseCommittee: rng.int(80, 450),
          propertyTax: rng.int(400, 1800),
          petsAllowed: rng.bool(0.4),
          minLease: rng.pick(["שנה", "שנה", "שנתיים", "גמיש"]),
        }
      : {}),
    ...(isRoommate
      ? {
          currentRoommates: rng.int(1, 3),
          roommateGender: rng.pick(["גברים", "נשים", "מעורב", "לא משנה"]),
          privateBathroom: rng.bool(0.3),
        }
      : {}),
    ...(isCommercial
      ? {
          commercialType: rng.pick(["משרד", "חנות", "מחסן", "קליניקה", "סטודיו", "מסעדה"]),
          dealType: rng.pick(["להשכרה", "להשכרה", "למכירה"]),
        }
      : {}),
    ...(isLot
      ? {
          zoning: rng.pick(["מגורים", "חקלאי", "מסחרי"]),
          buildRights: rng.int(120, 1200),
        }
      : {}),
    ...(isVacation
      ? {
          sleeps: rng.int(2, 12),
          pool: rng.bool(0.5),
          jacuzzi: rng.bool(0.45),
          seaView: rng.bool(0.3),
        }
      : {}),
  });

  const titleMap: Record<string, string> = {
    "apartments-sale": `${propertyType} ${rooms} חדרים למכירה ב${city}`,
    "apartments-rent": `${propertyType} ${rooms} חדרים להשכרה ב${city}`,
    roommates: `דרוש/ה שותף/ה לדירת ${rooms} חדרים ב${city}`,
    commercial: `${attrs.commercialType} ${size} מ"ר ${attrs.dealType} ב${city}`,
    lots: `מגרש ${size} מ"ר ב${city} — ${attrs.zoning}`,
    vacation: `צימר / דירת נופש ב${city} עד ${attrs.sleeps} אורחים`,
  };

  const description = [
    isLot
      ? `מגרש בשטח ${size} מ"ר ב${city}, ייעוד ${attrs.zoning}, עם ${attrs.buildRights} מ"ר זכויות בנייה.`
      : `${propertyType} בת ${rooms} חדרים בשטח ${size} מ"ר${floor ? `, קומה ${floor} מתוך ${totalFloors}` : ""}.`,
    rng.pick(RE_HIGHLIGHTS),
    attrs.elevator ? "יש מעלית בבניין." : "",
    attrs.parking ? "כולל חניה." : "",
    attrs.safeRoom ? 'יש ממ"ד.' : "",
    isRent ? `כניסה ${attrs.entryDate}. ועד בית ${attrs.houseCommittee} ₪ לחודש.` : "",
    "לתיאום צפייה — מוזמנים ליצור קשר.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    title: titleMap[sub] ?? `${propertyType} ב${city}`,
    description,
    price,
    attrs,
    imageTopic: isLot ? "land" : isCommercial ? "office" : "apartment",
    imageCount: rng.int(4, 9),
  };
}

/* -------------------------------------------------------------------------- */
/* יד שנייה                                                                    */
/* -------------------------------------------------------------------------- */

const CONDITIONS = ["חדש באריזה", "כמו חדש", "מצב מצוין", "מצב טוב", "משומש"] as const;

type SecondHandSpec = {
  types: string[];
  brands: string[];
  priceRange: [number, number];
  topic: string;
  typeKey: string;
  extra?: (rng: Rng, type: string) => AttrValues;
  describe: (rng: Rng, type: string, brand: string) => string;
};

const SECOND_HAND_SPECS: Record<string, SecondHandSpec> = {
  furniture: {
    typeKey: "furnitureType",
    types: ["ספה", "מיטה", "ארון", "שולחן", "כיסא", "שידה", "ספריה", "מזנון", "פינת אוכל", "מזרן"],
    brands: ["איקאה", "ביתילי", "הום סנטר", "ורדינון", "עמינח", "אולם", "רהיטי מזרח"],
    priceRange: [150, 6000],
    topic: "furniture",
    extra: (rng) => ({
      material: rng.pick(["עץ מלא", "MDF", "מתכת", "בד", "עור"]),
      dimensions: `${rng.int(60, 240)}×${rng.int(40, 100)}×${rng.int(40, 210)} ס"מ`,
    }),
    describe: (rng, type, brand) =>
      `${type} מבית ${brand}. ${rng.pick([
        "נקנה לפני שנתיים ושימש מעט מאוד.",
        "במצב מצוין ללא פגמים או שריטות.",
        "מפנה מקום בדירה, לכן נמכר במחיר טוב.",
      ])} האיסוף מהבית, ניתן לעזור בהעמסה.`,
  },
  electronics: {
    typeKey: "electronicsType",
    types: ["סמארטפון", "מחשב נייד", "טאבלט", "טלוויזיה", "קונסולה", "אוזניות", "שעון חכם", "מצלמה", "צג"],
    brands: ["Apple", "Samsung", "Lenovo", "Dell", "Sony", "LG", "Xiaomi", "HP", "Asus", "Canon"],
    priceRange: [200, 9000],
    topic: "electronics",
    extra: (rng, type) => ({
      storage: ["סמארטפון", "מחשב נייד", "טאבלט"].includes(type)
        ? rng.pick(["64GB", "128GB", "256GB", "512GB", "1TB"])
        : undefined as unknown as string,
      screenSize: ["טלוויזיה", "צג", "מחשב נייד"].includes(type)
        ? rng.pick([13, 15, 24, 27, 32, 43, 55, 65])
        : (undefined as unknown as number),
      originalBox: rng.bool(0.6),
    }),
    describe: (rng, type, brand) =>
      `${type} ${brand} במצב ${rng.pick(["מצוין", "טוב מאוד", "כמו חדש"])}. ${rng.pick([
        "עובד מושלם, ללא תקלות, סוללה במצב טוב.",
        "נרכש בארץ עם חשבונית, אחריות יצרן עדיין בתוקף.",
        "כולל את כל האביזרים המקוריים.",
      ])} ניתן לבדוק לפני הקנייה.`,
  },
  appliances: {
    typeKey: "applianceType",
    types: ["מקרר", "מכונת כביסה", "מייבש כביסה", "מדיח כלים", "תנור", "מיקרוגל", "מזגן", "שואב אבק", "מכונת קפה"],
    brands: ["Bosch", "Samsung", "LG", "Electra", "Beko", "Whirlpool", "Tadiran", "Delonghi"],
    priceRange: [250, 5500],
    topic: "appliance",
    extra: (rng) => ({ energyRating: rng.pick(["A+++", "A++", "A+", "A", "B"]) }),
    describe: (rng, type, brand) =>
      `${type} ${brand}. ${rng.pick([
        "עובד מצוין, נמכר בגלל שיפוץ מטבח.",
        "שימש שנתיים בלבד במשק בית קטן.",
        "מטופל ונקי, כולל הוראות הפעלה.",
      ])} האיסוף מהבית — נדרשת עזרה בהובלה.`,
  },
  fashion: {
    typeKey: "fashionType",
    types: ["חולצה", "מכנסיים", "שמלה", "מעיל", "נעליים", "תיק", "תכשיטים", "חליפה", "בגד ים"],
    brands: ["Zara", "Castro", "H&M", "Nike", "Adidas", "Fox", "Renuar", "Mango", "Levi's"],
    priceRange: [40, 1200],
    topic: "fashion",
    extra: (rng) => ({
      gender: rng.pick(["נשים", "גברים", "יוניסקס"]),
      size: rng.pick(["XS", "S", "M", "L", "XL", "38", "40", "42"]),
    }),
    describe: (rng, type, brand) =>
      `${type} ${brand} ${rng.pick(["שנלבש פעם אחת", "חדש עם תווית", "במצב מעולה"])}. ${rng.pick([
        "לא התאים במידה ולכן נמכר.",
        "נשמר בארון, ללא כתמים או קרעים.",
      ])} אפשרות למשלוח בתוספת תשלום.`,
  },
  sports: {
    typeKey: "sportType",
    types: ["כושר וחדר כושר", "אופניים", "גלישה", "ריצה", "כדורגל", "טניס", "יוגה", "קמפינג", "דיג"],
    brands: ["Decathlon", "Trek", "Giant", "Nike", "Reebok", "Cube", "Specialized"],
    priceRange: [80, 7000],
    topic: "sport",
    describe: (rng, type, brand) =>
      `ציוד ${type} מבית ${brand}. ${rng.pick([
        "שימש עונה אחת בלבד ועבר טיפול.",
        "במצב מעולה, מתאים למתחילים ולמתקדמים.",
        "מפנה מקום במחסן — מחיר הזדמנות.",
      ])}`,
  },
  "baby-kids": {
    typeKey: "babyType",
    types: ["עגלה", "מיטת תינוק", "כיסא אוכל", "סלקל", "מושב בטיחות", "צעצועים", "לול", "בגדי תינוק"],
    brands: ["Chicco", "Bugaboo", "Maxi-Cosi", "Shilav", "Britax", "Baby Love", "Doona"],
    priceRange: [80, 3500],
    topic: "baby",
    extra: (rng) => ({ ageRange: rng.pick(["0-6 חודשים", "6-12 חודשים", "1-3 שנים", "3-6 שנים"]) }),
    describe: (rng, type, brand) =>
      `${type} ${brand}. ${rng.pick([
        "שימש ילד אחד בלבד, נשמר מצוין.",
        "נוקה ועבר חיטוי, מוכן לשימוש.",
        "כולל את כל החלקים המקוריים.",
      ])} מתאים מגיל ${rng.int(0, 3)}.`,
  },
  tools: {
    typeKey: "toolType",
    types: ["מקדחה", "מסור", "משחזת", "פטישון", "ארגז כלים", "סולם", "מדחס", "ציוד גינון"],
    brands: ["Bosch", "Makita", "DeWalt", "Hilti", "Einhell", "Black+Decker", "Stanley"],
    priceRange: [90, 4500],
    topic: "tools",
    extra: (rng) => ({ powerSource: rng.pick(["חשמלי", "נטענת", "ידני", "פנאומטי"]) }),
    describe: (rng, type, brand) =>
      `${type} ${brand} ${rng.pick(["מקצועי", "לשימוש ביתי", "בעוצמה גבוהה"])}. ${rng.pick([
        "עובד מצוין, שימש בפרויקט אחד.",
        "כולל מזוודה וסט אביזרים.",
        "נמכר בגלל סגירת עסק.",
      ])}`,
  },
};

function generateSecondHand(rng: Rng, sub: string): GeneratedListing {
  const spec = SECOND_HAND_SPECS[sub] ?? SECOND_HAND_SPECS.furniture!;
  const type = rng.pick(spec.types);
  const brand = rng.pick(spec.brands);
  const condition = rng.pick(CONDITIONS);
  const [lo, hi] = spec.priceRange;
  const price = Math.round(rng.int(lo, hi) / 10) * 10;

  const attrs = clean({
    [spec.typeKey]: type,
    condition,
    brand,
    warranty: rng.bool(0.2),
    delivery: rng.bool(0.35),
    pickupOnly: rng.bool(0.5),
    ...(spec.extra?.(rng, type) ?? {}),
  });

  return {
    title: `${type} ${brand}${condition === "חדש באריזה" ? " — חדש באריזה" : ""}`,
    description: spec.describe(rng, type, brand),
    price,
    attrs,
    imageTopic: spec.topic,
    imageCount: rng.int(2, 6),
  };
}

/* -------------------------------------------------------------------------- */
/* דרושים                                                                      */
/* -------------------------------------------------------------------------- */

const JOB_TITLES: Record<string, string[]> = {
  "jobs-tech": ["מפתח/ת Full Stack", "מהנדס/ת QA", "מפתח/ת Frontend", "DevOps Engineer", "אנליסט/ית נתונים", "מנהל/ת מוצר", "מעצב/ת UX/UI"],
  "jobs-sales": ["נציג/ת מכירות", "מנהל/ת תיקי לקוחות", "מנהל/ת שיווק דיגיטלי", "איש/אשת מכירות שטח", "רכז/ת לידים"],
  "jobs-hospitality": ["טבח/ית", "מלצר/ית", "ברמן/ית", "מנהל/ת משמרת", "עוזר/ת טבח", "בריסטה"],
  "jobs-education": ["מורה למתמטיקה", "גננת", "סייע/ת בגן", "מדריך/ה בצהרון", "מורה לאנגלית", "רכז/ת חינוכי/ת"],
  "jobs-health": ["אח/ות מוסמך/ת", "מטפל/ת סיעודי/ת", "פיזיותרפיסט/ית", "מזכיר/ה רפואית", "סייע/ת רפואית"],
  "jobs-logistics": ["נהג/ת חלוקה", "מלגזן/ית", "מלקט/ת במחסן", "רכז/ת שילוח", "נהג/ת משאית"],
  "jobs-construction": ["מנהל/ת עבודה", "חשמלאי/ת מוסמך/ת", "רתך/ת", "טפסן/ית", "מנוף אי/ת"],
  "jobs-admin": ["מזכיר/ה", "עוזר/ת אישי/ת", "מנהל/ת חשבונות", "נציג/ת שירות לקוחות", "רכז/ת משאבי אנוש"],
};

const COMPANIES = [
  "אורבן טק בע\"מ",
  "קבוצת שחר",
  "מרכז הצפון",
  "רשת ביתא",
  "סיגמא שירותים",
  "אלמוג לוגיסטיקה",
  "קליק דיגיטל",
  "בית ההשקעות נווה",
  "רשת המסעדות ״לחם וים״",
];

/**
 * נושא התמונה לפי משפחת המשרה.
 *
 * כל המשרות קיבלו "office", ולכן מודעת "עוזר/ת טבח" הופיעה עם תמונת
 * חלל משרדים. התמונה היא הדבר הראשון שנקרא בכרטיס, וכשהיא סותרת את
 * הכותרת היא מלמדת שאי אפשר לסמוך על מה שמוצג.
 */
const JOB_IMAGE_TOPIC: Record<string, string> = {
  "jobs-hospitality": "kitchen",
  "jobs-construction": "site",
  "jobs-health": "clinic",
  "jobs-logistics": "warehouse",
  "jobs-education": "classroom",
  "jobs-tech": "office",
  "jobs-sales": "office",
  "jobs-admin": "office",
};

function generateJob(rng: Rng, sub: string, city: string): GeneratedListing {
  const title = rng.pick(JOB_TITLES[sub] ?? JOB_TITLES["jobs-admin"]!);
  const scope = rng.pick(["משרה מלאה", "משרה מלאה", "משרה חלקית", "משמרות", "פרילנס"]);
  const period = rng.bool(0.65) ? "לחודש" : "לשעה";
  const price = period === "לחודש" ? rng.int(7000, 32_000) : rng.int(38, 130);
  const company = rng.pick(COMPANIES);

  const attrs = clean({
    scope,
    employment: rng.pick(["שכיר", "שכיר", "שכיר", "קבלן / חשבונית", "סטודנט"]),
    experience: rng.pick(["ללא ניסיון", "עד שנה", "1-3 שנים", "3-5 שנים", "5+ שנים"]),
    remote: sub === "jobs-tech" ? rng.bool(0.7) : rng.bool(0.15),
    salaryPeriod: period,
    companyName: company,
  });

  return {
    title: `${title} — ${city}`,
    description: [
      `${company} מגייסת ${title} ל${scope} ב${city}.`,
      `דרישות: ${attrs.experience} ניסיון בתחום, יחסי אנוש מצוינים ויכולת עבודה בצוות.`,
      attrs.remote ? "קיימת אפשרות לעבודה היברידית מהבית." : "העבודה מתבצעת במשרדי החברה.",
      `שכר ${period === "לחודש" ? `${price.toLocaleString("he-IL")} ₪ לחודש` : `${price} ₪ לשעה`}, בהתאם לניסיון.`,
      "קורות חיים ניתן לשלוח דרך המערכת. פנייה זו מיועדת לנשים וגברים כאחד.",
    ].join(" "),
    price,
    attrs,
    imageTopic: JOB_IMAGE_TOPIC[sub] ?? "office",
    imageCount: rng.int(1, 3),
  };
}

/* -------------------------------------------------------------------------- */
/* בעלי חיים                                                                   */
/* -------------------------------------------------------------------------- */

const BREEDS: Record<string, string[]> = {
  dogs: ["לברדור", "גולדן רטריבר", "פינצ'ר", "האסקי", "שיצו", "בורדר קולי", "רועה גרמני", "מעורב"],
  cats: ["חתול בית", "פרסי", "סיאמי", "בנגלי", "מיין קון", "מעורב"],
  birds: ["תוכי קוואקר", "קנרית", "אפריקאי אפור", "לאבברד", "קוקטייל"],
  fish: ["גופי", "דיסקוס", "בטה", "מולי", "נאון"],
  rodents: ["אוגר סורי", "שרקן", "ארנב ננסי", "צ'ינצ'ילה", "שפן גינאה"],
};

function generatePet(rng: Rng, sub: string): GeneratedListing {
  if (sub === "pet-supplies") {
    const item = rng.pick(["כלוב", "אקווריום", "מלונה", "רתמה", "ארגז חול", "עמוד גירוד", "מנשא"]);
    return {
      title: `${item} לבעלי חיים — במצב טוב`,
      description: `${item} במצב טוב, שימש תקופה קצרה. נקי ומחוטא, מוכן לשימוש מיידי. איסוף עצמי.`,
      price: rng.int(40, 900),
      attrs: clean({ condition: rng.pick(CONDITIONS) }),
      imageTopic: "pet",
      imageCount: rng.int(2, 4),
    };
  }

  const breed = rng.pick(BREEDS[sub] ?? BREEDS.dogs!);
  const adoption = rng.bool(0.45);
  const attrs = clean({
    breed,
    petAge: rng.pick(["גור / צעיר", "עד שנה", "1-3 שנים", "3-7 שנים"]),
    petGender: rng.pick(["זכר", "נקבה"]),
    vaccinated: rng.bool(0.85),
    neutered: rng.bool(0.5),
    chipped: rng.bool(0.7),
    adoption,
  });

  return {
    title: adoption ? `${breed} למסירה באהבה` : `${breed} — ${attrs.petAge}`,
    description: [
      `${breed}, ${attrs.petGender === "זכר" ? "זכר" : "נקבה"}, ${attrs.petAge}.`,
      attrs.vaccinated ? "מחוסן ומטופל וטרינרית." : "",
      attrs.chipped ? "מושבב ורשום." : "",
      adoption
        ? "המסירה ללא תשלום לבית אוהב ואחראי בלבד. תנאי מסירה: ביקור בית ומחויבות לטיפול."
        : "נמסר עם כל הציוד הנלווה.",
      "מוזמנים ליצור קשר לפרטים נוספים ולתיאום פגישה.",
    ]
      .filter(Boolean)
      .join(" "),
    price: adoption ? 0 : rng.int(300, 4500),
    attrs,
    imageTopic: "pet",
    imageCount: rng.int(2, 5),
  };
}

/* -------------------------------------------------------------------------- */
/* עסקים ושירותים                                                              */
/* -------------------------------------------------------------------------- */

/**
 * מחזור חודשי סביר לפי ענף.
 *
 * מחזור אחיד לכל הענפים ייצר "קיוסק פעיל למכירה ₪2,130,000" — המחיר
 * נגזר מהרווח, והרווח מהמחזור, ולכן קיוסק עם מחזור של רשת מסעדות קיבל
 * מחיר של רשת מסעדות. סדר הגודל הוא מאפיין של הענף ולא רעש.
 */
const BUSINESS_SCALE: Record<string, [number, number]> = {
  "קיוסק": [25_000, 70_000],
  "מספרה וטיפוח": [25_000, 90_000],
  "אונליין ואיקומרס": [30_000, 260_000],
  "קמעונאות": [50_000, 220_000],
  "חדר כושר": [50_000, 200_000],
  "מוסך": [60_000, 280_000],
  "מכולת / סופר": [80_000, 380_000],
  "מסעדנות ובתי קפה": [90_000, 420_000],
};

/** אילו ענפים שייכים לכל תת-קטגוריה. */
/** נושא התמונה לפי סוג העסק. */
const BUSINESS_IMAGE_TOPIC: Record<string, string> = {
  "business-food": "kitchen",
  "business-retail": "shop",
  "business-services": "shop",
  "business-online": "electronics",
  "business-franchise": "shop",
};

const BUSINESS_FIELDS: Record<string, string[]> = {
  "business-food": ["מסעדנות ובתי קפה", "קיוסק"],
  "business-retail": ["קמעונאות", "מכולת / סופר", "קיוסק"],
  "business-services": ["מספרה וטיפוח", "מוסך", "חדר כושר"],
  "business-online": ["אונליין ואיקומרס"],
  "business-franchise": ["מסעדנות ובתי קפה", "קמעונאות", "חדר כושר"],
};

function generateBusiness(rng: Rng, sub: string, city: string): GeneratedListing {
  const field = rng.pick(BUSINESS_FIELDS[sub] ?? Object.keys(BUSINESS_SCALE));
  const [revLow, revHigh] = BUSINESS_SCALE[field] ?? [40_000, 250_000];
  const revenue = rng.int(revLow, revHigh);
  const profit = Math.round(revenue * rng.float(0.12, 0.32));
  const price = Math.round((profit * rng.int(14, 30)) / 5000) * 5000;

  const attrs = clean({
    businessField: field,
    monthlyRevenue: revenue,
    monthlyProfit: profit,
    yearsActive: rng.int(1, 22),
    employees: rng.int(0, 18),
    monthlyRent: rng.int(3000, 40_000),
    reasonForSale: rng.pick(["מעבר לחו\"ל", "פרישה", "התמקדות בעסק נוסף", "סיבות אישיות"]),
  });

  return {
    title: `${field} פעיל למכירה ב${city}`,
    description: [
      `עסק בתחום ${field} הפועל ${attrs.yearsActive} שנים ב${city}.`,
      `מחזור חודשי ממוצע ${revenue.toLocaleString("he-IL")} ₪, רווח תפעולי כ-${profit.toLocaleString("he-IL")} ₪.`,
      `${attrs.employees} עובדים, שכירות חודשית ${(attrs.monthlyRent as number).toLocaleString("he-IL")} ₪.`,
      `לקוחות קבועים, ספקים מסודרים והכנסה יציבה. סיבת המכירה: ${attrs.reasonForSale}.`,
      "נמסרים ספרים מלאים לרוכש רציני לאחר חתימת הסכם סודיות.",
    ].join(" "),
    price,
    attrs,
    imageTopic: BUSINESS_IMAGE_TOPIC[sub] ?? "shop",
    imageCount: rng.int(3, 6),
  };
}

const SERVICE_TITLES: Record<string, string[]> = {
  renovations: ["שיפוצים כלליים ובנייה קלה", "איטום גגות ומרפסות", "ריצוף וחיפוי", "גבס ותקרות אקוסטיות"],
  "electrician-plumber": ["חשמלאי מוסמך 24/7", "אינסטלטור — פתיחת סתימות", "התקנת דודים ומערכות מים", "בדק בית חשמל"],
  cleaning: ["ניקיון דירות ומשרדים", "פוליש וניקוי יסודי", "ניקיון לאחר שיפוץ", "ניקוי ספות ושטיחים"],
  moving: ["הובלות דירות ומשרדים", "הובלה קטנה עם מנוף", "פינוי תכולת דירה", "אחסנה והובלה"],
  computers: ["טכנאי מחשבים עד הבית", "שחזור מידע וגיבויים", "התקנת רשתות ומצלמות", "בניית אתרים לעסקים"],
  events: ["דיג'יי לאירועים", "צלם אירועים", "עיצוב אירועים ובלונים", "הגברה ותאורה"],
  tutoring: ["שיעורים פרטיים במתמטיקה", "אנגלית לבגרות", "פיזיקה ומכניקה", "הכנה לפסיכומטרי"],
  beauty: ["מספרה עד הבית", "מניקור ופדיקור", "איפור מקצועי", "טיפולי פנים"],
};

function generateService(rng: Rng, sub: string, region: string): GeneratedListing {
  const title = rng.pick(SERVICE_TITLES[sub] ?? SERVICE_TITLES.renovations!);
  const years = rng.int(2, 28);
  const basis = rng.pick(["לשעה", "לפרויקט", 'למ"ר', "לפי הצעת מחיר"]);
  const price =
    basis === "לשעה" ? rng.int(120, 450) : basis === 'למ"ר' ? rng.int(40, 350) : rng.int(500, 25_000);

  const attrs = clean({
    serviceArea: rng.bool(0.3) ? ["כל הארץ"] : rng.picks([region, "מרכז", "שרון", "שפלה"], rng.int(1, 3)),
    yearsExperience: years,
    licensed: rng.bool(0.75),
    insured: rng.bool(0.6),
    emergency: rng.bool(0.4),
    invoice: rng.bool(0.8),
    priceBasis: basis,
  });

  return {
    title: `${title} — ${years} שנות ניסיון`,
    description: [
      `${title}. ${years} שנות ניסיון בתחום, אלפי לקוחות מרוצים.`,
      attrs.licensed ? "בעל רישיון ותעודות מקצועיות." : "",
      attrs.insured ? "עבודה מבוטחת ואחריות מלאה." : "",
      attrs.emergency ? "זמין גם לקריאות חירום בערבים ובסופי שבוע." : "",
      attrs.invoice ? "מוציא חשבונית מס כחוק." : "",
      "הצעת מחיר ללא התחייבות — מוזמנים להתקשר.",
    ]
      .filter(Boolean)
      .join(" "),
    price,
    attrs,
    imageTopic: "work",
    imageCount: rng.int(2, 5),
  };
}

/* -------------------------------------------------------------------------- */

/** נקודת כניסה — בוחרת מחולל לפי הקטגוריה. */
export function generateListing(
  rng: Rng,
  rootSlug: string,
  subSlug: string,
  city: string,
  region: string,
): GeneratedListing {
  switch (rootSlug) {
    case "vehicles":
      return ["motorcycles", "scooters", "off-road"].includes(subSlug)
        ? generateMotorcycle(rng, subSlug)
        : generateCar(rng, subSlug);
    case "realestate":
      return generateRealEstate(rng, subSlug, city);
    case "second-hand":
      return generateSecondHand(rng, subSlug);
    case "jobs":
      return generateJob(rng, subSlug, city);
    case "pets":
      return generatePet(rng, subSlug);
    case "businesses":
      return generateBusiness(rng, subSlug, city);
    case "services":
      return generateService(rng, subSlug, region);
    default:
      return generateSecondHand(rng, "furniture");
  }
}

/**
 * מאגרי שמות, מקובצים לפי מוצא.
 *
 * שם פרטי ושם משפחה נבחרים תמיד מאותו מאגר. הגרסה הקודמת בחרה כל אחד
 * מרשימה שטוחה נפרדת ויצרה צירופים כמו "מוחמד פרידמן" — צירוף שלא
 * קיים בפועל וקורא כתקלה.
 *
 * החלוקה משקפת את הרכב החברה הישראלית ומיועדת לייצוג, לא לסיווג:
 * היא חיה בגנרטור נתוני הדמו בלבד ואין לה שום ביטוי בסכמה או במוצר.
 */
const NAME_POOLS = [
  {
    weight: 62,
    first: ["יעל", "נועם", "איתי", "שירה", "מיכל", "דניאל", "רותם", "עומר", "טל",
            "ליאור", "הדר", "אורי", "מאיה", "גיא", "יונתן", "אלון", "עדי", "רון",
            "אסף", "תומר", "אמיר", "דנה", "נדב", "מור", "יוסי", "רבקה", "אבי"],
    last: ["כהן", "לוי", "מזרחי", "פרץ", "ביטון", "דהן", "אברהם", "פרידמן",
           "שפירא", "אזולאי", "חדד", "גבאי", "מלכה", "אוחיון", "ברוך",
           "רוזנברג", "שמש", "נחום", "בן דוד"],
  },
  {
    weight: 21,
    first: ["מוחמד", "פאטמה", "אחמד", "ליילא", "עומר", "נור", "יוסוף", "מרים",
            "כרים", "סלמא", "האני", "רים"],
    last: ["חטיב", "מנסור", "זועבי", "עבד אלקאדר", "חאג'", "סלאמה", "נאסר",
           "דרויש", "עוואד", "טאהא"],
  },
  {
    weight: 17,
    first: ["סרגיי", "אנה", "דמיטרי", "אולגה", "איגור", "סבטלנה", "אלכס", "נטליה"],
    last: ["פטרוב", "קוזנצוב", "סוקולוב", "וולקוב", "נוביקוב", "מורוזוב",
           "לבדב", "אורלוב"],
  },
] as const;

/** שם מלא עקבי — שם פרטי ושם משפחה מאותו מאגר. */
export function pickFullName(rng: Rng): { first: string; last: string } {
  const total = NAME_POOLS.reduce((sum, p) => sum + p.weight, 0);
  let roll = rng.int(1, total);
  const pool = NAME_POOLS.find((p) => (roll -= p.weight) <= 0) ?? NAME_POOLS[0];
  return { first: rng.pick([...pool.first]), last: rng.pick([...pool.last]) };
}

export const HEBREW_FIRST_NAMES = NAME_POOLS.flatMap((p) => [...p.first]);
export const HEBREW_LAST_NAMES = NAME_POOLS.flatMap((p) => [...p.last]);
