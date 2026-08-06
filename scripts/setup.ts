/**
 * אשף ההגדרה — `npm run setup`.
 *
 * ההשקה נתקעת תמיד באותו מקום: לא בקוד אלא בשבעה חשבונות חיצוניים,
 * שכל אחד מהם דורש למצוא איפה המפתח מסתתר בממשק ואיך קוראים למשתנה
 * אצלנו. האשף הופך את זה לרצף של הדבקות: הוא פותח את הקישור, מקבל
 * את המפתח, **בודק אותו מול השירות בפועל**, וכותב אותו ל-`.env.local`.
 *
 * הבדיקה החיה היא העיקר. מפתח שהודבק עם רווח בסוף או הועתק מהחשבון
 * הלא נכון נראה תקין לחלוטין עד לרגע שבו משתמש אמיתי לא מקבל SMS.
 *
 * מה שנשאר ריק פשוט נשאר ריק — אפשר להריץ שוב מתי שרוצים, והאשף
 * מדלג על מה שכבר מוגדר.
 */
import { createInterface } from "node:readline/promises";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { stdin, stdout } from "node:process";

type Check = (values: Record<string, string>) => Promise<string | null>;

type Step = {
  title: string;
  why: string;
  url: string;
  /** הוראות איתור המפתח בממשק של הספק — זה מה שגוזל את הזמן */
  find: string[];
  vars: { key: string; label: string; optional?: boolean }[];
  /** בדיקה חיה. מחזירה `null` בהצלחה, או הודעת שגיאה. */
  check?: Check;
  /** אפשר לדלג בלי לשבור את ההשקה */
  skippable?: boolean;
};

const ENV_FILE = ".env.local";

/* -------------------------------------------------------------------------- */

const STEPS: Step[] = [
  {
    title: "דומיין",
    why: "בלי זה כל קישור ששותף בוואטסאפ מצביע ל-localhost, וגם כתובות החזרה מהסליקה נשברות.",
    url: "https://vercel.com/dashboard",
    find: [
      "Vercel → הפרויקט → Settings → Domains → Add",
      "אם עוד אין דומיין: אפשר להתחיל עם כתובת ה-vercel.app ולהחליף אחר כך",
    ],
    vars: [{ key: "NEXT_PUBLIC_SITE_URL", label: "הכתובת המלאה (https://..., בלי לוכסן בסוף)" }],
    check: async (v) => {
      const url = v.NEXT_PUBLIC_SITE_URL;
      if (!/^https?:\/\/[^/]+$/.test(url)) return "צריכה להיות כתובת מלאה בלי נתיב ובלי לוכסן בסוף";
      return null;
    },
  },
  {
    title: "SMS — אימות טלפון",
    why: "**זה חוסם הכול.** בלי SMS אף אחד לא מאמת טלפון, ובלי טלפון מאומת אף אחד לא מפרסם מודעה.",
    url: "https://www.019sms.co.il/",
    find: [
      "019: הרשמה עסקית → אזור אישי → API → יצירת טוקן",
      "חלופה מהירה יותר לפתיחה: Inforu (https://www.inforu.co.il)",
      "שם השולח (SMS_SENDER) הוא עד 11 תווים לטיניים ומופיע במכשיר",
    ],
    vars: [
      { key: "SMS_PROVIDER", label: 'הספק: "019" או "inforu"' },
      { key: "SMS_SENDER", label: "שם השולח (לטינית, עד 11 תווים)" },
      { key: "SMS_019_USERNAME", label: "שם משתמש 019 (רק אם בחרת 019)", optional: true },
      { key: "SMS_019_TOKEN", label: "טוקן 019", optional: true },
      { key: "SMS_INFORU_USERNAME", label: "שם משתמש Inforu", optional: true },
      { key: "SMS_INFORU_TOKEN", label: "טוקן Inforu", optional: true },
    ],
    check: async (v) => {
      if (!["019", "inforu"].includes(v.SMS_PROVIDER ?? "")) return 'SMS_PROVIDER חייב להיות "019" או "inforu"';
      if (v.SMS_PROVIDER === "019" && !(v.SMS_019_USERNAME && v.SMS_019_TOKEN)) {
        return "בחרת 019 אבל שם המשתמש או הטוקן חסרים";
      }
      if (v.SMS_PROVIDER === "inforu" && !(v.SMS_INFORU_USERNAME && v.SMS_INFORU_TOKEN)) {
        return "בחרת Inforu אבל שם המשתמש או הטוקן חסרים";
      }
      return null;
    },
  },
  {
    title: "Cloudinary — אחסון תמונות",
    why: "מערכת הקבצים של Vercel אינה נשמרת. בלי אחסון חיצוני התמונות נעלמות בכל פריסה.",
    url: "https://cloudinary.com/users/register_free",
    find: [
      "אחרי ההרשמה: Dashboard → Product Environment Credentials",
      "שלושת הערכים נמצאים שם יחד, בשורה אחת",
      "החינמי מספיק ל-25GB — זה כמה אלפי מודעות",
    ],
    vars: [
      { key: "UPLOAD_PROVIDER", label: 'להשאיר "cloudinary"' },
      { key: "CLOUDINARY_CLOUD_NAME", label: "Cloud name" },
      { key: "CLOUDINARY_API_KEY", label: "API Key" },
      { key: "CLOUDINARY_API_SECRET", label: "API Secret" },
    ],
    check: async (v) => {
      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${v.CLOUDINARY_CLOUD_NAME}/resources/image?max_results=1`,
        {
          headers: {
            Authorization: `Basic ${Buffer.from(`${v.CLOUDINARY_API_KEY}:${v.CLOUDINARY_API_SECRET}`).toString("base64")}`,
          },
        },
      ).catch(() => null);
      if (!res) return "אין תקשורת עם Cloudinary";
      if (res.status === 401) return "המפתחות נדחו — בדוק שהעתקת מהסביבה הנכונה";
      if (!res.ok) return `Cloudinary החזיר ${res.status}`;
      return null;
    },
  },
  {
    title: "Resend — דוא\"ל",
    why: "התראות וחיפושים שמורים הם מנוע ההחזרה של הלוח. בלי מייל הם לא מגיעים.",
    url: "https://resend.com/api-keys",
    find: [
      "Resend → API Keys → Create API Key (הרשאת Sending בלבד מספיקה)",
      "**חשוב:** Domains → Add Domain, ואז להוסיף את רשומות ה-SPF וה-DKIM ב-DNS",
      "בלי אימות דומיין ההודעות נוחתות בספאם — וזה שורף את הדומיין גם לעתיד",
    ],
    vars: [
      { key: "RESEND_API_KEY", label: "API Key (מתחיל ב-re_)" },
      { key: "EMAIL_FROM", label: 'כתובת השולח, למשל: כדאי <noreply@הדומיין-שלך>' },
    ],
    check: async (v) => {
      if (!v.RESEND_API_KEY.startsWith("re_")) return "מפתח Resend מתחיל ב-re_";
      const res = await fetch("https://api.resend.com/domains", {
        headers: { Authorization: `Bearer ${v.RESEND_API_KEY}` },
      }).catch(() => null);
      if (!res) return "אין תקשורת עם Resend";
      if (res.status === 401) return "המפתח נדחה";
      const body = (await res.json().catch(() => null)) as { data?: { status?: string; name?: string }[] } | null;
      const verified = body?.data?.filter((d) => d.status === "verified") ?? [];
      if (!verified.length) {
        return "המפתח תקין, אבל אין אף דומיין מאומת. הוסף SPF ו-DKIM ב-DNS — אחרת הכול לספאם";
      }
      return null;
    },
  },
  {
    title: "Upstash Redis — הגבלת קצב",
    why: "ב-serverless כל הפעלה מקבלת זיכרון חדש, ולכן הגבלת קצב בזיכרון פשוט לא קיימת.",
    url: "https://console.upstash.com/redis",
    find: [
      "Create Database → אזור eu-central-1 (הכי קרוב לישראל)",
      "אחרי היצירה: לשונית REST API → UPSTASH_REDIS_REST_URL ו-TOKEN",
      "החינמי מספיק בהחלט לשלב הזה",
    ],
    vars: [
      { key: "UPSTASH_REDIS_REST_URL", label: "REST URL" },
      { key: "UPSTASH_REDIS_REST_TOKEN", label: "REST Token" },
    ],
    check: async (v) => {
      const res = await fetch(`${v.UPSTASH_REDIS_REST_URL}/ping`, {
        headers: { Authorization: `Bearer ${v.UPSTASH_REDIS_REST_TOKEN}` },
      }).catch(() => null);
      if (!res) return "אין תקשורת עם Upstash";
      if (!res.ok) return `Upstash החזיר ${res.status}`;
      return null;
    },
  },
  {
    title: "Sentry — ניטור שגיאות",
    why: "בלי זה שגיאת פרודקשן נעלמת בלוגים, ומגלים אותה ממשתמש שמתלונן.",
    url: "https://sentry.io/signup/",
    find: [
      "יצירת פרויקט מסוג Next.js",
      "Settings → Client Keys (DSN) → העתקת ה-DSN",
    ],
    vars: [{ key: "NEXT_PUBLIC_SENTRY_DSN", label: "DSN (מתחיל ב-https://)" }],
    skippable: true,
    check: async (v) => (v.NEXT_PUBLIC_SENTRY_DSN.startsWith("https://") ? null : "DSN מתחיל ב-https://"),
  },
  {
    title: "פרטים משפטיים",
    why: "הדפים המשפטיים מציגים [[נדרש]] עד שהם מוגדרים. חובה לפני שמשתמשים אמיתיים נכנסים.",
    url: "https://www.gov.il/he/service/company-registration",
    find: [
      "אלה פרטים שלך — אין מה לפתוח חשבון",
      "רכז נגישות יכול להיות אתה עצמך; מה שנדרש הוא שם, מייל וטלפון שאפשר לפנות אליהם",
    ],
    vars: [
      { key: "LEGAL_OPERATOR", label: "שם החברה / העוסק המורשה" },
      { key: "LEGAL_COMPANY_ID", label: "ח.פ. או מספר עוסק" },
      { key: "LEGAL_ADDRESS", label: "כתובת פיזית מלאה" },
      { key: "LEGAL_EMAIL", label: "מייל לפניות" },
      { key: "LEGAL_PHONE", label: "טלפון לפניות" },
      { key: "LEGAL_PRIVACY_EMAIL", label: "מייל לפניות פרטיות" },
      { key: "LEGAL_A11Y_NAME", label: "שם רכז הנגישות" },
      { key: "LEGAL_A11Y_EMAIL", label: "מייל רכז הנגישות" },
      { key: "LEGAL_A11Y_PHONE", label: "טלפון רכז הנגישות" },
    ],
  },
  {
    title: "סליקה — Tranzila",
    why: "בלי זה חבילות הקידום מופעלות בחינם. אפשר לדלג ולהשקיע בזה אחרי שיש מודעות.",
    url: "https://www.tranzila.com/",
    find: [
      "פתיחת מסוף דורשת ח.פ. וחשבון בנק — זה הצעד הארוך ביותר",
      "אפשר להתחיל במסוף בדיקה (sandbox) לפני האישור המלא",
      "המסוף (terminal) הוא השם שמופיע בכתובת של דף הסליקה שלך",
    ],
    vars: [
      { key: "PAYMENT_PROVIDER", label: 'להשאיר "tranzila"' },
      { key: "TRANZILA_TERMINAL", label: "שם המסוף" },
      { key: "TRANZILA_API_KEY", label: "API app key" },
      { key: "TRANZILA_API_SECRET", label: "API secret" },
    ],
    skippable: true,
  },
];

/* -------------------------------------------------------------------------- */

function readEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(ENV_FILE, "utf8").split("\n")) {
    const m = /^([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/.exec(line.trim());
    if (m && m[2]) out[m[1]!] = m[2];
  }
  return out;
}

function writeEnv(values: Record<string, string>) {
  const body = Object.entries(values)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}="${v}"`)
    .join("\n");
  writeFileSync(ENV_FILE, `# נוצר על ידי npm run setup\n${body}\n`, "utf8");
}

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const amber = (s: string) => `\x1b[33m${s}\x1b[0m`;

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  const values = readEnv();

  console.log(`\n${bold("הגדרת כדאי")}`);
  console.log(dim("כל שלב: פותחים קישור, מדביקים, ואני בודק מול השירות בפועל."));
  console.log(dim("Enter ריק = לדלג על השלב. אפשר להריץ שוב בכל רגע.\n"));

  for (const [i, step] of STEPS.entries()) {
    const done = step.vars.filter((v) => !v.optional).every((v) => values[v.key]);
    console.log(`${bold(`[${i + 1}/${STEPS.length}] ${step.title}`)}${done ? green("  ✓ כבר מוגדר") : ""}`);
    console.log(`  ${step.why}`);

    if (done) {
      const again = await rl.question(dim("  להגדיר מחדש? (y/N) "));
      if (again.toLowerCase() !== "y") {
        console.log();
        continue;
      }
    }

    console.log(`  ${bold("קישור:")} ${step.url}`);
    for (const f of step.find) console.log(`    ${dim("·")} ${f}`);
    console.log();

    let filledAny = false;
    for (const v of step.vars) {
      const current = values[v.key];
      const hint = current ? dim(` [${current.slice(0, 12)}…]`) : v.optional ? dim(" (אופציונלי)") : "";
      const answer = (await rl.question(`  ${v.label}${hint}: `)).trim();
      if (answer) {
        values[v.key] = answer;
        filledAny = true;
      }
    }

    if (!filledAny) {
      console.log(step.skippable ? amber("  ⤳ דולג\n") : amber("  ⤳ דולג — שים לב שזה חוסם השקה\n"));
      continue;
    }

    writeEnv(values);

    if (step.check) {
      process.stdout.write("  בודק מול השירות… ");
      const error = await step.check(values).catch((e) => String(e));
      console.log(error ? red(`✗ ${error}`) : green("✓ עובד"));
      if (error) console.log(amber("  הערכים נשמרו בכל זאת. הרץ שוב אחרי שתתקן.\n"));
      else console.log();
    } else {
      console.log(green("  ✓ נשמר\n"));
    }
  }

  rl.close();

  const blocking = ["NEXT_PUBLIC_SITE_URL", "SMS_PROVIDER", "CLOUDINARY_CLOUD_NAME", "UPSTASH_REDIS_REST_URL", "LEGAL_OPERATOR"];
  const missing = blocking.filter((k) => !values[k]);

  console.log(bold("סיכום"));
  console.log(`  נשמר ב-${ENV_FILE}`);
  if (missing.length) {
    console.log(red(`  חסרים לחסימת השקה: ${missing.join(", ")}`));
  } else {
    console.log(green("  כל מה שחוסם השקה מוגדר."));
  }
  console.log(`\n${bold("הצעד הבא:")}`);
  console.log("  1. להעתיק את .env.local ל-Vercel:  vercel env pull / או הדבקה ב-Settings → Environment Variables");
  console.log("  2. npm run preflight    — בדיקה שהכול עובד יחד");
  console.log("  3. npm run demo:purge   — ניקוי מודעות הדגמה מהפרודקשן\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
