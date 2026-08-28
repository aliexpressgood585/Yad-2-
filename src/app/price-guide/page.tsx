import type { Metadata } from "next";
import Link from "next/link";

import { BreadcrumbJsonLd } from "@/components/seo/json-ld";
import { PriceGuideBreadcrumbs } from "@/components/valuation/price-guide-breadcrumbs";
import { formatCount } from "@/lib/format";
import { pricePaths } from "@/lib/hebrew-routes";
import { MIN_SAMPLE } from "@/lib/price-meter";
import { SITE } from "@/lib/site";
import { slugify } from "@/lib/utils";
import { guideTargets } from "@/lib/valuation";

export const revalidate = 86_400;

export const metadata: Metadata = {
  title: "מחירון רכב — לפי מודעות אמיתיות",
  description:
    "מחירון רכב שנבנה ממחירי המודעות הפעילות בלוח: חציון, טווח ומגמה לכל דגם שיש עליו מספיק מודעות.",
  alternates: { canonical: pricePaths.guideIndex },
  openGraph: {
    title: "מחירון רכב",
    description: "מה מבקשים בפועל על כל דגם, לפי המודעות בלוח.",
    url: pricePaths.guideIndex,
  },
};

export default async function PriceGuideIndex() {
  const targets = await guideTargets();

  const byMake = new Map<string, { model: string; count: number }[]>();
  for (const t of targets) {
    const list = byMake.get(t.manufacturer) ?? [];
    list.push({ model: t.model, count: t.count });
    byMake.set(t.manufacturer, list);
  }

  const makes = [...byMake.entries()]
    .map(([manufacturer, models]) => ({
      manufacturer,
      models,
      total: models.reduce((sum, m) => sum + m.count, 0),
    }))
    .sort((a, b) => b.total - a.total || a.manufacturer.localeCompare(b.manufacturer, "he"));

  return (
    <div className="container max-w-4xl py-6">
      <BreadcrumbJsonLd items={[{ name: "מחירון רכב", path: pricePaths.guideIndex }]} />
      <PriceGuideBreadcrumbs items={[{ name: "מחירון רכב" }]} />

      <header className="mt-3">
        <h1 className="font-heading text-2xl font-extrabold sm:text-3xl">מחירון רכב</h1>
        <p className="mt-2 max-w-2xl text-pretty text-muted-foreground">
          המחירון נבנה ממחירי המודעות הפעילות ב{SITE.name}, ולא מקטלוג חיצוני. דגם מופיע
          כאן רק כשיש עליו לפחות <span className="num">{MIN_SAMPLE}</span> מודעות —
          מתחת לזה אין בסיס להצגת מספר.
        </p>
      </header>

      {makes.length ? (
        <div className="mt-6 space-y-6">
          {makes.map((make) => (
            <section key={make.manufacturer}>
              <h2 className="mb-2 font-heading text-lg font-bold">
                <Link
                  href={pricePaths.guide(slugify(make.manufacturer))}
                  className="hover:underline"
                >
                  {make.manufacturer}
                </Link>
              </h2>
              <ul className="flex flex-wrap gap-2">
                {make.models
                  .sort((a, b) => b.count - a.count)
                  .map((m) => (
                    <li key={m.model}>
                      <Link
                        href={pricePaths.guide(slugify(make.manufacturer), slugify(m.model))}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-sm hover:bg-muted"
                      >
                        {m.model}
                        <span className="num text-xs text-muted-foreground">
                          {formatCount(m.count)}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="mt-6 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          אין כרגע דגם שיש עליו מספיק מודעות פעילות כדי לבנות מחירון.
        </p>
      )}

      <p className="mt-8 text-sm">
        <Link href={pricePaths.valuation} className="text-info underline underline-offset-4 hover:no-underline">
          בדיקת שווי לרכב מסוים — לפי שנה, יד וקילומטראז&apos;
        </Link>
      </p>
    </div>
  );
}
