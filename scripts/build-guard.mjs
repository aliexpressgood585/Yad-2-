/**
 * שער לפני בנייה — נכשל מוקדם, בשורה אחת, ובעברית.
 *
 * `next build` אינו מקמפל בלבד: הוא מרנדר מראש את דפי התוכן, ואלה
 * קוראים למסד. לכן `DATABASE_URL` חסר אינו נגמר בהודעה "משתנה חסר"
 * אלא במאתיים שורות של stack trace מ-Prisma, עמוק בתוך רינדור של דף
 * כלשהו — וקוראים אותן כתקלת קוד במקום כתקלת הגדרה.
 *
 * הריצה הראשונה שהפילה את הפריסה בפרודקשן נראתה בדיוק כך.
 *
 * הבדיקה כאן זולה ומוקדמת: היא רצה לפני `prisma generate`, לא נוגעת
 * ברשת, ואומרת מה להגדיר ואיפה.
 */

/** מה שחייב להתקיים כדי שבנייה תצליח בכלל. */
const REQUIRED = [
  {
    name: "DATABASE_URL",
    why: "דפי התוכן מרונדרים מראש בזמן הבנייה וקוראים מהמסד",
    where: "Vercel → Settings → Environment Variables (סמנו גם Production וגם Preview)",
    valid: (v) => /^postgres(ql)?:\/\//.test(v),
    shape: "מחרוזת חיבור של Postgres, למשל postgresql://user:pass@host:5432/db?sslmode=require",
  },
];

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const amber = (s) => `\x1b[33m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;

let failed = false;

for (const item of REQUIRED) {
  const value = process.env[item.name]?.trim();

  if (!value) {
    console.error(`\n${red("✗")} ${item.name} אינו מוגדר.`);
    console.error(`  למה זה נדרש: ${item.why}`);
    console.error(`  איפה מגדירים: ${item.where}`);
    console.error(`  איך זה נראה:  ${item.shape}`);
    failed = true;
    continue;
  }

  if (item.valid && !item.valid(value)) {
    console.error(`\n${red("✗")} ${item.name} מוגדר אבל אינו בצורה הנכונה.`);
    console.error(`  איך זה נראה:  ${item.shape}`);
    failed = true;
    continue;
  }

  console.log(`${green("✓")} ${item.name} מוגדר`);
}

/*
 * כתובת הבסיס אינה חוסמת — `lib/brand` נופל אחורה לדומיין של Vercel —
 * אבל בלעדיה הקישורים המוחלטים (sitemap, og:url) מצביעים לדומיין
 * הפרויקט ולא לדומיין המותג, וזה משנה איך הקישור נראה בוואטסאפ.
 */
if (!process.env.NEXT_PUBLIC_SITE_URL?.trim()) {
  const fallback =
    process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  console.log(
    `${amber("!")} NEXT_PUBLIC_SITE_URL אינו מוגדר — הקישורים המוחלטים ייבנו מול ${
      fallback ? `https://${fallback}` : "http://localhost:3000"
    }`,
  );
}

if (failed) {
  console.error(
    `\n${red("הבנייה נעצרה לפני שהתחילה.")} הגדירו את מה שחסר למעלה והריצו פריסה מחדש.\n`,
  );
  process.exit(1);
}
