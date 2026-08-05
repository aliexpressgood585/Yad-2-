import { formatNumber, formatPrice } from "@/lib/format";
import { bandForPrice, type TimeToSale } from "@/lib/time-to-sale";
import { cn } from "@/lib/utils";

/**
 * עקומת מחיר-מהירות.
 *
 * מדד המחיר עונה "אתה 12% מתחת לחציון" — נכון, ולא מכריע כלום. הרכיב
 * הזה עונה על השאלה שהמוכר באמת שואל: **כמה זמן זה ייקח במחיר הזה.**
 *
 * הצגה כארבעה פסים ולא כגרף קווי: הנתון הוא ארבע מדידות ולא פונקציה
 * רציפה, וקו מחבר מרמז על דיוק שאין. פס לכל רבעון אומר בדיוק מה נמדד.
 *
 * הפס הארוך ביותר הוא האיטי ביותר, כלומר האורך הוא **זמן** — קריאה
 * שאינה דורשת הסבר.
 */
export function SpeedCurve({
  curve,
  /** מחיר שהמוכר שוקל. כשנמסר, הרבעון שלו מודגש. */
  price,
  className,
}: {
  curve: TimeToSale;
  price?: number | null;
  className?: string;
}) {
  const slowest = Math.max(...curve.bands.map((b) => b.medianDays));
  const active = price != null ? bandForPrice(curve, price) : null;

  return (
    <section className={cn("flex flex-col gap-4 border border-border bg-card p-5", className)}>
      <div className="flex flex-col gap-1">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          כמה זמן זה ייקח
        </h3>
        <p className="text-sm text-muted-foreground">
          לפי <span className="num">{formatNumber(curve.sample)}</span> מודעות דומות שנמכרו
          בפועל. חציון הימים מפרסום עד מכירה, לפי רמת המחיר.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {curve.bands.map((band) => {
          const isActive = active?.quartile === band.quartile;
          return (
            <li key={band.quartile} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={cn("num", isActive ? "font-medium" : "text-muted-foreground")}>
                  {formatPrice(band.minPrice, { currency: "ILS" })}–
                  {formatPrice(band.maxPrice, { currency: "ILS" })}
                </span>
                <span className={cn("num shrink-0", isActive ? "font-medium" : "text-muted-foreground")}>
                  {formatNumber(band.medianDays)} ימים
                </span>
              </div>

              <div className="h-2 bg-secondary" role="presentation">
                <div
                  className={cn("h-full", isActive ? "bg-primary" : "bg-muted-foreground/40")}
                  style={{ width: `${Math.max(4, (band.medianDays / slowest) * 100)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>

      {/*
       * המשפט המכריע, וגם הסייג שלו.
       *
       * "המחיר שלך גבוה" הוא משפט שאפשר להתווכח איתו. "המחיר שלך מוסיף
       * 20 ימי המתנה" הוא עובדה שאפשר להחליט לפיה — וזה ההבדל בין מדד
       * שמסבירים אותו לבין מדד שפועלים לפיו.
       */}
      <p className="border-t border-border pt-3 text-xs leading-relaxed text-muted-foreground">
        המספרים הם חציון ולא הבטחה: מודעה בודדת יכולה להימכר ביום או לשכב
        חודשיים. הם מתארים מה קרה למודעות דומות, לא מה יקרה לשלך.
      </p>
    </section>
  );
}
