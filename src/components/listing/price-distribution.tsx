import Link from "next/link";

import { PriceHistogram } from "@/components/valuation/price-histogram";
import { formatCount, formatPrice } from "@/lib/format";
import { pricePaths } from "@/lib/hebrew-routes";
import { priceDistributionFor } from "@/lib/price-meter";

/**
 * ההתפלגות המלאה של המחיר בדף המודעה.
 *
 * מד המחיר בכרטיס עונה על "זול או יקר"; כאן נפתחת התשובה המלאה — כמה
 * מודעות השתתפו, איפה יושב החציון, ואיפה בתוך ההתפלגות נמצא המחיר הזה.
 *
 * `null` (פחות מ-MIN_SAMPLE מודעות להשוואה) → הרכיב לא מוצג כלל, כמו
 * הפס בכרטיס. אותו כלל, אותה סיבה.
 */
export async function PriceDistribution({
  listingId,
  price,
  currency = "ILS",
}: {
  listingId: string;
  price: number | null;
  currency?: string;
}) {
  const dist = await priceDistributionFor(listingId);
  if (!dist || price === null) return null;

  const below = dist.deltaPct < 0;
  const magnitude = Math.abs(dist.deltaPct);

  return (
    <section
      aria-labelledby="price-distribution-heading"
      className="rounded-lg border border-border bg-card p-5"
    >
      <h2 id="price-distribution-heading" className="font-heading text-lg font-bold">
        המחיר ביחס למודעות דומות
      </h2>

      <p className="mt-1 text-sm text-muted-foreground">
        {magnitude < 3 ? (
          <>
            המחיר נמצא בסביבת החציון של{" "}
            <span className="num">{formatCount(dist.sample)}</span> מודעות דומות.
          </>
        ) : (
          <>
            <span className={below ? "font-medium text-primary" : "font-medium text-foreground"}>
              <span className="num">{magnitude}%</span> {below ? "מתחת" : "מעל"} החציון
            </span>{" "}
            של <span className="num">{formatCount(dist.sample)}</span> מודעות דומות, שעומד
            על <span className="num">{formatPrice(dist.median, { currency })}</span>.
          </>
        )}
      </p>

      <PriceHistogram
        buckets={dist.buckets}
        median={dist.median}
        price={price}
        currency={currency}
        className="mt-4"
      />

      <dl className="mt-4 grid grid-cols-3 gap-4 border-t border-border pt-4">
        <div>
          <dt className="text-xs text-muted-foreground">רבעון תחתון</dt>
          <dd className="num text-sm font-semibold">
            {formatPrice(dist.p25, { currency })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">חציון</dt>
          <dd className="num text-sm font-semibold">
            {formatPrice(dist.median, { currency })}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">רבעון עליון</dt>
          <dd className="num text-sm font-semibold">
            {formatPrice(dist.p75, { currency })}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-muted-foreground">
        ההשוואה היא מול מודעות פעילות באותה תת-קטגוריה ובטווח הקרוב של שנת הייצור או מספר
        החדרים.{" "}
        <Link href={pricePaths.valuation} className="text-info hover:underline">
          בדיקת שווי לפריט משלך
        </Link>
      </p>
    </section>
  );
}
