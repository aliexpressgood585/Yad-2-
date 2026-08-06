/**
 * שומר הסף של נתוני ההדגמה.
 *
 * הטעות שמוחקת מסד נתונים היא תמיד אותה טעות: מריצים `db:seed` מול
 * מסד שהוא לא זה שחשבו עליו. הזריעה מוחקת הכול לפני שהיא כותבת,
 * ואין ממנה חזרה.
 *
 * הבדיקה מבוססת על מארח ולא על משתנה סביבה, כי `NODE_ENV` בטרמינל
 * מקומי הוא כמעט תמיד `development` גם כשה-`DATABASE_URL` שהודבק
 * לשם הוא של פרודקשן — וזה בדיוק המקרה.
 */

/** מארחים שמותר לזרוע אליהם. */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "db", "postgres"]);

export type GuardResult = { ok: true } | { ok: false; reason: string };

export function checkSeedTarget(url: string | undefined): GuardResult {
  if (!url) return { ok: false, reason: "DATABASE_URL אינו מוגדר" };

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { ok: false, reason: "DATABASE_URL אינו כתובת תקינה" };
  }

  if (LOCAL_HOSTS.has(host)) return { ok: true };

  /*
   * `SEED_TARGET_OK` הוא שסתום לסביבת בדיקות מרוחקת (למשל שרת
   * ה-CI). הוא נדרש במפורש ולכן אי אפשר להיכנס אליו בטעות.
   */
  if (process.env.SEED_TARGET_OK === host) return { ok: true };

  return {
    ok: false,
    reason:
      `הזריעה מוחקת את כל התוכן, וה-DATABASE_URL מצביע על "${host}" ולא על מסד מקומי.\n` +
      `  אם זו באמת הכוונה: SEED_TARGET_OK=${host} npm run db:seed`,
  };
}

/** נועל את התהליך אם היעד אינו מקומי. */
export function assertSeedTarget(url = process.env.DATABASE_URL): void {
  const result = checkSeedTarget(url);
  if (result.ok) return;
  console.error(`\n✗ הזריעה נעצרה.\n  ${result.reason}\n`);
  process.exit(1);
}
