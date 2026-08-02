/**
 * בדיקות תקינות על הנתונים שנזרעו.
 *
 * מריצים אחרי `npm run db:seed`:  npm run check:seed
 * נכשל אם נמצאה מודעה עם ערך שלא שייך לתת-הקטגוריה שלה, או מוכר
 * שמפרסם מחוץ לענף שלו — שני באגים שהתגלו בפרודקשן.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type Failure = { check: string; detail: string };
const failures: Failure[] = [];

/** מזהי הקטגוריה עצמה וכל אבותיה — משם מגיעים השדות בירושה. */
async function ancestorIds(categoryId: string): Promise<string[]> {
  const ids: string[] = [];
  let current: string | null = categoryId;
  while (current) {
    ids.push(current);
    const row: { parentId: string | null } | null = await prisma.category.findUnique({
      where: { id: current },
      select: { parentId: true },
    });
    current = row?.parentId ?? null;
  }
  return ids;
}

/** כל ערך נבחר חייב להשתייך לשדה שהקטגוריה של המודעה באמת רואה. */
async function checkAttributeScope() {
  const rows = await prisma.listingAttribute.findMany({
    where: { valueId: { not: null } },
    select: {
      listing: { select: { slug: true, categoryId: true, category: { select: { name: true } } } },
      attribute: { select: { key: true, categoryId: true } },
      value: { select: { label: true } },
    },
  });

  const ancestorCache = new Map<string, string[]>();
  for (const row of rows) {
    const catId = row.listing.categoryId;
    if (!ancestorCache.has(catId)) ancestorCache.set(catId, await ancestorIds(catId));
    if (ancestorCache.get(catId)!.includes(row.attribute.categoryId)) continue;

    failures.push({
      check: "היקף שדות",
      detail: `${row.listing.slug} (${row.listing.category.name}) — "${row.attribute.key}" = "${row.value?.label}" מקטגוריה אחרת`,
    });
  }
}

/**
 * ערך של שדה SELECT חייב להיות אחת מהאפשרויות של אותו שדה.
 * תופס את המקרה שבו הגנרטור בחר מרשימה כללית במקום מרשימת העלה.
 */
async function checkSelectValues() {
  const attributes = await prisma.attribute.findMany({
    where: { type: { in: ["SELECT", "MULTISELECT"] } },
    select: { id: true, key: true, values: { select: { id: true } } },
  });

  for (const attr of attributes) {
    const allowed = new Set(attr.values.map((v) => v.id));
    const used = await prisma.listingAttribute.findMany({
      where: { attributeId: attr.id, valueId: { not: null } },
      select: { valueId: true, listing: { select: { slug: true } } },
    });
    for (const u of used) {
      if (u.valueId && !allowed.has(u.valueId)) {
        failures.push({
          check: "ערכי SELECT",
          detail: `${u.listing.slug} — "${attr.key}" מצביע לערך שלא קיים בשדה`,
        });
      }
    }
  }
}

/** לכל מוכר עסקי — כל המודעות שלו באותה קטגוריית שורש. */
async function checkDealerScope() {
  const dealers = await prisma.user.findMany({
    where: { businessName: { not: null } },
    select: {
      businessName: true,
      listings: {
        select: { slug: true, categoryId: true },
        where: { deletedAt: null },
      },
    },
  });

  const rootCache = new Map<string, string>();
  const rootOf = async (categoryId: string) => {
    if (rootCache.has(categoryId)) return rootCache.get(categoryId)!;
    const chain = await ancestorIds(categoryId);
    const root = chain[chain.length - 1]!;
    rootCache.set(categoryId, root);
    return root;
  };

  for (const dealer of dealers) {
    if (!dealer.listings.length) continue;
    const roots = new Set<string>();
    for (const l of dealer.listings) roots.add(await rootOf(l.categoryId));
    if (roots.size > 1) {
      const names = await prisma.category.findMany({
        where: { id: { in: [...roots] } },
        select: { name: true },
      });
      failures.push({
        check: "ענף מוכר",
        detail: `"${dealer.businessName}" מפרסם ב-${roots.size} ענפים: ${names.map((n) => n.name).join(", ")}`,
      });
    }
  }
}

/** שדה מספרי חייב לשבת בטווח שהוגדר לו. */
async function checkNumericRanges() {
  const rows = await prisma.listingAttribute.findMany({
    where: { valueNumber: { not: null } },
    select: {
      valueNumber: true,
      listing: { select: { slug: true } },
      attribute: { select: { key: true, min: true, max: true } },
    },
  });

  for (const row of rows) {
    const { min, max, key } = row.attribute;
    const n = row.valueNumber!;
    if ((min !== null && n < min) || (max !== null && n > max)) {
      failures.push({
        check: "טווח מספרי",
        detail: `${row.listing.slug} — "${key}" = ${n}, מחוץ לטווח ${min}–${max}`,
      });
    }
  }
}

async function main() {
  await checkAttributeScope();
  await checkSelectValues();
  await checkDealerScope();
  await checkNumericRanges();

  if (!failures.length) {
    console.log("✓ כל בדיקות הנתונים עברו");
    return;
  }

  const byCheck = new Map<string, string[]>();
  for (const f of failures) {
    byCheck.set(f.check, [...(byCheck.get(f.check) ?? []), f.detail]);
  }
  for (const [check, details] of byCheck) {
    console.error(`\n✗ ${check} — ${details.length} כשלים`);
    for (const d of details.slice(0, 8)) console.error(`   ${d}`);
    if (details.length > 8) console.error(`   … ועוד ${details.length - 8}`);
  }
  process.exitCode = 1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
