/**
 * בדיקות כסף.
 *   npm run check:money
 *
 * שתי משפחות של באגים נבדקות כאן, ושתיהן מתגלות בחשבונית ולא בקוד:
 *
 *   **נקודה צפה.** `0.1 + 0.2` אינו `0.3`. סכום שמחושב בשקלים יוצא
 *   אגורה מהחשבון פעם באלף, במסמך שיש לו תוקף משפטי.
 *
 *   **מע"מ בכיוון הלא נכון.** מחיר לצרכן בישראל כולל מע"מ. חישוב
 *   `price * 0.18` נותן מספר שנראה סביר לגמרי ואינו רכיב המע"מ של
 *   הסכום — הוא גדול ממנו ב-18%.
 *
 * הבדיקות טהורות ואינן דורשות בסיס נתונים.
 */
import {
  DEALER_PLANS,
  FREE_BUSINESS_QUOTA,
  VAT_RATE,
  agorotToShekels,
  planById,
  shekelsToAgorot,
  vatFromGross,
} from "../../src/lib/plans";
import { invoiceNumber } from "../../src/lib/orders";
import { BOOST_PACKAGES } from "../../src/lib/site";

let failed = 0;

function check(ok: boolean, what: string, detail = "") {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${what}${detail ? `  ${detail}` : ""}`);
}

/* --- אגורות ---------------------------------------------------------------- */

console.log("סכומים באגורות\n");

check(shekelsToAgorot(19) === 1900, "₪19 → 1900 אגורות");
check(shekelsToAgorot(0.1) + shekelsToAgorot(0.2) === 30, "0.1 + 0.2 = 0.3 באגורות");
check(Number.isInteger(shekelsToAgorot(149)), "התוצאה תמיד שלמה");
check(agorotToShekels(1900) === 19, "המרה חזרה");

for (const pkg of BOOST_PACKAGES) {
  check(
    Number.isInteger(shekelsToAgorot(pkg.priceIls)),
    `חבילת "${pkg.name}" מתורגמת לאגורות בלי שארית`,
    `${shekelsToAgorot(pkg.priceIls)}`,
  );
}

/* --- מע"מ ------------------------------------------------------------------ */

console.log('\nמע"מ מתוך מחיר לצרכן\n');

/*
 * ₪19 כולל מע"מ 18%: הבסיס הוא 19/1.18 = 16.10, והמע"מ 2.90.
 * חישוב שגוי (19 × 0.18 = 3.42) נראה סביר לגמרי ואינו נכון.
 */
const vat19 = vatFromGross(1900);
check(vat19 === 290, "₪19 כולל מע\"מ → 290 אגורות מע\"מ", `${vat19}`);
check(vat19 !== Math.round(1900 * VAT_RATE), 'החישוב אינו "סכום × שיעור"', `${Math.round(1900 * VAT_RATE)} היה שגוי`);

for (const gross of [1900, 3900, 8900, 14900, 39900, 89900]) {
  const vat = vatFromGross(gross);
  const net = gross - vat;
  // הבסיס בתוספת המע"מ חייב לחזור בדיוק לסכום, בלי אגורה שנעלמת
  check(net + vat === gross, `${gross} אגורות: בסיס + מע"מ = הסכום`, `${net} + ${vat}`);
  check(
    Math.abs(net * (1 + VAT_RATE) - gross) < 1,
    `${gross} אגורות: הבסיס אכן נותן את הסכום בתוספת מע"מ`,
  );
}

check(vatFromGross(0) === 0, "סכום אפס — מע\"מ אפס");

/* --- חבילות ---------------------------------------------------------------- */

console.log("\nחבילות המנוי\n");

check(DEALER_PLANS.length >= 3, "לפחות שלוש חבילות", `${DEALER_PLANS.length}`);
check(
  DEALER_PLANS.every((p) => p.priceIls > 0),
  "לכל חבילה יש מחיר",
);
check(
  new Set(DEALER_PLANS.map((p) => p.id)).size === DEALER_PLANS.length,
  "מזהי החבילות ייחודיים",
);

/*
 * המחיר והמכסה חייבים לעלות יחד. חבילה יקרה יותר עם מכסה קטנה יותר
 * היא טבלת תמחור שאיש אינו יכול להסביר, וזה קורה בשקט כשמישהו מעדכן
 * מחיר בלי לבדוק את הסדר.
 */
const sorted = [...DEALER_PLANS].sort((a, b) => a.priceIls - b.priceIls);
let monotonic = true;
for (let i = 1; i < sorted.length; i++) {
  const previous = sorted[i - 1]!.listingQuota;
  const current = sorted[i]!.listingQuota;
  if (previous === null) monotonic = false;
  else if (current !== null && current <= previous) monotonic = false;
}
check(monotonic, "מחיר גבוה יותר → מכסה גדולה יותר");
check(
  sorted[0]!.listingQuota !== null && sorted[0]!.listingQuota > FREE_BUSINESS_QUOTA,
  "החבילה הזולה נותנת יותר מהמכסה החינמית",
  `${sorted[0]!.listingQuota} מול ${FREE_BUSINESS_QUOTA}`,
);
check(planById("pro")?.name === "מקצועי", "חיפוש חבילה לפי מזהה");
check(planById("nope") === undefined, "מזהה לא קיים מחזיר undefined");

/* --- מספר חשבונית ---------------------------------------------------------- */

console.log("\nמספר חשבונית\n");

const jan = new Date("2026-01-15T10:00:00Z");
check(invoiceNumber({ number: 42 }, jan) === "2026-000042", "שנה ומספר מרופד", invoiceNumber({ number: 42 }, jan));
check(
  invoiceNumber({ number: 42 }, jan) !== invoiceNumber({ number: 43 }, jan),
  "הזמנות שונות — מספרים שונים",
);
check(
  invoiceNumber({ number: 42 }, jan) !== invoiceNumber({ number: 42 }, new Date("2027-01-01")),
  "אותו מספר הזמנה בשנה אחרת אינו מתנגש",
);

if (failed) {
  console.error(`\n${failed} בדיקות נכשלו`);
  process.exit(1);
}
console.log("\nכל בדיקות הכסף עברו");
