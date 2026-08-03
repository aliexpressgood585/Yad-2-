import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export type HistogramBucket = { from: number; to: number; count: number };

/**
 * התפלגות המחירים בקבוצת מודעות — עשרה תאים, סמן חציון, וסימון
 * אופציונלי של מחיר בודד בתוך ההתפלגות.
 *
 * הרכיב אינו מקבל "מחיר מומלץ" ואינו מחשב אחד: הוא מצייר בדיוק את מה
 * שנמדד. אותו רכיב משרת את דף השווי ואת דף המודעה, כדי ששני המסכים
 * יראו אותה התפלגות באותו אופן.
 */
export function PriceHistogram({
  buckets,
  median,
  price,
  currency = "ILS",
  scrollReveal = false,
  className,
}: {
  buckets: HistogramBucket[];
  median: number;
  /** מחיר להדגשה בתוך ההתפלגות — המחיר של המודעה הנוכחית */
  price?: number | null;
  currency?: string;
  /**
   * פרישת העמודות בגלילה. מופעל בדף המודעה בלבד — ראה ההסבר
   * ב-`globals.css` וב-DESIGN.md.
   */
  scrollReveal?: boolean;
  className?: string;
}) {
  const peak = Math.max(1, ...buckets.map((b) => b.count));
  const min = buckets[0]?.from ?? 0;
  const max = buckets[buckets.length - 1]?.to ?? 0;

  const inBucket = (value: number, i: number) => {
    const b = buckets[i]!;
    const isLast = i === buckets.length - 1;
    return value >= b.from && (isLast ? value <= b.to : value < b.to);
  };

  return (
    <figure className={cn("space-y-2", className)}>
      <div
        className={cn("flex h-24 items-end gap-1", scrollReveal && "histogram-scroll")}
        aria-hidden
      >
        {buckets.map((b, i) => {
          const isMedian = inBucket(median, i);
          const isPrice = price != null && inBucket(price, i);
          return (
            // h-full הכרחי: גובה באחוזים נמדד מול הורה בעל גובה מפורש,
            // ובעמודה בגובה תוכן הוא מתאפס והעמודות נעלמות
            <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
              <div
                className={cn(
                  "histogram-bar w-full rounded-sm",
                  isPrice
                    ? "bg-info"
                    : isMedian
                      ? "bg-primary"
                      : "bg-primary/25",
                )}
                // גובה מזערי גם לתא ריק, אחרת נראה כאילו יש פער בציר
                style={{ height: `${Math.max(3, (b.count / peak) * 100)}%` }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="num">{formatPrice(min, { currency })}</span>
        <span className="num">{formatPrice(max, { currency })}</span>
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          החציון
        </span>
        {price != null ? (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-info" aria-hidden />
            המחיר במודעה זו
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-primary/25" aria-hidden />
          מודעות אחרות
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * טווח האמצע — האחוזון ה-25 עד ה-75.
 *
 * זה המספר שהמשתמש בא בשבילו: לא "המחיר" אלא הטווח שבו יושבת מחצית
 * השוק. מינימום ומקסימום אינם מוצגים ככותרת בכוונה — הם רגישים למודעה
 * חריגה אחת, והטווח הבין-רבעוני אינו.
 */
export function PriceRange({
  p25,
  p75,
  currency = "ILS",
  className,
}: {
  p25: number;
  p75: number;
  currency?: string;
  className?: string;
}) {
  return (
    <p className={cn("font-heading text-xl font-extrabold text-primary sm:text-2xl", className)}>
      <span className="num">{formatPrice(p25, { currency })}</span>
      <span className="mx-1.5 text-muted-foreground">–</span>
      <span className="num">{formatPrice(p75, { currency })}</span>
    </p>
  );
}
