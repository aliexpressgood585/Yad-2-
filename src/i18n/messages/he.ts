/**
 * הקטלוג העברי — מקור האמת.
 *
 * ## הטיפוס נגזר מכאן, וזה הגדר
 *
 * `Messages` הוא `typeof he`, וכל קטלוג אחר מוקלד מולו. מפתח שקיים כאן
 * וחסר בערבית או באנגלית **אינו מתקמפל**. לכן אין באתר מצב של שפה
 * חלקית: או שהקטלוג שלם, או שהבנייה נכשלת.
 *
 * ## מוסכמות למפתחות
 *
 * `אזור.רכיב.תפקיד` באנגלית, במקטעים קצרים. המפתח מתאר **היכן** הטקסט
 * ומה תפקידו, ולא מה הוא אומר: מפתח כמו `publish.submit` שורד שינוי
 * ניסוח, ומפתח כמו `publish.publishNow` נעשה שקרי ברגע שהכפתור משנה
 * טקסט.
 *
 * מפתח שמסתיים ב-`_one` / `_two` / `_many` / `_other` הוא משפחת ריבוי
 * ונבחר לפי `Intl.PluralRules`. לעברית יש צורת זוגי, ולכן `_two` אינו
 * מותרות.
 */
export const he = {
  /* --- שלד האתר ---------------------------------------------------------- */
  "chrome.skipToContent": "דילוג לתוכן הראשי",
  "chrome.publishListing": "פרסום מודעה",
  "chrome.mainCategories": "קטגוריות ראשיות",
  "chrome.mapView": "תצוגת מפה",
  "chrome.categories": "קטגוריות",
  "chrome.language": "שפה",
  "chrome.chooseLanguage": "בחירת שפת הממשק",

  /* --- כותרת תחתונה ------------------------------------------------------ */
  "footer.board": "הלוח",
  "footer.legal": "משפטי",
  "footer.about": "אודות",
  "footer.priceIndex": "מדד המחירים",
  "footer.carGuide": "מחירון רכב",
  "footer.cityPrices": "מחירי דירות",
  "footer.help": "עזרה ותמיכה",
  "footer.safety": "מדריך בטיחות",
  "footer.business": "פתרונות לעסקים",
  "footer.terms": "תנאי שימוש",
  "footer.privacy": "מדיניות פרטיות",
  "footer.accessibility": "הצהרת נגישות",
  "footer.cookies": "מדיניות עוגיות",
  "footer.rights": "כל הזכויות שמורות.",
  "footer.builtIn": "נבנה בישראל · אתר נגיש לפי תקן ישראלי 5568 (WCAG 2.1 AA)",
} as const;

export type MessageKey = keyof typeof he;

/**
 * הטיפוס שכל קטלוג אחר חייב לממש במלואו.
 *
 * `Record` ולא `Partial`: זה בדיוק המקום שבו שפה חלקית נפסלת.
 */
export type Messages = Record<MessageKey, string>;
