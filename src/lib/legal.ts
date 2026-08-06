/**
 * הפרטים המשפטיים של המפעיל — מקור אמת יחיד.
 *
 * הדפים המשפטיים חייבים לנקוב בזהות המפעיל, בכתובתו ובדרך ליצור איתו
 * קשר. אלה פרטים שרק בעל העסק יכול לספק, ולכן הם יושבים כאן
 * כ-`[[נדרש: ...]]` ולא מפוזרים בטקסט: כשהם יגיעו, ההשלמה היא קובץ
 * אחד ולא מרדף אחרי שבעה מקומות.
 *
 * הערכים המסומנים `[[נדרש]]` מוצגים כפי שהם באתר **בכוונה**. דף
 * מדיניות פרטיות עם פרטים מומצאים גרוע יותר מדף עם חור גלוי: השני
 * נראה כמו טיוטה, הראשון נראה כמו הצהרה שקרית.
 */

/** מסמן ערך שעדיין לא סופק. */
const REQUIRED = (what: string) => `[[נדרש: ${what}]]`;

export const LEGAL = {
  /** שם הישות המשפטית שמפעילה את הלוח — לא שם המותג. */
  operator: process.env.LEGAL_OPERATOR ?? REQUIRED("שם החברה או העוסק המורשה"),
  /** ח.פ. / ע.מ. — חובה בכל אתר מסחרי ישראלי. */
  companyId: process.env.LEGAL_COMPANY_ID ?? REQUIRED('ח.פ. או מספר עוסק מורשה'),
  /** כתובת פיזית. חובה בתקנות הגנת הצרכן ובהצהרת נגישות. */
  address: process.env.LEGAL_ADDRESS ?? REQUIRED("כתובת פיזית מלאה"),
  /** כתובת לפניות כלליות. */
  email: process.env.LEGAL_EMAIL ?? REQUIRED("כתובת מייל לפניות"),
  /** טלפון לפניות. */
  phone: process.env.LEGAL_PHONE ?? REQUIRED("טלפון לפניות"),

  /** ממונה על הגנת הפרטיות — הכתובת שאליה מפנים בקשות עיון ומחיקה. */
  privacyContact: process.env.LEGAL_PRIVACY_EMAIL ?? REQUIRED("מייל לפניות פרטיות"),

  /** רכז נגישות — נדרש מפורשות בתקן ישראלי 5568. */
  accessibilityCoordinator:
    process.env.LEGAL_A11Y_NAME ?? REQUIRED("שם רכז הנגישות"),
  accessibilityEmail: process.env.LEGAL_A11Y_EMAIL ?? REQUIRED("מייל רכז הנגישות"),
  accessibilityPhone: process.env.LEGAL_A11Y_PHONE ?? REQUIRED("טלפון רכז הנגישות"),

  /** תאריך העדכון האחרון של המסמכים המשפטיים. */
  updatedAt: "אוגוסט 2026",
} as const;

/** האם פרט מסוים עדיין חסר — לשימוש בבדיקה שמונה כמה חורים נשארו. */
export function isMissing(value: string): boolean {
  return value.startsWith("[[נדרש:");
}

/** רשימת כל מה שעדיין חסר. */
export function missingLegalDetails(): string[] {
  return Object.entries(LEGAL)
    .filter(([, v]) => typeof v === "string" && isMissing(v))
    .map(([k, v]) => `${k}: ${v}`);
}

/**
 * הצדדים השלישיים שמקבלים מידע.
 *
 * חוק הגנת הפרטיות מחייב לומר **למי** המידע מועבר, ותיקון 13 מחמיר
 * את זה. שלושה מהם מעבדים מידע מחוץ לישראל, וזה פרט שחייב להיאמר
 * במפורש ולא להשתמע.
 */
export const DATA_PROCESSORS = [
  { name: "Vercel", purpose: "אירוח האתר והגשת הדפים", location: "ארה\"ב והאיחוד האירופי" },
  { name: "Neon / Supabase", purpose: "מסד הנתונים", location: "האיחוד האירופי" },
  { name: "Cloudinary", purpose: "אחסון תמונות המודעות", location: "ארה\"ב" },
  { name: "Resend", purpose: "שליחת הודעות דוא\"ל", location: "ארה\"ב" },
  { name: "Upstash", purpose: "הגבלת קצב בקשות", location: "האיחוד האירופי" },
  { name: "ספק ה-SMS", purpose: "שליחת קודי אימות", location: "ישראל" },
  { name: "Sentry", purpose: "דיווח שגיאות טכניות", location: "האיחוד האירופי" },
] as const;

/**
 * תקופות שמירה.
 *
 * "נשמר כל עוד נדרש" אינה תשובה חוקית. לכל סוג מידע יש תקופה, וכשהיא
 * נגמרת המידע נמחק.
 */
export const RETENTION = [
  { what: "מודעה פעילה", period: "45 יום, ולאחר מכן 12 חודשים בארכיון" },
  { what: "חשבון משתמש", period: "עד למחיקה יזומה, או 24 חודשים ללא פעילות" },
  { what: "שיחות והודעות", period: "18 חודשים מההודעה האחרונה" },
  { what: "קודי אימות SMS", period: "5 דקות" },
  { what: "נתוני שימוש ומדידה", period: "12 חודשים" },
  { what: "רישומי ביקורת ודיווחים", period: "7 שנים — נדרש לבירור מחלוקות" },
] as const;
