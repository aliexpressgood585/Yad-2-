/**
 * בדיקות אבטחה שאפשר לאכוף בקוד.
 *
 * שלוש מהן תפסו תקלות אמיתיות בפרויקט הזה: מסלולים רגישים בלי הגבלת
 * קצב, כותרות אבטחה שנשמטו, ומספר טלפון שדלף למטען של הדף.
 */
import fs from "node:fs";
import path from "node:path";

let failed = 0;
function check(ok: boolean, label: string, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed++;
}

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

console.log("\nאבטחה\n");

/* --- כותרות --- */
const config = read("next.config.ts");
for (const header of [
  "Content-Security-Policy",
  "Strict-Transport-Security",
  "X-Frame-Options",
  "Referrer-Policy",
  "X-Content-Type-Options",
  "Permissions-Policy",
]) {
  check(config.includes(header), `כותרת ${header}`);
}
check(
  /connect-src[^"`]*sentry/.test(config),
  "ה-CSP מתיר דיווח ל-Sentry",
  "בלעדיו כל שגיאה נחסמת בשקט",
);

/* --- הגבלת קצב על מסלולים רגישים --- */
const RATE_LIMITED: [string, string][] = [
  ["src/app/api/auth/otp/route.ts", "OTP"],
  ["src/app/api/auth/register/route.ts", "הרשמה"],
  ["src/app/api/listings/route.ts", "פרסום"],
  ["src/app/api/listings/[id]/reveal/route.ts", "חשיפת טלפון"],
  ["src/app/api/messages/route.ts", "הודעות"],
  ["src/app/api/boosts/route.ts", "קידום"],
  ["src/app/api/upload/route.ts", "העלאת קבצים"],
];
for (const [file, label] of RATE_LIMITED) {
  check(read(file).includes("enforceRateLimit"), `הגבלת קצב — ${label}`);
}
check(
  read("src/lib/auth.ts").includes('rateLimit("login"'),
  "הגבלת קצב — התחברות",
  "המגבלה הייתה מוגדרת ומעולם לא נאכפה",
);

/* --- הטלפון אינו נשלף בשרת אלא במסלול החשיפה --- */
const leaks = ["src/lib/listings.ts", "src/lib/listing-dto.ts"].filter((f) =>
  read(f).includes("contactPhone"),
);
check(
  leaks.length === 0,
  "מספר הטלפון אינו נכנס למטען המודעה",
  leaks.length ? leaks.join(", ") : "רק מסלול החשיפה קורא אותו",
);

/* --- נתוני הדגמה --- */
check(
  read("src/lib/db.ts").includes("demoDataAllowed"),
  "סינון נתוני הדגמה קיים ברמת ה-client",
);
check(
  read("prisma/seed.ts").includes("assertSeedTarget"),
  "הזריעה מוגנת מפני מסד פרודקשן",
);

console.log();
if (failed) process.exit(1);
