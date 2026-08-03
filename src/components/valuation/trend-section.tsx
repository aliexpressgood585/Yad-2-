import { formatCount } from "@/lib/format";
import { MIN_SAMPLE } from "@/lib/price-meter";
import { MIN_TREND_POINTS, type TrendPoint } from "@/lib/valuation";
import { cn } from "@/lib/utils";

/**
 * מעטפת גרף המגמה, כולל המצב שבו אין מספיק חודשים לצייר.
 *
 * הגרף מוצג רק כשיש לפחות `MIN_TREND_POINTS` חודשים שעברו את גודל
 * המדגם. פחות מזה — נכתב במפורש שאין מספיק היסטוריה, ולא מצויר קו
 * שמחבר שתי נקודות ומתיימר להיות מגמה.
 */
export function TrendSection({
  title,
  points,
  className,
  children,
}: {
  title: string;
  points: TrendPoint[];
  className?: string;
  children: React.ReactNode;
}) {
  const enough = points.length >= MIN_TREND_POINTS;

  return (
    <section className={cn("rounded-lg border border-border bg-card p-5", className)}>
      <h2 className="font-heading text-lg font-bold">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        חציון המחיר של המודעות שהיו פעילות בכל חודש, ב-<span className="num">12</span>{" "}
        החודשים האחרונים.
      </p>

      {enough ? (
        <div className="mt-4">{children}</div>
      ) : (
        <p className="mt-4 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
          אין מספיק היסטוריה לגרף מגמה. נמצאו{" "}
          <span className="num">{formatCount(points.length)}</span> חודשים עם לפחות{" "}
          <span className="num">{MIN_SAMPLE}</span> מודעות, ודרושים{" "}
          <span className="num">{MIN_TREND_POINTS}</span>. מגמה שמצוירת מפחות מזה אינה
          מגמה אלא שתי נקודות.
        </p>
      )}
    </section>
  );
}
