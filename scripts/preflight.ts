/**
 * בדיקה לפני השקה — `npm run preflight [url]`.
 *
 * מריצה מול השרת החי את כל מה שאפשר לבדוק מבחוץ, ומחזירה תשובה אחת:
 * מותר לפרסם את הכתובת הזאת למשתמשים אמיתיים, או לא.
 *
 * למה לא סתם `/api/health`: הבדיקה שם עונה "האם השירותים עונים".
 * כאן השאלה אחרת — "האם משתמש אמיתי שייכנס עכשיו ייתקל במשהו שישרוף
 * את האמון". מודעת דמו עם טלפון שלא קיים היא תקלה כזאת, וגם דף
 * מדיניות פרטיות שכתוב בו [[נדרש]].
 */
import { missingLegalDetails } from "../src/lib/legal";

const BASE = (process.argv[2] ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3000").replace(/\/+$/, "");

let blocking = 0;
let warnings = 0;

const green = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red = (s: string) => `\x1b[31m${s}\x1b[0m`;
const amber = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;

function pass(label: string, detail = "") {
  console.log(`${green("✓")} ${label}${detail ? `  ${detail}` : ""}`);
}
function fail(label: string, detail: string) {
  console.log(`${red("✗")} ${label}  ${detail}`);
  blocking++;
}
function warn(label: string, detail: string) {
  console.log(`${amber("!")} ${label}  ${detail}`);
  warnings++;
}

async function get(path: string) {
  return fetch(`${BASE}${path}`, { redirect: "manual" }).catch(() => null);
}

async function main() {
  console.log(`\n${bold("בדיקה לפני השקה")}  ${BASE}\n`);

  /* --- 1. האתר עונה --- */
  const home = await get("/");
  if (!home) {
    fail("האתר עונה", "אין תקשורת בכלל");
    process.exit(1);
  }
  home.ok ? pass("האתר עונה", `HTTP ${home.status}`) : fail("האתר עונה", `HTTP ${home.status}`);

  /* --- 2. שירותים --- */
  const healthRes = await get("/api/health");
  const health = (await healthRes?.json().catch(() => null)) as {
    checks?: Record<string, { ok: boolean; note?: string }>;
  } | null;

  if (!health?.checks) {
    fail("נקודת הבריאות", "לא החזירה תשובה תקינה");
  } else {
    const critical = ["database", "storage", "sms"];
    for (const [name, check] of Object.entries(health.checks)) {
      if (check.ok) pass(`שירות: ${name}`);
      else if (critical.includes(name)) fail(`שירות: ${name}`, check.note ?? "לא מוגדר");
      else warn(`שירות: ${name}`, check.note ?? "לא מוגדר");
    }
  }

  /* --- 3. נתוני הדגמה --- */
  const sitemap = await get("/sitemap/0.xml");
  const sitemapBody = (await sitemap?.text()) ?? "";
  if (sitemapBody.includes("<loc>")) pass("מפת האתר מוגשת");
  else warn("מפת האתר", "ריקה — ייתכן שאין עדיין תוכן");

  const search = await get("/api/search?perPage=1");
  const searchBody = (await search?.json().catch(() => null)) as { items?: unknown[]; total?: number } | null;
  if (typeof searchBody?.total === "number") {
    pass("החיפוש עובד", `${searchBody.total} מודעות פעילות`);
    if (searchBody.total === 0) {
      warn("מלאי", "אפס מודעות. אל תפרסם את הכתובת לפני שיש לפחות 300");
    } else if (searchBody.total < 300) {
      warn("מלאי", `${searchBody.total} מודעות. מבקר שנוחת על לוח דליל לא חוזר — והוא נוחת פעם אחת`);
    }
  } else {
    fail("החיפוש", "לא החזיר תשובה תקינה");
  }

  /* --- 4. פרטים משפטיים --- */
  const missing = missingLegalDetails();
  if (missing.length) {
    fail("פרטים משפטיים", `${missing.length} חסרים — הדפים מציגים [[נדרש]] למשתמשים`);
    for (const m of missing) console.log(`    ${m}`);
  } else {
    pass("פרטים משפטיים");
  }

  /* --- 5. כותרות אבטחה --- */
  const headers = home.headers;
  for (const h of [
    "content-security-policy",
    "strict-transport-security",
    "x-frame-options",
    "referrer-policy",
  ]) {
    headers.get(h) ? pass(`כותרת ${h}`) : fail(`כותרת ${h}`, "חסרה");
  }

  /* --- 6. הטלפון אינו במטען --- */
  const listing = await get("/api/search?perPage=1");
  const first = ((await listing?.json().catch(() => null)) as { items?: { slug?: string }[] } | null)?.items?.[0];
  if (first?.slug) {
    const page = await get(`/item/${encodeURIComponent(first.slug)}`);
    const html = (await page?.text()) ?? "";
    // מספר ישראלי בן עשר ספרות שמתחיל ב-05
    const leaked = /\b05\d{8}\b/.test(html);
    leaked
      ? fail("מספר טלפון במטען", "המספר גלוי לפני לחיצה על 'הצגת מספר'")
      : pass("מספר הטלפון אינו במטען");
  } else {
    warn("בדיקת טלפון", "אין מודעה לבדוק עליה");
  }

  /* --- 7. robots --- */
  const robots = await get("/robots.txt");
  const robotsBody = (await robots?.text()) ?? "";
  if (robotsBody.includes("Sitemap:")) pass("robots.txt מפנה למפת האתר");
  else fail("robots.txt", "אינו מפנה למפת האתר");
  if (robotsBody.includes("Disallow: /") && !robotsBody.includes("Allow: /")) {
    fail("robots.txt", "חוסם את כל האתר");
  }

  /* --- סיכום --- */
  console.log(`\n${bold("תוצאה")}`);
  if (blocking) {
    console.log(red(`  ${blocking} חוסמים${warnings ? `, ${warnings} אזהרות` : ""}. אל תפרסם עדיין.\n`));
    process.exit(1);
  }
  if (warnings) {
    console.log(amber(`  אין חוסמים, ${warnings} אזהרות. אפשר לפרסם — קרא אותן קודם.\n`));
    return;
  }
  console.log(green("  הכול עבר. מותר לפרסם את הכתובת.\n"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
