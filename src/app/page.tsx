import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, Map as MapIcon, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { CategoryIcon } from "@/components/category-icon";
import { HomeHero } from "@/components/home/home-hero";
import { RecentlyViewed } from "@/components/home/recently-viewed";
import { ListingGrid, ListingGridSkeleton } from "@/components/listing/listing-grid";
import { Button } from "@/components/ui/button";
import { getCategoryTree } from "@/lib/categories";
import { toListingCardDtos } from "@/lib/listing-dto";
import { searchListingCards } from "@/lib/listings";
import { prisma } from "@/lib/db";

/** דף הבית מתרענן כל 5 דקות (ISR) — התוכן משתנה לאט יחסית. */
export const revalidate = 300;

const ADVANTAGES = [
  {
    icon: Zap,
    title: "בלי עומס פרסומות",
    body: "עמוד נקי, טעינה מהירה, וכל תשומת הלב על המודעות עצמן.",
  },
  {
    icon: ShieldCheck,
    title: "אמינות מוכרים",
    body: "ותק, אימות טלפון, דירוגים אמיתיים וזמן תגובה ממוצע — הכול גלוי.",
  },
  {
    icon: Sparkles,
    title: "התראות חכמות",
    body: "שומרים חיפוש ומקבלים הודעה ברגע שמתפרסמת מודעה שמתאימה בדיוק.",
  },
];

export default async function HomePage() {
  const [tree, promoted, latest, stats] = await Promise.all([
    getCategoryTree(),
    searchListingCards({ promotedOnly: true, withImages: true, perPage: 4, sort: "date" }),
    searchListingCards({ withImages: true, perPage: 12, sort: "date" }),
    prisma.listing.count({ where: { status: "ACTIVE", deletedAt: null } }),
  ]);

  return (
    <>
      <HomeHero categories={tree} totalListings={stats} />

      <div className="container space-y-12 py-10">
        {/* --- קטגוריות --- */}
        <section aria-labelledby="categories-heading">
          <h2 id="categories-heading" className="mb-4 font-heading text-xl font-bold">
            עיון לפי קטגוריה
          </h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {tree.map((category) => (
              <li key={category.id}>
                {/*
                 * `aria-label` מפורש: בלי זה שם הקטגוריה ורשימת התתי
                 * נדבקים בשם הנגיש לכלל אחד ("רכברכב פרטי · ג'יפים").
                 * רשימת התתי היא תצוגה מקדימה חזותית — כל אחת מהן
                 * נגישה בדף הקטגוריה עצמו — ולכן היא מוסתרת מהקורא.
                 */}
                <Link
                  href={`/${category.slug}`}
                  aria-label={category.name}
                  className="group flex h-full flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-all hover:border-primary hover:shadow-lifted"
                >
                  {/*
                   * האייקון אינו ענבר במנוחה.
                   * ענבר הוא צבע הקריאה, ושבעה ריבועי ענבר בדף הבית הופכים
                   * אותו לקישוט — ואז מחוג ענבר בשורת תוצאות כבר לא אומר
                   * כלום. הצבע נכנס בריחוף, כשיש כוונת פעולה.
                   */}
                  <span className="grid size-11 place-items-center bg-secondary text-muted-foreground transition-colors duration-ui ease-ui group-hover:text-primary">
                    <CategoryIcon name={category.icon} className="size-5" />
                  </span>
                  <span className="font-heading font-bold">{category.name}</span>
                  <span aria-hidden className="line-clamp-2 text-xs text-muted-foreground">
                    {category.children
                      .slice(0, 4)
                      .map((c) => c.name)
                      .join(" · ")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* --- מודעות מקודמות --- */}
        {promoted.items.length ? (
          <section aria-labelledby="promoted-heading">
            <div className="mb-4 flex items-end justify-between gap-3">
              <h2 id="promoted-heading" className="font-heading text-xl font-bold">
                מודעות מקודמות
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/search?promoted=1">
                  הכול
                  <ArrowLeft aria-hidden />
                </Link>
              </Button>
            </div>
            <ListingGrid listings={toListingCardDtos(promoted.items, promoted.meters)} priorityCount={4} />
          </section>
        ) : null}

        {/* --- נצפו לאחרונה (מקומי בדפדפן) --- */}
        <Suspense fallback={null}>
          <RecentlyViewed />
        </Suspense>

        {/*
         * --- מודעות אחרונות ---
         *
         * כותרת בלי תוכן היא הבטחה שהופרה, והיא נראית כמו תקלה גם
         * כשהיא נכונה. אין מודעות שעונות לתנאי — הסקציה לא קיימת.
         */}
        {latest.items.length ? (
        <section aria-labelledby="latest-heading">
          <div className="mb-4 flex items-end justify-between gap-3">
            <h2 id="latest-heading" className="font-heading text-xl font-bold">
              נוספו עכשיו ללוח
            </h2>
            <Button asChild variant="ghost" size="sm">
              <Link href="/search">
                לכל המודעות
                <ArrowLeft aria-hidden />
              </Link>
            </Button>
          </div>
          <Suspense fallback={<ListingGridSkeleton count={12} />}>
            <ListingGrid listings={toListingCardDtos(latest.items, latest.meters)} priorityCount={0} />
          </Suspense>
        </section>
        ) : null}

        {/* --- יתרונות --- */}
        <section aria-labelledby="advantages-heading" className="rounded-2xl bg-muted/40 p-6 sm:p-8">
          <h2 id="advantages-heading" className="mb-5 font-heading text-xl font-bold">
            למה דווקא כאן
          </h2>
          <ul className="grid gap-5 sm:grid-cols-3">
            {ADVANTAGES.map((a) => (
              <li key={a.title} className="flex gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-background text-primary shadow-lifted">
                  <a.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h3 className="font-heading font-bold">{a.title}</h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">{a.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* --- מפה --- */}
        <section className="overflow-hidden rounded-2xl border border-border bg-gradient-to-l from-primary/10 to-transparent p-6 sm:p-8">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
              <MapIcon className="size-6" aria-hidden />
            </span>
            <div className="flex-1">
              <h2 className="font-heading text-xl font-bold">מה יש לידי עכשיו?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                תצוגת מפה עם כל המודעות הפעילות, קיבוץ אשכולות וסינון לפי רדיוס.
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/map">פתיחת המפה</Link>
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
