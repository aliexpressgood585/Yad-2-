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
  guideTargets,
  loadVehicleComparables,
  safeParams,
  summarizePrices,
  vehicleTrend,
} from "@/lib/valuation";

type Props = { params: Promise<{ make: string; model: string }> };

/**
 * דפי המחירון נבנים מהנתונים ונשמרים במטמון ליום.
 *
 * יממה ולא שעה: החציון של דגם שלם זז לאט, ודף שנבנה מחדש בכל שעה היה
 * מייצר עומס שאין לו כיסוי בשינוי אמיתי במספרים.
 */
export const revalidate = 86_400;

/** רק צירופים שיש עליהם מספיק מודעות מקבלים דף מוכן מראש. */
export async function generateStaticParams() {
  return safeParams(async () => {
    const targets = await guideTargets();
    return targets.slice(0, 200).map((t) => ({
      make: slugify(t.manufacturer),
      model: slugify(t.model),
    }));
  });
}

/** מאתר את היצרן והדגם לפי ה-slug בכתובת, בהשוואת slug מול slug. */
async function resolve(makeSlug: string, modelSlug: string) {
  const make = decodeSlugParam(makeSlug);
  const model = decodeSlugParam(modelSlug);
  const targets = await guideTargets();
  return (
    targets.find(
      (t) => slugify(t.manufacturer) === slugify(make) && slugify(t.model) === slugify(model),
    ) ?? null
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { make, model } = await params;
  const target = await resolve(make, model);
  if (!target) return { title: "המחירון לא נמצא" };

  const name = `${target.manufacturer} ${target.model}`;
  const path = pricePaths.guide(slugify(target.manufacturer), slugify(target.model));

  return {
    title: `מחירון ${name} — כמה מבקשים עליו בלוח`,
    description: `טווח המחירים המבוקש על ${name} לפי ${target.count} מודעות פעילות: חציון, התפלגות, פילוח לפי שנת ייצור ומגמה של 12 חודשים.`,
    alternates: { canonical: path },
    openGraph: {
      title: `מחירון ${name}`,
      description: `מה מבקשים על ${name} בלוח, לפי מודעות פעילות.`,
      url: path,
    },
  };
}

export default async function ModelGuidePage({ params }: Props) {
  const { make, model } = await params;
  const target = await resolve(make, model);
  if (!target) notFound();

  const { manufacturer, model: modelName } = target;
  const name = `${manufacturer} ${modelName}`;

  const [all, trend] = await Promise.all([
    loadVehicleComparables(manufacturer),
    vehicleTrend(manufacturer, modelName),
  ]);

  const rows = all.filter((r) => r.model === modelName);
  const summary = summarizePrices(rows.map((r) => r.price));

  // הדף נבנה רק לצירופים שעברו את הסף, ולכן היעדר סיכום כאן משמעו
  // שהמודעות ירדו מאז הבנייה האחרונה של הדף
  if (!summary) notFound();

  const byYear = breakdownBy(rows, (r) => r.year);
  const byHand = breakdownBy(rows, (r) => r.hand);

  const path = pricePaths.guide(slugify(manufacturer), slugify(modelName));

  /**
   * AggregateOffer ולא Product עם מחיר יחיד: הדף אינו מוכר פריט אחד
   * אלא מתאר טווח, וזה בדיוק מה ש-AggregateOffer מתאר. המספרים זהים
   * למוצג בדף — נתון מובנה שסותר את הנראה הוא נתון שגוי.
   */
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name,
    category: "רכב",
    brand: { "@type": "Brand", name: manufacturer },
    description: `מחירון ${name} לפי ${summary.sample} מודעות פעילות ב${SITE.name}.`,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "ILS",
      lowPrice: summary.min,
      highPrice: summary.max,
      offerCount: summary.sample,
      availability: "https://schema.org/InStock",
      url: `${SITE.url}${path}`,
    },
  };

  return (
    <div className="container max-w-4xl py-6">
      <JsonLd data={jsonLd} />
      <BreadcrumbJsonLd
        items={[
          { name: "מחירון רכב", path: pricePaths.guideIndex },
          { name: manufacturer, path: pricePaths.guide(slugify(manufacturer)) },
          { name: modelName, path },
        ]}
      />

      <PriceGuideBreadcrumbs
        items={[
          { name: "מחירון רכב", href: pricePaths.guideIndex },
          { name: manufacturer, href: pricePaths.guide(slugify(manufacturer)) },
          { name: modelName },
        ]}
      />

      <header className="mt-3">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">מחירון {name}</h1>
        <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
          כל המספרים בדף מחושבים מ-
          <span className="num">{formatCount(summary.sample)}</span> מודעות פעילות ב
          {SITE.name} ברגע זה. אלה מחירים מבוקשים, לא מחירי עסקאות שנסגרו.
        </p>
      </header>

      <section className="mt-5 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm text-muted-foreground">טווח המחירים המבוקש</h2>
        <PriceRange p25={summary.p25} p75={summary.p75} className="mt-1" />
        <p className="mt-1.5 text-sm text-muted-foreground">
          מחצית מהמודעות בטווח הזה. החציון{" "}
          <span className="num font-medium text-foreground">{formatPrice(summary.median)}</span>,
          והטווח המלא נע בין <span className="num">{formatPrice(summary.min)}</span> ל-
          <span className="num">{formatPrice(summary.max)}</span>.
        </p>
        <PriceHistogram
          buckets={summary.buckets}
          median={summary.median}
          className="mt-5 border-t border-border pt-5"
        />
      </section>

      <TrendSection
        title={`מגמת המחירים של ${name}`}
        points={trend}
        className="mt-5"
      >
        <PriceTrendChart points={trend} />
      </TrendSection>

      {byYear.length ? (
        <section className="mt-5 rounded-lg border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">לפי שנת ייצור</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            שנים עם פחות מ-<span className="num">{MIN_SAMPLE}</span> מודעות אינן מופיעות
            בטבלה.
          </p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs text-muted-foreground">
                <th scope="col" className="py-2 text-start font-medium">שנה</th>
                <th scope="col" className="py-2 text-start font-medium">חציון</th>
                <th scope="col" className="py-2 text-start font-medium">טווח אמצע</th>
                <th scope="col" className="py-2 text-start font-medium">מודעות</th>
              </tr>
            </thead>
            <tbody>
              {byYear.map(({ key, summary: s }) => (
                <tr key={key} className="border-b border-border/60 last:border-b-0">
                  <th scope="row" className="py-2 text-start font-medium">
                    <span className="num">{key}</span>
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

      {byHand.length > 1 ? (
        <section className="mt-5 rounded-lg border border-border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">לפי יד</h2>
          <dl className="mt-3 grid gap-4 sm:grid-cols-3">
            {byHand.map(({ key, summary: s }) => (
              <div key={key}>
                <dt className="text-xs text-muted-foreground">
                  יד <span className="num">{formatNumber(key, { style: "identifier" })}</span>
                </dt>
                <dd className="num text-base font-semibold">{formatPrice(s.median)}</dd>
                <dd className="num text-xs text-muted-foreground">
                  {formatCount(s.sample)} מודעות
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}

      <section className="mt-5">
        <h2 className="mb-3 font-heading text-lg font-bold">
          המודעות שמהן חושב המחירון
        </h2>
        <ComparableTable
          rows={rows.slice(0, 30).map((r) => ({
            slug: r.slug,
            title: r.title,
            price: r.price,
            city: r.city,
            columns: [
              r.year === null ? "" : formatNumber(r.year, { style: "identifier" }),
              r.km === null ? "" : `${formatNumber(r.km)} ק"מ`,
            ],
          }))}
          headers={["שנה", "קילומטראז'"]}
        />
        {rows.length > 30 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            מוצגות <span className="num">30</span> מתוך{" "}
            <span className="num">{formatCount(rows.length)}</span> המודעות שנכללו בחישוב.
          </p>
        ) : null}
      </section>

      <aside className="mt-8 flex flex-col items-start gap-3 rounded-lg border border-border bg-primary-soft/40 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-bold">יש לך {name} למכירה?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            בדקו שווי מדויק יותר לפי שנה, יד וקילומטראז&apos; — ואז פרסמו.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link
              href={`${pricePaths.valuation}?type=vehicle&make=${encodeURIComponent(
                manufacturer,
              )}&model=${encodeURIComponent(modelName)}`}
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
