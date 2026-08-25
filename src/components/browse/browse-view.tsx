import Link from "next/link";
import { Suspense } from "react";

import { ActiveFilterChips } from "@/components/filters/active-filter-chips";
import { ParsedChips } from "@/components/browse/parsed-chips";
import { parseQuery } from "@/lib/search/parse-query";
import { DensityToggle } from "@/components/browse/density-toggle";
import { FilterPanel } from "@/components/filters/filter-panel";
import { MobileFilterSheet } from "@/components/filters/mobile-filter-sheet";
import { SortSelect } from "@/components/filters/sort-select";
import { SaveSearchButton } from "@/components/search/save-search-button";
import { InfiniteListings } from "@/components/listing/infinite-listings";
import { EmptyResults, ListingGridSkeleton } from "@/components/listing/listing-grid";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAttributesForCategory,
  getCategoryIdsWithDescendants,
  getCategoryPath,
  type CategoryNode,
} from "@/lib/categories";
import { parseFilters, toSearchQuery } from "@/lib/filters";
import { toListingCardDtos } from "@/lib/listing-dto";
import {
  countByAttributeValues,
  countByCategory,
  countByCity,
  priceBounds,
  searchListingCards,
} from "@/lib/listings";
import type { AttributeFacets } from "@/lib/listings";
import { PAGE_SIZE } from "@/lib/site";
import { Breadcrumbs } from "@/components/browse/breadcrumbs";
import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { formatCount } from "@/lib/format";

type Props = {
  category?: CategoryNode | null;
  searchParams: Record<string, string | string[] | undefined>;
  title: string;
  description?: string;
};

/**
 * המסך המשותף לדפי קטגוריה ולדף החיפוש.
 *
 * הכותרת ופירורי הלחם מרונדרים מיד, והחלק הכבד (שאילתות התוצאות,
 * הפאסטים וטווח המחירים) נטען בתוך גבול Suspense פנימי.
 * הגבול נמצא כאן ולא ב-`loading.tsx` בכוונה: קובץ loading היה מתחיל
 * להזרים תשובה עם סטטוס 200 עוד לפני שהעמוד מספיק לקרוא ל-`notFound()`,
 * וכתובת של קטגוריה לא קיימת הייתה מוחזרת כ-soft-404.
 */
export async function BrowseView({ category, searchParams, title, description }: Props) {
  const path = category ? await getCategoryPath(category.id) : [];

  return (
    <div className="container py-5">
      {path.length ? (
        <BreadcrumbJsonLd
          items={path.map((node, i) => ({
            name: node.name,
            path: i === 0 ? `/${node.slug}` : `/${path[0]!.slug}/${node.slug}`,
          }))}
        />
      ) : null}

      {path.length > 1 ? <Breadcrumbs path={path} /> : null}

      <header className="mb-4 mt-2">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>

      <Suspense key={JSON.stringify(searchParams)} fallback={<BrowseSkeleton />}>
        <BrowseResults
          category={category}
          searchParams={searchParams}
          title={title}
          rootSlug={path[0]?.slug ?? category?.slug}
        />
      </Suspense>
    </div>
  );
}

async function BrowseResults({
  category,
  searchParams,
  title,
  rootSlug,
}: Props & { rootSlug?: string }) {
  const state = parseFilters(searchParams);

  const [categoryIds, attributes] = category
    ? await Promise.all([
        getCategoryIdsWithDescendants(category.id),
        getAttributesForCategory(category.id),
      ])
    : [undefined, []];

  const query = toSearchQuery(state, attributes, { categoryIds, perPage: PAGE_SIZE });

  const [result, cityFacets, prices, catCounts, attrFacets] = await Promise.all([
    searchListingCards(query),
    countByCity(query),
    priceBounds(query),
    category?.children.length
      ? countByCategory({ ...query, categoryIds: undefined })
      : Promise.resolve(new Map<string, number>()),
    // ספירה לכל ערך בפילטר — "מעלית (31)" לפני הלחיצה
    countByAttributeValues(
      query,
      attributes.filter((a) => a.isFilter && a.type !== "NUMBER" && a.type !== "TEXT").map((a) => a.id),
    ),
  ]);

  const items = toListingCardDtos(result.items, result.meters);

  // אותו חילוץ שמזין את toSearchQuery, להצגה למשתמש
  const kept = new Set(state.keep ?? []);
  const parsedChips = state.q
    ? parseQuery(state.q).chips.filter((c) => !kept.has(c.key))
    : [];
  const hasQuery = Boolean(state.q);

  return (
    <>
      {/* תת-קטגוריות */}
      {category?.children.length ? (
        <nav aria-label="תת-קטגוריות" className="mb-4">
          <ul className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {category.children.map((child) => {
              const count = catCounts.get(child.id) ?? 0;
              return (
                <li key={child.id}>
                  <Link
                    href={`/${rootSlug ?? category.slug}/${child.slug}`}
                    className="flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
                  >
                    {child.name}
                    {count > 0 ? (
                      <span className="num text-xs text-muted-foreground">{count}</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {/*
       * הסימון הזה הוא מה שהופך את תיבת החיפוש בהדר לחיה: היא מעדכנת
       * תוך כדי הקלדה רק כשיש על המסך רשימת תוצאות לעדכן.
       */}
      <div data-live-search className="flex flex-col gap-6 lg:flex-row">
        {/* פילטרים — דסקטופ */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-32 max-h-[calc(100dvh-9rem)] overflow-y-auto pe-1">
            <FilterPanel
              attributes={attributes}
              cityFacets={cityFacets}
              priceRange={prices}
              priceLabel={category?.priceLabel}
              valueFacets={serializeFacets(attrFacets)}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {/*
           * כותרת לאזור התוצאות. כותרות המודעות הן h3, ובלי h2 ביניהן
           * לבין ה-h1 של הדף נוצרת קפיצת דרג — קורא מסך שמדלג בין
           * כותרות מאבד את הגבול בין הסינון לבין הרשימה.
           */}
          <h2 className="sr-only">תוצאות</h2>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              <span className="num font-semibold text-foreground">
                {formatCount(result.total)}
              </span>{" "}
              מודעות
            </p>

            <div className="ms-auto flex items-center gap-2">
              <SaveSearchButton defaultName={title} />
              <MobileFilterSheet
                attributes={attributes}
                cityFacets={cityFacets}
                priceRange={prices}
                priceLabel={category?.priceLabel}
                categorySlug={category?.slug}
                initialTotal={result.total}
                valueFacets={serializeFacets(attrFacets)}
              />
              <SortSelect hasQuery={hasQuery} />
              {/* גם בנייד: הצפיפות היא בדיוק ההעדפה שנלמדת, ובלי הכפתור
                  אי אפשר ללמד אותה */}
              <DensityToggle categorySlug={category?.slug} />
            </div>
          </div>

          <div className="mb-4 space-y-2">
            {/* מה שחולץ מהטקסט החופשי — גלוי והפיך */}
            <ParsedChips chips={parsedChips} />
            <ActiveFilterChips attributes={attributes} />
          </div>

          {items.length === 0 ? (
            /*
             * קטגוריה ריקה בלוח חדש אינה כישלון חיפוש — היא הזדמנות.
             * "אין תוצאות" מסיים את הביקור; הצעה לפרסם הופכת אותו
             * למודעה הראשונה. ההבחנה בין חיפוש שנכשל לבין קטגוריה
             * שעוד ריקה נעשית לפי `hasQuery`, כי הן שני מצבים שונים.
             */
            <EmptyResults
              title={
                hasQuery
                  ? `לא נמצאו תוצאות עבור "${state.q}"`
                  : "עוד לא פורסמו מודעות כאן"
              }
              body={
                hasQuery
                  ? "בדקו את האיות, נסו מילים כלליות יותר או הסירו חלק מהפילטרים."
                  : "הקטגוריה פתוחה ומחכה. מי שמפרסם ראשון מקבל את כל תשומת הלב שלה."
              }
              action={
                hasQuery ? (
                  /*
                   * חיפוש ללא תוצאות הוא ביקוש שהלוח עוד לא יודע
                   * לספק. "חזרה לדף הבית" מסיים את הביקור; שמירת
                   * החיפוש הופכת אותו להתראה, כלומר לסיבה לחזור —
                   * ובדרך גם אומרת לנו איזה היצע חסר.
                   */
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <SaveSearchButton
                      defaultName={state.q || title}
                      variant="default"
                      className="inline-flex"
                      showWhenAnonymous
                      label="נודיע לי כשתתפרסם מודעה מתאימה"
                    />
                    <Button asChild variant="outline">
                      <Link href="/">חזרה לדף הבית</Link>
                    </Button>
                  </div>
                ) : (
                  <Button asChild>
                    <Link href={category?.slug ? `/publish?category=${category.slug}` : "/publish"}>
                      רוצה להיות הראשון?
                    </Link>
                  </Button>
                )
              }
            />
          ) : (
            <InfiniteListings
              initialItems={items}
              initialHasMore={result.hasMore}
              total={result.total}
              categorySlug={category?.slug}
            />
          )}
        </div>
      </div>
    </>
  );
}

/**
 * מפות אינן ניתנות לסריאליזציה אל רכיב לקוח, ולכן הן נשלחות כאובייקט
 * שטוח: `attributeId` → ערך → ספירה.
 */
function serializeFacets(facets: AttributeFacets): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const [attributeId, byValue] of facets) {
    out[attributeId] = Object.fromEntries(byValue);
  }
  return out;
}

/** שלד התוצאות — מוצג בזמן שהשאילתות רצות בשרת. */
function BrowseSkeleton() {
  return (
    <>
      <div className="mb-4 flex gap-2 overflow-hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-28 shrink-0 rounded-full" />
        ))}
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="hidden w-64 shrink-0 space-y-3 lg:block">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-4 flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-10 w-44" />
          </div>
          <ListingGridSkeleton count={12} />
        </div>
      </div>
    </>
  );
}
