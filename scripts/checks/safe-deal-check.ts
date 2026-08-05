/**
 * בדיקות אזהרות העסקה.
 *   npm run check:safe-deal
 *
 * מקבע את שלושת הדברים שהופכים את הרשימה למשהו שקוראים: היא ספציפית
 * לקטגוריה, היא לא ריקה לעולם, והיא לא משתנה לפי חשד.
 */
import { dealHeadline, dealTipsFor } from "../../src/lib/safe-deal";

let failed = 0;
function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

const ROOTS = ["vehicles", "realestate", "secondhand", "jobs", "pets"];

/* --- ספציפיות לקטגוריה ---------------------------------------------------- */

console.log("ספציפיות\n");

const vehicles = dealTipsFor("vehicles");
const realestate = dealTipsFor("realestate");

check(
  vehicles.some((t) => t.title.includes("משרד התחבורה")),
  "רכב מקבל את הבדיקה במשרד התחבורה",
);
check(
  realestate.some((t) => t.title.includes("דמי רצינות")),
  "נדל\"ן מקבל את האזהרה על דמי רצינות",
);
check(
  !realestate.some((t) => t.title.includes("משרד התחבורה")),
  "אזהרת רכב לא דולפת לנדל\"ן",
  "רשימה אחת לכולם היא רשימה שאיש לא קורא",
);

/*
 * האזהרה הספציפית ראשונה. "אל תשלמו מראש" הוא דבר שרוב הקונים כבר
 * יודעים, ואם הוא פותח את הרשימה — השורות שמתחתיו לא ייקראו.
 */
for (const root of ROOTS) {
  const tips = dealTipsFor(root);
  check(
    !tips[0]!.title.includes("מקדמה"),
    `${root}: הספציפי לפני הכללי`,
    tips[0]!.title,
  );
}

/* --- אף פעם לא ריק -------------------------------------------------------- */

console.log("\nעמידות\n");

for (const input of [null, undefined, "", "category-that-does-not-exist"] as const) {
  const tips = dealTipsFor(input);
  check(
    tips.length >= 2,
    `קלט ${JSON.stringify(input)} מחזיר את האזהרות הכלליות`,
    `${tips.length} אזהרות`,
  );
}

check(
  dealTipsFor(null).every((t) => t.title && t.why),
  "לכל אזהרה יש כותרת ונימוק",
  "אזהרה בלי 'למה' היא הטפה",
);

/* --- הסיכון משנה טון ולא תוכן --------------------------------------------- */

console.log("\nטון מול תוכן\n");

/*
 * זו ההחלטה המרכזית. אם מודעה שסומנה הייתה מקבלת רשימה ארוכה יותר,
 * המשמעות הנלמדת היא שכשאין דגל — אין צורך לבדוק. הבדיקות הנכונות
 * נכונות גם בעסקה תקינה לחלוטין.
 */
check(
  JSON.stringify(dealTipsFor("vehicles")) === JSON.stringify(dealTipsFor("vehicles")),
  "אותה קטגוריה מחזירה תמיד אותה רשימה",
);
check(
  dealHeadline(true) !== dealHeadline(false),
  "מודעה שסומנה מקבלת כותרת אחרת",
  dealHeadline(true),
);
check(
  !dealHeadline(false).includes("סומנה"),
  "מודעה רגילה לא נקראת כמו חשד",
  dealHeadline(false),
);

/* --- ניסוח --------------------------------------------------------------- */

console.log("\nניסוח\n");

/*
 * הרשימה מדברת אל הקונה ולא על המוכר. מילה כמו "רמאי" או "נוכל"
 * הופכת את הלוח לעוין כלפי הרוב הישר, וגם נקראת פחות.
 */
const ACCUSATORY = ["רמאי", "נוכל", "גנב", "שקרן"];
const all = ROOTS.flatMap((r) => dealTipsFor(r));
check(
  !all.some((t) => ACCUSATORY.some((w) => t.title.includes(w) || t.why.includes(w))),
  "אין ניסוח שמאשים את המוכר",
  `${all.length} אזהרות נבדקו`,
);

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות אזהרות העסקה עברו");
