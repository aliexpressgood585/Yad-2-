import type { Metadata } from "next";
import Link from "next/link";

import { PriceGauge } from "@/components/listing/price-gauge";
import { auth } from "@/lib/auth";
import { activeMembership, inventoryScope } from "@/lib/business";
import { inventoryRows, inventorySummary } from "@/lib/business-metrics";
import { formatCount, formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "ביצועי המלאי",
  robots: { index: false, follow: false },
};

const SORTS = [
  { key: "performance", label: "מה עובד" },
  { key: "stale", label: "מה תקוע" },
  { key: "recent", label: "לפי תאריך" },
] as const;

type Props = { searchParams: Promise<{ sort?: string }> };

/**
 * דשבורד הסוחר.
 *
 * שלושה מספרים בראש ושורות מלאי מתחתיהם. מה שאין כאן הוא בכוונה: אין
 * גרף צפיות יומי, אין פילוח לפי מכשיר ואין "אחוז עלייה מהחודש שעבר"
 * על כל שורה. לסוחר יש כבר מערכת שיודעת מה יש לו במלאי; מה שאין לו
 * הוא **איפה המחיר שלו יושב ביחס למה שהקונה משווה אליו** — וזו בדיוק
 * הסקאלה שהקונה רואה, באותה צורה בדיוק.
 */
export default async function BusinessDashboard({ searchParams }: Props) {
  const { sort } = await searchParams;
  const active = SORTS.find((s) => s.key === sort) ?? SORTS[0];

  const session = await auth();
  const membership = (await activeMembership(session!.user.id))!;
  const scope = inventoryScope(membership, session!.user.id);

  const [summary, rows] = await Promise.all([
    inventorySummary(scope),
    inventoryRows(scope, { sort: active.key }),
  ]);

  const conversion = summary.views > 0 ? (summary.contacts / summary.views) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* --- שלושת המספרים --- */}
      <dl className="grid gap-px border border-border bg-border sm:grid-cols-3">
        <div className="bg-card p-4">
          <dt className="text-xs text-muted-foreground">מלאי פעיל</dt>
          <dd className="num mt-1 font-heading text-2xl">{formatCount(summary.active)}</dd>
          <p className="mt-1 text-xs text-muted-foreground">
            גיל חציוני <span className="num">{summary.medianAgeDays}</span> ימים
            {summary.drafts > 0 ? (
              <>
                {" · "}
                <span className="num">{formatCount(summary.drafts)}</span> טיוטות
              </>
            ) : null}
          </p>
        </div>

        <div className="bg-card p-4">
          <dt className="text-xs text-muted-foreground">פניות ב-30 יום</dt>
          <dd className="num mt-1 font-heading text-2xl text-primary">
            {formatCount(summary.contacts + summary.reveals)}
          </dd>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="num">{formatCount(summary.reveals)}</span> חשיפות טלפון ·{" "}
            <span className="num">{formatCount(summary.contacts)}</span> הודעות
          </p>
        </div>

        <div className="bg-card p-4">
          <dt className="text-xs text-muted-foreground">מודעות בלי פנייה אחת</dt>
          <dd
            className={cn(
              "num mt-1 font-heading text-2xl",
              summary.silent > summary.active / 2 ? "text-accent" : "",
            )}
          >
            {formatCount(summary.silent)}
          </dd>
          <p className="mt-1 text-xs text-muted-foreground">
            מתוך <span className="num">{formatCount(summary.active)}</span> פעילות · יחס
            המרה <span className="num">{conversion.toFixed(1)}%</span>
          </p>
        </div>
      </dl>

      {/* --- מיון --- */}
      <nav aria-label="מיון המלאי" className="flex border border-border">
        {SORTS.map((s) => (
          <Link
            key={s.key}
            href={`/my/business?sort=${s.key}`}
            aria-current={s.key === active.key ? "page" : undefined}
            className={cn(
              "px-3 py-1.5 text-sm transition-colors",
              s.key === active.key
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {s.label}
          </Link>
        ))}
      </nav>

      {/* --- שורות המלאי --- */}
      {rows.length === 0 ? (
        <p className="border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          אין מודעות במלאי. אפשר לפרסם אחת-אחת או להעלות קובץ מרוכז.
        </p>
      ) : (
        <ul className="flex flex-col gap-px bg-border">
          {rows.map((row) => (
            <li key={row.id} className="bg-card p-3.5">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="min-w-0 flex-1 truncate text-sm font-semibold">
                  <Link href={`/item/${row.slug}`} className="hover:text-primary">
                    {row.title}
                  </Link>
                  {row.status === "DRAFT" ? (
                    <span className="ms-2 border border-border px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                      טיוטה
                    </span>
                  ) : null}
                </h2>
                <p className="num shrink-0 text-base font-medium">
                  {formatPrice(row.price)}
                </p>
              </div>

              <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
                <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                  <div className="flex gap-1.5">
                    <dt>צפיות</dt>
                    <dd className="num text-foreground">{formatCount(row.views)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>חשיפות טלפון</dt>
                    <dd className="num text-foreground">{formatCount(row.reveals)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>הודעות</dt>
                    <dd className="num text-foreground">{formatCount(row.contacts)}</dd>
                  </div>
                  <div className="flex gap-1.5">
                    <dt>באוויר</dt>
                    <dd className="num text-foreground">{row.ageDays} ימים</dd>
                  </div>
                </dl>

                {/*
                 * אותה סקאלה שהקונה רואה בשורת התוצאה. זה הנתון היחיד
                 * כאן שהסוחר לא יכול להפיק מהמערכת שלו, ומתחת לשמונה
                 * מודעות דומות אין אותו — כמו בכל מקום אחר באתר.
                 */}
                <div className="w-full max-w-[13rem]">
                  <PriceGauge meter={row.meter} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
