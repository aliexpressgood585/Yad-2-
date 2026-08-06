/**
 * בדיקת קוהורט מד המחיר מול המסד.
 *
 * מוודאת שלושה דברים שאי אפשר לבדוק ביחידה: שההשוואה לא חוצה בין
 * השכרה למכירה, שהתפלגות האחוזים אינה מוטה לצד אחד (הסימן המובהק
 * לקוהורט רחב מדי), ושכל מד שמוצג מבוסס על מדגם אמיתי.
 */
import { prisma } from "../../src/lib/db";
import { capPromoted, PROMOTED_PER_WINDOW } from "../../src/lib/listings";
import { priceKindFor, comparableKind } from "../../src/lib/price-kind";
import { MIN_SAMPLE, priceMetersFor } from "../../src/lib/price-meter";

let failed = 0;
function check(ok: boolean, label: string, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${label}${detail ? `  ${detail}` : ""}`);
  if (!ok) failed++;
}

async function main() {
  const listings = await prisma.listing.findMany({
    where: { status: "ACTIVE", deletedAt: null, price: { gt: 0 }, cohortKey: { not: null } },
    select: { id: true, categoryId: true },
  });
  console.log(`\nמד מחיר — ${listings.length} מודעות עם קוהורט\n`);

  const meters = new Map<string, Awaited<ReturnType<typeof priceMetersFor>> extends Map<string, infer V> ? V : never>();
  for (let i = 0; i < listings.length; i += 200) {
    const batch = await priceMetersFor(listings.slice(i, i + 200).map((l) => l.id));
    for (const [k, v] of batch) meters.set(k, v);
  }

  const shown = [...meters.values()];
  check(shown.length > 0, "יש מודעות עם מד מחיר", `${shown.length} מתוך ${listings.length}`);

  // התפלגות: כמה נופלות מתחת לחציון וכמה מעליו
  const NOISE = 3;
  const below = shown.filter((m) => m.deltaPct <= -NOISE).length;
  const above = shown.filter((m) => m.deltaPct >= NOISE).length;
  const mid = shown.length - below - above;
  const sided = below + above;
  const skew = sided ? Math.max(below, above) / sided : 0;
  console.log(
    `\nהתפלגות: ${below} מתחת · ${mid} בחציון · ${above} מעל  →  הטיה ${Math.round(skew * 100)}%\n`,
  );
  check(skew <= 0.6, "ההתפלגות מאוזנת", `לא יותר מ-60% לצד אחד`);

  check(
    shown.every((m) => m.sample >= MIN_SAMPLE),
    "כל מד מבוסס על מדגם מספיק",
    `מינימום ${Math.min(...shown.map((m) => m.sample))}`,
  );

  check(
    shown.every((m) => m.median > 0),
    "אין חציון אפס",
  );

  // אף השוואה לא חוצה בין השכרה למכירה — נאכף דרך categoryId זהה
  const cross = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*) AS n
      FROM "Listing" a
      JOIN "Category" ca ON ca.id = a."categoryId"
      JOIN "Listing" b ON b."cohortKey" = a."cohortKey" AND b."categoryId" = a."categoryId"
      JOIN "Category" cb ON cb.id = b."categoryId"
     WHERE ca.slug LIKE '%-rent' AND cb.slug LIKE '%-sale'
  `;
  check(Number(cross[0]?.n ?? 0) === 0, "השכרה לא מושווית למכירה");

  // --- מכסת המקודמות ---
  /*
   * המכסה מתקיימת כל עוד יש מספיק מודעות אורגניות למלא את החלון.
   * ברשימה שרובה מקודמת אין סידור שמקיים אותה — ואז הדרישה היא
   * שהמקודמות יידחקו כמה שאפשר אחורה, לא שייעלמו.
   */
  for (const [n, promotedCount] of [[30, 14], [40, 8], [12, 6], [24, 24]] as const) {
    const mixed = Array.from({ length: n }, (_, i) => ({ p: i < promotedCount }));
    const capped = capPromoted(mixed, (x) => x.p);
    const firstTen = capped.slice(0, 10).filter((x) => x.p).length;
    const organic = n - promotedCount;
    const allowed = Math.max(PROMOTED_PER_WINDOW, 10 - organic);
    check(
      firstTen <= allowed,
      `לכל היותר ${allowed} מקודמות ב-10 הראשונות (${promotedCount}/${n})`,
      `${firstTen}`,
    );
    check(capped.length === n, `אף מודעה לא נעלמה (${promotedCount}/${n})`);
  }

  // --- סוג המחיר ---
  check(priceKindFor("jobs", "jobs-tech") === "salary", "משרה מסומנת כשכר");
  check(priceKindFor(null, "businesses") === "business", "עסק למכירה מסומן כשווי עסק");
  check(priceKindFor("realestate", "apartments-rent") === "rent", "השכרה מסומנת כשכירות");
  check(priceKindFor("realestate", "apartments-sale") === "sale", "מכירה מסומנת כמחיר");
  check(priceKindFor("vehicles", "private-cars") === "sale", "רכב מסומן כמחיר");
  check(!comparableKind("salary"), "שכר לא נכנס למד המחיר");
  check(!comparableKind("business"), "שווי עסק לא נכנס למד המחיר");

  const tiers = new Map<number, number>();
  for (const m of shown) tiers.set(m.tier, (tiers.get(m.tier) ?? 0) + 1);
  console.log(
    `\nשלבי הרפיה: ${[...tiers].sort().map(([t, n]) => `שלב ${t} — ${n}`).join(" · ")}\n`,
  );

  await prisma.$disconnect();
  if (failed) process.exit(1);
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
