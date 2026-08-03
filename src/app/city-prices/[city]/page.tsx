import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { BreadcrumbJsonLd, JsonLd } from "@/components/seo/json-ld";
import { Button } from "@/components/ui/button";
import { ComparableTable } from "@/components/valuation/comparable-table";
import { PriceGuideBreadcrumbs } from "@/components/valuation/price-guide-breadcrumbs";
import { PriceHistogram, PriceRange } from "@/components/valuation/price-histogram";
import { PriceTrendChart } from "@/components/valuation/price-trend-chart";
import { TrendSection } from "@/components/valuation/trend-section";
import { formatCount, formatNumber, formatPrice } from "@/lib/format";
import { pricePaths } from "@/lib/hebrew-routes";
import { MIN_SAMPLE } from "@/lib/price-meter";
import { SITE } from "@/lib/site";
import { decodeSlugParam } from "@/lib/slug";
import { slugify } from "@/lib/utils";
import {
  breakdownBy,
  cityTargets,
  DEAL_LABEL,
  loadRealEstateComparables,
  medianPricePerSqm,
  realEstateTrend,
  safeParams,
  summarizePrices,
  type DealKind,
  type PriceSummary,
  type RealEstateComparable,
  type TrendPoint,
} from "@/lib/valuation";

type Props = { params: Promise<{ city: string }> };

export const revalidate = 86_400;

export async function generateStaticParams() {
  return safeParams(async () => {
    const cities = await cityTargets();
    return cities.slice(0, 200).map((c) => ({ city: slugify(c.city) }));
  });
}

async function resolve(citySlug: string) {
  const wanted = slugify(decodeSlugParam(citySlug));
  const cities = await cityTargets();
  return cities.find((c) => slugify(c.city) === wanted) ?? null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params;
  const found = await resolve(city);
  if (!found) return { title: "העיר לא נמצאה" };

  const path = pricePaths.city(slugify(found.city));
  return {
    title: `מחירי דירות ב${found.city} — לפי מודעות אמיתיות`,
    description: `מחירי דירות למכירה ולהשכרה ב${found.city}: חציון, טווח, מחיר למ"ר, פילוח לפי מספר חדרים ומגמה של 12 חודשים.`,
    alternates: { canonical: path },
    openGraph: {
      title: `מחירי דירות ב${found.city}`,
      description: `מה מבקשים על דירות ב${found.city}, לפי המודעות בלוח.`,
      url: path,
    },
  };
}

/** נתוני צד אחד של השוק בעיר. */
type Side = {
  deal: DealKind;
  rows: RealEstateComparable[];
  summary: PriceSummary | null;
  trend: TrendPoint[];
};

export default async function CityPricesPage({ params }: Props) {
  const { city: citySlug } = await params;
  const found = await resolve(citySlug);
  if (!found) notFound();

  const city = found.city;

  const [saleRows, rentRows, saleTrend, rentTrend] = await Promise.all([
    loadRealEstateComparables("sale", city),
    loadRealEstateComparables("rent", city),
    realEstateTrend("sale", city),
    realEstateTrend("rent", city),
  ]);

  const sides: Side[] = ([
    {
      deal: "sale" as const,
      rows: saleRows,
      summary: summarizePrices(saleRows.map((r) => r.price)),
      trend: saleTrend,
    },
    {
      deal: "rent" as const,
      rows: rentRows,
      summary: summarizePrices(rentRows.map((r) => r.price)),
      trend: rentTrend,
    },
  ] satisfies Side[]).filter((s) => s.summary !== null);

  // הדף נבנה רק לערים שעברו את הסף; אם שני הצדדים ירדו מאז — 404
  if (!sides.length) notFound();

  const path = pricePaths.city(slugify(city));

  /**
   * Dataset ולא Product: הדף אינו מציע נכס אלא מפרסם מדידה של שוק.
   * הערכים זהים למוצג על המסך.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Dataset",
    name: `מחירי דירות ב${city}`,
    description: `חציון וטווח המחירים המבוקשים על דירות ב${city}, מחושבים ממודעות פעילות ב${SITE.name}.`,
    url: `${SITE.url}${path}`,
    inLanguage: "he-IL",
    isAccessibleForFree: true,
    creator: { "@type": "Organization", name: SITE.name, url: SITE.url },
    spatialCoverage: { "@type": "Place", name: city },
    temporalCoverage: new Date().toISOString().slice(0, 10),
    variableMeasured: sides.map((s) => ({
      "@type": "PropertyValue",
      name: `חציון מחיר — דירות ${DEAL_LABEL[s.deal]}`,
      value: s.summary!.median,
      unitText: "ILS",
      measurementTechnique: `חציון של ${s.summary!.sample} מודעות פעילות`,
    })),
  };

  return (
    <div className="container max-w-4xl py-6">
      <JsonLd data={jsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "מחירי דירות", path: pricePaths.cityIndex },
          { name: city, path },
        ]}
      />
      <PriceGuideBreadcrumbs
        items={[{ name: "מחירי דירות", href: pricePaths.cityIndex }, { name: city }]}
      />

      <header className="mt-3">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">
          מחירי דירות ב{city}
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
          כל המספרים בדף מחושבים מהמודעות הפעילות ב{SITE.name} ברגע זה — מחיר מבוקש ולא
          מחיר עסקה שנסגרה. פילוח שאין בו לפחות{" "}
          <span className="num">{MIN_SAMPLE}</span> מודעות אינו מוצג.
        </p>
      </header>

      {sides.map((side) => {
        const summary = side.summary!;
        const byRooms = breakdownBy(side.rows, (r) => r.rooms);
        const perSqm = medianPricePerSqm(side.rows);

        return (
          <div key={side.deal} className="mt-6 space-y-5">
            <section className="rounded-lg border border-border bg-card p-5">
              <h2 className="font-heading text-lg font-bold">
                דירות {DEAL_LABEL[side.deal]} ב{city}
              </h2>
              <PriceRange p25={summary.p25} p75={summary.p75} className="mt-2" />
              <p className="mt-1.5 text-sm text-muted-foreground">
                חציון{" "}
                <span className="num font-medium text-foreground">
                  {formatPrice(summary.median)}
                </span>{" "}
                מתוך <span className="num">{formatCount(summary.sample)}</span> מודעות
                {perSqm ? (
                  <>
                    {" "}
                    · חציון למ&quot;ר{" "}
                    <span className="num font-medium text-foreground">
                      {formatPrice(perSqm.value)}
                    </span>{" "}
                    <span className="num">({formatCount(perSqm.sample)} מודעות עם שטח)</span>
                  </>
                ) : null}
                .
              </p>
              <PriceHistogram
                buckets={summary.buckets}
                median={summary.median}
                className="mt-5 border-t border-border pt-5"
              />
            </section>

            {byRooms.length ? (
              <section className="rounded-lg border border-border bg-card p-5">
                <h3 className="font-heading text-lg font-bold">לפי מספר חדרים</h3>
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                      <th scope="col" className="py-2 text-start font-medium">חדרים</th>
                      <th scope="col" className="py-2 text-start font-medium">חציון</th>
                      <th scope="col" className="py-2 text-start font-medium">טווח אמצע</th>
                      <th scope="col" className="py-2 text-start font-medium">מודעות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byRooms.map(({ key, summary: s }) => (
                      <tr key={key} className="border-b border-border/60 last:border-b-0">
                        <th scope="row" className="py-2 text-start font-medium">
                          <span className="num">
                            {formatNumber(key, { style: "identifier" })}
                          </span>
                        </th>
                        <td className="py-2">
                          <span className="num">{formatPrice(s.median)}</span>
                        </td>
                        <td className="py-2 text-muted-foreground">
                          <span className="num">
                            {formatPrice(s.p25)}–{formatPrice(s.p75)}
                          </span>
                        </td>
                        <td className="py-2 text-muted-foreground">
                          <span className="num">{formatCount(s.sample)}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}

            <TrendSection
              title={`מגמת המחירים — דירות ${DEAL_LABEL[side.deal]} ב${city}`}
              points={side.trend}
            >
              <PriceTrendChart points={side.trend} />
            </TrendSection>

            <section>
              <h3 className="mb-3 font-heading text-lg font-bold">
                המודעות שמהן חושבו המספרים
              </h3>
              <ComparableTable
                headers={["חדרים", "שטח"]}
                rows={side.rows.slice(0, 20).map((r) => ({
                  slug: r.slug,
                  title: r.title,
                  price: r.price,
                  city: r.neighborhood ?? r.city,
                  columns: [
                    r.rooms === null ? "" : formatNumber(r.rooms, { style: "identifier" }),
                    r.size === null ? "" : `${formatNumber(r.size)} מ"ר`,
                  ],
                }))}
              />
            </section>
          </div>
        );
      })}

      <aside className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-border bg-primary-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold">יש לך דירה ב{city}?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            בדקו שווי לפי שכונה, חדרים ומ&quot;ר — ואז פרסמו.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link
              href={`${pricePaths.valuation}?type=realestate&deal=sale&city=${encodeURIComponent(city)}`}
            >
              בדיקת שווי
              <ArrowLeft aria-hidden />
            </Link>
          </Button>
          <Button asChild>
            <Link href="/publish">פרסם מודעה</Link>
          </Button>
        </div>
      </aside>
    </div>
  );
}
