import type { PriceMeter as PriceMeterData } from "@/lib/price-meter";
import { cn } from "@/lib/utils";

/**
 * מד המחיר — פס דק שמראה איפה המחיר יושב ביחס למודעות דומות.
 *
 * אלמנט החתימה של הלוח: המחיר לבדו לא אומר אם העסקה טובה, והפס הזה
 * עונה על זה במבט אחד, בלי להעמיס על הכרטיס.
 *
 * `meter === null` (פחות מ-8 מודעות להשוואה) → לא מוצג כלום.
 * לעולם לא ממציאים נתון מתוך מדגם קטן.
 */
export function PriceMeter({
  meter,
  className,
}: {
  meter: PriceMeterData | null;
  className?: string;
}) {
  if (!meter) return null;

  const below = meter.deltaPct < 0;
  const magnitude = Math.abs(meter.deltaPct);

  // סטייה של אחוז-שניים מהחציון היא רעש סטטיסטי, לא "מחיר טוב"
  if (magnitude < 3) return null;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div
        className="relative h-0.5 w-full rounded-full bg-border"
        role="img"
        aria-label={`המחיר ${below ? "נמוך" : "גבוה"} ב-${magnitude} אחוז מחציון ${meter.sample} מודעות דומות`}
      >
        <span
          className={cn(
            "absolute top-1/2 size-1.5 -translate-y-1/2 rounded-full",
            below ? "bg-primary" : "bg-muted-foreground",
          )}
          // הסמן ממוקם באחוזון; ב-RTL הציר מתהפך, ולכן inset-inline-start
          style={{ insetInlineStart: `calc(${(meter.percentile * 100).toFixed(1)}% - 3px)` }}
        />
      </div>
      <p className={cn("text-xs", below ? "text-primary" : "text-muted-foreground")}>
        <span className="num">{magnitude}%</span> {below ? "מתחת לחציון" : "מעל החציון"}
      </p>
    </div>
  );
}
