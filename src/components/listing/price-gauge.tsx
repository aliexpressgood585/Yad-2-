import type { PriceMeter as PriceMeterData } from "@/lib/price-meter";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * הסקאלה — הדקדוק של הלוח.
 *
 * פס עם שנתות ומחוג, שמראה איפה המחיר של המודעה יושב בשוק שלה. זה לא
 * רכיב שמוצמד לכרטיס אלא הצורה שבה כל מחיר באתר נקרא: מחיר לבדו הוא
 * מספר, ומחיר עם מיקום בהתפלגות הוא מידע.
 *
 * **`meter === null` → לא מוצג כלום.** פחות משמונה מודעות דומות פירושו
 * שאין קריאה, ומכשיר שמראה קריאה שאין לו הוא מכשיר מקולקל. לא מחוג
 * חלש, לא מחוג אפור, לא "מדגם קטן" באותיות קטנות — אין סקאלה בכלל.
 * הכלל נאכף גם במקור הנתונים (`priceMetersFor` עם `HAVING count >= 8`)
 * וגם כאן, כי שתי נקודות אכיפה עדיפות על אחת בכלל שאסור לעקוף.
 *
 * המחוג מוצג תמיד כשיש קריאה — מיקומו *הוא* הנתון. מה שמותנה בסף
 * ה-3% הוא רק **המסקנה המילולית**: סטייה של אחוז-שניים מהחציון היא
 * רעש סטטיסטי, וכתיבת "1% מתחת לחציון" הופכת רעש לטענה.
 */
export function PriceGauge({
  meter,
  size = "row",
  className,
}: {
  meter: PriceMeterData | null;
  /** `row` — שורת תוצאה. `page` — דף המודעה, עם ערכי הקצה מתחת לפס. */
  size?: "row" | "page";
  className?: string;
}) {
  if (!meter) return null;

  const below = meter.deltaPct < 0;
  const magnitude = Math.abs(meter.deltaPct);
  const showVerdict = magnitude >= 3;
  const position = Math.min(100, Math.max(0, meter.percentile * 100));

  const label = showVerdict
    ? `המחיר ${below ? "נמוך" : "גבוה"} ב-${magnitude} אחוז מחציון ${meter.sample} מודעות דומות`
    : `המחיר על החציון של ${meter.sample} מודעות דומות`;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="gauge w-full" role="img" aria-label={label}>
        {/* שנתת החציון — נקודת הייחוס שממנה נמדדת הסטייה */}
        <span className="gauge-median" style={{ insetInlineStart: "50%" }} aria-hidden />
        {/* ב-RTL הציר מתהפך, ולכן inset-inline ולא left */}
        <span
          className="gauge-needle"
          style={{ insetInlineStart: `${position.toFixed(1)}%` }}
          aria-hidden
        />
      </div>

      <div
        className={cn(
          "flex items-baseline gap-2 text-xs",
          size === "page" && "justify-between",
        )}
      >
        {showVerdict ? (
          <p className={below ? "text-info" : "text-muted-foreground"}>
            <span className="num font-medium">{magnitude}%</span>{" "}
            {below ? "מתחת לחציון" : "מעל החציון"}
          </p>
        ) : (
          <p className="text-muted-foreground">על החציון</p>
        )}

        {size === "page" ? (
          <p className="text-muted-foreground">
            חציון <span className="num">{formatPrice(meter.median)}</span> ·{" "}
            <span className="num">{meter.sample}</span> מודעות
          </p>
        ) : null}
      </div>
    </div>
  );
}
