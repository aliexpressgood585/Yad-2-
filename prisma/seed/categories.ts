/**
 * עץ הקטגוריות והשדות הדינמיים.
 * שדה שמוגדר בקטגוריית-אב חל אוטומטית על כל הצאצאים שלה
 * (ראה `getAttributesForCategory`), ולכן מגדירים כאן רק את ההבדלים.
 */

export type AttrOption = { value: string; label: string; parent?: string };

export type AttrDef = {
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "SELECT" | "MULTISELECT" | "BOOLEAN";
  unit?: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  filter?: boolean;
  /** מוצג כשורת מפרט בולטת בכרטיס המודעה ובראש דף המודעה */
  highlight?: boolean;
  min?: number;
  max?: number;
  step?: number;
  dependsOn?: string;
  options?: (string | AttrOption)[];
};

export type CatDef = {
  slug: string;
  name: string;
  namePlural?: string;
  icon: string;
  description?: string;
  priceLabel?: string;
  attributes?: AttrDef[];
  children?: CatDef[];
};

/* -------------------------------------------------------------------------- */
/* רכב                                                                         */
/* -------------------------------------------------------------------------- */

const CAR_MODELS: Record<string, string[]> = {
  "טויוטה": ["קורולה", "יאריס", "RAV4", "אוריס", "C-HR", "היילקס", "קאמרי", "לנד קרוזר"],
  "מאזדה": ["3", "6", "CX-3", "CX-5", "CX-30", "2"],
  "יונדאי": ["i10", "i20", "i25", "i30", "טוסון", "סנטה פה", "איוניק", "קונה"],
  "קיה": ["פיקנטו", "ריו", "סיד", "ספורטג'", "נירו", "סורנטו", "סטוניק"],
  "סקודה": ["אוקטביה", "פאביה", "סופרב", "קודיאק", "קארוק", "סקאלה"],
  "פולקסווגן": ["גולף", "פולו", "פאסאט", "טיגואן", "T-Roc", "ג'טה"],
  "מיצובישי": ["אאוטלנדר", "ASX", "ספייס סטאר", "אקליפס קרוס", "L200"],
  "ניסאן": ["קשקאי", "מיקרה", "ג'וק", "X-Trail", "ליף"],
  "הונדה": ["סיוויק", "ג'אז", "CR-V", "HR-V"],
  "סובארו": ["אימפרזה", "XV", "פורסטר", "אאוטבק", "B4"],
  "שברולט": ["ספארק", "קרוז", "טראקס", "מאליבו"],
  "פורד": ["פוקוס", "פיאסטה", "קוגה", "אקספלורר", "טרנזיט"],
  "רנו": ["קליאו", "מגאן", "קפצ'ור", "סניק", "קנגו"],
  "פיג'ו": ["208", "308", "2008", "3008", "5008", "פרטנר"],
  "סיטרואן": ["C3", "C4", "C5 אירקרוס", "ברלינגו"],
  "BMW": ["סדרה 1", "סדרה 3", "סדרה 5", "X1", "X3", "X5"],
  "מרצדס-בנץ": ["A-Class", "C-Class", "E-Class", "GLA", "GLC", "ספרינטר"],
  "אאודי": ["A1", "A3", "A4", "Q2", "Q3", "Q5"],
  "טסלה": ["Model 3", "Model Y", "Model S"],
  "סוזוקי": ["סוויפט", "ויטרה", "S-Cross", "בלנו"],
  "אופל": ["קורסה", "אסטרה", "מוקה", "קרוסלנד"],
  "אלפא רומיאו": ["ג'ולייטה", "סטלביו", "ג'וליה"],
  "סיאט": ["איביזה", "לאון", "אטקה", "ארונה"],
  "MG": ["ZS", "HS", "5", "4"],
  "BYD": ["אטו 3", "דולפין", "סיל"],
  "צ'רי": ["טיגו 4", "טיגו 8", "אריזו 5"],
};

/**
 * דגמי רכב מסחרי.
 *
 * רשימה נפרדת ולא ירושה מ-CAR_MODELS: כשהיצרן והדגם ישבו על קטגוריית
 * האב, כל תת-קטגוריה ירשה את רשימת הרכבים הפרטיים — ונוצרו מודעות כמו
 * "MG 4 עם משקל מטען 1,500 ק\"ג וסוג מרכב מקרר", כלומר האצ'בק חשמלי
 * שהוגדר כמשאית קירור.
 */
const COMMERCIAL_MODELS: Record<string, string[]> = {
  "פורד": ["טרנזיט", "טרנזיט קונקט", "ריינג'ר"],
  "מרצדס-בנץ": ["ספרינטר", "ויטו", "סיטאן"],
  "פולקסווגן": ["קראפטר", "טרנספורטר", "קאדי"],
  "פיג'ו": ["פרטנר", "בוקסר", "אקספרט"],
  "סיטרואן": ["ברלינגו", "ג'אמפר", "ג'אמפי"],
  "רנו": ["קנגו", "מאסטר", "טראפיק"],
  "טויוטה": ["היאס", "היילקס"],
  "יונדאי": ["H1", "פורטר"],
  "איווקו": ["דיילי"],
  "איסוזו": ["D-Max", "NPR"],
};

/**
 * דו-גלגלי.
 *
 * לא מחובר כרגע לעץ הקטגוריות: הגנרטור של אופנועים וקטנועים בונה כותרת
 * מהיצרן ומנפח המנוע ("סוזוקי 750cc 2014") ואינו כותב שדה `manufacturer`.
 * חיבור הרשימה כשדה חובה היה יוצר מודעות בלי ערך בשדה חובה. נשמר כאן
 * כדי שהחיבור יהיה שינוי אחד כשהגנרטור יעודכן.
 */
const MOTORCYCLE_MODELS: Record<string, string[]> = {
  "ימאהה": ["MT-07", "MT-09", "טנרה 700", "R1", "טרייסר"],
  "הונדה": ["CB500", "CBR650", "אפריקה טווין", "פאן אירופה"],
  "קוואסאקי": ["Z650", "נינג'ה 400", "ורסיס 650"],
  "סוזוקי": ["GSX-R750", "V-Strom 650", "בורגמן"],
  "BMW": ["R1250GS", "F850GS", "S1000RR"],
  "KTM": ["דיוק 390", "אדוונצ'ר 790", "SMC 690"],
  "הרלי דיווידסון": ["ספורטסטר", "פאט בוב", "רוד קינג"],
  "פיאג'ו": ["ליברטי", "בוורלי", "MP3"],
  "SYM": ["ג'ט 14", "סימפלי", "קרוקס"],
  "קימקו": ["אג'יליטי", "פיפל", "דאונטאון"],
};

function modelOptionsFor(models: Record<string, string[]>): AttrOption[] {
  return Object.entries(models).flatMap(([make, list]) =>
    list.map((m) => ({ value: `${make}-${m}`, label: m, parent: make })),
  );
}

/** יצרן + דגם עבור רשימת דגמים נתונה. מוגדר בכל עלה בנפרד. */
function makeAndModelAttrs(models: Record<string, string[]>): AttrDef[] {
  return [
    {
      key: "manufacturer",
      label: "יצרן",
      type: "SELECT",
      required: true,
      highlight: true,
      options: Object.keys(models),
    },
    {
      key: "model",
      label: "דגם",
      type: "SELECT",
      required: true,
      highlight: true,
      dependsOn: "manufacturer",
      options: modelOptionsFor(models),
    },
  ];
}

// יצרן ודגם אינם ב-VEHICLE_ATTRS המשותף — ראה COMMERCIAL_MODELS.
const VEHICLE_ATTRS: AttrDef[] = [
  {
    key: "year",
    label: "שנת ייצור",
    type: "NUMBER",
    required: true,
    highlight: true,
    min: 1980,
    max: new Date().getFullYear() + 1,
    step: 1,
    placeholder: "לדוגמה 2019",
  },
  {
    key: "hand",
    label: "יד",
    type: "SELECT",
    required: true,
    highlight: true,
    options: [
      { value: "0", label: "חדש מהיבואן" },
      { value: "1", label: "יד ראשונה" },
      { value: "2", label: "יד שנייה" },
      { value: "3", label: "יד שלישית" },
      { value: "4", label: "יד רביעית" },
      { value: "5", label: "יד חמישית ומעלה" },
    ],
  },
  {
    key: "km",
    label: "קילומטראז'",
    type: "NUMBER",
    unit: "ק\"מ",
    required: true,
    highlight: true,
    min: 0,
    max: 900_000,
    step: 1000,
  },
  {
    key: "gearbox",
    label: "תיבת הילוכים",
    type: "SELECT",
    required: true,
    highlight: true,
    options: ["אוטומטית", "ידנית", "רובוטית", "טיפטרוניק", "רדוקציה"],
  },
  {
    key: "fuel",
    label: "סוג מנוע",
    type: "SELECT",
    required: true,
    options: ["בנזין", "דיזל", "היברידי", "חשמלי", "היברידי נטען", "גז"],
  },
  {
    key: "engine",
    label: "נפח מנוע",
    type: "NUMBER",
    unit: 'סמ"ק',
    min: 50,
    max: 8000,
    step: 100,
  },
  {
    key: "color",
    label: "צבע",
    type: "SELECT",
    options: [
      "לבן",
      "שחור",
      "כסף",
      "אפור",
      "כחול",
      "אדום",
      "ירוק",
      "בז'",
      "חום",
      "צהוב",
      "כתום",
    ],
  },
  {
    key: "ownership",
    label: "בעלות נוכחית",
    type: "SELECT",
    options: ["פרטית", "חברה", "ליסינג", "השכרה", "מונית", "לימוד נהיגה", "ממשלתי"],
  },
  { key: "testUntil", label: "טסט עד", type: "TEXT", filter: false, placeholder: "MM/YYYY" },
  {
    key: "extras",
    label: "אבזור",
    type: "MULTISELECT",
    options: [
      "חיישני רוורס",
      "מצלמת רוורס",
      "בקרת שיוט",
      "חלונות חשמל",
      "מולטימדיה",
      "גג נפתח",
      "ריפוד עור",
      "מערכת בטיחות מתקדמת",
      "חימום מושבים",
      "גלגלי סגסוגת",
    ],
  },
];

const VEHICLES: CatDef = {
  slug: "vehicles",
  name: "רכב",
  namePlural: "רכבים",
  icon: "Car",
  description: "רכבים פרטיים, מסחריים, ג'יפים ודו-גלגלי מכל הארץ",
  attributes: VEHICLE_ATTRS,
  children: [
    {
      slug: "private-cars",
      name: "רכב פרטי",
      namePlural: "רכבים פרטיים",
      icon: "Car",
      attributes: makeAndModelAttrs(CAR_MODELS),
      description: "רכבים פרטיים יד שנייה וחדשים",
    },
    {
      slug: "commercial-vehicles",
      name: "רכב מסחרי",
      namePlural: "רכבים מסחריים",
      icon: "Truck",
      attributes: [
        ...makeAndModelAttrs(COMMERCIAL_MODELS),
        {
          key: "payload",
          label: "משקל מטען מותר",
          type: "NUMBER",
          unit: "ק\"ג",
          min: 100,
          max: 20_000,
          step: 50,
        },
        {
          key: "bodyType",
          label: "סוג מרכב",
          type: "SELECT",
          options: ["סגור", "פתוח", "מקרר", "טנדר", "מיניבוס", "הרמה"],
        },
      ],
    },
    {
      slug: "suvs",
      name: "ג'יפים וקרוסאוברים",
      icon: "Car",
      attributes: [
        ...makeAndModelAttrs(CAR_MODELS),
        {
          key: "drive",
          label: "הנעה",
          type: "SELECT",
          highlight: true,
          options: ["4x4", "4x2 קדמית", "4x2 אחורית", "AWD"],
        },
      ],
    },
    {
      slug: "motorcycles",
      name: "אופנועים",
      icon: "Bike",
      attributes: [
        {
          key: "licenseType",
          label: "סוג רישיון",
          type: "SELECT",
          highlight: true,
          options: ["A1 (עד 125)", "A2 (עד 35 כ\"ס)", "A (ללא הגבלה)"],
        },
        {
          key: "bikeType",
          label: "סוג אופנוע",
          type: "SELECT",
          options: ["ספורט", "טוארינג", "נייקד", "אנדורו", "צ'ופר", "סופרמוטו"],
        },
      ],
    },
    {
      slug: "scooters",
      name: "קטנועים",
      icon: "Bike",
      attributes: [
        {
          key: "scooterType",
          label: "סוג",
          type: "SELECT",
          options: ["קטנוע עירוני", "מקסי סקוטר", "תלת אופן", "חשמלי"],
        },
      ],
    },
    {
      slug: "off-road",
      name: "רכבי שטח",
      icon: "Truck",
      attributes: [
        ...makeAndModelAttrs(CAR_MODELS),
        {
          key: "offroadType",
          label: "סוג כלי",
          type: "SELECT",
          options: ["טרקטורון", "רייזר", "באגי", "רכב שטח ייעודי"],
        },
      ],
    },
    {
      slug: "trade-in",
      name: "טרייד-אין",
      icon: "Car",
      description: "רכבים המוצעים להחלפה מול רכב אחר",
      attributes: [
        ...makeAndModelAttrs(CAR_MODELS),
        {
          key: "wantedInReturn",
          label: "מעוניין לקבל בתמורה",
          type: "TEXT",
          filter: false,
          placeholder: "לדוגמה: רכב משפחתי אוטומטי משנת 2018 ומעלה",
        },
      ],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* נדל"ן                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * סוג הנכס מוגדר בכל תת-קטגוריה בנפרד ולא ב-REALESTATE_ATTRS המשותף.
 *
 * כשהוא ישב על ההורה, כל תת-קטגוריה ירשה את אותה רשימה — ומודעת שותפים
 * קיבלה "בית פרטי" או "משק חקלאי", ערכים ששייכים למכירה בלבד. הפרדה
 * לפי עלה גם מונעת כפילות מול commercialType ומול zoning, שכבר מתארים
 * את סוג הנכס בקטגוריות שלהם.
 */
function propertyTypeAttr(options: string[]): AttrDef {
  return {
    key: "propertyType",
    label: "סוג הנכס",
    type: "SELECT",
    required: true,
    highlight: true,
    options,
  };
}

const RESIDENTIAL_SALE_TYPES = [
  "דירה",
  "דירת גן",
  "פנטהאוז",
  "דופלקס",
  "בית פרטי",
  "דו משפחתי",
  "קוטג'",
  "יחידת דיור",
  "משק חקלאי",
];

const RESIDENTIAL_RENT_TYPES = [
  "דירה",
  "דירת גן",
  "פנטהאוז",
  "דופלקס",
  "בית פרטי",
  "קוטג'",
  "יחידת דיור",
  // "מרתף" הוסר: הוא אינו סוג נכס שמפרסמים תחתיו דירה, ומודעת
  // "מרתף 2.5 חדרים להשכרה" נקראה כמו תקלה בגנרטור — כי היא הייתה.
];

/** בשותפים משכירים חדר בתוך דירה — לא בית פרטי ולא משק חקלאי. */
const ROOMMATE_TYPES = ["דירה", "דירת גן", "פנטהאוז", "דופלקס", "יחידת דיור"];

const VACATION_TYPES = ["דירה", "וילה", "בקתה", "צימר", "בית פרטי", "לופט"];

const REALESTATE_ATTRS: AttrDef[] = [
  {
    key: "rooms",
    label: "חדרים",
    type: "NUMBER",
    required: true,
    highlight: true,
    unit: "חד'",
    min: 1,
    max: 15,
    step: 0.5,
  },
  {
    key: "size",
    label: "גודל",
    type: "NUMBER",
    required: true,
    highlight: true,
    unit: 'מ"ר',
    min: 10,
    max: 2000,
    step: 5,
  },
  { key: "floor", label: "קומה", type: "NUMBER", highlight: true, min: -1, max: 60, step: 1 },
  { key: "totalFloors", label: "מתוך קומות", type: "NUMBER", min: 1, max: 60, step: 1 },
  { key: "balconySize", label: 'מרפסת (מ"ר)', type: "NUMBER", min: 0, max: 200, step: 1 },
  { key: "elevator", label: "מעלית", type: "BOOLEAN", highlight: true },
  { key: "parking", label: "חניה", type: "BOOLEAN", highlight: true },
  { key: "balcony", label: "מרפסת", type: "BOOLEAN" },
  { key: "safeRoom", label: 'ממ"ד', type: "BOOLEAN" },
  { key: "storage", label: "מחסן", type: "BOOLEAN" },
  { key: "airConditioning", label: "מיזוג אוויר", type: "BOOLEAN" },
  { key: "bars", label: "סורגים", type: "BOOLEAN" },
  { key: "accessible", label: "גישה לנכים", type: "BOOLEAN" },
  { key: "renovated", label: "משופצת", type: "BOOLEAN" },
  { key: "furnished", label: "מרוהטת", type: "BOOLEAN" },
  {
    key: "condition",
    label: "מצב הנכס",
    type: "SELECT",
    options: ["חדש מקבלן", "חדש (לא גרו בו)", "משופץ", "במצב טוב", "דרוש שיפוץ"],
  },
  { key: "entryDate", label: "תאריך כניסה", type: "TEXT", filter: false, placeholder: "מיידי / 01.09" },
];

const REALESTATE: CatDef = {
  slug: "realestate",
  name: 'נדל"ן',
  namePlural: "נכסים",
  icon: "Home",
  description: "דירות למכירה ולהשכרה, שותפים, נכסים מסחריים ומגרשים",
  attributes: REALESTATE_ATTRS,
  children: [
    {
      slug: "apartments-sale",
      name: "דירות למכירה",
      icon: "Building2",
      attributes: [propertyTypeAttr(RESIDENTIAL_SALE_TYPES)],
    },
    {
      slug: "apartments-rent",
      name: "דירות להשכרה",
      icon: "Key",
      priceLabel: "שכר דירה חודשי",
      attributes: [
        propertyTypeAttr(RESIDENTIAL_RENT_TYPES),
        { key: "houseCommittee", label: "ועד בית לחודש", type: "NUMBER", unit: "₪", min: 0, max: 3000, step: 10 },
        { key: "propertyTax", label: "ארנונה לחודשיים", type: "NUMBER", unit: "₪", min: 0, max: 10_000, step: 50 },
        { key: "petsAllowed", label: "מותר בעלי חיים", type: "BOOLEAN" },
        { key: "minLease", label: "תקופת שכירות מינימלית", type: "SELECT", options: ["6 חודשים", "שנה", "שנתיים", "גמיש"] },
      ],
    },
    {
      slug: "roommates",
      name: "שותפים",
      icon: "Users",
      priceLabel: "מחיר לשותף",
      attributes: [
        propertyTypeAttr(ROOMMATE_TYPES),
        { key: "currentRoommates", label: "שותפים בדירה", type: "NUMBER", min: 0, max: 10, step: 1, highlight: true },
        { key: "roommateGender", label: "מין השותף המבוקש", type: "SELECT", highlight: true, options: ["גברים", "נשים", "מעורב", "לא משנה"] },
        { key: "privateBathroom", label: "שירותים צמודים", type: "BOOLEAN" },
      ],
    },
    {
      slug: "commercial",
      name: "נדל\"ן מסחרי",
      icon: "Store",
      attributes: [
        {
          key: "commercialType",
          label: "סוג הנכס",
          type: "SELECT",
          required: true,
          highlight: true,
          options: ["משרד", "חנות", "מחסן", "מבנה תעשייה", "קליניקה", "אולם", "מסעדה", "סטודיו"],
        },
        { key: "dealType", label: "סוג עסקה", type: "SELECT", highlight: true, options: ["למכירה", "להשכרה"] },
      ],
    },
    {
      slug: "lots",
      name: "מגרשים",
      icon: "MapPin",
      attributes: [
        { key: "zoning", label: "ייעוד", type: "SELECT", highlight: true, options: ["מגורים", "חקלאי", "מסחרי", "תעשייה", "ללא ייעוד"] },
        { key: "buildRights", label: "זכויות בנייה", type: "NUMBER", unit: 'מ"ר', min: 0, max: 20_000, step: 10 },
      ],
    },
    {
      slug: "vacation",
      name: "נופש ונופשונים",
      icon: "Palmtree",
      priceLabel: "מחיר ללילה",
      attributes: [
        propertyTypeAttr(VACATION_TYPES),
        { key: "sleeps", label: "מספר אורחים", type: "NUMBER", highlight: true, min: 1, max: 30, step: 1 },
        { key: "pool", label: "בריכה", type: "BOOLEAN", highlight: true },
        { key: "jacuzzi", label: "ג'קוזי", type: "BOOLEAN" },
        { key: "seaView", label: "נוף לים", type: "BOOLEAN" },
      ],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* יד שנייה                                                                    */
/* -------------------------------------------------------------------------- */

const CONDITION: AttrDef = {
  key: "condition",
  label: "מצב הפריט",
  type: "SELECT",
  required: true,
  highlight: true,
  options: ["חדש באריזה", "כמו חדש", "מצב מצוין", "מצב טוב", "משומש", "לתיקון / חלפים"],
};

const SECOND_HAND: CatDef = {
  slug: "second-hand",
  name: "יד שנייה",
  namePlural: "פריטים יד שנייה",
  icon: "ShoppingBag",
  description: "ריהוט, אלקטרוניקה, אופנה, ספורט ועוד — הכול יד שנייה",
  attributes: [
    CONDITION,
    { key: "brand", label: "מותג", type: "TEXT", placeholder: "לדוגמה: איקאה, סמסונג" },
    { key: "warranty", label: "עם אחריות", type: "BOOLEAN" },
    { key: "delivery", label: "אפשרות משלוח", type: "BOOLEAN" },
    { key: "pickupOnly", label: "איסוף עצמי בלבד", type: "BOOLEAN" },
  ],
  children: [
    {
      slug: "furniture",
      name: "ריהוט",
      icon: "Sofa",
      attributes: [
        {
          key: "furnitureType",
          label: "סוג הריהוט",
          type: "SELECT",
          required: true,
          highlight: true,
          options: ["ספה", "מיטה", "ארון", "שולחן", "כיסא", "שידה", "ספריה", "מזנון", "פינת אוכל", "מזרן", "ריהוט גן"],
        },
        { key: "material", label: "חומר", type: "SELECT", options: ["עץ מלא", "MDF", "מתכת", "זכוכית", "בד", "עור", "ראטן"] },
        { key: "dimensions", label: "מידות", type: "TEXT", filter: false, placeholder: "רוחב × עומק × גובה" },
      ],
    },
    {
      slug: "electronics",
      name: "אלקטרוניקה",
      icon: "Laptop",
      attributes: [
        {
          key: "electronicsType",
          label: "סוג המוצר",
          type: "SELECT",
          required: true,
          highlight: true,
          options: ["סמארטפון", "מחשב נייד", "מחשב נייח", "טאבלט", "טלוויזיה", "קונסולה", "אוזניות", "שעון חכם", "מצלמה", "רמקולים", "צג"],
        },
        { key: "storage", label: "נפח אחסון", type: "SELECT", options: ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB", "2TB"] },
        { key: "screenSize", label: "גודל מסך", type: "NUMBER", unit: '"', min: 4, max: 100, step: 1 },
        { key: "originalBox", label: "עם קופסה מקורית", type: "BOOLEAN" },
      ],
    },
    {
      slug: "appliances",
      name: "מוצרי חשמל",
      icon: "Plug",
      attributes: [
        {
          key: "applianceType",
          label: "סוג המוצר",
          type: "SELECT",
          required: true,
          highlight: true,
          options: ["מקרר", "מכונת כביסה", "מייבש כביסה", "מדיח כלים", "תנור", "מיקרוגל", "מזגן", "שואב אבק", "מייבש שיער", "מכונת קפה"],
        },
        { key: "energyRating", label: "דירוג אנרגטי", type: "SELECT", options: ["A+++", "A++", "A+", "A", "B", "C", "D"] },
      ],
    },
    {
      slug: "fashion",
      name: "אופנה",
      icon: "Shirt",
      attributes: [
        {
          key: "fashionType",
          label: "סוג הפריט",
          type: "SELECT",
          required: true,
          highlight: true,
          options: ["חולצה", "מכנסיים", "שמלה", "מעיל", "נעליים", "תיק", "אביזרים", "תכשיטים", "בגד ים", "חליפה"],
        },
        { key: "gender", label: "מיועד ל", type: "SELECT", highlight: true, options: ["נשים", "גברים", "יוניסקס", "ילדים"] },
        { key: "size", label: "מידה", type: "SELECT", options: ["XS", "S", "M", "L", "XL", "XXL", "36", "38", "40", "42", "44"] },
      ],
    },
    {
      slug: "sports",
      name: "ספורט ופנאי",
      icon: "Dumbbell",
      attributes: [
        {
          key: "sportType",
          label: "תחום",
          type: "SELECT",
          required: true,
          highlight: true,
          options: ["כושר וחדר כושר", "אופניים", "גלישה", "ריצה", "כדורגל", "כדורסל", "טניס", "יוגה", "קמפינג", "דיג"],
        },
      ],
    },
    {
      slug: "baby-kids",
      name: "לתינוק ולילד",
      icon: "Baby",
      attributes: [
        {
          key: "babyType",
          label: "סוג הפריט",
          type: "SELECT",
          required: true,
          highlight: true,
          options: ["עגלה", "מיטת תינוק", "כיסא אוכל", "סלקל", "מושב בטיחות", "צעצועים", "לול", "מוצרי הנקה", "בגדי תינוק"],
        },
        { key: "ageRange", label: "גיל מתאים", type: "SELECT", options: ["0-6 חודשים", "6-12 חודשים", "1-3 שנים", "3-6 שנים", "6+"] },
      ],
    },
    {
      slug: "tools",
      name: "כלי עבודה",
      icon: "Hammer",
      attributes: [
        {
          key: "toolType",
          label: "סוג הכלי",
          type: "SELECT",
          required: true,
          highlight: true,
          options: ["מקדחה", "מסור", "משחזת", "פטישון", "ארגז כלים", "סולם", "מדחס", "מכונת ריתוך", "ציוד גינון"],
        },
        { key: "powerSource", label: "הפעלה", type: "SELECT", options: ["חשמלי", "נטענת", "פנאומטי", "ידני", "מנוע בנזין"] },
      ],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* דרושים                                                                      */
/* -------------------------------------------------------------------------- */

const JOBS: CatDef = {
  slug: "jobs",
  name: "דרושים",
  namePlural: "משרות",
  icon: "Briefcase",
  description: "משרות לפי תחום ואזור בכל הארץ",
  priceLabel: "שכר מוצע",
  attributes: [
    {
      key: "scope",
      label: "היקף משרה",
      type: "SELECT",
      required: true,
      highlight: true,
      options: ["משרה מלאה", "משרה חלקית", "משמרות", "עבודה זמנית", "פרילנס", "התמחות"],
    },
    {
      key: "employment",
      label: "סוג העסקה",
      type: "SELECT",
      highlight: true,
      options: ["שכיר", "קבלן / חשבונית", "סטודנט", "נוער"],
    },
    {
      key: "experience",
      label: "ניסיון נדרש",
      type: "SELECT",
      options: ["ללא ניסיון", "עד שנה", "1-3 שנים", "3-5 שנים", "5+ שנים"],
    },
    { key: "remote", label: "אפשרות לעבודה מהבית", type: "BOOLEAN", highlight: true },
    { key: "salaryPeriod", label: "בסיס השכר", type: "SELECT", options: ["לשעה", "לחודש", "לפרויקט"] },
    { key: "companyName", label: "שם החברה", type: "TEXT", filter: false },
  ],
  children: [
    { slug: "jobs-tech", name: "הייטק ותוכנה", icon: "Laptop" },
    { slug: "jobs-sales", name: "מכירות ושיווק", icon: "Briefcase" },
    { slug: "jobs-hospitality", name: "מסעדנות ואירוח", icon: "Store" },
    { slug: "jobs-education", name: "חינוך והוראה", icon: "Users" },
    { slug: "jobs-health", name: "בריאות וסיעוד", icon: "Users" },
    { slug: "jobs-logistics", name: "לוגיסטיקה ותחבורה", icon: "Truck" },
    { slug: "jobs-construction", name: "בנייה ותשתיות", icon: "HardHat" },
    { slug: "jobs-admin", name: "אדמיניסטרציה ומשרד", icon: "Briefcase" },
  ],
};

/* -------------------------------------------------------------------------- */
/* בעלי חיים                                                                   */
/* -------------------------------------------------------------------------- */

const PETS: CatDef = {
  slug: "pets",
  name: "בעלי חיים",
  icon: "Cat",
  description: "כלבים, חתולים, ציפורים וציוד לבעלי חיים",
  attributes: [
    { key: "breed", label: "גזע", type: "TEXT", highlight: true, placeholder: "לדוגמה: לברדור" },
    { key: "petAge", label: "גיל", type: "SELECT", highlight: true, options: ["גור / צעיר", "עד שנה", "1-3 שנים", "3-7 שנים", "7+ שנים"] },
    { key: "petGender", label: "מין", type: "SELECT", options: ["זכר", "נקבה"] },
    { key: "vaccinated", label: "מחוסן", type: "BOOLEAN", highlight: true },
    { key: "neutered", label: "מסורס / מעוקר", type: "BOOLEAN" },
    { key: "chipped", label: "עם שבב", type: "BOOLEAN" },
    { key: "adoption", label: "מסירה ללא תשלום", type: "BOOLEAN", highlight: true },
  ],
  children: [
    { slug: "dogs", name: "כלבים", icon: "Cat" },
    { slug: "cats", name: "חתולים", icon: "Cat" },
    { slug: "birds", name: "ציפורים", icon: "Cat" },
    { slug: "fish", name: "דגים ואקווריום", icon: "Cat" },
    { slug: "rodents", name: "מכרסמים", icon: "Cat" },
    {
      slug: "pet-supplies",
      name: "ציוד לבעלי חיים",
      icon: "ShoppingBag",
      attributes: [CONDITION],
    },
  ],
};

/* -------------------------------------------------------------------------- */
/* עסקים למכירה                                                                */
/* -------------------------------------------------------------------------- */

const BUSINESSES: CatDef = {
  slug: "businesses",
  name: "עסקים למכירה",
  icon: "Store",
  description: "עסקים פעילים, זכיינות ושותפויות",
  attributes: [
    {
      key: "businessField",
      label: "תחום העסק",
      type: "SELECT",
      required: true,
      highlight: true,
      options: ["מסעדנות ובתי קפה", "קמעונאות", "מספרה וטיפוח", "מכולת / סופר", "מוסך", "אונליין ואיקומרס", "שירותים", "ייצור", "חדר כושר", "קיוסק", "פרנצ'ייז"],
    },
    { key: "monthlyRevenue", label: "מחזור חודשי", type: "NUMBER", unit: "₪", highlight: true, min: 0, max: 5_000_000, step: 1000 },
    // "רווח תפעולי" ולא "רווח חודשי": זה הרווח לפני מימון ומס, וזה המונח
    // שקונה עסק מחפש. הקצב החודשי משתמע מ"מחזור חודשי" שלצידו.
    { key: "monthlyProfit", label: "רווח תפעולי", type: "NUMBER", unit: "₪", highlight: true, min: 0, max: 2_000_000, step: 500 },
    { key: "yearsActive", label: "ותק בשנים", type: "NUMBER", min: 0, max: 100, step: 1 },
    { key: "employees", label: "מספר עובדים", type: "NUMBER", min: 0, max: 500, step: 1 },
    { key: "monthlyRent", label: "שכירות חודשית", type: "NUMBER", unit: "₪", min: 0, max: 200_000, step: 500 },
    { key: "reasonForSale", label: "סיבת המכירה", type: "TEXT", filter: false },
  ],
  /*
   * "עסקים למכירה" הייתה הקטגוריה הראשית היחידה בלי תתי-קטגוריות,
   * וכרטיס הקטגוריה שלה בדף הבית נשאר ריק מתחת לשם. החלוקה היא לפי
   * סוג העסק מפני שזה מה שקובע גם את טווח המחירים וגם את מי שמחפש:
   * מי שמחפש מסעדה אינו מי שמחפש חנות אונליין.
   */
  children: [
    { slug: "business-food", name: "מסעדנות ובתי קפה", icon: "Store" },
    { slug: "business-retail", name: "קמעונאות וחנויות", icon: "Store" },
    { slug: "business-services", name: "שירותים ומקצועות", icon: "Store" },
    { slug: "business-online", name: "אונליין ואיקומרס", icon: "Store" },
    { slug: "business-franchise", name: "זכיינות ושותפויות", icon: "Store" },
  ],
};

/* -------------------------------------------------------------------------- */
/* שירותים ובעלי מקצוע                                                          */
/* -------------------------------------------------------------------------- */

const SERVICES: CatDef = {
  slug: "services",
  name: "שירותים ובעלי מקצוע",
  namePlural: "בעלי מקצוע",
  icon: "Wrench",
  description: "בעלי מקצוע מומלצים לכל עבודה — עם דירוגים אמיתיים",
  priceLabel: "מחיר משוער",
  attributes: [
    {
      key: "serviceArea",
      label: "אזור שירות",
      type: "MULTISELECT",
      highlight: true,
      options: ["צפון", "חיפה", "שרון", "מרכז", "תל אביב", "ירושלים", "שפלה", "דרום", "כל הארץ"],
    },
    { key: "yearsExperience", label: "שנות ניסיון", type: "NUMBER", highlight: true, min: 0, max: 60, step: 1 },
    { key: "licensed", label: "בעל רישיון / תעודה", type: "BOOLEAN", highlight: true },
    { key: "insured", label: "עם ביטוח מקצועי", type: "BOOLEAN" },
    { key: "emergency", label: "זמין לקריאות חירום", type: "BOOLEAN" },
    { key: "invoice", label: "מוציא חשבונית", type: "BOOLEAN" },
    { key: "priceBasis", label: "בסיס תמחור", type: "SELECT", options: ["לשעה", "לפרויקט", 'למ"ר', "לפי הצעת מחיר"] },
  ],
  children: [
    { slug: "renovations", name: "שיפוצים ובנייה", icon: "HardHat" },
    { slug: "electrician-plumber", name: "חשמל ואינסטלציה", icon: "Plug" },
    { slug: "cleaning", name: "ניקיון", icon: "Wrench" },
    { slug: "moving", name: "הובלות", icon: "Truck" },
    { slug: "computers", name: "מחשבים וטכנולוגיה", icon: "Laptop" },
    { slug: "events", name: "אירועים והפקות", icon: "Users" },
    { slug: "tutoring", name: "לימודים ושיעורים פרטיים", icon: "Users" },
    { slug: "beauty", name: "טיפוח ויופי", icon: "Shirt" },
  ],
};

export const CATEGORY_TREE: CatDef[] = [
  VEHICLES,
  REALESTATE,
  SECOND_HAND,
  JOBS,
  PETS,
  BUSINESSES,
  SERVICES,
];

export {
  CAR_MODELS,
  COMMERCIAL_MODELS,
  MOTORCYCLE_MODELS,
  RESIDENTIAL_SALE_TYPES,
  RESIDENTIAL_RENT_TYPES,
  ROOMMATE_TYPES,
  VACATION_TYPES,
};
