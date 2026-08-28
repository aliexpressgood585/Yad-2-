import { prisma } from "@/lib/db";
import { deliverNow, enqueueNotifications } from "@/lib/notification-queue";

/**
 * ארבעת הטריגרים של לולאת ההחזרה.
 *
 *   1. מודעה חדשה שתואמת חיפוש שמור   (cron)
 *   2. ירידת מחיר במודעה שסימנתם      (בעדכון מודעה)
 *   3. הודעה חדשה בצ׳אט                (בשליחת הודעה)
 *   4. מודעה שלכם עומדת לפוג           (cron)
 *
 * כולם נכנסים לתור ואף אחד מהם אינו שולח בעצמו. זו ההפרדה שמאפשרת את
 * הקיבוץ ואת שעות השקט: הטריגר יודע *מה קרה*, והתור מחליט *מה נשלח,
 * למי ומתי*. ראה `notification-queue.ts`.
 *
 * הקובץ נפרד מ-`notifications.ts` כדי לשבור מעגל ייבוא: התור קורא
 * ל-`createNotification` שם, והטריגרים קוראים לתור.
 */

/**
 * מפתח הייחודיות של אירוע.
 *
 * חייב להיות יציב על פני ריצות: אותו אירוע שנרשם שוב — cron שרץ
 * פעמיים, ניסיון חוזר אחרי נפילה, שתי בקשות מקבילות — חייב לייצר את
 * אותו מפתח בדיוק, אחרת ההגנה מפני שליחה כפולה אינה קיימת.
 */
function key(...parts: (string | number)[]): string {
  return parts.join(":");
}

/* --- 3 · הודעה חדשה בצ׳אט ------------------------------------------------- */

/**
 * הודעה בצ׳אט. נכנסת לתור ומיד נעשה ניסיון לשלוח אותה.
 *
 * הסדר הזה הוא העיקר: קודם נרשם האירוע (ולכן הוא לא ילך לאיבוד אם
 * השליחה תיפול, ולא יישלח פעמיים אם הבקשה תנוסה שוב), ורק אחר כך
 * מנוסה השליחה המיידית. בשעת שקט `deliverNow` פשוט דוחה אותה, ואיש
 * לא כתב שורת טיפול נפרדת לשעות שקט בצ׳אט.
 *
 * המפתח כולל את מזהה ההודעה, כדי ששתי הודעות שונות באותה שיחה יהיו
 * שני אירועים — ובכל זאת יתקבצו להתראה אחת אם הגיעו יחד.
 */
export async function notifyNewMessage(input: {
  recipientId: string;
  messageId: string;
  senderName: string;
  conversationId: string;
  listingTitle: string;
  preview: string;
}) {
  await enqueueNotifications([
    {
      userId: input.recipientId,
      type: "NEW_MESSAGE",
      dedupeKey: key("message", input.messageId, input.recipientId),
      payload: {
        senderName: input.senderName,
        conversationId: input.conversationId,
        listingTitle: input.listingTitle,
        preview: input.preview,
      },
    },
  ]);

  await deliverNow(input.recipientId);
}

/* --- 1 · מודעה חדשה בחיפוש שמור ------------------------------------------- */

/**
 * התאמה לחיפוש שמור.
 *
 * המפתח כולל את חותמת ההרצה ולא את מספר התוצאות: אותה הרצת cron לא
 * תייצר שתי התראות לאותו חיפוש, אבל הרצה של מחר כן תוכל — וזה בדיוק
 * ההתנהגות הרצויה.
 */
export async function notifySavedSearchMatch(input: {
  userId: string;
  searchId: string;
  searchName: string;
  count: number;
  runStamp: string;
}) {
  await enqueueNotifications([
    {
      userId: input.userId,
      type: "SAVED_SEARCH_MATCH",
      dedupeKey: key("saved-search", input.searchId, input.runStamp),
      payload: {
        searchName: input.searchName,
        count: input.count,
        url: `/my/searches?highlight=${input.searchId}`,
      },
    },
  ]);
}

/* --- 4 · מודעה שעומדת לפוג ------------------------------------------------ */

/**
 * המפתח כולל את מזהה המודעה בלבד, בלי תאריך: מודעה מתריעה פעם אחת על
 * כך שהיא עומדת לפוג, גם אם ה-cron ירוץ שוב מחר וגם אם יופעל ידנית
 * חמש פעמים.
 */
export async function notifyListingExpiring(input: {
  userId: string;
  listingId: string;
  listingTitle: string;
  daysLeft: number;
  expiresAt: Date;
}) {
  await enqueueNotifications([
    {
      userId: input.userId,
      type: "LISTING_EXPIRING",
      dedupeKey: key("expiring", input.listingId, input.expiresAt.toISOString().slice(0, 10)),
      payload: {
        listingTitle: input.listingTitle,
        daysLeft: input.daysLeft,
        url: "/my/listings",
      },
    },
  ]);
}

/* --- 2 · ירידת מחיר במועדף ------------------------------------------------ */

/**
 * הסף שמתחתיו ירידת מחיר אינה אירוע.
 *
 * ירידה של ₪50 על רכב ב-₪80,000 אינה חדשה, והתראה עליה היא בדיוק סוג
 * הרעש שגורם לאנשים לכבות התראות. שלושה אחוזים הם הסף שבו הירידה
 * מתחילה להיות סיבה לחזור ולהסתכל.
 */
export const MIN_PRICE_DROP_RATIO = 0.03;

/**
 * ירידת מחיר במודעה שמישהו סימן כמועדפת.
 *
 * נקראת מנתיב עדכון המודעה. הבעלים אינו מקבל התראה על המחיר שהוא עצמו
 * שינה, גם אם סימן את המודעה שלו.
 *
 * המפתח כולל את המחיר החדש, ולכן: הורדה מ-100 ל-90 מתריעה; שמירה חוזרת
 * של 90 לא; ירידה נוספת ל-80 מתריעה שוב; והחזרה ל-90 אחרי 80 לא
 * מתריעה, כי זו כבר לא ירידה.
 */
export async function notifyPriceDrop(input: {
  listingId: string;
  listingTitle: string;
  listingSlug: string;
  ownerId: string;
  oldPrice: number;
  newPrice: number;
}): Promise<number> {
  const drop = input.oldPrice - input.newPrice;
  if (drop <= 0) return 0;
  if (drop / input.oldPrice < MIN_PRICE_DROP_RATIO) return 0;

  const favorites = await prisma.favorite.findMany({
    where: { listingId: input.listingId, userId: { not: input.ownerId } },
    select: { userId: true },
    take: 1000,
  });
  if (!favorites.length) return 0;

  return enqueueNotifications(
    favorites.map((f) => ({
      userId: f.userId,
      type: "PRICE_DROP" as const,
      dedupeKey: key("price-drop", input.listingId, input.newPrice, f.userId),
      payload: {
        listingTitle: input.listingTitle,
        oldPrice: input.oldPrice,
        newPrice: input.newPrice,
        url: `/item/${input.listingSlug}`,
      },
    })),
  );
}
