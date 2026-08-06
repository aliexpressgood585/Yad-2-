/**
 * מחיקת כל נתוני ההדגמה — `npm run demo:purge`.
 *
 * מוחק מודעות ומשתמשים שמסומנים `isDemo`, ואיתם כל מה שתלוי בהם:
 * תמונות, שדות, שיחות, הודעות, מועדפים, דירוגים, דיווחים והתראות.
 * המחיקות הנלוות נעשות דרך `onDelete: Cascade` בסכימה, ומה שאינו
 * מדורג נמחק כאן במפורש.
 *
 * הרצה מול פרודקשן **מותרת** ואף רצויה — זו בדיוק הפקודה שמנקה את
 * הלוח לפני שמשתמשים אמיתיים נכנסים אליו.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const dry = process.argv.includes("--dry-run");

  const listings = await prisma.listing.count({ where: { isDemo: true } });
  const users = await prisma.user.count({ where: { isDemo: true } });

  console.log(`\nנתוני הדגמה במסד: ${listings} מודעות, ${users} משתמשים`);
  if (!listings && !users) {
    console.log("אין מה למחוק.\n");
    return;
  }
  if (dry) {
    console.log("(--dry-run — לא נמחק דבר)\n");
    return;
  }

  /*
   * סדר המחיקה חשוב: שיחות והודעות תלויות במודעה **ובמשתמש**, ומחיקת
   * המשתמש קודם הייתה מפילה את המחיקה על מפתח זר. מודעות תחילה,
   * ואחריהן המשתמשים שנשארו בלי כלום.
   */
  const conversations = await prisma.conversation.deleteMany({
    where: {
      OR: [
        { listing: { isDemo: true } },
        { buyer: { isDemo: true } },
        { seller: { isDemo: true } },
      ],
    },
  });
  const reviews = await prisma.review.deleteMany({
    where: { OR: [{ author: { isDemo: true } }, { target: { isDemo: true } }] },
  });
  const deletedListings = await prisma.listing.deleteMany({ where: { isDemo: true } });
  const deletedUsers = await prisma.user.deleteMany({ where: { isDemo: true } });

  console.log(
    [
      `  ✓ ${conversations.count} שיחות`,
      `  ✓ ${reviews.count} דירוגים`,
      `  ✓ ${deletedListings.count} מודעות (כולל תמונות, שדות ומועדפים)`,
      `  ✓ ${deletedUsers.count} משתמשים`,
    ].join("\n"),
  );

  const left = await prisma.listing.count({ where: { isDemo: true } });
  console.log(`\n${left === 0 ? "✓ הלוח נקי מנתוני הדגמה." : `✗ נשארו ${left} מודעות דמו.`}\n`);
  if (left) process.exit(1);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
