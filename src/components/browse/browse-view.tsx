import Link from "next/link";

import { ActiveFilterChips } from "@/components/filters/active-filter-chips";
import { FilterPanel } from "@/components/filters/filter-panel";
import { MobileFilterSheet } from "@/components/filters/mobile-filter-sheet";
import { SortSelect } from "@/components/filters/sort-select";
import { SaveSearchButton } from "@/components/search/save-search-button";
import { InfiniteListings } from "@/components/listing/infinite-listings";
import { EmptyResults } from "@/components/listing/listing-grid";
import { Button } from "@/components/ui/button";
import {
  getAttributesForCategory,
  getCategoryIdsWithDescendants,
  getCategoryPath,
  type CategoryNode,
} from "@/lib/categories";
import { parseFilters, toSearchQuery } from "@/lib/filters";
import { toListingCardDtos } from "@/lib/listing-dto";
import { countByCategory, countByCity, priceBounds, searchListingCards } from "@/lib/listings";
import { PAGE_SIZE } from "@/lib/site";
import { Breadcrumbs } from "@/components/browse/breadcrumbs";

type Props = {
  category?: CategoryNode | null;
  searchParams: Record<string, string | string[] | undefined>;
  title: string;
  description?: string;
};

/**
 * המסך המשותף לדפי קטגוריה ולדף החיפוש:
 * פילטרים דינמיים, מיון, ספירת תוצאות וגלילה אינסופית.
 */
export async function BrowseView({ category, searchParams, title, description }: Props) {
  const state = parseFilters(searchParams);

  const [categoryIds, attributes, path] = category
    ? await Promise.all([
        getCategoryIdsWithDescendants(category.id),
        getAttributesForCategory(category.id),
        getCategoryPath(category.id),
      ])
    : [undefined, [], []];

  const query = toSearchQuery(state, attributes, { categoryIds, perPage: PAGE_SIZE });

  const [result, cityFacets, prices, catCounts] = await Promise.all([
    searchListingCards(query),
    countByCity(query),
    priceBounds(query),
    category?.children.length
      ? countByCategory({ ...query, categoryIds: undefined })
      : Promise.resolve(new Map<string, number>()),
  ]);

  const items = toListingCardDtos(result.items);
  const hasQuery = Boolean(state.q);

  return (
    <div className="container py-5">
      {path.length > 1 ? <Breadcrumbs path={path} /> : null}

      <header className="mb-4 mt-2">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </header>

      {/* תת-קטגוריות */}
      {category?.children.length ? (
        <nav aria-label="תת-קטגוריות" className="mb-4">
          <ul className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {category.children.map((child) => {
              const count = catCounts.get(child.id) ?? 0;
              return (
                <li key={child.id}>
                  <Link
                    href={`/${path[0]?.slug ?? category.slug}/${child.slug}`}
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

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* פילטרים — דסקטופ */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-32 max-h-[calc(100dvh-9rem)] overflow-y-auto pe-1">
            <FilterPanel
              attributes={attributes}
              cityFacets={cityFacets}
              priceRange={prices}
              priceLabel={category?.priceLabel}
            />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
              <span className="num font-semibold text-foreground">
                {result.total.toLocaleString("he-IL")}
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
              />
              <SortSelect hasQuery={hasQuery} />
            </div>
          </div>

          <div className="mb-4">
            <ActiveFilterChips attributes={attributes} />
          </div>

          {items.length === 0 ? (
            <EmptyResults
              title={hasQuery ? `לא נמצאו תוצאות עבור "${state.q}"` : "אין מודעות בקטגוריה הזו"}
              body={
                hasQuery
                  ? "בדקו את האיות, נסו מילים כלליות יותר או הסירו חלק מהפילטרים."
                  : "נסו להסיר פילטרים או לעיין בקטגוריה אחרת."
              }
              action={
                <Button asChild variant="outline">
                  <Link href="/">חזרה לדף הבית</Link>
                </Button>
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
    </div>
  );
}
