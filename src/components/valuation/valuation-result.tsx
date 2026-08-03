import Link from "next/link";
import { Info, TrendingUp } from "lucide-react";

import { PriceHistogram, PriceRange } from "@/components/valuation/price-histogram";
import { Button } from "@/components/ui/button";
import { formatCount, formatNumber, formatPrice } from "@/lib/format";
import { MIN_SAMPLE } from "@/lib/price-meter";
import type { Criterion, PriceSummary } from "@/lib/valuation";

/** צ'יפ אחד של קריטריון השוואה. */
function CriterionChip({ criterion }: { criterion: Criterion }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs">
      <span className="text-muted-foreground">{criterion.label}</span>
      <span className={criterion.numeric ? "num font-medium" : "font-medium"}>
        {criterion.value}
      </span>
    </span>
  );
}

/**
 * מה שמוצג כשאין מספיק מודעות.
 *
 * המסך הזה חשוב לא פחות מהמסך עם המספר: הוא אומר בדיוק כמה מודעות
 * נמצאו, מה חסר, ומה אפשר לעשות — ולא מציג הערכה חלופית בשום צורה.
 */
export function NotEnoughData({
  sample,
  what,
  publishHref,
}: {
  sample: number;
  what: string;
  publishHref?: string;
}) {
  return (
    <section
      aria-labelledby="valuation-empty"
      className="rounded-lg border border-border bg-card p-5"
    >
      <div className="flex items-start gap-2.5">
        <Info className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
        <div className="space-y-2">
          <h2 id="valuation-empty" className="font-heading text-lg font-bold">
            אין מספיק מודעות כדי לקבוע טווח שווי
          </h2>
          <p className="text-sm text-foreground/90">
            נמצאו <span className="num font-medium">{formatCount(sample)}</span>{" "}
            {sample === 1 ? "מודעה" : "מודעות"} ל{what}, ודרושות לפחות{" "}
            <span className="num font-medium">{MIN_SAMPLE}</span>. מספר שנגזר ממדגם קטן
            מזה אינו מדד אלא ניחוש, ולכן לא נציג אותו.
          </p>
          <p className="text-sm text-muted-foreground">
            אפשר לבחור פחות מאפיינים — למשל בלי קילומטראז&apos; או בלי שכונה — ולקבל
            השוואה רחבה יותר.
          </p>
          {publishHref ? (
            <Button asChild variant="outline" size="sm" className="mt-1">
              <Link href={publishHref}>פרסם מודעה ותראה מה מציעים עליה</Link>
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * תוצאת ההערכה: טווח, התפלגות, גודל מדגם, ומה בדיוק הושווה.
 *
 * ההצגה של הקריטריונים אינה קישוט. משתמש שרואה טווח בלי לדעת מול מה
 * הוא נמדד אינו יכול לדעת אם הוא רלוונטי לו, ומשתמש שלא יודע שוויתרנו
 * על הקילומטראז' שלו יקרא את התוצאה כמדויקת יותר משהיא.
 */
export function ValuationResult({
  summary,
  criteria,
  dropped,
  title,
  currency = "ILS",
  perSqm,
  children,
}: {
  summary: PriceSummary;
  criteria: Criterion[];
  dropped: string[];
  title: string;
  currency?: string;
  perSqm?: { value: number; sample: number } | null;
  children?: React.ReactNode;
}) {
  return (
    <section aria-labelledby="valuation-result" className="space-y-5">
      <div className="rounded-lg border border-border bg-card p-5">
        <h2 id="valuation-result" className="text-sm text-muted-foreground">
          {title}
        </h2>

        <PriceRange p25={summary.p25} p75={summary.p75} className="mt-1" />

        <p className="mt-1.5 text-sm text-muted-foreground">
          מחצית מהמודעות המשוות יושבות בטווח הזה. החציון עומד על{" "}
          <span className="num font-medium text-foreground">
            {formatPrice(summary.median, { currency })}
          </span>
          .
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">מודעות בהשוואה</dt>
            <dd className="num text-base font-semibold">{formatCount(summary.sample)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">הזול ביותר</dt>
            <dd className="num text-base font-semibold">
              {formatPrice(summary.min, { currency })}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">היקר ביותר</dt>
            <dd className="num text-base font-semibold">
              {formatPrice(summary.max, { currency })}
            </dd>
          </div>
          {perSqm ? (
            <div>
              <dt className="text-xs text-muted-foreground">
                חציון למ&quot;ר{" "}
                <span className="num">({formatNumber(perSqm.sample)} מודעות)</span>
              </dt>
              <dd className="num text-base font-semibold">
                {formatPrice(perSqm.value, { currency })}
              </dd>
            </div>
          ) : null}
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-card p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <TrendingUp className="size-4 text-muted-foreground" aria-hidden />
          התפלגות המחירים
        </h3>
        <PriceHistogram buckets={summary.buckets} median={summary.median} currency={currency} />
      </div>

      <div className="rounded-lg border border-border bg-muted/30 p-5">
        <h3 className="text-sm font-bold">מה הושווה</h3>
        <ul className="mt-2.5 flex flex-wrap gap-2">
          {criteria.map((c) => (
            <li key={`${c.label}-${c.value}`}>
              <CriterionChip criterion={c} />
            </li>
          ))}
        </ul>
        {dropped.length ? (
          <p className="mt-3 text-xs text-muted-foreground">
            כדי להגיע ל-<span className="num">{MIN_SAMPLE}</span> מודעות לפחות, ההשוואה
            התעלמה מ: {dropped.join(", ")}.
          </p>
        ) : (
          <p className="mt-3 text-xs text-muted-foreground">
            כל המאפיינים שמסרת נכללו בהשוואה.
          </p>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          הנתונים מחושבים ממחירי המודעות הפעילות בלוח ברגע זה — מחיר מבוקש ולא מחיר
          עסקה שנסגרה.
        </p>
      </div>

      {children}
    </section>
  );
}
