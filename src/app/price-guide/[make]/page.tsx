import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { PriceGuideBreadcrumbs } from "@/components/valuation/price-guide-breadcrumbs";
import { PriceRange } from "@/components/valuation/price-histogram";
import { PriceTrendChart } from "@/components/valuation/price-trend-chart";
import { TrendSection } from "@/components/valuation/trend-section";
import { formatCount, formatPrice } from "@/lib/format";
import { pricePaths } from "@/lib/hebrew-routes";
import { MIN_SAMPLE } from "@/lib/price-meter";
import { SITE } from "@/lib/site";
import { decodeSlugParam } from "@/lib/slug";
import { slugify } from "@/lib/utils";
import {
  guideTargets,
  loadVehicleComparables,
  safeParams,
  summarizePrices,
  vehicleTrend,
} from "@/lib/valuation";

type Props = { params: Promise<{ make: string }> };

export const revalidate = 86_400;

export async function generateStaticParams() {
  return safeParams(async () => {
    const targets = await guideTargets();
    return [...new Set(targets.map((t) => t.manufacturer))].map((make) => ({
      make: slugify(make),
    }));
  });
}

async function resolve(makeSlug: string) {
  const wanted = slugify(decodeSlugParam(makeSlug));
  const targets = await guideTargets();
  const manufacturer = targets.find((t) => slugify(t.manufacturer) === wanted)?.manufacturer;
  if (!manufacturer) return null;
  return {
    manufacturer,
    models: targets.filter((t) => t.manufacturer === manufacturer),
  };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { make } = await params;
  const found = await resolve(make);
  if (!found) return { title: "המחירון לא נמצא" };

  const path = pricePaths.guide(slugify(found.manufacturer));
  return {
    title: `מחירון ${found.manufacturer} — כל הדגמים`,
    description: `מחירי ${found.manufacturer} לפי המודעות הפעילות בלוח: חציון, טווח ומגמה לכל דגם.`,
    alternates: { canonical: path },
    openGraph: {
      title: `מחירון ${found.manufacturer}`,
      description: `מה מבקשים על ${found.manufacturer} בלוח.`,
      url: path,
    },
  };
}

export default async function MakeGuidePage({ params }: Props) {
  const { make } = await params;
  const found = await resolve(make);
  if (!found) notFound();

  const { manufacturer, models } = found;

  const [rows, trend] = await Promise.all([
    loadVehicleComparables(manufacturer),
    vehicleTrend(manufacturer, null),
  ]);

  const summary = summarizePrices(rows.map((r) => r.price));
  const path = pricePaths.guide(slugify(manufacturer));

  return (
    <div className="container max-w-4xl py-6">
      <BreadcrumbJsonLd
        items={[
          { name: "מחירון רכב", path: pricePaths.guideIndex },
          { name: manufacturer, path },
        ]}
      />
      <PriceGuideBreadcrumbs
        items={[{ name: "מחירון רכב", href: pricePaths.guideIndex }, { name: manufacturer }]}
      />

      <header className="mt-3">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">
          מחירון {manufacturer}
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
          לפי המודעות הפעילות ב{SITE.name} ברגע זה.
        </p>
      </header>

      {summary ? (
        <section className="mt-5 rounded-lg border border-border bg-card p-5">
          <h2 className="text-sm text-muted-foreground">
            טווח המחירים המבוקש על כל דגמי {manufacturer}
          </h2>
          <PriceRange p25={summary.p25} p75={summary.p75} className="mt-1" />
          <p className="mt-1.5 text-sm text-muted-foreground">
            חציון <span className="num font-medium text-foreground">{formatPrice(summary.median)}</span>{" "}
            מתוך <span className="num">{formatCount(summary.sample)}</span> מודעות. השוואה בין
            דגמים שונים היא השוואה גסה — הדף של כל דגם מדויק ממנה.
          </p>
        </section>
      ) : null}

      <TrendSection title={`מגמת המחירים של ${manufacturer}`} points={trend} className="mt-5">
        <PriceTrendChart points={trend} />
      </TrendSection>

      <section className="mt-5">
        <h2 className="mb-3 font-heading text-lg font-bold">דגמים</h2>
        <p className="mb-3 text-sm text-muted-foreground">
          דגם מופיע כאן רק כשיש עליו לפחות <span className="num">{MIN_SAMPLE}</span> מודעות.
        </p>
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {models.map((m) => {
            const modelRows = rows.filter((r) => r.model === m.model);
            const s = summarizePrices(modelRows.map((r) => r.price));
            return (
              <li key={m.model}>
                <Link
                  href={pricePaths.guide(slugify(manufacturer), slugify(m.model))}
                  className="flex items-center justify-between gap-3 p-4 hover:bg-muted"
                >
                  <span>
                    <span className="font-medium">{m.model}</span>
                    <span className="num block text-xs text-muted-foreground">
                      {formatCount(m.count)} מודעות
                    </span>
                  </span>
                  {s ? (
                    <span className="num whitespace-nowrap text-sm font-semibold">
                      {formatPrice(s.median)}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-8 text-sm">
        <Link
          href={`${pricePaths.valuation}?type=vehicle&make=${encodeURIComponent(manufacturer)}`}
          className="text-info hover:underline"
        >
          בדיקת שווי ל{manufacturer} לפי דגם, שנה, יד וקילומטראז&apos;
        </Link>
      </p>
    </div>
  );
}
