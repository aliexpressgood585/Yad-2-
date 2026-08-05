import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatNumber, formatPrice } from "@/lib/format";
import { priceMetersFor } from "@/lib/price-meter";
import { PriceMeter } from "@/components/listing/price-meter";

export const metadata: Metadata = { title: "לוח הסוחר" };
export const dynamic = "force-dynamic";

/** כמה מודעות להציג בטבלה. מעבר לזה הסוחר עובר לניהול המודעות. */
const ROWS = 60;

/**
 * לוח הסוחר.
 *
 * שונה מ"המודעות שלי" בשאלה שהוא עונה עליה. "המודעות שלי" הוא ניהול —
 * מה פעיל, מה פג, מה לערוך. כאן השאלה היא **מה עובד**: איזה פריט
 * במלאי מושך פניות, איזה יושב שבועות בלי אף אחת, ואיפה המחיר עומד
 * מול השוק.
 *
 * לכן העמודות הן צפיות, פניות, וסקאלת המחיר — ולא סטטוס ותאריך.
 */
export default async function DealerDashboard() {
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/login?callbackUrl=/my/business");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessName: true, businessSlug: true },
  });

  if (!user?.businessName) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-heading text-xl font-bold">לוח הסוחר</h1>
        <p className="max-w-prose text-muted-foreground">
          המסך הזה מיועד לחשבונות עסקיים. אפשר להפוך את החשבון לעסקי מהפרופיל,
          ואז יופיעו כאן ביצועי המלאי והייבוא המרוכז.
        </p>
        <Link href="/my/profile" className="text-info underline underline-offset-4">
          מעבר לפרופיל
        </Link>
      </div>
    );
  }

  const listings = await prisma.listing.findMany({
    where: { userId: session.user.id, deletedAt: null, status: { in: ["ACTIVE", "EXPIRED"] } },
    orderBy: { publishedAt: "desc" },
    take: ROWS,
    select: {
      id: true,
      slug: true,
      title: true,
      price: true,
      currency: true,
      status: true,
      viewCount: true,
      publishedAt: true,
    },
  });

  const ids = listings.map((l) => l.id);

  /*
   * פניות נספרות מטבלת המדידה ולא מ-`ListingDailyStat`.
   * הטבלה ההיא סופרת אירועים; כאן נספרים **אנשים** — זוגות ייחודיים של
   * (סשן, מודעה), בדיוק כמו מדד הצפון. אחרת מבקר אחד שחשף טלפון וגם
   * כתב היה נראה כשתי פניות, והסוחר היה מקבל תמונה ורודה מהמציאות.
   */
  const [meters, contactRows] = await Promise.all([
    priceMetersFor(ids),
    ids.length
      ? prisma.$queryRaw<{ listingId: string; contacts: bigint }[]>`
          SELECT "listingId", COUNT(*) AS contacts
          FROM (
            SELECT DISTINCT "listingId", "sessionId"
            FROM "FunnelEvent"
            WHERE step IN ('REVEAL', 'MESSAGE') AND "listingId" = ANY(${ids})
          ) c
          GROUP BY "listingId"
        `
      : Promise.resolve([]),
  ]);

  const contacts = new Map(contactRows.map((r) => [r.listingId, Number(r.contacts)]));

  const totalViews = listings.reduce((s, l) => s + l.viewCount, 0);
  const totalContacts = [...contacts.values()].reduce((s, n) => s + n, 0);
  const silent = listings.filter((l) => (contacts.get(l.id) ?? 0) === 0).length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-bold">{user.businessName}</h1>
          <p className="text-sm text-muted-foreground">ביצועי המלאי</p>
        </div>
        <Link
          href="/my/business/import"
          className="bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          ייבוא מרוכז מקובץ
        </Link>
      </header>

      <dl className="grid grid-cols-2 gap-px border border-border bg-border sm:grid-cols-4">
        {[
          { label: "מודעות", value: formatNumber(listings.length) },
          { label: "צפיות", value: formatNumber(totalViews) },
          { label: "פניות", value: formatNumber(totalContacts) },
          { label: "בלי אף פנייה", value: formatNumber(silent) },
        ].map((stat) => (
          <div key={stat.label} className="flex flex-col gap-1 bg-card p-4">
            <dt className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              {stat.label}
            </dt>
            <dd className="num font-heading text-2xl font-bold leading-none">{stat.value}</dd>
          </div>
        ))}
      </dl>

      {listings.length === 0 ? (
        <p className="border border-border bg-card p-6 text-center text-muted-foreground">
          אין עדיין מודעות פעילות. אפשר לייבא מלאי שלם מקובץ.
        </p>
      ) : (
        <div className="overflow-x-auto border border-border">
          <table className="w-full min-w-[46rem] bg-card">
            <thead>
              <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <th className="p-3 text-start font-bold">מודעה</th>
                <th className="p-3 text-start font-bold">מחיר</th>
                <th className="p-3 text-start font-bold">מול השוק</th>
                <th className="p-3 text-start font-bold">צפיות</th>
                <th className="p-3 text-start font-bold">פניות</th>
              </tr>
            </thead>
            <tbody>
              {listings.map((listing) => {
                const reached = contacts.get(listing.id) ?? 0;
                return (
                  <tr key={listing.id} className="border-b border-border last:border-b-0">
                    <td className="p-3">
                      <Link
                        href={`/item/${listing.slug}`}
                        className="font-medium hover:text-primary"
                      >
                        {listing.title}
                      </Link>
                      {listing.status === "EXPIRED" ? (
                        <span className="ms-2 text-xs text-accent">פג תוקף</span>
                      ) : null}
                    </td>
                    <td className="num p-3">
                      {formatPrice(listing.price, { currency: listing.currency })}
                    </td>
                    <td className="w-44 p-3">
                      <PriceMeter meter={meters.get(listing.id) ?? null} variant="column" />
                    </td>
                    <td className="num p-3">{formatNumber(listing.viewCount)}</td>
                    <td className="num p-3">
                      {/*
                       * אפס פניות מודגש ולא מוסתר. זו המספר היחיד בטבלה
                       * שמחייב פעולה — פריט שאיש לא פנה עליו הוא פריט
                       * שהמחיר או התמונות שלו לא עובדים.
                       */}
                      <span className={reached === 0 ? "text-accent" : undefined}>
                        {formatNumber(reached)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
