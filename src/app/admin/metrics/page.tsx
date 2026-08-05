import type { Metadata } from "next";

import { formatNumber } from "@/lib/format";
import { funnelFor, northStarTrend, startOfUtcDay } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "מדידה" };
export const dynamic = "force-dynamic";

/** טווחי הזמן שאפשר לבחור, בימים. */
const RANGES = [7, 30, 90] as const;
const DEFAULT_RANGE = 30;

export default async function MetricsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days } = await searchParams;
  const span = RANGES.includes(Number(days) as (typeof RANGES)[number])
    ? Number(days)
    : DEFAULT_RANGE;

  const to = startOfUtcDay(new Date());
  const from = new Date(to);
  from.setUTCDate(from.getUTCDate() - (span - 1));

  const [funnel, trend] = await Promise.all([funnelFor(from, to), northStarTrend(from, to)]);

  const peak = Math.max(1, ...trend.map((d) => d.contacts));
  const total = trend.reduce((sum, d) => sum + d.contacts, 0);
  const perDay = trend.length ? total / trend.length : 0;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-xl font-bold">מדידה</h1>
          <p className="text-sm text-muted-foreground">
            {span} הימים האחרונים · מתעדכן בזמן אמת
          </p>
        </div>

        <nav aria-label="טווח זמן" className="flex items-center border border-border">
          {RANGES.map((r) => (
            <a
              key={r}
              href={`/admin/metrics?days=${r}`}
              aria-current={r === span ? "page" : undefined}
              className={cn(
                "px-3 py-1.5 text-sm transition-colors duration-ui ease-ui",
                r === span
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="num">{r}</span> ימים
            </a>
          ))}
        </nav>
      </header>

      {/* --- מדד הצפון --- */}
      <section aria-labelledby="north-star" className="border border-border bg-card">
        <div className="flex flex-wrap items-start justify-between gap-6 border-b border-border p-5">
          <div className="flex flex-col gap-1">
            <h2 id="north-star" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              מדד הצפון · פניות ראשונות
            </h2>
            <p className="font-heading text-3xl font-bold leading-none">
              <span className="num">{formatNumber(funnel.northStar)}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              <span className="num">{formatNumber(Math.round(perDay * 10) / 10)}</span> ליום בממוצע
            </p>
          </div>

          <div className="flex flex-col gap-1 text-end">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              שיעור מענה
            </h3>
            {funnel.replyRatePct === null ? (
              <p className="text-sm text-muted-foreground">אין עדיין פניות בהודעה</p>
            ) : (
              <>
                <p className="font-heading text-3xl font-bold leading-none text-info">
                  <span className="num">{funnel.replyRatePct}%</span>
                </p>
                <p className="text-sm text-muted-foreground">מהפניות בהודעה נענו</p>
              </>
            )}
          </div>
        </div>

        {/*
         * המגמה נמדדת מול השיא בטווח ולא מול אפס.
         * גרף שמותח את עצמו לגובה הקבוע היה מציג תנודה של שתי פניות
         * כאילו היא קפיצה — וזו בדיוק הקריאה השגויה שמדידה אמורה למנוע.
         */}
        <div className="p-5">
          {trend.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              אין עדיין נתונים בטווח הזה
            </p>
          ) : (
            <div className="flex h-28 items-end gap-px" role="img" aria-label={`מגמת פניות: ${total} בסך הכול`}>
              {trend.map((d) => (
                <div
                  key={d.day}
                  className="min-w-px flex-1 bg-primary/70 transition-colors hover:bg-primary"
                  style={{ height: `${Math.max(2, (d.contacts / peak) * 100)}%` }}
                  title={`${d.day} — ${d.contacts} פניות`}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* --- המשפך --- */}
      <section aria-labelledby="funnel" className="border border-border bg-card">
        <h2 id="funnel" className="border-b border-border p-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          משפך · סשנים ייחודיים
        </h2>

        <ul className="divide-y divide-border">
          {funnel.rows.map((row) => (
            <li key={row.step} className="flex flex-col gap-2 p-5">
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium">{row.label}</span>
                <span className="flex items-baseline gap-3">
                  {row.fromPrevPct !== null ? (
                    <span className="text-sm text-muted-foreground">
                      <span className="num">{row.fromPrevPct}%</span> מהשלב הקודם
                    </span>
                  ) : null}
                  <span className="num font-heading text-lg font-bold">
                    {formatNumber(row.sessions)}
                  </span>
                </span>
              </div>

              <div
                className="h-1.5 bg-secondary"
                role="img"
                aria-label={`${formatNumber(row.sessions)} סשנים`}
              >
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${Math.min(100, (row.sessions / Math.max(1, funnel.rows[0]?.sessions ?? 1)) * 100)}%`,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>

        <p className="border-t border-border p-5 text-xs leading-relaxed text-muted-foreground">
          חשיפת טלפון והודעה הן <strong className="font-semibold">חלופות ולא שלבים</strong> —
          קונה מתקשר או כותב, לא שניהם בזה אחר זה. שתיהן נמדדות מול הצפיות ולא זו מול זו,
          כי משפך שמציב אותן ברצף היה מציג נפילה שאינה קיימת. &quot;המוכר השיב&quot; הוא פעולה
          של המוכר ולכן אינו שלב במסע הקונה.
        </p>
      </section>
    </div>
  );
}
