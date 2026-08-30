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
  /* --- ניווט --------------------------------------------------------------- */
  "nav.openMenu": "פתיחת התפריט",
  "nav.mainMenu": "תפריט ניווט ראשי",
  "nav.moreLinks": "קישורים נוספים",
  "nav.publishFree": "פרסום מודעה חינם",
  "nav.advancedSearch": "חיפוש מתקדם",
  "nav.favorites": "מועדפים",
  "nav.savedSearches": "חיפושים שמורים",
  "nav.compare": "השוואת מודעות",
  "nav.helpAndSafety": "עזרה ובטיחות",
  "nav.myListings": "המודעות שלי",
  "nav.messages": "הודעות",
  "nav.notifications": "התראות",
  "nav.myProfile": "הפרופיל שלי",
  "nav.adminPanel": "פאנל ניהול",

  /* --- סרגל תחתון ---------------------------------------------------------- */
  "tabBar.quickNav": "ניווט מהיר",
  "tabBar.home": "בית",
  "tabBar.search": "חיפוש",
  "tabBar.publish": "פרסום",
  "tabBar.favorites": "מועדפים",
  "tabBar.messages": "הודעות",

  /* --- ערכת צבעים ---------------------------------------------------------- */
  "theme.choose": "בחירת ערכת צבעים",
  "theme.instrument": "פנים המכשיר",
  "theme.day": "פנים היום",

  /* --- חיפוש בהדר ---------------------------------------------------------- */
  "search.listings": "חיפוש מודעות",
  "search.placeholder": "מה מחפשים? רכב, דירה, ספה…",
  "search.clear": "ניקוי החיפוש",
  "search.submit": "חיפוש",

  /* --- משתמש --------------------------------------------------------------- */
  "user.myMenu": "התפריט שלי",
  "user.anonymous": "משתמש",
  "auth.login": "התחברות",
  "auth.logout": "התנתקות",
} as const;

export type MessageKey = keyof typeof he;

/**
 * הטיפוס שכל קטלוג אחר חייב לממש במלואו.
 *
 * `Record` ולא `Partial`: זה בדיוק המקום שבו שפה חלקית נפסלת.
 */
export type Messages = Record<MessageKey, string>;
