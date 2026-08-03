import type { Metadata } from "next";
import Link from "next/link";

import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { PriceGuideBreadcrumbs } from "@/components/valuation/price-guide-breadcrumbs";
import { formatCount } from "@/lib/format";
import { pricePaths } from "@/lib/hebrew-routes";
import { MIN_SAMPLE } from "@/lib/price-meter";
import { SITE } from "@/lib/site";
import { slugify } from "@/lib/utils";
import { cityTargets } from "@/lib/valuation";

export const revalidate = 86_400;

export const metadata: Metadata = {
  title: "מחירי דירות לפי עיר",
  description:
    "מחירי דירות למכירה ולהשכרה בכל עיר שיש בה מספיק מודעות: חציון, טווח ומחיר למ\"ר, מחושבים מהמודעות עצמן.",
  alternates: { canonical: pricePaths.cityIndex },
  openGraph: {
    title: "מחירי דירות לפי עיר",
    description: "מה מבקשים על דירות בכל עיר, לפי המודעות בלוח.",
    url: pricePaths.cityIndex,
  },
};

export default async function CityPricesIndex() {
  const cities = await cityTargets();

  return (
    <div className="container max-w-4xl py-6">
      <BreadcrumbJsonLd items={[{ name: "מחירי דירות", path: pricePaths.cityIndex }]} />
      <PriceGuideBreadcrumbs items={[{ name: "מחירי דירות" }]} />

      <header className="mt-3">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">
          מחירי דירות לפי עיר
        </h1>
        <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
          עיר מופיעה כאן רק כשיש בה לפחות <span className="num">{MIN_SAMPLE}</span> מודעות
          פעילות בסוג עסקה אחד לפחות. כל המספרים מחושבים מהמודעות ב{SITE.name}.
        </p>
      </header>

      {cities.length ? (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border bg-card">
          {cities.map((c) => (
            <li key={c.city}>
              <Link
                href={pricePaths.city(slugify(c.city))}
                className="flex items-center justify-between gap-3 p-4 hover:bg-muted"
              >
                <span className="font-medium">{c.city}</span>
                <span className="text-xs text-muted-foreground">
                  {c.sale >= MIN_SAMPLE ? (
                    <>
                      <span className="num">{formatCount(c.sale)}</span> למכירה
                    </>
                  ) : null}
                  {c.sale >= MIN_SAMPLE && c.rent >= MIN_SAMPLE ? " · " : null}
                  {c.rent >= MIN_SAMPLE ? (
                    <>
                      <span className="num">{formatCount(c.rent)}</span> להשכרה
                    </>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          אין כרגע עיר שיש בה מספיק מודעות פעילות כדי לפרסם מחירים.
        </p>
      )}

      <p className="mt-8 text-sm">
        <Link href={pricePaths.valuation} className="text-info hover:underline">
          בדיקת שווי לדירה מסוימת — לפי שכונה, חדרים ומ&quot;ר
        </Link>
      </p>
    </div>
  );
}
